<template>
  <div class="entity-stats">
    <div class="stats-controls">
      <PeriodPicker
        v-model:range="dateRange"
        v-model:granularity="granularity"
        :granularity-options="granularities"
      />
    </div>

    <!--
      Остатки расходуемых свойств: что лежит сейчас и сколько ушло за период.
      Журнал ниже показывает каждое движение отдельной строкой, а суммы по
      свойствам не было нигде — вопрос «сколько масла списали за неделю»
      приходилось складывать вручную.
    -->
    <div v-if="props.entityType === 'item' && partialRows.length" class="partial-summary">
      <table class="partial-summary__table">
        <thead>
          <tr>
            <th>{{ t('balance.property') }}</th>
            <th>{{ t('balance.remainder') }}</th>
            <th>{{ t('journal.writeoff_word') }}</th>
            <th>{{ t('journal.replenish_word') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in partialRows" :key="row.property_id">
            <td :data-label="t('balance.property')">{{ row.title }}</td>
            <td :data-label="t('balance.remainder')">
              <template v-if="row.current !== null">
                {{ formatAmount(row.current) }} {{ row.unit }}
              </template>
              <span v-else class="muted">—</span>
            </td>
            <!-- Ноль выводим прочерком: «0 мл» в графе «Пополнено» выглядит
                 как ещё одно число, хотя за период ничего не приходило. -->
            <td :data-label="t('journal.writeoff_word')">
              <template v-if="row.writeoff">{{ formatAmount(row.writeoff) }} {{ row.unit }}</template>
              <span v-else class="muted">—</span>
            </td>
            <td :data-label="t('journal.replenish_word')">
              <template v-if="row.replenish">{{ formatAmount(row.replenish) }} {{ row.unit }}</template>
              <span v-else class="muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="statsLoading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="statsError" class="error">{{ statsError }}</div>

    <div v-else class="chart-card chart-card--wide">
      <div class="chart-head">
        <h4 class="chart-title">{{ t('journal.activity') }}</h4>
        <span v-if="activityTotal" class="stats-summary">{{ t('journal.total_for_period') }} <b>{{ activityTotal }}</b></span>
      </div>
      <p class="chart-subtitle">
        {{ t('journal.chart_x_hint') }}
      </p>
      <AuditActivityChart :points="actionPoints" :labels="actionLabels" />
    </div>

    <hr class="section-divider" />

    <div class="journal-table-head">
      <span class="total" v-if="meta.total">{{ t('journal.total_entries', { count: meta.total }) }}</span>
    </div>

    <div v-if="listLoading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="listError" class="error">{{ listError }}</div>

    <template v-else>
      <table v-if="entries.length" class="journal-table">
        <thead>
          <tr>
            <th>{{ t('journal.when') }}</th>
            <th>{{ t('journal.action') }}</th>
            <th>{{ t('journal.actor') }}</th>
            <th>{{ t('journal.details') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td :data-label="t('journal.when')">{{ formatDate(entry.created_at) }}</td>
            <td :data-label="t('journal.action')">
              <span class="action-badge" :class="actionBadgeClass(entry.action)">
                {{ actionLabel(entry.action) }}
              </span>
            </td>
            <td :data-label="t('journal.actor')">
              <UserLink :user="entry.actor" />
            </td>
            <td :data-label="t('journal.details')" class="details-cell">
              <span class="details-text">{{ summarize(entry) }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">{{ t('journal.empty') }}</div>

      <div v-if="meta.last_page > 1" class="pagination">
        <button
          :disabled="meta.current_page <= 1"
          type="button"
          class="page-btn"
          @click="goToPage(meta.current_page - 1)"
        >
          ← {{ t('common.back') }}
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="meta.current_page >= meta.last_page"
          type="button"
          class="page-btn"
          @click="goToPage(meta.current_page + 1)"
        >
          {{ t('common.forward') }} →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { defineAsyncComponent } from 'vue'
import { actionLabel, actionBadgeClass, formatDate, summarize, useAuditLabelMaps } from '~/utils/auditLabels'
import { todayRange } from '~/utils/periodPresets'
import type { AuditLogEntry, AuditLogStatsPoint, AuditLogPartialSummaryRow } from '~/repository/modules/auditLog'
import { formatAmount } from '~/utils/amount'

const props = defineProps<{
  entityType: string
  entityId: number
  /**
   * Остатки расходуемых свойств из карточки: `partial` предмета. Считать их
   * здесь заново означало бы второй расход на ту же карточку, а блок и так
   * показывается только у расходуемого предмета.
   */
  partial?: { property_id: number; total: number; unit_short?: string | null }[]
}>()

// Без immediate: остатки объявлены ниже, и вызов до их инициализации падал бы
// с «cannot access before initialization». Первое значение всё равно подставит
// onMounted.
watch(
  () => props.partial,
  (value) => setPartialRemainders(value),
  { deep: true },
)

const { t } = useI18n()

const { $api } = useNuxtApp()
const { actions: actionLabels } = useAuditLabelMaps()

// ---- период / шаг (как на странице журнала) ----
const granularities = [
  { label: t('journal.days'), value: 'day' },
  { label: t('journal.hours'), value: 'hour' },
]
const granularity = ref<'day' | 'hour'>('day')

// null — «всё время»: у PeriodPicker это заготовка без границ.
const dateRange = ref<[string, string] | null>(todayRange())

/** Период и шаг приходят из PeriodPicker: перезагрузка на их смену. */
watch([dateRange, granularity], () => reloadAll())

function rangeParams(): { date_from?: string; date_to?: string } {
  const r = dateRange.value
  if (!r || !r[0] || !r[1]) return {}
  return { date_from: new Date(r[0] + 'T00:00:00').toISOString(), date_to: new Date(r[1] + 'T23:59:59').toISOString() }
}

function requestBase() {
  return {
    entity_type: props.entityType,
    entity_id: props.entityId,
    granularity: granularity.value,
    tz_offset: new Date().getTimezoneOffset() * -1,
    ...rangeParams(),
  }
}

// ---- статистика ----
const statsLoading = ref(true)
const statsError = ref<string | null>(null)
const actionPoints = ref<AuditLogStatsPoint[]>([])

const activityTotal = computed(() => actionPoints.value.reduce((s, p) => s + p.count, 0))

async function loadStats() {
  statsLoading.value = true
  statsError.value = null
  try {
    actionPoints.value = await $api.auditLog.stats({
      group_by: 'day,action',
      ...requestBase(),
    })
  } catch (err: any) {
    statsError.value = err?.data?.error || err?.message || String(err)
  } finally {
    statsLoading.value = false
  }
}

// ---- остатки по расходуемым свойствам ----
/**
 * Остатки на сейчас — из данных предмета, расход за период — из журнала.
 *
 * Оба приходят разными запросами и по разным причинам: остаток считается из
 * количества и нормы (это не журнал, а само состояние), а суммы за период
 * существуют только в журнале. Склеиваются по property_id.
 */
const partialRemainders = ref<Record<number, { total: number; unit_short?: string | null }>>({})
const partialSummary = ref<AuditLogPartialSummaryRow[]>([])

const partialRows = computed(() =>
  partialSummary.value.map((row) => {
    const rest = partialRemainders.value[row.property_id] ?? null

    return {
      property_id: row.property_id,
      title: row.property_title ?? String(row.property_id),
      unit: row.unit_short ?? '',
      // Остаток есть не всегда: свойство могли списать раньше начала периода,
      // и тогда за период строк нет вовсе — а остаток как раз есть.
      current: rest ? rest.total : null,
      writeoff: row.writeoff,
      replenish: row.replenish,
    }
  })
)

/** Остатки предмета кладёт страница карточки: считать их второй раз незачем. */
function setPartialRemainders(value: unknown): void {
  const list = (value ?? []) as { property_id: number; total: number; unit_short?: string | null }[]
  const map: Record<number, { total: number; unit_short?: string | null }> = {}
  for (const row of list) {
    map[row.property_id] = { total: row.total, unit_short: row.unit_short }
  }
  partialRemainders.value = map
}

async function loadPartialSummary() {
  try {
    partialSummary.value = await $api.auditLog.partialSummary({
      entity_type: props.entityType,
      entity_id: props.entityId,
      ...rangeParams(),
    })
  } catch {
    // Блок остатков — дополнение к журналу, а не основа: его отсутствие не
    // должно оставлять страницу пустой, молчание здесь честнее ошибки.
    partialSummary.value = []
  }
}

// ---- записи ----
const entries = ref<AuditLogEntry[]>([])
const listLoading = ref(true)
const listError = ref<string | null>(null)
const page = ref(1)
const meta = ref<{ current_page: number; last_page: number; total: number }>({
  current_page: 0,
  last_page: 0,
  total: 0,
})

async function loadList() {
  listLoading.value = true
  listError.value = null
  try {
    const result = await $api.auditLog.list({
      page: page.value,
      entity_type: props.entityType,
      entity_id: props.entityId,
      ...rangeParams(),
    })
    entries.value = result.data
    meta.value = {
      current_page: result.meta.current_page,
      last_page: result.meta.last_page,
      total: result.meta.total,
    }
  } catch (err: any) {
    listError.value = err?.data?.error || err?.message || String(err)
  } finally {
    listLoading.value = false
  }
}

function reloadAll() {
  page.value = 1
  loadStats()
  loadList()
  loadPartialSummary()
}

function goToPage(next: number) {
  page.value = next
  loadList()
}

onMounted(() => {
  setPartialRemainders(props.partial)
  loadStats()
  loadList()
  loadPartialSummary()
})

watch(
  () => [props.entityType, props.entityId],
  () => {
    granularity.value = 'day'
    reloadAll()
  },
)
</script>

<style scoped>
.entity-stats {
  display: flex;
  flex-direction: column;
}

.stats-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.preset-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-group {
  gap: 8px;
}

.control-label {
  font-size: 13px;
  color: var(--text-dim);
}

.ctl-btn {
  padding: 5px 12px;
  font-size: 13px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.ctl-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.ctl-btn.active {
  background: var(--accent-bg);
  color: var(--link);
  border-color: var(--accent);
}

.chart-card--wide {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
}

/*
 * Сводка остатков по свойствам. Карточка-обводка, как у графика, но без
 * заголовка внутри: столбцы таблицы говорят сами за себя, а лишний заголовок
 * «Остатки» над «Активность и действия» читался бы как часть графика.
 */
.partial-summary {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px 12px;
  margin-bottom: 14px;
}

.partial-summary__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.partial-summary__table th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 0 0 6px;
  white-space: nowrap;
}

.partial-summary__table td {
  padding: 5px 0;
  border-top: 1px solid var(--border);
  color: var(--text-secondary);
  white-space: nowrap;
}

.partial-summary__table th + th,
.partial-summary__table td + td {
  padding-left: 18px;
}

@media (max-width: 768px) {
  /* На телефоне таблица остатков перестаёт быть таблицей: четыре столбца с
   * числами не помещаются, и подпись уезжает на отдельную строку. */
  .partial-summary__table thead {
    display: none;
  }

  .partial-summary__table,
  .partial-summary__table tbody,
  .partial-summary__table tr,
  .partial-summary__table td {
    display: block;
    width: 100%;
  }

  .partial-summary__table tr {
    margin-bottom: 8px;
  }

  .partial-summary__table td {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    border-top: none;
    padding: 2px 0;
  }

  .partial-summary__table td::before {
    content: attr(data-label);
    color: var(--text-muted);
    font-size: 13px;
  }

  .partial-summary__table td + td {
    padding-left: 0;
  }
}

.chart-title {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.chart-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.stats-summary {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.stats-summary b {
  color: var(--info);
  font-size: 15px;
}

.chart-subtitle {
  margin: -6px 0 12px;
  font-size: 12px;
  color: var(--text-faint);
  line-height: 1.5;
}


.section-divider {
  border: none;
  height: 1px;
  margin: 24px 0 14px;
  background: var(--bg-hover);
}

.journal-table-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 10px;
}

.total {
  font-size: 13px;
  color: var(--text-dim);
}

.loading,
.error,
.empty {
  padding: 20px;
  color: var(--text-muted);
}

.error {
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 4px;
}

.journal-table {
  width: 100%;
  border-collapse: collapse;
}

.journal-table th,
.journal-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  vertical-align: top;
}

.journal-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.journal-table td {
  color: var(--text-secondary);
}

.journal-table tr:hover td {
  background: var(--bg-elevated);
}

.action-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
}

/*
 * Бейджи идут по общему правилу: цветная заливка, текст того же цвета в
 * тёмном варианте (ink), рамка — сам цвет. Раньше сочетания были случайными:
 * зелёная заливка с синим текстом и синей рамкой, синяя заливка с рамкой в
 * цвет заливки (рамки не видно), оранжевая заливка с красным текстом. Рядом
 * друг с другом это читалось как ошибка вёрстки, а не как обозначение.
 */
.badge--success {
  background: var(--success-bg);
  color: var(--success-ink);
  border-color: var(--success);
}

.badge--restore {
  background: var(--info-bg);
  color: var(--info-ink);
  border-color: var(--info);
}

.badge--danger {
  background: var(--danger-bg);
  color: var(--danger-ink);
  border-color: var(--danger);
}

.badge--auth {
  background: var(--info-bg);
  color: var(--info-ink);
  border-color: var(--info);
}

.badge--op {
  background: var(--warn-bg);
  color: var(--warn-ink);
  border-color: var(--warn);
}

.badge--label {
  background: var(--note-bg);
  color: var(--note-ink);
  border-color: var(--note);
}

.muted {
  color: var(--text-faint);
}

.details-cell .details-text {
  color: var(--text-muted);
  font-size: 13px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.page-btn {
  padding: 6px 14px;
  font-size: 13px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-hover) 70%, var(--text));
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .journal-table,
  .journal-table tbody,
  .journal-table tr,
  .journal-table td {
    display: block;
  }

  .journal-table thead {
    display: none;
  }

  .journal-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .journal-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
    font-size: 15px;
    white-space: normal;
  }

  .journal-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .journal-table tr:hover td {
    background: transparent;
  }
}
</style>