<template>
  <div class="journal-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('journal.title') }}</h3>
    </div>

    <div class="journal-controls">
      <!--
        Период и свои даты — общий компонент, тот же, что в статистике
        предмета и в графике остатков. Блок «Шаг» есть только там, где он
        влияет на подписи: на вкладке записей он был бы пустой кнопкой.
      -->
      <PeriodPicker
        v-model:range="dateRange"
        v-model:granularity="granularity"
        :granularity-options="activeTab === 'analytics' ? granularities : []"
      />

      <div class="preset-row">
        <div class="control-group">
          <span class="control-label">{{ t('journal.object_label') }}</span>
          <select v-model="entityFilter" class="ctl-select" @change="applyFilters">
            <option value="">{{ t('journal.all_objects') }}</option>
            <option v-for="et in entityOptions" :key="et.value" :value="et.value">
              {{ et.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <TabBar :tabs="tabDefs" />

    <template v-if="activeTab === 'analytics'">
      <div v-if="statsLoading" class="loading">{{ t('common.loading') }}</div>
      <div v-else-if="statsError" class="error">{{ statsError }}</div>

      <div v-else class="charts-grid">
      <section class="chart-card chart-card--wide">
        <div class="chart-head">
          <h4 class="chart-title">{{ t('journal.activity') }}</h4>
          <span v-if="activityTotal" class="stats-summary">{{ t('journal.total_for_period') }}<b>{{ activityTotal }}</b></span>
        </div>
        <p class="chart-subtitle">{{ t('journal.chart_x_hint') }}</p>
        <AuditActivityChart :points="actionSeries" :labels="actionLabels" />
      </section>

      <section class="chart-card chart-card--wide">
        <h4 class="chart-title">{{ t('journal.activity_by_object') }}</h4>
        <p class="chart-subtitle">{{ t('journal.chart_entities_hint') }}</p>
        <AuditActivityChart :points="entitySeries" :labels="entityLabels" />
      </section>
      </div>
    </template>

    <template v-else>
      <div class="journal-table-head">
        <span class="total" v-if="meta.total">{{ t('journal.total_entries', { count: meta.total }) }}</span>
      </div>

      <div v-if="listLoading" class="loading">{{ t('common.loading') }}</div>
      <div v-else-if="listError" class="error">{{ listError }}</div>

      <template v-else>
      <table class="journal-table" v-if="entries.length">
        <thead>
          <tr>
            <th>{{ t('journal.when') }}</th>
            <th>{{ t('journal.action') }}</th>
            <th>{{ t('journal.object') }}</th>
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
            <td :data-label="t('journal.object')">
              <template v-if="entry.entity_type">
                {{ entityLabel(entry.entity_type) }}
                <span class="entity-id" v-if="entry.entity_id">#{{ entry.entity_id }}</span>
              </template>
              <span v-else class="muted">—</span>
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

      <div class="pagination" v-if="meta.last_page > 1">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          @click="goToPage((meta.current_page || 1) - 1)"
          class="page-btn"
        >
          ← {{ t('common.back') }}
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          @click="goToPage((meta.current_page || 1) + 1)"
          class="page-btn"
        >
          {{ t('common.forward') }} →
        </button>
      </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { defineAsyncComponent } from 'vue'
import {
  actionLabel,
  entityLabel,
  actionBadgeClass,
  formatDate,
  summarize,
  useAuditLabelMaps,
} from '~/utils/auditLabels'
import { todayRange } from '~/utils/periodPresets'
import type { AuditLogEntry, AuditLogStatsPoint } from '~/repository/modules/auditLog'

const { $api } = useNuxtApp()
const { t } = useI18n()
const { actions: actionLabels, entities: entityLabels } = useAuditLabelMaps()
const route = useRoute()
const router = useRouter()

// ---- табы ----
const tabDefs = computed(() => [
  { key: 'analytics', label: t('journal.analytics') },
  { key: 'journal', label: t('form.journal_tab') },
])

const activeTab = computed(() => {
  const q = route.query.tab
  return typeof q === 'string' && tabDefs.value.some((tab) => tab.key === q) ? q : tabDefs.value[0]?.key ?? 'analytics'
})

// ---- объекты (фильтр) ----
// computed, а не обычный объект: язык приезжает из настроек после монтирования,
// и собранный при setup список остался бы русским.
const ENTITY_FILTER_OPTIONS = computed<Record<string, string>>(() => ({
  item: t('access_sections.items'),
  store: t('access_sections.stores'),
  warehouse: t('access_sections.warehouses'),
  label_preset: t('access_sections.label_presets'),
  label_list: t('access_sections.label_lists'),
  category: t('nav.categories'),
  property: t('nav.property_list'),
  property_group: t('nav.property_groups'),
  dictionary: t('nav.dictionaries'),
  dictionary_value: t('properties.dictionary_values'),
  unit: t('properties.units_list'),
  vendor: t('nav.vendors'),
  access_grant: t('nav.access'),
  user: t('access_sections.users'),
}))

const entityOptions = computed(() => Object.entries(ENTITY_FILTER_OPTIONS.value).map(([value, label]) => ({ value, label })))
const entityFilter = ref<string>('')

// ---- шаг ----
const granularities = computed<{ label: string; value: string }[]>(() => [
  { label: t('journal.days'), value: 'day' },
  { label: t('journal.hours'), value: 'hour' },
])
const granularity = ref<'day' | 'hour'>('day')

// ---- период ----
// null — «всё время»: у PeriodPicker это и есть заготовка без границ.
const dateRange = ref<[string, string] | null>(todayRange())

/** Период и шаг приходят из PeriodPicker: перезагрузка на их смену. */
watch([dateRange, granularity], () => reloadAll())

function rangeParams(): { date_from?: string; date_to?: string } {
  const r = dateRange.value
  if (!r || !r[0] || !r[1]) return {}
  return { date_from: new Date(r[0] + 'T00:00:00').toISOString(), date_to: new Date(r[1] + 'T23:59:59').toISOString() }
}

// ---- статистика ----
const statsLoading = ref(true)
const statsError = ref<string | null>(null)
const actionSeries = ref<AuditLogStatsPoint[]>([])
const entitySeries = ref<AuditLogStatsPoint[]>([])

const activityTotal = computed(() => actionSeries.value.reduce((s, p) => s + p.count, 0))

function statsParams() {
  return {
    granularity: granularity.value,
    entity_type: entityFilter.value || undefined,
    tz_offset: new Date().getTimezoneOffset() * -1,
    ...rangeParams(),
  }
}

async function loadStats() {
  statsLoading.value = true
  statsError.value = null
  try {
    const [actions, entities] = await Promise.all([
      $api.auditLog.stats({ group_by: 'day,action', ...statsParams() }),
      $api.auditLog.stats({ group_by: 'day,entity', ...statsParams() }),
    ])
    actionSeries.value = actions
    entitySeries.value = entities
  } catch (err: any) {
    statsError.value = err?.data?.error || err?.message || String(err)
  } finally {
    statsLoading.value = false
  }
}

// ---- записи ----
const entries = ref<AuditLogEntry[]>([])
const listLoading = ref(true)
const listError = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number; total: number }>({
  current_page: 0,
  last_page: 0,
  total: 0,
})

async function loadList() {
  listLoading.value = true
  listError.value = null
  const page = Number(route.query.page) || 1
  try {
    const result = await $api.auditLog.list({
      page,
      entity_type: entityFilter.value || undefined,
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
  router.push({ query: { ...route.query, page: undefined } })
  loadActive()
}

function loadActive() {
  if (activeTab.value === 'analytics') loadStats()
  else loadList()
}



function applyFilters() {
  reloadAll()
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

onMounted(() => {
  loadActive()
})

watch(() => route.query.page, () => loadList())
watch(activeTab, () => loadActive())
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.tabbar {
  margin-bottom: 16px;
}

.journal-controls {
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

.ctl-select {
  padding: 5px 10px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.chart-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  min-height: 180px;
}

.chart-card--wide {
  grid-column: 1 / -1;
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

/* --- датапикер в тёмной теме --- */
.date-group :deep(.dp__input) {
  --dp-input-padding: 4px 10px 4px 42px;
  height: 30px;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.date-group :deep(.dp__input:hover) {
  border-color: var(--border-strong);
}

.date-group :deep(.dp__input_icon) {
  color: var(--text-dim);
}

.date-group :deep(.dp__theme_light) {
  --dp-background-color: var(--bg);
  --dp-text-color: var(--text);
  --dp-hover-color: var(--accent-bg);
  --dp-hover-text-color: var(--text);
  --dp-hover-icon-color: var(--text);
  --dp-primary-color: var(--accent);
  --dp-primary-text-color: var(--text);
  --dp-secondary-color: var(--border);
  --dp-border-color: var(--border);
  --dp-menu-border-color: var(--bg-hover);
  --dp-border-color-hover: var(--border-strong);
  --dp-disabled-color: var(--border-strong);
  --dp-disabled-border-color: var(--border);
  --dp-scroll-bar-background: var(--bg-elevated);
  --dp-scroll-bar-color: var(--border-strong);
  --dp-success-color: var(--success);
  --dp-success-border-color: var(--success);
  --dp-tooltip-color: var(--border-strong);
  --dp-action-row-color: var(--border-strong);
  --dp-icon-color: var(--border-strong);
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

.entity-id {
  color: var(--text-faint);
  font-size: 12px;
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

@media (max-width: 900px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
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