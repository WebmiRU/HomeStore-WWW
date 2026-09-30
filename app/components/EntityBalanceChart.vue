<template>
  <div class="balance-chart">
    <div class="controls">
      <div class="control-group">
        <span class="control-label">{{ t('journal.period_label') }}</span>
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

      <!--
        Сводка у расходуемого предмета — по свойствам. «Остаток: 2, мин 1, макс 2»
        у бутылки, из которой списали 300 мл, сказала бы только, что количество
        не изменилось, — то есть ничего.
      -->
      <div v-if="hasPropertySeries" class="summary">
        <span v-for="row in propertyRemainders" :key="row.property_id">
          {{ row.title }}: <b class="sum-val">{{ row.qty }}</b>
        </span>
      </div>
      <div v-else-if="points.length" class="summary">
        <span>{{ t('balance.remainder') }}: <b class="sum-val">{{ lastQty }}</b></span>
        <span>{{ t('balance.min') }}: {{ minQty }}</span>
        <span>{{ t('balance.max') }}: {{ maxQty }}</span>
      </div>
    </div>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="chart-wrap">
      <ClientOnly>
        <div v-if="hasVisibleData" ref="chartEl" class="chart"></div>
        <template v-else>
          <div class="empty">{{ t('balance.no_data') }}</div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { themeToken, themeTokenAlpha } from '~/utils/themeToken'
import * as echarts from 'echarts'
import type { AuditLogBalancePoint, AuditLogBalanceSeries } from '~/repository/modules/auditLog'

const props = defineProps<{
  entityType: string
  entityId: number
}>()

const { $api } = useNuxtApp()
const { t } = useI18n()
// Тема нужна графику как данные: цвета линий и подписи берутся из токенов, и
// без перерисовки на новом фоне остались бы цвета прежней темы.
const { resolved } = useTheme()

const ranges = [
  { label: t('balance.day'), value: 'day' },
  { label: t('balance.month'), value: 'month' },
  { label: t('balance.year'), value: 'year' },
  { label: t('balance.all_time'), value: 'all' },
]

const period = ref<string>('year')
const loading = ref(true)
const error = ref<string | null>(null)
const points = ref<AuditLogBalancePoint[]>([])
/**
 * Остатки по расходуемым свойствам.
 *
 * У предмета, который расходуется частями, количество штук почти не двигается:
 * списали 300 мл из бутылки, а количество осталось прежним. График по штукам
 * молчал бы обо всём расходе, поэтому у такого предмета рисуются ряды по
 * свойствам, а не по штукам.
 */
const series = ref<AuditLogBalanceSeries[]>([])

const hasPropertySeries = computed(() => series.value.some((row) => row.points.length > 0))

/** Есть ли что рисовать: у расходуемого предмета штук может не быть вовсе. */
const hasVisibleData = computed(() => visible.value.length > 1 || points.value.length > 1)

const lastQty = computed(() => (points.value.length ? points.value[points.value.length - 1].qty : 0))
const minQty = computed(() => (points.value.length ? Math.min(...points.value.map((p) => p.qty)) : 0))
const maxQty = computed(() => (points.value.length ? Math.max(...points.value.map((p) => p.qty)) : 0))

/** Остаток на конец периода по каждому расходуемому свойству. */
const propertyRemainders = computed(() => series.value
  .filter((row) => row.points.length > 0)
  .map((row) => ({
    property_id: row.property_id,
    title: row.title,
    qty: row.points[row.points.length - 1].qty,
  })))

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
    points.value = result.points
    series.value = result.series ?? []
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
  // Ряд по свойствам — источник истины для расходуемого предмета: резать
  // «статичные хвосты» надо по нему, иначе у одного свойства хвост обрежется,
  // а у другого нет.
  const source = hasPropertySeries.value
    ? (series.value[0]?.points ?? [])
    : points.value
  const pts = source
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

/** Цвета линий по свойствам: своих не берём, берём из токенов темы. */
const SERIES_COLORS = ['--chart-line', '--info', '--note', '--success', '--warn']

function seriesColor(index: number): string {
  return themeToken(SERIES_COLORS[index % SERIES_COLORS.length], '#7aa8a4')
}

function buildOption(): any {
  const data = visible.value.map((p, i) => [tValues.value[i], p.qty])

  // У расходуемого предмета вместо одной линии штук — по одной на свойство.
  // Штуки в общий ряд не попадают: они там почти не меняются и только
  // сбивают масштаб линий, которые смотрят ради расхода.
  const propertySeries = hasPropertySeries.value
    ? series.value
      .filter((row) => row.points.length > 0)
      .map((row, index) => {
        const byTime = new Map<number, number>()
        for (const point of row.points) byTime.set(timestamp(point), point.qty)

        return {
          name: row.title,
          type: 'line',
          step: 'end',
          // Дыры в сетке не соединяются: без этого линия прыгала бы через
          // месяц без операций, будто остаток менялся задним числом.
          connectNulls: false,
          data: visible.value.map((p) => [timestamp(p), byTime.get(timestamp(p)) ?? null]),
          symbol: 'circle',
          symbolSize: 0,
          lineStyle: { color: seriesColor(index), width: 2 },
          itemStyle: { color: seriesColor(index) },
        }
      })
    : []

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      backgroundColor: themeToken('--bg-elevated', '#2a2a2e'),
      borderColor: themeToken('--border'),
      textStyle: { color: themeToken('--text-secondary'), fontSize: 13 },
      valueFormatter: (v: number | null) => (v == null ? '' : String(v)),
      axisPointer: { lineStyle: { color: themeToken('--border-strong') } },
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: themeToken('--text-muted'), fontSize: 11 },
      axisLine: { lineStyle: { color: themeToken('--border') } },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: themeToken('--text-muted'), fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: themeToken('--border') } },
    },
    legend: propertySeries.length
      ? {
          show: true,
          bottom: 0,
          textStyle: { color: themeToken('--text-muted'), fontSize: 12 },
          itemWidth: 18,
          itemHeight: 10,
        }
      : { show: false },
    grid: { left: 44, right: 14, top: 12, bottom: propertySeries.length ? 44 : 28 },
    series: propertySeries.length ? propertySeries : [
      {
        name: t('balance.remainder_word'),
        type: 'line',
        step: 'end',
        data,
        symbol: 'circle',
        symbolSize: 0,
        lineStyle: { color: themeToken('--chart-line', '#7aa8a4'), width: 2 },
        itemStyle: { color: themeToken('--chart-line', '#7aa8a4') },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: themeTokenAlpha('--chart-line', 30, '#7aa8a4') },
              { offset: 1, color: themeTokenAlpha('--chart-line', 2, '#7aa8a4') },
            ],
          },
        },
      },
    ],
  }
}

const tValues = computed(() => visible.value.map(timestamp))

async function renderChart() {
  if (loading.value || error.value || !hasVisibleData.value) return

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

watch(resolved, () => renderChart())

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

.summary {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: var(--text-muted);
}

.sum-val {
  color: var(--info);
  font-size: 15px;
}

.loading,
.error {
  padding: 20px;
  color: var(--text-muted);
}

.error {
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 4px;
}

.chart-wrap {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 14px 6px;
}

.chart {
  width: 100%;
  height: 280px;
}

.empty {
  padding: 20px;
  color: var(--text-muted);
}
</style>