<template>
  <div class="entity-stats">
    <div class="stats-controls">
      <div class="preset-row">
        <span class="control-label">{{ t('journal.period_label') }}</span>
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
          <span class="control-label">{{ t('journal.own_dates') }}</span>
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
          <span class="control-label">{{ t('journal.step_label') }}</span>
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
              <span v-if="entry.actor">{{ entry.actor.name }}</span>
              <span v-else class="muted">—</span>
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

const { t } = useI18n()

const { $api } = useNuxtApp()
const { actions: actionLabels } = useAuditLabelMaps()

// ---- период / шаг (как на странице журнала) ----
const granularities = [
  { label: t('journal.days'), value: 'day' },
  { label: t('journal.hours'), value: 'hour' },
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
  background: var(--info-bg);
  color: var(--info);
  border-color: var(--info-bg);
}

.chart-card--wide {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
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
  --dp-hover-color: var(--info-bg);
  --dp-hover-text-color: var(--text);
  --dp-hover-icon-color: var(--text);
  --dp-primary-color: var(--info);
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

.badge--success {
  background: var(--success-bg);
  color: var(--info);
  border-color: var(--accent);
}

.badge--restore {
  background: var(--info-bg);
  color: var(--info);
  border-color: var(--info-bg);
}

.badge--danger {
  background: var(--danger-bg);
  color: var(--danger-ink);
  border-color: var(--warn);
}

.badge--auth {
  background: var(--info-bg);
  color: var(--info);
  border-color: var(--info-bg);
}

.badge--op {
  background: var(--warn-bg);
  color: var(--danger-ink);
  border-color: var(--bg-elevated);
}

.badge--label {
  background: var(--info-bg);
  color: var(--info);
  border-color: var(--info-bg);
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