<template>
  <div class="partial-editor">
    <!--
      Настройка показывается, только когда есть что расходовать. У предмета без
      заполненных числовых свойств показывать нечего: расходнуть «да/нет» или
      значение из справочника нельзя, и такая строка была бы обещанием, которое
      списание не выполнит.
    -->
    <template v-if="rows.length">
      <div
        v-for="(row, index) in rows"
        :key="row.property_id"
        class="partial-editor__row"
        :class="{ 'partial-editor__row--on': row.enabled }"
      >
        <label class="partial-editor__check">
          <input
            type="checkbox"
            class="field-check"
            :checked="row.enabled"
            :disabled="readonly || blocked"
            @change="toggleProperty(index, $event)"
          >
          <span class="partial-editor__name">{{ row.title }}</span>
          <span v-if="!row.enabled" class="partial-editor__idle">
            {{ t('items.partial_not_used') }}
          </span>
        </label>

        <div v-if="row.enabled" class="partial-editor__body">
          <label class="field partial-editor__step">
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

          <label class="partial-editor__reason">
            <input
              type="checkbox"
              class="field-check"
              :checked="row.is_full_reason"
              :disabled="readonly || blocked"
              @change="toggleReason(index, $event)"
            >
            <span>{{ t('items.partial_full_reason') }}</span>
          </label>
        </div>
      </div>

      <!--
        Подсказки одна над другой, а не в строку: по форме они длинные, и
        в строку не влезали — а влезая, ломали друг другу выравнивание. Плюс
        каждая про своё, и в одну фразу их не собрать.
      -->
      <p class="partial-editor__hint">
        {{ t('items.partial_full_reason_hint') }}
      </p>
      <p v-if="!readonly && hasReason" class="partial-editor__hint">
        {{ t('items.partial_exclusive_hint') }}
      </p>
      <p v-if="!readonly && blocked" class="partial-editor__hint partial-editor__hint--block">
        {{ t('items.partial_blocked_by_code') }}
      </p>
    </template>

    <p v-else class="partial-editor__hint">
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
  /**
   * У предмета включено списание по коду.
   *
   * Тогда количество считается по кодам, а расходовать остатки свойств нельзя:
   * при обоих режимах количество уезжало бы двумя несовместимыми способами.
   * Раньше настройки при этом сбрасывались молча, и человек узнавал об этом
   * из уведомления, которое к тому моменту уже исчезало. Теперь галочки не
   * нажимаются, а под ними стоит объяснение.
   */
  blocked?: boolean
}>(), {
  readonly: false,
  totals: () => ({}),
  blocked: false,
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
 * Пересобирает строки из списка свойств.
 *
 * Список свойств меняется вслед за правки значений: свойство могли заполнить
 * только что, и до этого расходовать его было нечего. Пересборка целиком
 * означает, что в строках не остаётся свойств, которых у предмета больше нет.
 *
 * Следит только за списком свойств, а не за настройками: пересборка на
 * настройках заменяла бы строки новыми объектами на каждое движение, и
 * правка шага теряла бы фокус из поля на середине ввода. Настройки приходят
 * снаружи при загрузке и после сохранения, и в обоих случаях список
 * свойств меняется вместе с ними.
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

watch(numericProperties, rebuild, { immediate: true })

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

/**
 * Отправка настроек вверх — только когда они действительно поменялись.
 *
 * Без сверки с тем, что уже пришло в props, возникает петля: строки порождают
 * payload, payload уходит наверх, props приходят обратно, строки пересобираются
 * новыми объектами — и payload меняется снова, хотя смысл тот же. В консоли
 * это выглядит как «Maximum recursive updates exceeded», а по факту страница
 * просто перерисовывает список до бесконечности.
 */
watch(
  payload,
  (value) => {
    if (JSON.stringify(value) !== JSON.stringify(props.modelValue)) {
      emit('update:modelValue', value)
    }
  },
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
 * Свои правила для .field-label и .field-input: в приложении они описаны в
 * scoped-блоках страниц и до разметки дочернего компонента не достают, а
 * браузерные умолчания превращают поле в серую полосу без рамки. Переписаны
 * под этот компонент, как это уже сделано в ItemCodesEditor и
 * ItemPropertiesEditor.
 */
.partial-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

/*
 * Строка — это карточка одного свойства: рамка отделяет его от соседних, а
 * включённое состояние выделяется рамкой акцентного цвета. Без этого отмеченное
 * свойство отличалось бы от неотмеченного только галочкой, а на узком экране
 * их легко перепутать.
 */
.partial-editor__row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.partial-editor__row--on {
  border-color: var(--accent);
}

.partial-editor__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}

.partial-editor__name {
  font-weight: 600;
}

/* Неотмеченное свойство названо, но выглядит приглушённо: расхода по нему нет. */
.partial-editor__idle {
  font-size: 12px;
  color: var(--text-dim);
}

.partial-editor__body {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
  padding-left: 24px;
}

.partial-editor__step {
  width: 180px;
  margin: 0;
}

.partial-editor__step .field-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--text-dim);
}

/*
 * Поле шага — то же, что и все остальные поля формы: тот же фон, та же рамка,
 * тот же шрифт. Отдельного вида у него быть не должно — иначе рядом с
 * обычными полями карточки оно читается как неактивное.
 */
.partial-editor__step .field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 14px;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  color: var(--text);
}

.partial-editor__reason {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.partial-editor__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-dim);
}

/* Подсказка о том, что режим заблокирован: она и объясняет причину, и
   отличается цветом от обычных подсказок — иначе тонет среди них. */
.partial-editor__hint--block {
  margin-top: 6px;
  color: var(--warn);
}
</style>
