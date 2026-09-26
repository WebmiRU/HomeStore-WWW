<template>
  <div class="props-editor">
    <div class="props-editor__head">
      <span class="field-label">Свойства</span>
      <span class="field-hint">{{ hint }}</span>
    </div>

    <div v-if="!readonly" class="input-group props-picker">
      <select v-model="pendingId" class="field-select input-group__control" :disabled="!pickGroups.length">
        <option value="" disabled>
          {{ pickGroups.length ? '[ВЫБЕРИТЕ СВОЙСТВО]' : '[ВСЕ СВОЙСТВА УЖЕ ДОБАВЛЕНЫ]' }}
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
        title="Добавить выбранное свойство"
        @click="addProperty"
      >Добавить</button>
    </div>
    <p v-if="!readonly" class="field-hint props-picker__hint">
      Список свойств по умолчанию считается по уже заполненным значениям в этой категории.
      Любое другое свойство можно добавить отсюда — набор по умолчанию не ограничивает.
    </p>

    <p v-if="!visible.length" class="props-editor__empty">
      Пока нет ни одного свойства. Выберите его в списке выше — и заполните значение.
    </p>

    <div v-for="group in grouped" :key="group.key" class="props-group">
      <div v-if="group.label" class="props-group__title">{{ group.label }}</div>

      <div v-for="property in group.properties" :key="property.id" class="prop-row">
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
        <span class="prop-row__label">
          <span class="prop-row__head">
            <span class="prop-row__title">{{ property.title }}</span>
            <button
              v-if="!readonly && !isDefault(property.id)"
              type="button"
              class="prop-row__remove"
              title="Убрать свойство у предмета"
              @click="removeProperty(property.id)"
            >×</button>
          </span>
          <span v-if="isDefault(property.id)" class="prop-row__default">по умолчанию</span>
        </span>

        <div class="prop-row__values">
          <div v-for="(slot, index) in valuesOf(property.id)" :key="index" class="input-group prop-value">
            <select
              v-if="property.type === 'dictionary'"
              class="field-select input-group__control"
              :value="slot.dictionaryValueId ?? ''"
              :disabled="readonly"
              @change="onDictionaryChange(property.id, index, $event)"
            >
              <option value="">[НЕ ВЫБРАНО]</option>
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
              <option value="">[НЕ ЗАПОЛНЕНО]</option>
              <option value="да">да</option>
              <option value="нет">нет</option>
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
              :title="valuesOf(property.id).length === 1 ? 'Очистить значение' : 'Убрать значение'"
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
              title="Добавить ещё значение"
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

  if (n === 0) return 'Набор по умолчанию для категории пуст'
  return `По умолчанию ${n} шт. — набор считается по уже заполненным значениям`
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
  color: #888;
}

.props-editor__head .field-hint {
  display: block;
  margin: 0;
  font-size: 12px;
  color: #777;
}

.props-editor {
  border: 1px solid #2f2f2f;
  border-radius: 6px;
  padding: 14px;
  background: #202020;
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
  color: #777;
  line-height: 1.5;
}

.props-group + .props-group {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #2b2b2b;
}

.props-group__title {
  font-size: 11px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 8px;
}

.prop-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 5px 0;
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
  color: #aaa;
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
  color: #5f7f5f;
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
  background: #3a1f1f;
  color: #f8a8a8;
  border: 1px solid #7a3a3a;
  border-radius: 4px;
  cursor: pointer;
}

.prop-row__remove:hover {
  background: #4d2a2a;
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
