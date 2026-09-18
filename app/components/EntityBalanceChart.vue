<template>
  <div class="balance-chart">
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

      <div v-if="points.length" class="summary">
        <span>Остаток: <b class="sum-val">{{ lastQty }}</b></span>
        <span>Мин: {{ minQty }}</span>
        <span>Макс: {{ maxQty }}</span>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="chart-wrap">
      <ClientOnly>
        <div v-if="visible.length" ref="chartEl" class="chart"></div>
        <template v-else>
          <div class="empty">Нет данных</div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { AuditLogBalancePoint } from '~/repository/modules/auditLog'

const props = defineProps<{
  entityType: string
  entityId: number
}>()

const { $api } = useNuxtApp()

const ranges = [
  { label: 'День', value: 'day' },
  { label: 'Месяц', value: 'month' },
  { label: 'Год', value: 'year' },
  { label: 'Всё время', value: 'all' },
]

const period = ref<string>('year')
const loading = ref(true)
const error = ref<string | null>(null)
const points = ref<AuditLogBalancePoint[]>([])

const lastQty = computed(() => (points.value.length ? points.value[points.value.length - 1].qty : 0))
const minQty = computed(() => (points.value.length ? Math.min(...points.value.map((p) => p.qty)) : 0))
const maxQty = computed(() => (points.value.length ? Math.max(...points.value.map((p) => p.qty)) : 0))

function rangeParams(): { date_from?: string; date_to?: string } {
  if (period.value === 'all') return {}
  const to = new Date()
  const from = new Date()
  const days = { day: 1, month: 30, year: 365 }[period.value as 'day' | 'month' | 'year']
  from.setDate(to.getDate() - days)
  return { date_from: from.toISOString(), date_to: to.toISOString() }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const result = await $api.auditLog.balance({
      entity_type: props.entityType,
      entity_id: props.entityId,
      ...rangeParams(),
    })
    points.value = result
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
    renderChart()
  }
}

function setPeriod(value: string) {
  period.value = value
  load()
}

// --- построение ряда -----------------------------------------------------

const timestamp = (p: AuditLogBalancePoint) => new Date(p.at).getTime()
const allTs = computed(() => points.value.map(timestamp))

// Отсекаем только по-настоящему статичные «хвосты» (остаток не менялся ≥60 дней)
// в начале и в конце ряда. Внутренние зазоры между кластерами не трогаем.
const STATIC_TAIL_MS = 60 * 24 * 3600 * 1000
const visible = computed(() => {
  const pts = points.value
  if (pts.length < 2) return pts
  const ts = allTs.value
  let from = 0
  while (from + 1 < pts.length && ts[from + 1] - ts[from] > STATIC_TAIL_MS) from++
  let to = pts.length
  while (to - 1 > from && ts[to - 1] - ts[to - 2] > STATIC_TAIL_MS) to--
  return from > 0 || to < pts.length ? pts.slice(from, to) : pts
})

// --- ECharts --------------------------------------------------------------

const chartEl = ref<HTMLDivElement | null>(null)
let chart: any = null
let chartNode: HTMLElement | null = null

function buildOption(): any {
  const data = visible.value.map((p, i) => [tValues.value[i], p.qty])

  return {
    animation: false,
    grid: { left: 44, right: 14, top: 12, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#2a2a2e',
      borderColor: '#3a3a3e',
      textStyle: { color: '#ccc', fontSize: 13 },
      valueFormatter: (v: number | null) => (v == null ? '' : `${Math.round(v)} шт.`),
      axisPointer: { lineStyle: { color: '#555' } },
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: '#8a8a8a', fontSize: 11 },
      axisLine: { lineStyle: { color: '#333' } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: '#8a8a8a', fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#2a2a2a' } },
    },
    series: [
      {
        name: 'Остаток',
        type: 'line',
        step: 'end',
        data,
        symbol: 'circle',
        symbolSize: 0,
        lineStyle: { color: '#7aa8a4', width: 2 },
        itemStyle: { color: '#7aa8a4' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(122,168,164,0.30)' },
              { offset: 1, color: 'rgba(122,168,164,0.02)' },
            ],
          },
        },
      },
    ],
  }
}

const tValues = computed(() => visible.value.map(timestamp))

async function renderChart() {
  if (loading.value || error.value || !visible.value.length) return

  // Узел может появиться через один-два кадра после смены reactive-состояния.
  await nextTick()
  if (!chartEl.value) await nextTick()
  if (!chartEl.value) return

  if (chart && chartNode !== chartEl.value) {
    chart.dispose()
    chart = null
  }
  if (!chart) {
    chart = echarts.init(chartEl.value)
    chartNode = chartEl.value
  }
  chart.setOption(buildOption(), { notMerge: true })
  chart.resize()
}

function onResize() {
  chart?.resize()
}

watch(
  () => [props.entityType, props.entityId],
  () => {
    period.value = 'year'
    points.value = []
    load()
  },
)

onMounted(() => {
  window.addEventListener('resize', onResize)
  load()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
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

.summary {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: #888;
}

.sum-val {
  color: #9dd;
  font-size: 15px;
}

.loading,
.error {
  padding: 20px;
  color: #888;
}

.error {
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
}

.chart-wrap {
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  padding: 14px 14px 6px;
}

.chart {
  width: 100%;
  height: 280px;
}

.empty {
  padding: 20px;
  color: #888;
}
</style>