<template>
  <div class="balance-chart">
    <div class="controls">
      <PeriodPicker v-model:range="range" />

      <!--
        У расходуемого предмета сводка и по штукам, и по свойствам: «Остаток: 2,
        мин 1, макс 2» у бутылки, из которой списали 300 мл, сказала бы только,
        что количество не изменилось. Но и заменить штуки свойствами нельзя —
        сколько бутылок осталось, человек спросит справедливо, и ответ должен
        быть на виду.
      -->
      <div v-if="hasPropertySeries" class="summary">
        <span v-if="hasQtySeries">
          {{ t('balance.pieces') }}: <b class="sum-val">{{ lastQty }}</b>
        </span>
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
import { lastYearsRange } from '~/utils/periodPresets'
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

/*
 * Период — тот же набор заготовок и свои даты, что в журнале и статистике.
 *
 * Раньше здесь был свой вдвое меньший список («День, Месяц, Год, Всё время»)
 * без своих дат: одни и те же периоды назывались по-разному и стояли в
 * разном порядке, и отрезок «со вторника по понедельник» выбрать было нечем.
 */
const range = ref<[string, string] | null>(lastYearsRange(1))
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

/**
 * Есть ли ряд по штукам.
 *
 * Отдельно от hasPropertySeries: у расходуемого предмета штуки обычно есть, но
 * у только что созданного — одна точка, и рисовать по ней нечего.
 */
const hasQtySeries = computed(() => points.value.length > 0)

/**
 * Есть ли что рисовать.
 *
 * Раньше требовались две точки, и предмет с одной операцией показывал «Нет
 * данных» — при том что остаток на руках есть и он же показан в сводке. Человек
 * читал это как «остатков не заведено». Рисуем по любой точке: одна — это
 * отрезок нулевой длины, но отметка на оси видна, и пустоты нет.
 */
const hasVisibleData = computed(() => visible.value.length > 0 || points.value.length > 0)

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
  const r = range.value
  if (!r || !r[0] || !r[1]) return {}
  return {
    date_from: new Date(r[0] + 'T00:00:00').toISOString(),
    date_to: new Date(r[1] + 'T23:59:59').toISOString(),
  }
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

// Период меняет выборку — перезапрашиваем.
watch(range, () => load())

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
          // При одной точке линии не видно вовсе, и остаётся пустое поле с
          // подписью о периоде. Маркер показывает, что отсчёт есть.
          symbolSize: visible.value.length < 2 ? 6 : 0,
          lineStyle: { color: seriesColor(index), width: 2 },
          itemStyle: { color: seriesColor(index) },
        }
      })
    : []

  // Штуки — на своей оси. В одной с линиями свойств они были бы не видны:
  // «2 шт» и «1800 мл» разного порядка, и линия штук улетала бы в самое дно
  // графика, где её не отличить от оси.
  const qtySeries = hasPropertySeries.value && points.value.length > 0
    ? [
        {
          name: `${t('balance.pieces')} (${t('balance.pieces_hint')})`,
          type: 'line',
          step: 'end',
          yAxisIndex: 1,
          connectNulls: false,
          // Штуки меняются редко, поэтому по времени берём каждую запись, а не
          // только те, где совпало с шагом сетки свойств: иначе изменение
          // количества попало бы в точку, которой на оси нет.
          data: points.value.map((p) => [timestamp(p), p.qty]),
          symbol: 'circle',
          symbolSize: points.value.length < 2 ? 6 : 0,
          lineStyle: { color: themeToken('--text-dim'), width: 2, type: 'dashed' },
          itemStyle: { color: themeToken('--text-dim') },
        },
      ]
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
    // Правая ось — только когда есть чем её читать, то есть у расходуемого
    // предмета с рядом штук. Подпись «шт» на самой оси: по цвету линии её не
    // отличить, а ось без подписи выглядит как «в чём эти числа».
    yAxis: qtySeries.length
      ? [
          {
            type: 'value',
            min: 0,
            axisLabel: { color: themeToken('--text-muted'), fontSize: 11 },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
          },
          {
            type: 'value',
            min: 0,
            // Штуки целые, а ось без шага показывала 0,5 и 1,5 штуки.
            minInterval: 1,
            name: t('balance.pieces_hint'),
            nameTextStyle: { color: themeToken('--text-muted'), fontSize: 11, align: 'right' },
            nameGap: 8,
            position: 'right',
            axisLabel: { color: themeToken('--text-muted'), fontSize: 11 },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
          },
        ]
      : {
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
    // Справа место под подпись второй оси, иначе она наезжает на край.
    grid: { left: 44, right: qtySeries.length ? 46 : 14, top: 12, bottom: propertySeries.length ? 44 : 28 },
    series: propertySeries.length ? [...propertySeries, ...qtySeries] : [
      {
        name: t('balance.remainder_word'),
        type: 'line',
        step: 'end',
        data,
        symbol: 'circle',
        symbolSize: data.length < 2 ? 6 : 0,
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
    range.value = lastYearsRange(1)
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