<template>
  <div class="chart-box" :style="{ minHeight: `${props.height + 40}px` }">
    <div v-if="!series.length" class="empty">Нет данных за выбранный период</div>
    <ClientOnly>
      <div v-if="series.length" ref="chartEl" class="chart" :style="{ height: `${props.height}px` }"></div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { AuditLogStatsPoint } from '~/repository/modules/auditLog'

const props = withDefaults(
  defineProps<{
    points: AuditLogStatsPoint[]
    labels?: Record<string, string>
    height?: number
  }>(),
  { labels: () => ({}), height: 320 },
)

// Классическая палитра Grafana (dark).
const GRAFANA_COLORS = [
  '#7EB26D', '#EAB839', '#6ED0E0', '#EF843C', '#E24D42',
  '#1F78C4', '#BA43A9', '#705DA0', '#508642', '#CCA300',
  '#447EBC', '#C15C17', '#F4D598', '#F29191', '#AEA2E0',
]

const TOTAL_NAME = 'Всего'
const ROTATE_AFTER = 16
const ZOOM_AFTER = 40

// --- данные: buckets + ряды -------------------------------------------------

const buckets = computed<string[]>(() => {
  const seen: string[] = []
  for (const p of props.points) {
    if (p.bucket && !seen.includes(p.bucket)) seen.push(p.bucket)
  }
  return seen
})

const series = computed(() => {
  const bs = buckets.value
  if (!bs.length) return []

  const byKey: Record<string, number[]> = {}
  const totals: Record<string, number> = {}
  for (const p of props.points) {
    const k = p.key ?? ''
    const idx = bs.indexOf(p.bucket ?? '')
    if (idx === -1) continue
    if (!byKey[k]) {
      byKey[k] = new Array(bs.length).fill(0)
      totals[k] = 0
    }
    byKey[k][idx] = (byKey[k][idx] || 0) + p.count
    totals[k] = (totals[k] || 0) + p.count
  }

  // Топ-8 категорий, остальное — «Прочее».
  const order = Object.keys(totals).sort((a, b) => totals[b] - totals[a])
  const top = order.slice(0, 8)
  const rest = order.slice(8)
  const keys = rest.length ? [...top, '__rest__'] : top

  return keys.map((k) => {
    const isRest = k === '__rest__'
    const source = isRest ? rest : [k]
    const data = bs.map((_, i) => source.reduce((s, r) => s + (byKey[r]?.[i] ?? 0), 0))
    const name = isRest
      ? 'Прочее'
      : (props.labels[k] ?? (k || 'Без категории'))
    return { key: k, name, data, total: totals[k] }
  })
})

const totalByBucket = computed(() =>
  buckets.value.map((_, i) => series.value.reduce((s, r) => s + (r.data[i] ?? 0), 0)),
)

// --- ECharts ----------------------------------------------------------------

const chartEl = ref<HTMLDivElement | null>(null)
let chart: any = null
let chartNode: HTMLElement | null = null

function formatBucket(b: string): string {
  const [d] = b.split(' ')
  const date = new Date(d.length === 10 ? d + 'T00:00:00' : b)
  const label = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`
  const time = b.includes(' ') ? b.slice(11, 16) : ''
  return time ? `${label} ${time}` : label
}

function buildOption(): any {
  const zoom = buckets.value.length > ZOOM_AFTER
  const rotate = buckets.value.length > ROTATE_AFTER ? 45 : 0

  const barSeries = series.value.map((s, i) => ({
    name: s.name,
    type: 'bar',
    stack: 'total',
    data: s.data,
    barMaxWidth: 26,
    itemStyle: { color: GRAFANA_COLORS[i % GRAFANA_COLORS.length], borderRadius: 0 },
    emphasis: { focus: 'series' },
  }))

  const totalLine = {
    name: TOTAL_NAME,
    type: 'line',
    data: totalByBucket.value,
    symbol: 'none',
    smooth: 0.15,
    lineStyle: { color: 'rgba(255,255,255,0.85)', width: 2 },
    itemStyle: { color: 'rgba(255,255,255,0.85)' },
    z: 10,
  }

  const many = buckets.value.length > 90

  return {
    animation: true,
    grid: { left: 46, right: 18, top: 40, bottom: many ? 58 : 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30,30,30,0.94)',
      borderColor: '#3a3a3a',
      padding: [8, 12],
      textStyle: { color: '#ccc', fontSize: 12, lineHeight: 18 },
      axisPointer: { type: 'line', lineStyle: { color: '#555', type: 'dashed' } },
      formatter: (params: any[]) => {
        if (!params || !params.length) return ''
        const rows = params
          .filter((p) => p.seriesName !== TOTAL_NAME)
          .map((p) => `${p.marker} ${p.seriesName}: <b style="color:#fff">${p.value ?? 0}</b>`)
          .join('<br/>')
        const total = params.reduce((s, p) => s + (Number(p.value) || 0), 0)
        return `<b style="color:#eee">${formatBucket(params[0].axisValue)}</b><br/>${rows}<div style="border-top:1px solid #3a3a3a;margin:4px 0 2px;padding-top:3px">Итого: <b style="color:#fff">${total}</b></div>`
      },
    },
    legend: {
      type: 'scroll',
      top: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: '#9a9a9a', fontSize: 11 },
      pageIconColor: '#6a6a6a',
      pageTextStyle: { color: '#8a8a8a', fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: buckets.value,
      axisLabel: {
        color: '#8a8a8a',
        fontSize: 11,
        interval: 'auto',
        rotate,
        formatter: formatBucket,
      },
      axisLine: { lineStyle: { color: '#3a3a3a' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: '#8a8a8a', fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#2a2a2a' } },
    },
    dataZoom: zoom
      ? [
          { type: 'inside' },
          {
            type: 'slider',
            height: 14,
            bottom: 6,
            borderColor: '#3a3a3a',
            backgroundColor: 'transparent',
            fillerColor: 'rgba(90,138,90,0.25)',
            handleStyle: { color: '#5a8a5a', borderWidth: 0 },
            moveHandleStyle: { color: '#5a8a5a' },
            textStyle: { color: '#8a8a8a', fontSize: 10 },
          },
        ]
      : [],
    series: [...barSeries, totalLine],
  }
}

async function render() {
  if (!series.value.length) return
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

watch(() => props.points, () => render())

onMounted(() => {
  window.addEventListener('resize', onResize)
  render()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.chart-box {
  position: relative;
}

.chart {
  width: 100%;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 160px;
  color: #666;
  font-size: 13px;
}
</style>