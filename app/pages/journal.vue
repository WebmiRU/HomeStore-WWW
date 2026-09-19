<template>
  <div class="journal-page">
    <div class="page-header">
      <h3 class="page-title">Журнал действий</h3>
    </div>

    <div class="journal-controls">
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

        <div class="control-group">
          <span class="control-label">Объект:</span>
          <select v-model="entityFilter" class="ctl-select" @change="applyFilters">
            <option value="">Все объекты</option>
            <option v-for="et in entityOptions" :key="et.value" :value="et.value">
              {{ et.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="statsLoading" class="loading">Загрузка статистики...</div>
    <div v-else-if="statsError" class="error">{{ statsError }}</div>

    <div v-else class="charts-grid">
      <section class="chart-card chart-card--wide">
        <div class="chart-head">
          <h4 class="chart-title">Активность и действия</h4>
          <span v-if="activityTotal" class="stats-summary">Всего за период: <b>{{ activityTotal }}</b></span>
        </div>
        <p class="chart-subtitle">
          Ось X — дата, ось Y — число событий. Цвет сегмента — действие (пополнение, списание,
          создание и т.д.); высота столбца — общая активность, белая линия — итог за день/час.
        </p>
        <AuditActivityChart :points="actionSeries" :labels="ACTION_LABELS" />
      </section>

      <section class="chart-card chart-card--wide">
        <h4 class="chart-title">Активность по объектам</h4>
        <p class="chart-subtitle">
          Те же события по типу затронутого объекта: предметы, хранилища, склады, этикетки и т.д.
        </p>
        <AuditActivityChart :points="entitySeries" :labels="ENTITY_LABELS" />
      </section>
    </div>

    <hr class="section-divider" />

    <div class="journal-table-head">
      <h3 class="page-title">Записи</h3>
      <span class="total" v-if="meta.total">Всего: {{ meta.total }}</span>
    </div>

    <div v-if="listLoading" class="loading">Загрузка записей...</div>
    <div v-else-if="listError" class="error">{{ listError }}</div>

    <template v-else>
      <table class="journal-table" v-if="entries.length">
        <thead>
          <tr>
            <th>Когда</th>
            <th>Действие</th>
            <th>Объект</th>
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
            <td data-label="Объект">
              <template v-if="entry.entity_type">
                {{ entityLabel(entry.entity_type) }}
                <span class="entity-id" v-if="entry.entity_id">#{{ entry.entity_id }}</span>
              </template>
              <span v-else class="muted">—</span>
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

      <div class="pagination" v-if="meta.last_page > 1">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          @click="goToPage((meta.current_page || 1) - 1)"
          class="page-btn"
        >
          ← Назад
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          @click="goToPage((meta.current_page || 1) + 1)"
          class="page-btn"
        >
          Вперёд →
        </button>
      </div>
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
  ACTION_LABELS,
  ENTITY_LABELS,
} from '~/utils/auditLabels'
import type { AuditLogEntry, AuditLogStatsPoint } from '~/repository/modules/auditLog'
import '@vuepic/vue-datepicker/dist/main.css'

const VueDatepicker = defineAsyncComponent(() =>
  import('@vuepic/vue-datepicker').then((m) => m.default),
)

const { $api } = useNuxtApp()
const route = useRoute()
const router = useRouter()

// ---- объекты (фильтр) ----
const ENTITY_FILTER_OPTIONS: Record<string, string> = {
  item: 'Предметы',
  store: 'Хранилища',
  warehouse: 'Склады',
  label_preset: 'Шаблоны',
  label_list: 'Этикетки',
  access_grant: 'Доступ',
  user: 'Пользователи',
}

const entityOptions = Object.entries(ENTITY_FILTER_OPTIONS).map(([value, label]) => ({ value, label }))
const entityFilter = ref<string>('')

// ---- шаг ----
const granularities = [
  { label: 'дни', value: 'day' },
  { label: 'часы', value: 'hour' },
]
const granularity = ref<'day' | 'hour'>('day')

// ---- период (календарь) ----
function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function todayRange(): [string, string] {
  const to = startOfDay(new Date())
  return [isoLocal(to), isoLocal(to)]
}

const dateRange = ref<[string, string] | null>(todayRange())

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

type PeriodPreset = { label: string; range: () => [string, string] | null }

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function addMonths(d: Date, delta: number): Date {
  const total = d.getFullYear() * 12 + d.getMonth() + delta
  const year = Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(d.getDate(), lastDay)
  return new Date(year, month, day)
}

function thisWeekRange(): [string, string] {
  const to = startOfDay(new Date())
  const dow = to.getDay()
  const diff = dow === 0 ? 6 : dow - 1
  const from = new Date(to)
  from.setDate(to.getDate() - diff)
  const end = new Date(from)
  end.setDate(from.getDate() + 6)
  return [isoLocal(from), isoLocal(end)]
}

function currentMonthRange(): [string, string] {
  const to = new Date()
  const from = new Date(to.getFullYear(), to.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth() + 1, 0)
  return [isoLocal(from), isoLocal(end)]
}

function currentYearRange(): [string, string] {
  const to = new Date()
  return [
    isoLocal(new Date(to.getFullYear(), 0, 1)),
    isoLocal(new Date(to.getFullYear(), 11, 31)),
  ]
}

function lastNDaysRange(n: number): [string, string] {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - (n - 1))
  return [isoLocal(from), isoLocal(to)]
}

function lastMonthsRange(n: number): [string, string] {
  const to = new Date()
  return [isoLocal(addMonths(to, -n)), isoLocal(to)]
}

function lastYearsRange(n: number): [string, string] {
  const to = new Date()
  const from = new Date(to)
  from.setFullYear(to.getFullYear() - n)
  return [isoLocal(from), isoLocal(to)]
}

const periodPresets: PeriodPreset[] = [
  { label: 'Сегодня', range: () => lastNDaysRange(1) },
  { label: 'Эта неделя', range: thisWeekRange },
  { label: 'Этот месяц', range: currentMonthRange },
  { label: 'Этот год', range: currentYearRange },
  { label: 'Неделя', range: () => lastNDaysRange(7) },
  { label: 'Месяц', range: () => lastMonthsRange(1) },
  { label: 'Год', range: () => lastYearsRange(1) },
  { label: 'Всё время', range: () => null },
]

function activePreset(preset: PeriodPreset): boolean {
  const r = preset.range()
  if (r === null) return !hasRange.value
  const cur = dateRange.value
  return !!(cur && cur[0] === r[0] && cur[1] === r[1])
}

function rangeParams(): { date_from?: string; date_to?: string } {
  const r = dateRange.value
  if (!r || !r[0] || !r[1]) return {}
  return { date_from: r[0], date_to: r[1] + 'T23:59:59' }
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
  loadStats()
  loadList()
}

function setGranularity(value: 'day' | 'hour') {
  granularity.value = value
  loadStats()
}

function applyFilters() {
  reloadAll()
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

onMounted(() => {
  loadStats()
  loadList()
})

watch(() => route.query.page, () => loadList())
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
  color: #ccc;
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

.ctl-select {
  padding: 5px 10px;
  font-size: 13px;
  font-family: inherit;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.chart-card {
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
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

.entity-id {
  color: #666;
  font-size: 12px;
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