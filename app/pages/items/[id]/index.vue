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
            <ItemCodesEditor v-model="codes" :readonly="!canEdit" />
            <button v-if="codesChanged && canEdit" type="button" class="btn-reset-code" @click="resetCodes">{{ t('common.reset') }}</button>
          </div>

          <label class="field">
            <span class="field-label">{{ t('form.quantity') }}</span>
            <input
              v-model="quantityInput"
              type="number"
              class="field-input"
              step="1"
              :placeholder="t('items.quantity_placeholder')"
              :readonly="!canEdit"
            />
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
          <EntityAuditStats entity-type="item" :entity-id="Number(id)" />
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
import { ref, reactive, computed, onMounted } from 'vue'
import type { ItemPayload } from '~/repository/modules/code'
import type { ItemResponse, ItemPropertyInput } from '~/repository/modules/item'
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

const properties = ref<ItemPropertyInput[]>([])
const categoryProperties = ref<PropertyResponse[]>([])
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
const codesChanged = computed(() => normalizedCodes(codes.value) !== normalizedCodes(originalCodes.value))

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
    quantityInput.value = item.payload.quantity != null ? String(item.payload.quantity) : ''
    images.value = item.images ?? []
    properties.value = toPropertyInputs(item.properties)
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
    const payload: Partial<ItemPayload> & { codes?: string[]; properties?: ItemPropertyInput[] } = {
      title: form.title,
      title_print: form.title_print || null,
      store_id: form.store_id,
      category_id: form.category_id,
      vendor_id: form.vendor_id,
      codes: filledCodes(),
      properties: properties.value,
    }
    const qty = String(quantityInput.value).trim()
    if (qty !== '') {
      payload.quantity = Number(qty)
    }
    const saved = await $api.item.update(Number(id), payload)
    $notify.add(t('form.saved', { title: t('items.one') }), { type: 'success' })
    notifyCodeConflicts(saved)
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
  color: #ccc;
}

.loading,
.error {
  color: #888;
  padding: 12px 0;
}

.error {
  color: #f88;
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
  color: #888;
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}
.field-input:focus,
.field-select:focus {
  border-color: #666;
}

.field-select {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.field-hint {
  display: block;
  font-size: 12px;
  color: #777;
  margin-top: 4px;
}

.code-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-input--changed {
  border-color: #e8a33d;
  box-shadow: 0 0 0 1px #e8a33d;
}

.btn-reset-code {
  flex-shrink: 0;
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  color: #f0b45c;
  background: #2e2414;
  border: 1px solid #e8a33d;
  border-radius: 4px;
  cursor: pointer;
}

.btn-reset-code:hover {
  background: #3a2e1a;
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
  background: #2a5a2a;
  color: #cfc;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: #3a7a3a;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-cancel,
.btn-copy {
  padding: 8px 16px;
  font-size: 14px;
  color: #aaa;
  text-decoration: none;
  border: 1px dashed #555;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.btn-cancel:hover,
.btn-copy:hover {
  color: #ddd;
  background: #333;
  border-style: solid;
}

@media (max-width: 768px) {
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
