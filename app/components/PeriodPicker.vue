<template>
  <div class="period-picker">
    <div class="preset-row">
      <span class="control-label">{{ t('journal.period_label') }}</span>
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        class="ctl-btn"
        :class="{ active: activePreset(preset) }"
        @click="selectPreset(preset)"
      >
        {{ preset.label }}
      </button>
    </div>

    <div class="preset-row">
      <div class="control-group date-group">
        <span class="control-label">{{ t('journal.own_dates') }}</span>
        <ClientOnly>
          <VueDatepicker
            v-model="pickerValue"
            range
            :format="'dd.MM.yyyy'"
            value-format="yyyy-MM-dd"
            :enable-time-picker="false"
            :clearable="false"
            auto-apply
            @closed="applyPicked"
          />
        </ClientOnly>
      </div>

      <!--
        Шаг нужен не везде: у графика остатков своя шкала, и подписи «дни/часы»
        там только занимали бы место. Поэтому блок опционален, а не спрятан
        шириной в ноль.
      -->
      <div v-if="granularities.length" class="control-group">
        <span class="control-label">{{ t('journal.step_label') }}</span>
        <button
          v-for="g in granularities"
          :key="g.value"
          type="button"
          class="ctl-btn"
          :class="{ active: granularity === g.value }"
          @click="granularity = g.value"
        >
          {{ g.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  defaultPeriodPresets,
  isoLocal,
  todayRange,
  type PeriodPreset,
} from '~/utils/periodPresets'
import '@vuepic/vue-datepicker/dist/main.css'

const VueDatepicker = defineAsyncComponent(() =>
  import('@vuepic/vue-datepicker').then((m) => m.default),
)

/**
 * Выбор периода: набор заготовок и свои даты.
 *
 * Набор периодов встречался в четырёх местах, и каждый раз был свой: журнал
 * действий и статистика предмета знали про «Сегодня…Всё время» и свои даты,
 * журнал операций — про «Всё время, Сегодня, Неделя, Месяц» и два поля ввода
 * даты, график остатков — про «День, Месяц, Год, Всё время» и ничего больше.
 * Человек, привыкший к одному виду, на другой смотрел как на другой
 * инструмент: те же периоды назывались по-разному и стояли в разном порядке.
 *
 * Здесь один набор на всех. Модель — пара дат ([from, to]) либо null на «всё
 * время»: пресеты и свои даты живут в одном состоянии, поэтому свой выбор
 * видно по подсветке заготовки, а не по отдельному переключателю.
 *
 * @model range      [string, string] | null — выбранный период
 * @model granularity string                 — шаг; используется, если задан granularityOptions
 */
const range = defineModel<[string, string] | null>('range', { required: true })
const granularity = defineModel<string>('granularity', { required: false })

const props = defineProps<{
  /** Заготовки шага; пустой список — блока «Шаг» нет вовсе. */
  granularityOptions?: { label: string; value: string }[]
  /** Начальный период: по умолчанию сегодня. */
  defaultRange?: [string, string] | null
}>()

const { t } = useI18n()

const presets = computed<PeriodPreset[]>(() => defaultPeriodPresets())
const granularities = computed(() => props.granularityOptions ?? [])

if (props.defaultRange !== undefined) {
  range.value = props.defaultRange
} else if (range.value === undefined) {
  range.value = todayRange()
}

/**
 * То, что показывает календарь.
 *
 * Отдельно от range: пикер не терпит null («всё время» — это не диапазон), и
 * при выборе заготовки «всё время» он всё равно должен что-то показывать.
 * Тогда показываем сегодня: пустой календарь рядом с активной кнопкой
 * «Всё время» читался бы как «даты не выбраны».
 */
const pickerValue = ref<[string, string] | null>(range.value ?? todayRange())

watch(range, (value) => {
  pickerValue.value = value ?? todayRange()
})

function activePreset(preset: PeriodPreset): boolean {
  const target = preset.range()
  const current = range.value

  if (target === null) return current === null
  return !!current && current[0] === target[0] && current[1] === target[1]
}

function selectPreset(preset: PeriodPreset) {
  range.value = preset.range()
}

function applyPicked() {
  const picked = pickerValue.value

  if (!picked || typeof picked[0] !== 'string' || typeof picked[1] !== 'string') {
    return
  }

  range.value = [picked[0], picked[1]]
}

function toISO(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return isoLocal(value)
  return null
}

defineExpose({ toISO })
</script>

<style scoped>
.period-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 13px;
  color: var(--text-dim);
}

/*
 * Заготовки периода и шага.
 *
 * Стили переехали сюда из потребителей: у scoped-компонента его правила не
 * достают внутрь другого компонента, и кнопки остались бы голыми — без
 * заливки, скругления и подсветки выбранного. А вид периода должен быть один
 * на всех экранах, где он есть.
 */
.ctl-btn {
  padding: 5px 12px;
  font-size: 13px;
  font-family: inherit;
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

.date-group {
  /* Пикер шириной по содержимому: растянутый на всю строку календарь
   * выглядит отдельной панелью, а не полем ввода дат. */
  flex: 0 0 auto;
  gap: 8px;
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

</style>