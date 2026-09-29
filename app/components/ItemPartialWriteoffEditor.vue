<template>
  <div class="partial-editor">
    <p class="field-hint partial-editor__hint">
      {{ t('items.partial_hint') }}
    </p>

    <!--
      Настройка выключена, если нет ни одного отмеченного свойства. Показывать
      пустой список с одним включённым крыжиком значило бы заставлять человека
      искать, где тут вообще галочки, а у предмета без числовых свойств
      показывать нечего и нечего выбирать.
    -->
    <template v-if="rows.length">
      <div
        v-for="(row, index) in rows"
        :key="row.property_id"
        class="partial-editor__row"
      >
        <label class="field field--check partial-editor__check">
          <input
            type="checkbox"
            class="field-check"
            :checked="row.enabled"
            :disabled="readonly"
            @change="toggleProperty(index, $event)"
          >
          <span>{{ row.title }}</span>
        </label>

        <template v-if="row.enabled">
          <label class="field partial-editor__field">
            <span class="field-label">{{ t('items.partial_step') }}</span>
            <input
              v-model.number="row.step"
              type="number"
              class="field-input"
              min="0"
              step="any"
              :readonly="readonly"
            >
          </label>

          <label class="field field--check partial-editor__reason">
            <input
              type="checkbox"
              class="field-check"
              :checked="row.is_full_reason"
              :disabled="readonly"
              @change="toggleReason(index, $event)"
            >
            <span>{{ t('items.partial_full_reason') }}</span>
            <span class="field-hint">
              {{ t('items.partial_full_reason_hint') }}
            </span>
          </label>
        </template>
      </div>

      <p class="field-hint partial-editor__hint">
        {{ t('items.partial_step_hint') }}
      </p>

      <p v-if="!readonly && hasReason" class="field-hint partial-editor__hint">
        {{ t('items.partial_exclusive_hint') }}
      </p>
    </template>

    <p v-else class="field-hint partial-editor__empty">
      {{ t('items.partial_no_properties') }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Настройка частичного списания: какие числовые свойства предмета расходуются.
 *
 * Свойство здесь значит запас, а не описание: у бутылки сиропа «Объём, 1000 мл»
 * — это 1000 мл в одной бутылке, и списать можно двести, не выпивая её.
 * Переключение на список числовых свойств, а не свободный ввод: свойство
 * выбирается из тех, что уже заведены у предмета, иначе человек вписал бы
 * расход по свойству, которого у предмета нет, и списание его не исполнило бы.
 */
import { computed, ref, watch } from 'vue'
import type { ItemPartialPropertyInput } from '~/repository/modules/item'
import type { PropertyType } from '~/repository/modules/property'

/**
 * Свойство, которое можно расходовать: id, название, тип и то, чем оно
 * заполнено у предмета.
 *
 * Форма плоская и одинаковая для карточки и страницы создания: на карточке
 * это ответ сервера, на создании — то, что человек ввёл минуту назад. Единый
 * вход нужен, чтобы правило «расходовать можно заполненное и числовое» не
 * приходилось дублировать в двух местах, иначе они разъедутся.
 */
type PartialCandidate = {
  property_id: number
  title: string
  type: PropertyType
  value: string | null
}

/** Одна строка списка: настройка свойства плюс то, чего в payload не уходит. */
type EditorRow = {
  property_id: number
  title: string
  enabled: boolean
  step: number
  is_full_reason: boolean
  sort: number
}

const { t } = useI18n()

const props = withDefaults(defineProps<{
  /** Свойства, которые можно расходовать: числовые и уже заполненные. */
  properties: PartialCandidate[]
  /** Настройки с сервера: какие свойства уже расходуются. */
  modelValue: ItemPartialPropertyInput[]
  readonly?: boolean
  /** Подсказка об остатках: сервер их присылает, а из значений не вывести. */
  totals?: Record<number, { total: number; remaining: number; norm: number }>
}>(), {
  readonly: false,
  totals: () => ({}),
})

const emit = defineEmits<{
  'update:modelValue': [ItemPartialPropertyInput[]]
}>()

/**
 * Числовые свойства, уже заполненные у предмета: только их есть смысл
 * расходовать. Нормой служит само значение — списанное делят на него при
 * переходе между штуками.
 */
const numericProperties = computed<PartialCandidate[]>(() => props.properties.filter((property) => {
  const value = property.value

  if (value === null || value.trim() === '') {
    return false
  }

  return property.type === 'int' || property.type === 'float'
}))

const rows = ref<EditorRow[]>([])

/**
 * Пересобирает строки из значений и настроек.
 *
 * Список свойств меняется вслед за правкой значений: свойство могли заполнить
 * только что, и до этого расходовать его было нечего. Пересборка целиком
 * означает, что в строках не остаётся свойств, которых у предмета больше нет.
 */
function rebuild(): void {
  const settings = new Map(
    props.modelValue.map((row) => [Number(row.property_id), row]),
  )

  rows.value = numericProperties.value.map((property, position) => {
    const saved = settings.get(property.property_id)

    return {
      property_id: property.property_id,
      title: property.title,
      enabled: saved !== undefined,
      step: Number(saved?.step ?? 1) || 1,
      is_full_reason: saved?.is_full_reason ?? true,
      // Порядок задаёт выбранный сервером, а для новых — позиция в списке.
      sort: saved?.sort ?? position,
    }
  })
}

watch(
  () => [props.properties, props.modelValue] as const,
  rebuild,
  { immediate: true, deep: true },
)

/**
 * Отмеченные свойства в том виде, в каком их принимает сервер.
 *
 * Шаг и порядок отправляются все, а не только у отмеченных: сервер сверяет с
 * ними остатки, и потерянный шаг означал бы «списать целую штуку».
 */
const payload = computed<ItemPartialPropertyInput[]>(() => rows.value
  .filter((row) => row.enabled)
  .map((row, position) => ({
    property_id: row.property_id,
    step: row.step,
    is_full_reason: row.is_full_reason,
    sort: position,
  })))

watch(
  payload,
  (value) => emit('update:modelValue', value),
  { immediate: true, deep: true },
)

/** Есть ли хоть одно свойство, обнуление которого означает пустую штуку. */
const hasReason = computed(() => rows.value.some((row) => row.enabled && row.is_full_reason))

function toggleProperty(index: number, event: Event): void {
  rows.value[index].enabled = (event.target as HTMLInputElement).checked
}

function toggleReason(index: number, event: Event): void {
  rows.value[index].is_full_reason = (event.target as HTMLInputElement).checked
}
</script>

<style scoped>
/*
 * Свои правила для .field-hint и .field-label: в приложении они описаны в
 * scoped-блоках страниц и до разметки дочернего компонента не достают, а
 * браузерные умолчания (16px, чёрный цвет) на тёмном фоне превращают
 * подсказку в основной текст.
 */
.partial-editor {
  width: 100%;
}

.partial-editor__hint,
.partial-editor__empty {
  display: block;
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-dim);
}

.partial-editor__empty {
  color: var(--text-dim);
}

.partial-editor__row {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.partial-editor__row:last-child {
  border-bottom: none;
}

.partial-editor__check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
}

.partial-editor__field {
  margin: 6px 0 0 24px;
  max-width: 240px;
}

.partial-editor__reason {
  margin: 6px 0 0 24px;
  font-size: 13px;
}
</style>
