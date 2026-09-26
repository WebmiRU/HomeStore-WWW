<template>
  <div class="create-page">
    <h3 class="page-title">Добавление предмета</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else @submit.prevent="save" class="create-form">
      <section v-if="activeTab === 'main'" class="tab-section">
        <label class="field">
          <span class="field-label">Название</span>
          <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
        </label>

        <label class="field">
          <span class="field-label">Название для печати</span>
          <input v-model="form.title_print" type="text" class="field-input" maxlength="500" />
        </label>

        <label class="field">
          <span class="field-label">Хранилище</span>
          <select v-model.number="form.store_id" class="field-select">
            <option :value="null">[НЕТ]</option>
            <optgroup v-for="group in storeGroups" :key="group.label" :label="group.label">
              <option
                v-for="opt in group.options"
                :key="opt.id"
                :value="opt.id"
              >{{ opt.own ? '●' : '○' }} {{ '\u2014'.repeat(opt.depth) }}{{ opt.depth > 0 ? ' ' : '' }}{{ opt.title }}</option>
            </optgroup>
          </select>
          <span class="field-hint">● — своё хранилище, ○ — доступ по правам</span>
        </label>

        <label class="field">
          <span class="field-label">Категория</span>
          <select v-model="form.category_id" class="field-select" @change="onCategoryChange">
            <option :value="null">[НЕТ]</option>
            <option v-for="option in categoryOptions" :key="option.id" :value="option.id">
              {{ '—'.repeat(option.depth) }}{{ option.depth > 0 ? ' ' : '' }}{{ option.title }}
            </option>
          </select>
          <span class="field-hint">Задаёт набор свойств по умолчанию на вкладке «Свойства»</span>
        </label>

        <label class="field">
          <span class="field-label">Код</span>
          <input v-model="form.code" type="text" class="field-input" maxlength="256" />
        </label>

        <label class="field">
          <span class="field-label">Количество</span>
          <input
            v-model="quantityInput"
            type="number"
            class="field-input"
            step="1"
            placeholder="без количества"
          />
        </label>
      </section>

      <section v-if="activeTab === 'properties'" class="tab-section">
        <div v-if="propertiesLoading" class="loading">Загрузка свойств...</div>
        <ItemPropertiesEditor
          v-else
          v-model="properties"
          :defaultProperties="categoryProperties"
          :availableProperties="allProperties"
          :dictionaries="dictionaries"
          :resetKey="propertiesKey"
        />
      </section>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
        <button type="button" @click="saveAndCopy" class="btn-save-copy" :disabled="saving">Сохранить и создать копию</button>
        <NuxtLink to="/items" class="btn-cancel">Отмена</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { StoreResponse } from '~/repository/modules/store'
import type { CategoryResponse } from '~/repository/modules/category'
import type { DictionaryResponse } from '~/repository/modules/dictionary'
import type { PropertyResponse } from '~/repository/modules/property'
import type { ItemPropertyInput } from '~/repository/modules/item'
import { useStoreSelectOptions, type StoreSelectGroup } from '~/composables/storeSelectOptions'
import { categorySelectOptions } from '~/composables/categorySelectOptions'

const { $api, $notify } = useNuxtApp()
const router = useRouter()
const route = useRoute()

const scannedCode = typeof route.query.code === 'string' ? route.query.code : ''
const copyTitle = typeof route.query.copy_title === 'string' ? route.query.copy_title : ''
const copyTitlePrint = typeof route.query.copy_title_print === 'string' ? route.query.copy_title_print : ''
const copyStoreId = typeof route.query.copy_store_id === 'string' ? Number(route.query.copy_store_id) : null
const copyCode = typeof route.query.copy_code === 'string' ? route.query.copy_code : ''
const copyQuantity = typeof route.query.copy_quantity === 'string' ? route.query.copy_quantity : ''
// Копия предмета наследует категорию и заполненные ею свойства: иначе
// после «создать копию» пришлось бы вбивать всё заново.
const copyCategoryId = typeof route.query.copy_category_id === 'string' ? Number(route.query.copy_category_id) : null
const copyProperties = parseCopiedProperties(route.query.copy_properties)

function parseCopiedProperties(raw: unknown): ItemPropertyInput[] {
  if (typeof raw !== 'string' || raw === '') return []

  try {
    const parsed = JSON.parse(raw)

    return Array.isArray(parsed) ? (parsed as ItemPropertyInput[]) : []
  } catch {
    // Ссылка могла прийти обрезанной — начинаем с пустых значений.
    return []
  }
}

const tabs = [
  { key: 'main', label: 'Основные параметры' },
  { key: 'properties', label: 'Свойства' },
]

// TabBar живёт на query, поэтому и здесь вкладка берётся из адреса, а не из
// локального состояния: иначе переход по табу не совпал бы с содержимым.
const activeTab = computed(() => {
  const q = route.query.tab
  if (typeof q === 'string' && tabs.some((t) => t.key === q)) {
    return q
  }
  return 'main'
})

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const form = reactive({
  title: copyTitle,
  title_print: copyTitlePrint,
  store_id: copyStoreId,
  category_id: copyCategoryId !== null && Number.isFinite(copyCategoryId) ? copyCategoryId : null,
  code: copyCode !== '' ? copyCode : scannedCode,
})

const quantityInput = ref(copyQuantity)

const storeGroups = computed<StoreSelectGroup[]>(() => useStoreSelectOptions(stores.value))

const stores = ref<StoreResponse[]>([])
const categories = ref<CategoryResponse[]>([])
const dictionaries = ref<DictionaryResponse[]>([])
const allProperties = ref<PropertyResponse[]>([])

const categoryOptions = computed(() => categorySelectOptions(categories.value))

const properties = ref<ItemPropertyInput[]>(copyProperties)
const categoryProperties = ref<PropertyResponse[]>([])
const propertiesLoading = ref(false)
/** Редактор перечитывает значения только при смене ключа — так его не затирает собственная выдача. */
const propertiesKey = ref('')

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [list, all, dicts, props] = await Promise.all([
      $api.store.list(),
      $api.category.all(),
      $api.dictionary.all(),
      $api.property.all(),
    ])
    stores.value = list
    categories.value = all
    dictionaries.value = dicts
    allProperties.value = props
    if (form.category_id !== null) {
      await loadProperties(form.category_id)
    }
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function loadProperties(categoryId: number | null) {
  propertiesLoading.value = true
  try {
    categoryProperties.value = categoryId === null ? [] : await $api.category.properties(categoryId)
    propertiesKey.value = String(categoryId)
  } catch (err: any) {
    categoryProperties.value = []
    $notify.add(formatApiError(err, 'Ошибка загрузки свойств категории'), { type: 'error', timer: 10 })
  } finally {
    propertiesLoading.value = false
  }
}

/**
 * Смена категории меняет только набор по умолчанию: то, что пользователь
 * добавил и заполнил руками, остаётся — набор по умолчанию ничего не запрещает.
 */
async function onCategoryChange() {
  await loadProperties(form.category_id)
}

function itemPayload() {
  return {
    title: form.title,
    title_print: form.title_print || null,
    store_id: form.store_id,
    category_id: form.category_id,
    code: form.code.trim() || null,
    quantity: String(quantityInput.value).trim() === '' ? null : Number(quantityInput.value),
    properties: properties.value,
  }
}

async function save() {
  saving.value = true
  try {
    const created = await $api.item.create(itemPayload())
    $notify.add('Предмет создан', { type: 'success' })
    router.push(`/items/${created.payload.id}/edit`)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка создания'), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

async function saveAndCopy() {
  saving.value = true
  try {
    await $api.item.create(itemPayload())
    $notify.add('Предмет создан', { type: 'success' })
    router.push({
      path: '/items/create',
      query: {
        copy_title: form.title,
        copy_title_print: form.title_print,
        copy_store_id: form.store_id,
        copy_category_id: form.category_id,
        copy_code: form.code,
        copy_quantity: quantityInput.value,
        copy_properties: JSON.stringify(properties.value),
      },
    })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка создания'), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: #ccc;
}

.create-tabs {
  margin: 14px 0 20px;
}

.loading,
.error {
  color: #888;
  padding: 12px 0;
}

.error {
  color: #f88;
}

.create-form {
  width: 100%;
}

.tab-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.btn-save:disabled,
.btn-save-copy:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-save-copy {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  background: #2a5a4a;
  color: #cfc;
  border: 1px solid #3a7a6a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-save-copy:hover:not(:disabled) {
  background: #3a7a6a;
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 14px;
  color: #aaa;
  text-decoration: none;
  border: 1px dashed #555;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.btn-cancel:hover {
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
