<template>
  <div class="props-editor prop-grid">
    <div class="props-editor__head">
      <span class="field-label">{{ t('form.properties_tab') }}</span>
      <span class="field-hint">{{ hint }}</span>
    </div>

    <div v-if="!readonly" class="input-group props-picker">
      <select v-model="pendingId" class="field-select input-group__control" :disabled="!pickGroups.length">
        <option value="" disabled>
          {{ pickGroups.length ? t('placeholders.pick_property') : t('placeholders.all_properties_added') }}
        </option>
        <optgroup v-for="group in pickGroups" :key="group.key" :label="group.label">
          <option v-for="option in group.properties" :key="option.id" :value="option.id">
            {{ option.title }} — {{ option.type_label }}
          </option>
        </optgroup>
      </select>
      <button
        type="button"
        class="input-group__btn input-group__btn--primary"
        :disabled="pendingId === ''"
        :title="t('item_properties.add_chosen')"
        @click="addProperty"
      >{{ t('common.add') }}</button>
    </div>
    <p v-if="!readonly" class="field-hint props-picker__hint">
      {{ t('item_properties.default_set_hint') }}</p>

    <p v-if="!visible.length" class="props-editor__empty">
      {{ t('item_properties.empty') }}
    </p>

    <div v-for="group in grouped" :key="group.key" class="props-group">
      <div v-if="group.label" class="props-group__title">{{ group.label }}</div>

      <!--
        Одна сетка на весь список свойств, а не по контейнеру на строку: блок
        единиц измерения тогда общий для всех и выравнивается по самому
        широкому сам. По контейнеру на строку каждая строка считала ширину
        отдельно, и «мл» с «г» в одном списке давали разные размеры.

        Свойство занимает первую колонку и столько строк, сколько у него
        значений (grid-row: span), а каждое значение раскладывается по колонкам
        само: display: contents у обёртки значения убирает её из раскладки,
        и поле, единица и кнопки становятся прямо ячейками общей сетки.
      -->
      <div
        v-for="property in group.properties"
        :key="property.id"
        class="prop-row"
      >
        <!--
          Крестик удаления свойства — справа от названия, а не справа от поля.
          Справа от поля он выглядел болтающимся: значение с «-» и «+» уже
          занимают эту сторону, и лишнее действие с «×» рядом с «+» читалось
          как часть управления значением. У названия своё место — это строка
          свойства, а не значение, и «×» рядом с ним означает «убрать свойство
          у предмета», как и подсказка.

          Отдельной колонки под крестик не делаем: у свойств из набора по
          умолчанию его не бывает, и колонка сдвинула бы все подписи вправо.
        -->
        <span
          class="prop-row__label prop-grid__label"
          :style="{ gridRow: `span ${Math.max(1, valuesOf(property.id).length)}` }"
        >
          <span class="prop-row__head">
            <span class="prop-row__title">{{ property.title }}</span>
            <button
              v-if="!readonly && !isDefault(property.id)"
              type="button"
              class="prop-row__remove"
              :title="t('item_properties.remove_from_item')"
              @click="removeProperty(property.id)"
            >×</button>
          </span>
          <span v-if="isDefault(property.id)" class="prop-row__default">{{ t('item_properties.by_default') }}</span>
        </span>

        <!--
          Обёртка значений убирается из раскладки: её содержимое становится
          прямыми ячейками общей сетки строки. Пока она оставалась обычным
          блоком, значения жили внутри него, а сетка видела только пустую
          колонку — и блок единиц растягивался на всю ширину поля.
        -->
        <div class="prop-row__values prop-grid__values">
          <div v-for="(slot, index) in valuesOf(property.id)" :key="index" class="input-group prop-value prop-grid__row">
            <select
              v-if="property.type === 'dictionary'"
              class="field-select input-group__control"
              :value="slot.dictionaryValueId ?? ''"
              :disabled="readonly"
              @change="onDictionaryChange(property.id, index, $event)"
            >
              <option value="">{{ t('placeholders.not_chosen') }}</option>
              <option v-for="option in dictionaryOptions(property)" :key="option.id" :value="option.id">
                {{ option.title }}
              </option>
            </select>

            <select
              v-else-if="property.type === 'bool'"
              class="field-select input-group__control"
              :value="slot.value"
              :disabled="readonly"
              @change="onTextChange(property.id, index, $event)"
            >
              <option value="">{{ t('placeholders.not_filled') }}</option>
              <option value="да">{{ t('item_properties.yes_value') }}</option>
              <option value="нет">{{ t('item_properties.no_value') }}</option>
            </select>

            <input
              v-else
              :value="slot.value"
              type="text"
              class="field-input input-group__control"
              :disabled="readonly"
              @input="onTextChange(property.id, index, $event)"
            />

            <span v-if="property.unit" class="input-group-text">{{ property.unit.title_short }}</span>

            <!--
              «-» в верхних строках занимает место сразу за двух: там, где в
              нижней строке стоят «-» и «+». Поле от этого везде одной ширины,
              а правый край строки скруглён — «-» в верхних строках последний
              элемент группы, и скругление достаётся ему.

              Раньше здесь был «×», но рядом с «+» он читался как «испортить»,
              а не как «убрать одно значение». Пара «-» и «+» говорит сразу:
              значение можно убрать и добавить. Знак именно U+2212, а не дефис:
              у дефиса чёрточка сидит выше, чем у «+», и пара выглядит перекошенной.

              И он не красный. Убрать значение — обычное действие, его не надо
                  пугать; красным остаётся только «×» свойства.
            -->
            <button
              v-if="!readonly"
              type="button"
              class="input-group__btn input-group__btn--minus input-group__btn--icon"
              :class="{ 'input-group__btn--wide': index !== valuesOf(property.id).length - 1 }"
              :title="valuesOf(property.id).length === 1 ? t('item_properties.clear_value') : t('item_properties.remove_value')"
              @click="removeValue(property.id, index)"
            >−</button>

            <!--
              «+» — один на свойство, на последнем значении. В верхних строках
              его нет, и поле с единицей измерения уезжало бы вправо на ширину
              кнопки, поэтому там «×» растягивается на два нажатия: ровно на
              место, которое в нижней строке занимают «×» и «+» вместе. Ширина
              поля от этого одинаковая во всех строках, и невидимых кнопок-
              пустышек не нужно.
            -->
            <button
              v-if="!readonly && index === valuesOf(property.id).length - 1"
              type="button"
              class="input-group__btn input-group__btn--icon input-group__btn--add"
              :title="t('item_properties.add_more')"
              @click="addValue(property.id)"
            >+</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DictionaryResponse } from '~/repository/modules/dictionary'
import type { PropertyResponse } from '~/repository/modules/property'
import type { ItemPropertyInput } from '~/repository/modules/item'

type Slot = { value: string; dictionaryValueId: number | null }

/**
 * Редактор свойств предмета.
 *
 * Показывается три источника, и все три важны:
 *
 * - набор по умолчанию, посчитанный сервером для категории (вложенные
 *   категории и уже заполненные значения — его считает ItemPropertyService);
 * - свойства, которые уже заведены у предмета: набор по умолчанию имеет смысл
 *   только как отправная точка, поэтому свойство, добавленное руками или
 *   оставшееся после смены категории, не должно пропасть из карточки и вместе
 *   с собой стереть значение;
 * - всё остальное, что есть у пользователя, — через список добавления. Именно
 *   поэтому набор по умолчанию ничего не запрещает: он подсказывает, а не
 *   ограничивает.
 *
 * Значения редактируются в буфере rows, а наружу уходит ровно то, что в
 * modelValue: буфер перезаписывается только при смене resetKey, иначе
 * собственная выдача component'а затирала бы наполовину введённую строку.
 */
const { t } = useI18n()

const props = defineProps<{
  /** Набор по умолчанию — то, что сервер насчитал для категории. */
  defaultProperties: PropertyResponse[]
  /** Все свойства пользователя: отсюда берутся и те, что в наборе нет. */
  availableProperties: PropertyResponse[]
  modelValue: ItemPropertyInput[]
  dictionaries: DictionaryResponse[]
  /** Меняется, когда загружен другой предмет или другая категория. */
  resetKey: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ItemPropertyInput[]]
}>()

const rows = ref<Record<number, Slot[]>>({})
/** Свойства, добавленные руками из списка: в наборе по умолчанию их нет. */
const addedIds = ref<number[]>([])
const pendingId = ref('')

const byId = computed(() => {
  const map = new Map<number, PropertyResponse>()

  for (const property of props.availableProperties) {
    map.set(property.id, property)
  }

  return map
})

const defaultIds = computed(() => new Set(props.defaultProperties.map((p) => p.id)))

/**
 * Свойства, которые видны в редакторе: набор по умолчанию, плюс уже
 * заведённые у предмета, плюс добавленные руками. Порядок — по id, как в
 * списке свойств, чтобы карточка не переставлялась сама собой.
 */
const visible = computed(() => {
  const ids = new Set<number>(props.defaultProperties.map((p) => p.id))

  // Свойство из modelValue может отсутствовать в наборе по умолчанию, но в
  // availableProperties оно обязано быть: иначе это чужое или удалённое
  // свойство, и показывать его нечем.
  for (const row of props.modelValue) {
    ids.add(row.property_id)
  }

  for (const id of addedIds.value) {
    ids.add(id)
  }

  return [...ids]
    .map((id) => byId.value.get(id) ?? props.defaultProperties.find((p) => p.id === id))
    .filter((p): p is PropertyResponse => p !== undefined)
    .sort((a, b) => a.id - b.id)
})

/** Названия значений справочников: в списке нужны слова, а не id. */
const valuesByDictionary = computed(() => {
  const map = new Map<number, { id: number; title: string }[]>()

  for (const dictionary of props.dictionaries) {
    map.set(dictionary.id, dictionary.values ?? [])
  }

  return map
})

function byGroup(properties: PropertyResponse[]) {
  const groups: { key: string; label: string; properties: PropertyResponse[] }[] = []
  const byKey = new Map<string, (typeof groups)[number]>()

  for (const property of properties) {
    const key = property.group_id === null ? 'none' : `g${property.group_id}`
    let group = byKey.get(key)

    if (!group) {
      group = { key, label: property.group?.title ?? '', properties: [] }
      byKey.set(key, group)
      groups.push(group)
    }

    group.properties.push(property)
  }

  // Без группы — в конец: безымянные свойства должны быть видны, а не
  // потеряться среди именованных групп.
  groups.sort((a, b) => Number(a.key === 'none') - Number(b.key === 'none'))

  return groups
}

const grouped = computed(() => byGroup(visible.value))

/** Что ещё можно добавить: всё, чего нет в редакторе. */
const pickGroups = computed(() => {
  const shown = new Set(visible.value.map((p) => p.id))
  const rest = props.availableProperties.filter((p) => !shown.has(p.id))

  return byGroup(rest)
})

const hint = computed(() => {
  const n = props.defaultProperties.length

  if (n === 0) return t('item_properties.default_set_empty')
  return t('item_properties.default_count', { count: n })
})

function isDefault(propertyId: number): boolean {
  return defaultIds.value.has(propertyId)
}

function valuesOf(propertyId: number): Slot[] {
  if (!rows.value[propertyId]) {
    rows.value[propertyId] = []
  }

  return rows.value[propertyId]
}

/**
 * Пустое значение для строки, которой ещё нечем заполнять.
 *
 * Поле показывается сразу у любого видимого свойства — и у добавленного, и у
 * взятого из набора по умолчанию. Иначе в строке набора нечего было бы
 * заполнять, и пришлось бы догадываться, что делает «+».
 */
function ensureSlot(propertyId: number): void {
  if (valuesOf(propertyId).length === 0) {
    valuesOf(propertyId).push({ value: '', dictionaryValueId: null })
  }
}

function dictionaryOptions(property: PropertyResponse): { id: number; title: string }[] {
  if (property.dictionary_id === null) return []

  return valuesByDictionary.value.get(property.dictionary_id) ?? []
}

function addProperty() {
  const id = Number(pendingId.value)

  if (!Number.isFinite(id) || id === 0) return

  if (!addedIds.value.includes(id)) {
    addedIds.value.push(id)
  }

  ensureSlot(id)

  pendingId.value = ''
}

function removeProperty(propertyId: number) {
  addedIds.value = addedIds.value.filter((id) => id !== propertyId)
  delete rows.value[propertyId]
  emitValue()
}

function addValue(propertyId: number) {
  valuesOf(propertyId).push({ value: '', dictionaryValueId: null })
  emitValue()
}

/**
 * «×» есть в каждой строке, а не только когда значений несколько, — иначе
 * строка без кнопки оказывалась бы на ширину кнопки длиннее, и поля соседних
 * свойств не совпадали бы. У последнего оставшегося значения кнопка не
 * удаляет строку, а очищает её: так поле остаётся на месте и в него можно
 * сразу вписать новое значение.
 */
function removeValue(propertyId: number, index: number) {
  const values = valuesOf(propertyId)
  if (values.length === 1) {
    values[0] = { value: '', dictionaryValueId: null }
  } else {
    values.splice(index, 1)
  }
  emitValue()
}

function onTextChange(propertyId: number, index: number, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement

  valuesOf(propertyId)[index].value = target.value
  emitValue()
}

function onDictionaryChange(propertyId: number, index: number, event: Event) {
  const target = event.target as HTMLSelectElement
  const raw = target.value

  valuesOf(propertyId)[index].dictionaryValueId = raw === '' ? null : Number(raw)
  valuesOf(propertyId)[index].value = ''
  emitValue()
}

/**
 * Пустые строки в ответ не уходят: сервер и сам отбрасывает незаполненное,
 * а слать их значило бы заставлять его гадать, что считать очисткой.
 */
function emitValue() {
  const result: ItemPropertyInput[] = []

  for (const property of visible.value) {
    const slots = valuesOf(property.id).filter(
      (slot) => slot.dictionaryValueId !== null || slot.value.trim() !== '',
    )

    if (slots.length === 0) continue

    result.push({
      property_id: property.id,
      values: slots.map((slot) =>
        slot.dictionaryValueId !== null
          ? { value: null, dictionary_value_id: slot.dictionaryValueId }
          : { value: slot.value, dictionary_value_id: null },
      ),
    })
  }

  emit('update:modelValue', result)
}

function fillFrom(model: ItemPropertyInput[]) {
  const next: Record<number, Slot[]> = {}

  for (const property of visible.value) {
    next[property.id] = []
  }

  for (const row of model) {
    if (!next[row.property_id]) continue

    for (const value of row.values ?? []) {
      next[row.property_id].push({
        value: value.value ?? '',
        dictionaryValueId: value.dictionary_value_id ?? null,
      })
    }
  }

  rows.value = next

  for (const property of visible.value) {
    ensureSlot(property.id)
  }
}

watch(
  () => props.resetKey,
  () => {
    addedIds.value = []
    pendingId.value = ''
    fillFrom(props.modelValue)
  },
  { immediate: true },
)
</script>

<style scoped>
/*
 * Заголовок и подсказка в шапке блока — теми же правилами, что на странице
 * правки предмета, и по той же причине здесь свои: .field-label и .field-hint
 * описаны в scoped-блоках страниц, а до разметки дочернего компонента они не
 * достают. Без них подсказка остаётся с браузерными 16px и светлым цветом и на
 * тёмном фоне читается как основной текст.
 *
 * Селектор узкий — шапка: у подсказки под выбором свойства своя правильная
 * (.props-picker__hint), и общее правило на неё залезло бы, отобрав у неё
 * отступ снизу.
 */
.props-editor__head .field-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: var(--text-muted);
}

.props-editor__head .field-hint {
  display: block;
  margin: 0;
  font-size: 12px;
  color: var(--text-dim);
}

.props-editor {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
  background: var(--bg);
}

.props-editor__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.props-picker {
  margin-bottom: 4px;
}

.props-picker__hint {
  margin: 0 0 12px;
}

.props-editor__empty {
  margin: 0;
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.5;
}

/*
 * Обёртки не участвуют в раскладке: сетка общая для всего списка, иначе каждая
 * группа (а с ней каждое свойство внутри) считала бы ширину колонки отдельно.
 * Заголовок группы при этом становится элементом сетки на всю ширину, и раз��елитель
 * между группами переезжает на него.
 */
.props-group,
.prop-row {
  display: contents;
}

.props-editor__head,
.props-picker,
.props-picker__hint,
.props-editor__empty,
.props-group__title {
  grid-column: 1 / -1;
}

.props-group__title {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

/* Первая группа начинает список, и отчерчивать её не от чего. */
.props-group:first-of-type .props-group__title {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.props-group__title {
  font-size: 11px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 8px;
}

/*
 * Общая сетка на весь список свойств.
 *
 * Колонки: название, поле, единица, «−», «+». Единица — одна колонка на все
 * строки, поэтому блоки выравниваются по самому широкому из них без единиц
 * «в ширину двух знаков» и без измерений в скрипте: добавили свойство с новой
 * единицей — сетка пересчиталась сама.
 *
 * gap: 0 намеренно: блоки должны стоять встык, как детали одной группы, и
 * каждая линия между ними — это граница одного блока, а не просвет.
 */
.prop-grid {
  display: grid;
  grid-template-columns: minmax(120px, 260px) 1fr max-content auto auto;
  /*
   * Сетка живёт на всём списке свойств, а не на каждом свойстве отдельно.
   * Пока она была на контейнере одной строки, каждая строка считала ширину
   * колонки сама по себе: «мл» и «г» в одном списке получали разные размеры,
   * и это было видно глазом — вопреки обещанию в комментарии ниже.
   */

  /*
   * Растяжка по высоте, а не start: пока дети были флекс-группой, высоту им
   * давал align-items: stretch, и единица с кнопками были во всю строку
   * вместе с полем. Обёртки значений стали display: contents, и растягивать
   * их стало нечем — с align-items: start единица (19px) и кнопки (20px)
   * осели у верха поля высотой 36px, и колонка выглядела разобранной.
   */
  align-items: stretch;

  /* Интервал между строками значений держит сетка. Раньше его давал
   * gap у флекс-колонки .prop-row__values, а та стала display: contents — и
   * строки слиплись: без этого поля вставали друг к другу вплотную. */
  row-gap: 6px;
  /*
   * Своего отступа у сетки нет: она живёт на том же элементе, что и блок
   * свойств, и её padding: 5px 0 перебивал внутренние отступы блока —
   * содержимое прилипало к рамке вплотную. Отступы задаёт .props-editor.
   */
}

/*
 * Обёртка значения убрана из раскладки: её дети — поле, единица и кнопки —
 * становятся ячейками общей сетки напрямую. Иначе каждая строка снова была бы
 * отдельной группой, и колонка единиц считалась бы по ней одной.
 */
.prop-grid__row {
  display: contents;
}

.prop-grid__row > .input-group__control {
  grid-column: 2;
  grid-row: auto;
  border-radius: 4px 0 0 4px;
}

/*
 * Единица — отдельная ячейка со своей рамкой, и одинаковая у всех строк.
 *
 * Ширину задаёт колонка max-content: блок ровно по самому широкому из них, а
 * внутри — только отступы вокруг текста, без минимальной ширины. Раньше здесь
 * стоял min-width в два знака, и однобуквенная «г» занимала место, где в
 * другой строке стояло «мл», — блок выглядел пустым и раздутым.
 */
.prop-grid__row > .input-group-text {
  grid-column: 3;
  grid-row: auto;
  /*
   * Растяжка по колонке: без неё каждая ячейка равна своему тексту, и «г»
   * оказывалась вдвое уже «мл» при общей колонке. Столбец единиц должен
   * выглядеть столбцом, а не лесенкой.
   */
  justify-self: stretch;
  justify-content: center;
  background: var(--bg-sunken);
}

/*
 * Левую рамку здесь не переопределяем: у «−» и «+» она своя, из template.sass,
 * и она отличает кнопку от поля рядом. Правило сетки и так выше по
 * специфичности, и стоило здесь написать border-left: none — рамка пропадала
 * совсем: у кнопок не оставалось границы слева, а у поля она была, и стык
 * читался как разрыв.
 */
.prop-grid__row > .input-group__btn--minus {
  grid-column: 4;
  grid-row: auto;
  border-radius: 0;
}

/*
 * В верхних строках «+» нет, и без растяжки «−» поле уезжало бы вправо на его
 * ширину: колонки-то у всех строк общие. Поэтому «−» занимает сразу две
 * колонки — ровно столько, сколько в нижней строке занимают «−» и «+» вместе.
 */
.prop-grid__row > .input-group__btn--wide {
  grid-column: 4 / span 2;
  border-radius: 0 4px 4px 0;
}

/*
 * Правая граница у «+» не читалась: скругление 4px съедало её у самого края, и
 * при ширине 38px оставалась полоска в четверть пикселя. Скругление убирать
 * нельзя — ради него группа и выглядит группой, — поэтому правая рамка вдвое
 * толще остальных: на скруглении она идёт по дуге и остаётся заметной.
 */
.prop-grid__row > .input-group__btn--add {
  grid-column: 5;
  grid-row: auto;
  border-radius: 0 4px 4px 0;
  border-right-width: 2px;
}

/*
 * У строки без кнопок (режим просмотра) правый край срезается: кнопок, кому
 * достать скругление, нет, и квадратный угол смотрелся бы обрывом.
 */
.prop-grid__row:last-child > .input-group-text:last-child {
  border-radius: 0 4px 4px 0;
}

/*
 * Названия свойств в первой колонке. У них своя рамка не нужна, но отступы
 * остаются: иначе подпись прилипла бы к полю.
 */
.prop-grid__label {
  grid-column: 1;
  grid-row: auto / span 1;
  align-self: start;
  padding-right: 12px;
}

/*
 * На узком экране колонка названия и поля больше не умещаются рядом: названия
 * уходят в свою строку над значением, а колонки сжимаются до нужного.
 */
@media (max-width: 768px) {
  .prop-grid {
    grid-template-columns: 1fr auto auto auto;
  }

  .prop-grid__label {
    grid-column: 1 / -1;
    grid-row: auto;
    padding-right: 0;
    padding-bottom: 4px;
  }

  .prop-grid__row > .input-group__control {
    grid-column: 1;
  }
}

/*
 * Название свойства и крестик удаления — одна строка. Отдельной колонки под
 * крестик не делаем намеренно: у свойств из набора по умолчанию его не бывает,
 * и резервированная колонка сдвинула бы все подписи вправо.
 */
.prop-row__label {
  flex: 0 0 40%;
  max-width: 40%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
  color: var(--text-muted);
  padding-top: 8px;
}

.prop-row__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.prop-row__title {
  min-width: 0;
}

.prop-row__default {
  display: block;
  font-size: 11px;
  color: var(--success);
}

/*
 * Значения одного свойства идут строго друг под другом.
 *
 * Раньше здесь был flex-wrap с basis 200px, и три значения укладывались в
 * строку, а четвёртое падало во вторую колонку — колонки разной длины читались
 * как разные свойства. Вертикальный список снимает вопрос: у значения одна
 * строка, сколько их ни заведи.
 */
.prop-row__values {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

/*
 * Обёртка значений убирается из раскладки — её содержимое становится прямыми
 * ячейками общей сетки строки. Объявлено после .prop-row__values: у правил
 * одинаковая специфичность, и перебивает то, которое ниже. Пока обёртка была
 * обычным блоком, сетка видела в ней пустую колонку, а блок единиц
 * растягивался на всю ширину поля.
 */
.prop-grid .prop-row__values {
  display: contents;
}

/*
 * Крестик удаления свойства — единственное по-настоящему опасное действие в
 * строке, поэтому он единственный красный. Значение убирается «-» синего цвета:
 * это обычный шаг, а не удаление.
 *
 * Мелкий и приглушённый: он стоит у названия, а не в поле, и наравне с ним
 * кричать не должен.
 */
.prop-row__remove {
  flex-shrink: 0;
  display: block;
  width: 20px;
  height: 20px;
  font-size: 13px;
  line-height: 1;
  font-family: inherit;
  background: var(--danger-bg);
  color: var(--danger-ink);
  border: 1px solid var(--danger);
  border-radius: 4px;
  cursor: pointer;
}

.prop-row__remove:hover {
  background: var(--danger-bg);
}

@media (max-width: 768px) {
  .prop-row {
    flex-direction: column;
    gap: 4px;
  }

  .prop-row__label {
    flex: none;
    max-width: none;
    padding-top: 0;
  }

  .prop-row__values {
    width: 100%;
  }
}
</style>
