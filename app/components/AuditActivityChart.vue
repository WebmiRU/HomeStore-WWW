<template>
  <div class="chart-box" :style="{ minHeight: `${props.height + 40}px` }">
    <div v-if="!series.length" class="empty">{{ t('audit_chart.no_data') }}</div>
    <ClientOnly>
      <div v-if="series.length" ref="chartEl" class="chart" :style="{ height: `${props.height}px` }"></div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { themeToken, themeTokenAlpha } from '~/utils/themeToken'
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

// Палитра серий — из токенов: canvas не берёт CSS-переменные сам, а зашитый
// цвет на светлой теме остался бы тёмным на светлом. Читается при каждой
// отрисовке, поэтому смена темы перекрашивает график.
const SERIES_TOKENS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6']

const { t } = useI18n()
const { resolved } = useTheme()

// computed, а не константа: язык приезжает из настроек после монтирования, и
// зафиксированная при setup подпись осталась бы русской.
const totalName = computed(() => t('audit_chart.total'))
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
      ? t('audit_chart.other')
      : (props.labels[k] ?? (k || t('audit_chart.no_category')))
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
  // Палитра читается здесь, а не один раз при загрузке: тема переключается
  // на лету, и цвета серий должны меняться вместе с ней.
  const palette = SERIES_TOKENS.map((token) => themeToken(token, '#7eb26d'))

  const barSeries = series.value.map((s, i) => ({
    name: s.name,
    type: 'bar',
    stack: 'total',
    data: s.data,
    barMaxWidth: 26,
    itemStyle: { color: palette[i % palette.length], borderRadius: 0 },
    emphasis: { focus: 'series' },
  }))

  const totalLine = {
    name: totalName.value,
    type: 'line',
    data: totalByBucket.value,
    symbol: 'none',
    smooth: 0.15,
    lineStyle: { color: themeTokenAlpha('--text', 85, '#fff'), width: 2 },
    itemStyle: { color: themeTokenAlpha('--text', 85, '#fff') },
    z: 10,
  }

  const many = buckets.value.length > 90

  return {
    animation: true,
    grid: { left: 46, right: 18, top: 40, bottom: many ? 58 : 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: themeTokenAlpha('--bg-elevated', 94, '#1e1e1e'),
      borderColor: themeToken('--border'),
      padding: [8, 12],
      textStyle: { color: themeToken('--text-secondary'), fontSize: 12, lineHeight: 18 },
      axisPointer: { type: 'line', lineStyle: { color: themeToken('--border-strong'), type: 'dashed' } },
      formatter: (params: any[]) => {
        if (!params || !params.length) return ''
        const rows = params
          .filter((p) => p.seriesName !== totalName.value)
          .map((p) => `${p.marker} ${p.seriesName}: <b style="color:var(--text)">${p.value ?? 0}</b>`)
          .join('<br/>')
        const total = params.reduce((s, p) => s + (Number(p.value) || 0), 0)
        return `<b style="color:var(--text)">${formatBucket(params[0].axisValue)}</b><br/>${rows}<div style="border-top:1px solid var(--border);margin:4px 0 2px;padding-top:3px">${t('audit_chart.total')}: <b style="color:var(--text)">${total}</b></div>`
      },
    },
    legend: {
      type: 'scroll',
      top: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: themeToken('--text-muted'), fontSize: 11 },
      pageIconColor: themeToken('--text-dim'),
      pageTextStyle: { color: themeToken('--text-muted'), fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: buckets.value,
      axisLabel: {
        color: themeToken('--text-muted'),
        fontSize: 11,
        interval: 'auto',
        rotate,
        formatter: formatBucket,
      },
      axisLine: { lineStyle: { color: themeToken('--border') } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: themeToken('--text-muted'), fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: themeToken('--border') } },
    },
    dataZoom: zoom
      ? [
          { type: 'inside' },
          {
            type: 'slider',
            height: 14,
            bottom: 6,
            borderColor: themeToken('--border'),
            backgroundColor: 'transparent',
            fillerColor: themeTokenAlpha('--accent', 25, '#3a7a3a'),
            handleStyle: { color: themeToken('--accent'), borderWidth: 0 },
            moveHandleStyle: { color: themeToken('--accent') },
            textStyle: { color: themeToken('--text-muted'), fontSize: 10 },
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

// Язык в источнике: подписи легенды и «Итого» приходят из словаря, и без
// перерисовки смены языка на графике не было бы видно.
// Тема в списке: переключение должно перерисовывать график, иначе на новом
// фоне остались бы линии прежнего цвета.
watch([() => props.points, totalName, resolved], () => render())

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
  color: var(--text-faint);
  font-size: 13px;
}
</style>