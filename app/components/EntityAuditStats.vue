<template>
  <div class="entity-stats">
    <div class="stats-controls">
      <div class="preset-row">
        <span class="control-label">Период:</span>
        <button
          v-for="preset in periodPresets"
          :key="preset.label"
          type="button"
          class="ctl-btn"
          :class="{ active: activePreset(preset) }"
          @click="setRange(preset.range())"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="preset-row">
        <div class="control-group date-group">
          <span class="control-label">Свои даты:</span>
          <ClientOnly>
            <VueDatepicker
              v-model="dateRange"
              range
              :format="'dd.MM.yyyy'"
              value-format="yyyy-MM-dd"
              :enable-time-picker="false"
              :clearable="false"
              auto-apply
              @closed="applyDateRange"
            />
          </ClientOnly>
        </div>

        <div class="control-group">
          <span class="control-label">Шаг:</span>
          <button
            v-for="g in granularities"
            :key="g.value"
            type="button"
            class="ctl-btn"
            :class="{ active: granularity === g.value }"
            @click="setGranularity(g.value)"
          >
            {{ g.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="statsLoading" class="loading">Загрузка статистики...</div>
    <div v-else-if="statsError" class="error">{{ statsError }}</div>

    <div v-else class="chart-card chart-card--wide">
      <div class="chart-head">
        <h4 class="chart-title">Активность и действия</h4>
        <span v-if="activityTotal" class="stats-summary">Всего за период: <b>{{ activityTotal }}</b></span>
      </div>
      <p class="chart-subtitle">
        Ось X — дата, ось Y — число событий. Цвет сегмента — действие (пополнение, списание,
        изменение и т.д.); высота столбца — общая активность, белая линия — итог за день/час.
      </p>
      <AuditActivityChart :points="actionPoints" :labels="ACTION_LABELS" />
    </div>

    <hr class="section-divider" />

    <div class="journal-table-head">
      <span class="total" v-if="meta.total">Всего записей: {{ meta.total }}</span>
    </div>

    <div v-if="listLoading" class="loading">Загрузка записей...</div>
    <div v-else-if="listError" class="error">{{ listError }}</div>

    <template v-else>
      <table v-if="entries.length" class="journal-table">
        <thead>
          <tr>
            <th>Когда</th>
            <th>Действие</th>
            <th>Кто</th>
            <th>Детали</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td data-label="Когда">{{ formatDate(entry.created_at) }}</td>
            <td data-label="Действие">
              <span class="action-badge" :class="actionBadgeClass(entry.action)">
                {{ actionLabel(entry.action) }}
              </span>
            </td>
            <td data-label="Кто">
              <span v-if="entry.actor">{{ entry.actor.name }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td data-label="Детали" class="details-cell">
              <span class="details-text">{{ summarize(entry) }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Записей не найдено</div>

      <div v-if="meta.last_page > 1" class="pagination">
        <button
          :disabled="meta.current_page <= 1"
          type="button"
          class="page-btn"
          @click="goToPage(meta.current_page - 1)"
        >
          ← Назад
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="meta.current_page >= meta.last_page"
          type="button"
          class="page-btn"
          @click="goToPage(meta.current_page + 1)"
        >
          Вперёд →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { defineAsyncComponent } from 'vue'
import { actionLabel, actionBadgeClass, formatDate, summarize, ACTION_LABELS } from '~/utils/auditLabels'
import {
  isoLocal,
  todayRange,
  type PeriodPreset,
  defaultPeriodPresets,
} from '~/utils/periodPresets'
import type { AuditLogEntry, AuditLogStatsPoint } from '~/repository/modules/auditLog'
import '@vuepic/vue-datepicker/dist/main.css'

const VueDatepicker = defineAsyncComponent(() =>
  import('@vuepic/vue-datepicker').then((m) => m.default),
)

const props = defineProps<{
  entityType: string
  entityId: number
}>()

const { $api } = useNuxtApp()

// ---- период / шаг (как на странице журнала) ----
const granularities = [
  { label: 'дни', value: 'day' },
  { label: 'часы', value: 'hour' },
]
const granularity = ref<'day' | 'hour'>('day')

const dateRange = ref<[string, string] | null>(todayRange())
const periodPresets: PeriodPreset[] = defaultPeriodPresets()

const hasRange = computed(() => {
  const r = dateRange.value
  return !!(r && typeof r[0] === 'string' && typeof r[1] === 'string')
})

function toISO(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.slice(0, 10)
  if (v instanceof Date && !Number.isNaN(v.getTime())) return isoLocal(v)
  return null
}

function applyDateRange() {
  const r = dateRange.value
  const from = r ? toISO(r[0]) : null
  const to = r ? toISO(r[1] ?? r[0]) : null
  dateRange.value = from && to ? [from, to] : null
  reloadAll()
}

function setRange(r: [string, string] | null) {
  dateRange.value = r
  reloadAll()
}

function activePreset(preset: PeriodPreset): boolean {
  const r = preset.range()
  if (r === null) return !hasRange.value
  const cur = dateRange.value
  return !!(cur && cur[0] === r[0] && cur[1] === r[1])
}

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
}

function setGranularity(value: 'day' | 'hour') {
  granularity.value = value
  loadStats()
}

function goToPage(next: number) {
  page.value = next
  loadList()
}

onMounted(() => {
  loadStats()
  loadList()
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
  color: #777;
}

.ctl-btn {
  padding: 5px 12px;
  font-size: 13px;
  background: #2a2a2a;
  color: #aaa;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.ctl-btn:hover {
  background: #333;
  color: #ddd;
}

.ctl-btn.active {
  background: #2a2a3a;
  color: #aaf;
  border-color: #3a3a5a;
}

.chart-card--wide {
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  padding: 14px;
}

.chart-title {
  margin: 0;
  font-size: 14px;
  color: #999;
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
  color: #888;
  white-space: nowrap;
}

.stats-summary b {
  color: #9dd;
  font-size: 15px;
}

.chart-subtitle {
  margin: -6px 0 12px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

/* --- датапикер в тёмной теме --- */
.date-group :deep(.dp__input) {
  --dp-input-padding: 4px 10px 4px 42px;
  height: 30px;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.date-group :deep(.dp__input:hover) {
  border-color: #5a5a5a;
}

.date-group :deep(.dp__input_icon) {
  color: #777;
}

.date-group :deep(.dp__theme_light) {
  --dp-background-color: #1e1e1e;
  --dp-text-color: #ddd;
  --dp-hover-color: #2a2a3a;
  --dp-hover-text-color: #fff;
  --dp-hover-icon-color: #ddd;
  --dp-primary-color: #5a5a8a;
  --dp-primary-text-color: #fff;
  --dp-secondary-color: #3a3a3a;
  --dp-border-color: #3a3a3a;
  --dp-menu-border-color: #3a3a3a;
  --dp-border-color-hover: #5a5a5a;
  --dp-disabled-color: #4a4a4a;
  --dp-disabled-border-color: #3a3a3a;
  --dp-scroll-bar-background: #2a2a2a;
  --dp-scroll-bar-color: #5a5a5a;
  --dp-success-color: #5a8a5a;
  --dp-success-border-color: #5a8a5a;
  --dp-tooltip-color: #ddd;
  --dp-action-row-color: #8a8a8a;
  --dp-icon-color: #8a8a8a;
}

.section-divider {
  border: none;
  height: 1px;
  margin: 24px 0 14px;
  background: #333;
}

.journal-table-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 10px;
}

.total {
  font-size: 13px;
  color: #777;
}

.loading,
.error,
.empty {
  padding: 20px;
  color: #888;
}

.error {
  color: #f88;
  background: #3a1a1a;
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
  border-bottom: 1px solid #333;
  font-size: 14px;
  vertical-align: top;
}

.journal-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.journal-table td {
  color: #ccc;
}

.journal-table tr:hover td {
  background: #252525;
}

.action-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
  background: #2a2a2a;
  color: #bbb;
  border: 1px solid #444;
}

.badge--success {
  background: #1d2f1d;
  color: #9cc;
  border-color: #2f4f2f;
}

.badge--danger {
  background: #331a1a;
  color: #f9a;
  border-color: #553;
}

.badge--auth {
  background: #2a2a3a;
  color: #aaf;
  border-color: #3a3a5a;
}

.badge--op {
  background: #2f2a1d;
  color: #dcc;
  border-color: #554;
}

.badge--label {
  background: #1d2a33;
  color: #9cc;
  border-color: #2f4f60;
}

.muted {
  color: #666;
}

.details-cell .details-text {
  color: #999;
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
  background: #333;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: #444;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: #888;
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
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .journal-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .journal-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .journal-table tr:hover td {
    background: transparent;
  }
}
</style>