<template>
  <div class="entity-stats">
    <div class="controls">
      <div class="control-group">
        <span class="control-label">Период:</span>
        <button
          v-for="range in ranges"
          :key="range.value"
          type="button"
          class="ctl-btn"
          :class="{ active: period === range.value }"
          @click="setPeriod(range.value)"
        >
          {{ range.label }}
        </button>
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

    <div v-if="statsLoading" class="loading">Загрузка статистики...</div>
    <div v-else-if="statsError" class="error">{{ statsError }}</div>

    <div v-else>
      <section class="chart-card">
        <h4 class="chart-title">Активность по действиям</h4>
        <div
          v-if="chartBuckets.length"
          class="chart"
          :class="{ 'chart--hourly': granularity === 'hour' }"
        >
          <div ref="chartEl" class="chart-body"></div>
        </div>
        <div v-else class="empty">За выбранный период событий нет</div>
      </section>
    </div>

    <hr class="section-divider" />

    <div class="table-head">
      <h4 class="table-title">Записи</h4>
      <span v-if="meta.total" class="total">Всего: {{ meta.total }}</span>
    </div>

    <div v-if="listLoading" class="loading">Загрузка записей...</div>
    <div v-else-if="listError" class="error">{{ listError }}</div>

    <template v-else>
      <table v-if="entries.length" class="entry-table">
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
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { actionLabel, actionBadgeClass, formatDate, summarize } from '~/utils/auditLabels'
import type { AuditLogEntry, AuditLogStatsPoint } from '~/repository/modules/auditLog'

const props = defineProps<{
  entityType: string
  entityId: number
}>()

const { $api } = useNuxtApp()

const ranges = [
  { label: '7 дней', value: '7' },
  { label: '30 дней', value: '30' },
  { label: '90 дней', value: '90' },
  { label: 'Всё время', value: 'all' },
]
const granularities = [
  { label: 'дни', value: 'day' },
  { label: 'часы', value: 'hour' },
]

const period = ref<string>('all')
const granularity = ref<'day' | 'hour'>('day')

const statsLoading = ref(true)
const statsError = ref<string | null>(null)

// Для конкретной сущности события создания неинформативны (их ровно 0 или 1),
// скрываем их из диаграммы.
const actionPoints = ref<AuditLogStatsPoint[]>([])
const filteredActionPoints = computed(() =>
  actionPoints.value.filter((p) => !p.key?.endsWith('.created')),
)

const ACTION_COLORS: Record<string, string> = {
  'operation.replenish': '#5a9a6a',
  'operation.writeoff': '#aa5a5a',
  'operation.preset': '#5a7aaa',
  'operation.bulk_replenish': '#5a9a6a',
  'operation.bulk_writeoff': '#aa5a5a',
}

// Один график: по оси X — даты/часы, по Y — активность, разложенная по действиям.
const chartBuckets = computed<string[]>(() => {
  const buckets = new Set<string>()
  for (const p of filteredActionPoints.value) buckets.add(p.bucket)
  return [...buckets].sort()
})

const chartSeries = computed(() => {
  const totals = new Map<string, number>()
  for (const p of filteredActionPoints.value) {
    const key = p.key ?? 'unknown'
    totals.set(key, (totals.get(key) ?? 0) + p.count)
  }
  const keys = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key)

  const buckets = chartBuckets.value
  const perKey = new Map<string, Map<string, number>>()
  for (const p of filteredActionPoints.value) {
    const key = p.key ?? 'unknown'
    if (!perKey.has(key)) perKey.set(key, new Map())
    const bucketMap = perKey.get(key)!
    bucketMap.set(p.bucket, (bucketMap.get(p.bucket) ?? 0) + p.count)
  }

  return keys.map((key) => ({
    key,
    name: actionLabel(key),
    color: ACTION_COLORS[key] ?? '#5a7aaa',
    data: buckets.map((b) => perKey.get(key)?.get(b) ?? 0),
  }))
})

const seriesTotals = computed(() =>
  chartSeries.value.map((s) => ({ key: s.key, name: s.name, total: s.data.reduce((a, b) => a + b, 0) })),
)

// --- ECharts ---------------------------------------------------------------

const chartEl = ref<HTMLDivElement | null>(null)
let chart: any = null
let chartNode: HTMLElement | null = null

const AXIS_COLOR = '#8a8a8a'
const SPLIT_COLOR = '#2c2c2c'

function fmtTick(value: string): string {
  const [date, time] = value.split(' ')
  const d = new Date(date.length === 10 ? date + 'T00:00:00' : value)
  const day = `${d.getDate()}.${d.getMonth() + 1}`
  if (granularity.value === 'hour' && time) {
    return `${day} ${time.slice(0, 5)}`
  }
  return day.length === 5 ? day : `${d.getFullYear()}.${day}`
}

function buildChartOption(): any {
  return {
    animation: false,
    grid: { left: 38, right: 14, top: 10, bottom: 56 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(255,255,255,0.04)' } },
      backgroundColor: '#2a2a2e',
      borderColor: '#3a3a3e',
      textStyle: { color: '#ccc', fontSize: 13 },
      formatter: (params: any[]) => {
        if (!params.length) return ''
        const date = fmtTick(params[0].axisValue)
        const rows = params
          .map((p) => `${p.marker}${p.seriesName}: <b>${p.value}</b>`)
          .join('<br/>')
        const total = params.reduce((s, p) => s + (p.value || 0), 0)
        return `${date}<br/>${rows}<br/><b style="color:#ddd">Всего: ${total}</b>`
      },
    },
    legend: {
      bottom: 14,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: '#bbb', fontSize: 12 },
      formatter: (name: string) => {
        const s = seriesTotals.value.find((x) => x.name === name)
        return s ? `${name} — ${s.total}` : name
      },
    },
    xAxis: {
      type: 'category',
      data: chartBuckets.value,
      axisLabel: {
        color: AXIS_COLOR,
        fontSize: 11,
        hideOverlap: true,
        formatter: (value: string) => fmtTick(value),
      },
      axisLine: { lineStyle: { color: '#333' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: AXIS_COLOR, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: SPLIT_COLOR } },
    },
    series: chartSeries.value.map((s) => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 24,
      data: s.data,
      itemStyle: { color: s.color, borderRadius: [0, 0, 0, 0] },
    })),
  }
}

async function renderChart() {
  if (statsLoading.value || statsError.value) return
  await nextTick()
  if (!chartEl.value) await nextTick()
  if (!chartEl.value || !chartBuckets.value.length) return

  if (chart && chartNode !== chartEl.value) {
    chart.dispose()
    chart = null
  }
  if (!chart) {
    chart = echarts.init(chartEl.value)
    chartNode = chartEl.value
  }
  chart.setOption(buildChartOption(), { notMerge: true })
  chart.resize()
}

function onResize() {
  chart?.resize()
}

// --- загрузка ---------------------------------------------------------------

function rangeParams(): { date_from?: string; date_to?: string } {
  if (period.value === 'all') return {}
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - (Number(period.value) - 1))
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  }
}

async function loadStats() {
  statsLoading.value = true
  statsError.value = null
  const range = rangeParams()
  const base = { entity_type: props.entityType, entity_id: props.entityId, granularity: granularity.value, ...range }
  try {
    actionPoints.value = await $api.auditLog.stats({ ...base, group_by: 'action' })
  } catch (err: any) {
    statsError.value = err?.data?.error || err?.message || String(err)
  } finally {
    statsLoading.value = false
    renderChart()
  }
}

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

function setPeriod(value: string) {
  period.value = value
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
  window.addEventListener('resize', onResize)
  loadStats()
  loadList()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})

watch(
  () => [props.entityType, props.entityId],
  () => {
    period.value = 'all'
    granularity.value = 'day'
    page.value = 1
    loadStats()
    loadList()
  },
)
</script>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-bottom: 16px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
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

.chart-card {
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  padding: 14px;
}

.chart-title {
  margin: 0 0 12px;
  font-size: 14px;
  color: #999;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.chart {
  height: 280px;
}

.chart--hourly {
  height: 320px;
}

.chart-body {
  width: 100%;
  height: 100%;
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

.section-divider {
  border: none;
  height: 1px;
  margin: 24px 0 14px;
  background: #333;
}

.table-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 10px;
}

.table-title {
  margin: 0;
  font-size: 15px;
  color: #aaa;
}

.total {
  font-size: 13px;
  color: #777;
}

.entry-table {
  width: 100%;
  border-collapse: collapse;
}

.entry-table th,
.entry-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
  vertical-align: top;
}

.entry-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.entry-table td {
  color: #ccc;
}

.entry-table tr:hover td {
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
  .entry-table,
  .entry-table tbody,
  .entry-table tr,
  .entry-table td {
    display: block;
  }

  .entry-table thead {
    display: none;
  }

  .entry-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .entry-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .entry-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .entry-table tr:hover td {
    background: transparent;
  }
}
</style>