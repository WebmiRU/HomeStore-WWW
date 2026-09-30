<template>
  <div class="edit-page">
    <h3 class="page-title">{{ t('items.edit_title', { id }) }}</h3>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <form @submit.prevent="save" class="edit-form">
        <section v-if="activeTab === 'main'" class="tab-section">
          <label class="field">
            <span class="field-label">{{ t('form.title') }}</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="500" required :readonly="!canEdit" />
          </label>

          <label class="field">
            <span class="field-label">{{ t('form.title_print') }}</span>
            <input v-model="form.title_print" type="text" class="field-input" maxlength="500" :readonly="!canEdit" />
          </label>

          <label class="field">
            <span class="field-label">{{ t('form.vendor') }}</span>
            <select v-model="form.vendor_id" class="field-select" :disabled="!canEdit">
              <option :value="null">{{ t('placeholders.none') }}</option>
              <option v-if="deletedVendor" :value="deletedVendor.id" disabled>
                {{ deletedVendor.label }}
              </option>
              <option v-for="option in vendorOptions" :key="option.id" :value="option.id">
              {{ option.title }}
              </option>
            </select>
            <span class="field-hint">{{ t('items.vendor_hint') }}</span>
          </label>

          <label class="field">
            <span class="field-label">{{ t('form.store') }}</span>
            <select v-model.number="form.store_id" class="field-select" :disabled="!canEdit">
              <option :value="null">{{ t('placeholders.none') }}</option>
              <option v-if="deletedStore" :value="deletedStore.id" disabled>
                {{ deletedStore.label }}
              </option>
              <optgroup v-for="group in storeGroups" :key="group.label" :label="group.label">
                <option
                  v-for="opt in group.options"
                  :key="opt.id"
                  :value="opt.id"
                >{{ opt.own ? '●' : '○' }} {{ '\u2014'.repeat(opt.depth) }}{{ opt.depth > 0 ? ' ' : '' }}{{ opt.title }}</option>
              </optgroup>
            </select>
            <span class="field-hint">{{ t('items.own_storage_hint') }}</span>
          </label>

          <label class="field">
            <span class="field-label">{{ t('form.category') }}</span>
            <select v-model="form.category_id" class="field-select" :disabled="!canEdit" @change="onCategoryChange">
              <option :value="null">{{ t('placeholders.none') }}</option>
              <option v-if="deletedCategory" :value="deletedCategory.id" disabled>
                {{ deletedCategory.label }}
              </option>
              <option v-for="option in categoryOptions" :key="option.id" :value="option.id">
                {{ '—'.repeat(option.depth) }}{{ option.depth > 0 ? ' ' : '' }}{{ option.title }}
              </option>
            </select>
            <span class="field-hint">{{ t('items.category_hint') }}</span>
          </label>

          <div class="field">
            <span class="field-label">{{ t('items.codes') }}</span>
            <ItemCodesEditor
              v-model="codes"
              v-model:release-code-on-writeoff="releaseCodeOnWriteoff"
              :readonly="!canEdit"
            />
            <button v-if="codesChanged && canEdit" type="button" class="btn-reset-code" @click="resetCodes">{{ t('common.reset') }}</button>
          </div>

          <label class="field">
            <span class="field-label">{{ t('form.quantity') }}</span>
            <!--
              У предмета, который живёт по кодам, количество равно числу его
              кодов: сервер считает его сам. Поле оставлено видимым, но не
              редактируемым — иначе человек выставил бы число, противоречащее
              наклейкам, и списание пошло бы не по тем единицам.
            -->
            <input
              v-model="quantityInput"
              type="number"
              class="field-input"
              step="1"
              :placeholder="t('items.quantity_placeholder')"
              :readonly="!canEdit || releaseCodeOnWriteoff || partialEnabled"
            />
            <span v-if="releaseCodeOnWriteoff" class="field-hint">
              {{ t('items.quantity_by_codes_hint') }}
            </span>
            <span v-else-if="partialEnabled" class="field-hint">
              {{ t('items.quantity_by_partial_hint') }}
            </span>
          </label>
        </section>

        <section v-if="activeTab === 'properties'" class="tab-section">
          <div v-if="propertiesLoading" class="loading">{{ t('form.loading') }}</div>
          <ItemPropertiesEditor
            v-else
            v-model="properties"
            :defaultProperties="categoryProperties"
            :availableProperties="allProperties"
            :dictionaries="dictionaries"
            :resetKey="propertiesKey"
            :readonly="!canEdit"
          />

          <!--
            Настройка расхода живёт под значениями свойств, а не рядом с
            кодами: расходуется именно то, что только что заполнено выше, и
            без этих значений настраивать нечего.
          -->
          <div v-if="!propertiesLoading" class="field partial-block">
            <span class="field-label">{{ t('items.partial_title') }}</span>
            <ItemPartialWriteoffEditor
              v-model="partialProperties"
              :properties="partialCandidates"
              :readonly="!canEdit"
            />
          </div>
        </section>

        <section v-if="activeTab === 'images'" class="tab-section">
          <ImagesTable v-model="images" entity="item" :entity-id="Number(id)" :readonly="!canEdit" />
        </section>

        <section v-if="activeTab === 'balance'" class="tab-section">
          <EntityBalanceChart entity-type="item" :entity-id="Number(id)" />
        </section>

        <section v-if="activeTab === 'movements'" class="tab-section">
          <ItemMovementsList :item-id="Number(id)" />
        </section>

        <section v-if="activeTab === 'stats'" class="tab-section">
          <EntityAuditStats entity-type="item" :entity-id="Number(id)" :partial="itemEntity?.partial ?? []" />
        </section>

        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="saving || !canEdit">{{ t('form.save') }}</button>
          <NuxtLink
            v-if="canEdit"
            :to="{
              path: '/items/create',
              query: {
                copy_title: form.title,
                copy_title_print: form.title_print,
                copy_store_id: form.store_id,
                copy_category_id: form.category_id,
                copy_vendor_id: form.vendor_id,
                copy_codes: JSON.stringify(filledCodes()),
                copy_quantity: quantityInput,
                copy_properties: JSON.stringify(properties),
                // Без .value: в шаблоне ссылка на ref уже развёрнута, и
                // «partialProperties.value» здесь давал undefined — параметр
                // молча пропадал из ссылки «создать копию».
                copy_partial_properties: JSON.stringify(partialProperties),
              },
            }"
            class="btn-copy"
          >{{ t('form.clone') }}</NuxtLink>
          <NuxtLink to="/items" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import type { ItemPayload } from '~/repository/modules/code'
import type { ItemResponse, ItemPropertyInput, ItemPartialPropertyInput } from '~/repository/modules/item'
import type { ImageResponse } from '~/repository/modules/image'
import type { StoreResponse } from '~/repository/modules/store'
import type { CategoryResponse } from '~/repository/modules/category'
import type { VendorResponse } from '~/repository/modules/vendor'
import type { DictionaryResponse } from '~/repository/modules/dictionary'
import type { PropertyResponse } from '~/repository/modules/property'
import { useStoreSelectOptions, type StoreSelectGroup } from '~/composables/storeSelectOptions'
import { categorySelectOptions } from '~/composables/categorySelectOptions'
import { deletedOption } from '~/composables/deletedOption'
import { vendorSelectOptions } from '~/composables/vendorSelectOptions'
import { useCodeConflictNotice } from '~/composables/useCodeConflictNotice'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const { notifyCodeConflicts } = useCodeConflictNotice()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const quantityInput = ref('')
const images = ref<ImageResponse[]>([])
const itemEntity = ref<ItemResponse | null>(null)

const canEdit = computed(() => itemEntity.value?.rights?.includes('edit') ?? false)

const tabs = computed(() => [
  { key: 'main', label: t('items.main_tab') },
  { key: 'properties', label: t('form.properties_tab') },
  { key: 'images', label: t('items.images_tab') },
  { key: 'balance', label: t('form.balance_tab') },
  { key: 'movements', label: t('form.movements_tab') },
  { key: 'stats', label: t('items.stats_tab') },
])

const activeTab = computed(() => {
  const q = route.query.tab
  if (typeof q === 'string' && tabs.value.some((t) => t.key === q)) {
    return q
  }
  return 'main'
})

const stores = ref<StoreResponse[]>([])
const categories = ref<CategoryResponse[]>([])
const vendors = ref<VendorResponse[]>([])
const dictionaries = ref<DictionaryResponse[]>([])
const allProperties = ref<PropertyResponse[]>([])

const storeGroups = computed<StoreSelectGroup[]>(() => useStoreSelectOptions(stores.value, itemEntity.value?.payload?.store_id ?? null))

const categoryOptions = computed(() => categorySelectOptions(categories.value))

const vendorOptions = computed(() => vendorSelectOptions(vendors.value))

// Позиция «текущее значение удалено» для каждого селекта: значение задано,
// но родителя в списке уже нет, и без неё форма врала бы, что поле пустое.
const deletedVendor = computed(() =>
  deletedOption(vendorOptions.value, form.vendor_id, itemEntity.value?.vendor),
)

const deletedCategory = computed(() =>
  deletedOption(categoryOptions.value, form.category_id, itemEntity.value?.category),
)

const deletedStore = computed(() => {
  const chain = itemEntity.value?.store ?? []

  return deletedOption(
    storeGroups.value.flatMap((group) => group.options),
    form.store_id,
    chain[0],
  )
})

const form = reactive({
  title: '',
  title_print: '',
  store_id: null as number | null,
  category_id: null as number | null,
  vendor_id: null as number | null,
})

const codes = ref<string[]>([''])
/** Коды как их отдал сервер: по ним считается «изменились» и работает «Сброс». */
const originalCodes = ref<string[]>([''])

/**
 * Пометка «списывать по коду». Отдельное поле, а не часть codes: сервер
 * хранит её у предмета, и она не имеет отношения к списку кодов — у codes
 * и общий сброс, и общая копирование.
 */
const releaseCodeOnWriteoff = ref(false)
/** Пометка как её отдал сервер: к ней возвращает «Сброс». */
const originalReleaseCodeOnWriteoff = ref(false)

/**
 * Количество помеченного предмета — это число его кодов, и пересчёт идёт на
 * лету, при каждой правке списка кодов, а не после сохранения: иначе рядом с
 * кодами стояло бы чужое число, и человек узнал бы правильное лишь после
 * сохранения.
 *
 * Сервер при сохранении считает так же — это число нужно, чтобы форма
 * показывала то, что будет записано, а не то, что было при открытии.
 */
watch(
  [codes, releaseCodeOnWriteoff],
  () => {
    if (!releaseCodeOnWriteoff.value) {
      return
    }

    // Пустые строки кодом не считаются: строки в списке бывают, и последняя
    // из них всегда пустая под следующий код.
    //
    // Ноль кодов — это ноль, а не пустое поле: пустое количество в интерфейсе
    // значит «единичный экземпляр», то есть ровно одна штука, и предмет без
    // кодов выглядел бы сразу непустым. Написать сюда надо именно 0.
    const count = codes.value.filter((code) => code.trim() !== '').length

    quantityInput.value = String(count)
  },
)

const properties = ref<ItemPropertyInput[]>([])
const categoryProperties = ref<PropertyResponse[]>([])

/**
 * Свойства, которые редактор расхода может предложить: заполненные значения с
 * их типами и названиями.
 *
 * Список полей ввода для этого не годится: он меняется на каждый символ и не
 * знает типов, а редактору нужно знать, какое свойство числовое и каким оно
 * заполнено — по этому и предлагается расход.
 */
const partialCandidates = computed(() => {
  const byId = new Map(allProperties.value.map((property) => [property.id, property]))

  return properties.value.map((entry) => {
    const property = byId.get(entry.property_id)
    // Числовой тип нужен для отсева: свойство без него в списке расхода было бы
    // ошибкой, потому что расходнуть «да/нет» или значение из справочника нельзя.
    const type = property?.type ?? 'text'
    // Берётся первое непустое значение: у свойства их может быть несколько, а
    // нормой списания служит то, что человек видит в поле.
    const value = entry.values
      .map((item) => item.value)
      .find((item) => item !== null && item !== undefined && String(item).trim() !== '')

    return {
      property_id: entry.property_id,
      title: property?.title ?? String(entry.property_id),
      type,
      value: value ?? null,
    }
  })
})

/** Настройки расхода частями: какие свойства и с каким шагом. */
const partialProperties = ref<ItemPartialPropertyInput[]>([])

/** Включено ли частичное списание — есть хоть одно расходуемое свойство. */
const partialEnabled = computed(() => partialProperties.value.length > 0)

/**
 * Два режима списания взаимоисключающи, и выключает включающий.
 *
 * Там единица — код, здесь — запас свойства. При обоих включённых количество
 * уменьшалось бы двумя несовместимыми способами, и прав выяснилось бы только
 * в журнале. Молча снимать нельзя: человек должен знать, что режим сменился,
 * поэтому ему показывается объяснение.
 */
watch(
  partialProperties,
  (value) => {
    if (value.length > 0 && releaseCodeOnWriteoff.value) {
      releaseCodeOnWriteoff.value = false
      $notify.add(t('items.partial_exclusive_hint'), { type: 'info', timer: 8 })
    }
  },
  { deep: true },
)

watch(
  releaseCodeOnWriteoff,
  (value) => {
    if (value && partialProperties.value.length > 0) {
      partialProperties.value = []
      $notify.add(t('items.partial_exclusive_hint'), { type: 'info', timer: 8 })
    }
  },
)
const propertiesLoading = ref(false)
const propertiesKey = ref('')

/**
 * «Сброс» показывается только когда есть что сбрасывать.
 *
 * Пустая строка в списке — это не изменение: такая строка означает
 * «придумай код», а не «удали мой». Иначе кнопка вылезла бы сразу после
 * открытия карточки и путала с пустым полем, в которое просто прицеливаются
 * сканером.
 */
const codesChanged = computed(
  () =>
    normalizedCodes(codes.value) !== normalizedCodes(originalCodes.value)
    || releaseCodeOnWriteoff.value !== originalReleaseCodeOnWriteoff.value,
)

function normalizedCodes(list: string[]): string {
  // Разделитель нужен, чтобы «ab» + «c» и «a» + «bc» не сравнились как
  // равные: без него это один и тот же ключ от двух разных списков.
  return list.map((c) => c.trim()).filter((c) => c !== '').join('|')
}

/** Коды, которые действительно поедут на сервер: без пустых строк. */
function filledCodes(): string[] {
  return codes.value.map((c) => c.trim()).filter((c) => c !== '')
}

function resetCodes() {
  codes.value = [...originalCodes.value]
  releaseCodeOnWriteoff.value = originalReleaseCodeOnWriteoff.value
}

/** Приводит ответ сервера к виду, который принимает редактор. */
function toPropertyInputs(rows: ItemResponse['properties']): ItemPropertyInput[] {
  const byProperty = new Map<number, ItemPropertyInput>()

  for (const row of rows ?? []) {
    const entry = byProperty.get(row.property_id) ?? { property_id: row.property_id, values: [] }
    entry.values.push(
      row.dictionary_value_id !== null
        ? { value: null, dictionary_value_id: row.dictionary_value_id }
        : { value: row.value, dictionary_value_id: null },
    )
    byProperty.set(row.property_id, entry)
  }

  return [...byProperty.values()]
}

async function loadProperties(categoryId: number | null) {
  propertiesLoading.value = true
  try {
    categoryProperties.value = categoryId === null ? [] : await $api.category.properties(categoryId)
    propertiesKey.value = String(categoryId)
  } catch (err: any) {
    categoryProperties.value = []
    $notify.add(formatApiError(err, t('categories.properties_load_failed')), { type: 'error', timer: 10 })
  } finally {
    propertiesLoading.value = false
  }
}

/**
 * Смена категории меняет только набор по умолчанию. Заведённые вручную
 * свойства и их значения остаются: набор по умолчанию — подсказка, а не
 * ограничение, и стирать из-за него руками введённое незачем.
 */
async function onCategoryChange() {
  await loadProperties(form.category_id)
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [item, list, all, dicts, props, vendorList] = await Promise.all([
      $api.item.get(Number(id)),
      $api.store.list(),
      $api.category.all(),
      $api.dictionary.all(),
      $api.property.all(),
      $api.vendor.all(),
    ])

    stores.value = list
    categories.value = all
    vendors.value = vendorList
    dictionaries.value = dicts
    allProperties.value = props
    itemEntity.value = item
    form.title = item.payload.title
    form.title_print = item.payload.title_print ?? ''
    form.store_id = item.payload.store_id
    form.category_id = item.payload.category_id
    form.vendor_id = item.payload.vendor_id ?? null
    codes.value = (item.codes ?? []).length > 0 ? [...item.codes!] : ['']
    originalCodes.value = [...codes.value]
    releaseCodeOnWriteoff.value = item.payload.release_code_on_writeoff ?? false
    originalReleaseCodeOnWriteoff.value = releaseCodeOnWriteoff.value
    quantityInput.value = item.payload.quantity != null ? String(item.payload.quantity) : ''
    images.value = item.images ?? []
    properties.value = toPropertyInputs(item.properties)
    partialProperties.value = (item.partial ?? []).map((row) => ({
      property_id: row.property_id,
      step: row.step,
      is_full_reason: row.is_full_reason,
      sort: row.sort,
    }))
    await loadProperties(form.category_id)
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload: Partial<ItemPayload> & {
      codes?: string[]
      properties?: ItemPropertyInput[]
      partial_properties?: ItemPartialPropertyInput[]
    } = {
      title: form.title,
      title_print: form.title_print || null,
      store_id: form.store_id,
      category_id: form.category_id,
      vendor_id: form.vendor_id,
      codes: filledCodes(),
      properties: properties.value,
      partial_properties: partialProperties.value,
      release_code_on_writeoff: releaseCodeOnWriteoff.value,
    }
    const qty = String(quantityInput.value).trim()
    if (qty !== '') {
      payload.quantity = Number(qty)
    }
    const saved = await $api.item.update(Number(id), payload)
    $notify.add(t('form.saved', { title: t('items.one') }), { type: 'success' })
    notifyCodeConflicts(saved)

    // Ответ содержит то, что сервер сделал с предметом, а форма до этого
    // показывала то, что человек в неё вводил. Разница видна не сразу, и
    // обе величины меняются сами собой:
    //
    //   - коды: обычному предмету без кодов сервер подставляет сгенерированный
    //     UUID, и в форме до перезагрузки страницы его не видно;
    //   - количество помеченного предмета пересчитано по кодам.
    const savedCodes = saved.codes ?? []
    if (savedCodes.length > 0) {
      codes.value = [...savedCodes]
      originalCodes.value = [...savedCodes]
    }

    const savedQuantity = saved.payload?.quantity
    quantityInput.value = savedQuantity != null ? String(savedQuantity) : ''

    // Настройки расхода сервер мог поправить: включённый режим выключает
    // второй, и отмеченное свойство могло перестать быть числовым. Форма
    // обязана показать то, что реально записано, а не то, что отправляла.
    if (saved.partial) {
      partialProperties.value = saved.partial.map((row) => ({
        property_id: row.property_id,
        step: row.step,
        is_full_reason: row.is_full_reason,
        sort: row.sort,
      }))
    }
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.save_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.edit-page {
  display: flex;
  flex-direction: column;
}

.page-title {
  margin: 24px 0 8px;
  font-size: 20px;
  color: var(--text-secondary);
}

/*
 * Отступ блока настроек расхода от значений свойств: это отдельная настройка
 * предмета, а не ещё одно поле в списке, и без отступа он читается как часть
 * того же списка.
 */
.partial-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.loading,
.error {
  color: var(--text-muted);
  padding: 12px 0;
}

.error {
  color: var(--danger);
}

.edit-tabs {
  margin: 14px 0 20px;
}

.tab-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.edit-form {
  max-width: none;
  width: 100%;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.tab-section .field {
  margin-bottom: 0;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}
.field-input:focus,
.field-select:focus {
  border-color: var(--border-strong);
}

.field-select {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.field-hint {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

.code-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-input--changed {
  border-color: var(--warn);
  box-shadow: 0 0 0 1px var(--warn);
}

/*
 * Кнопка стоит после списка кодов вместе с подсказкой о них, и без отступа
 * прилипала к тексту подсказки: получалось, что «Сброс» относится к словам,
 * а не к кодам.
 */
.btn-reset-code {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 12px;
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  color: var(--warn-ink);
  background: var(--warn-bg);
  border: 1px solid var(--warn);
  border-radius: 4px;
  cursor: pointer;
}

.btn-reset-code:hover {
  background: color-mix(in srgb, var(--warn) 24%, var(--bg-elevated));
}


.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.btn-save {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-cancel,
.btn-copy {
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-muted);
  text-decoration: none;
  border: 1px dashed var(--border-strong);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.btn-cancel:hover,
.btn-copy:hover {
  color: var(--text);
  background: var(--bg-hover);
  border-style: solid;
}

@media (max-width: 768px) {
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
