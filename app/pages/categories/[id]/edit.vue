<template>
  <div class="edit-page">
    <h3 class="page-title">Редактирование категории #{{ id }}</h3>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <section v-if="activeTab === 'main'" class="tab-section">
        <form class="edit-form" @submit.prevent="save">
          <label class="field">
            <span class="field-label">Название</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="200" required />
          </label>

          <label class="field">
            <span class="field-label">Родительская категория</span>
            <select v-model="form.parent_id" class="field-select">
              <option :value="null">[КОРЕНЬ]</option>
              <option v-for="option in parentOptions" :key="option.id" :value="option.id">
                {{ '—'.repeat(option.depth) }}{{ option.depth > 0 ? ' ' : '' }}{{ option.title }}
              </option>
            </select>
            <span class="field-hint">Ни сама категория, ни её вложенные сюда попасть не могут</span>
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
            <NuxtLink to="/categories" class="btn-cancel">Отмена</NuxtLink>
          </div>
        </form>

        <div class="children">
          <div class="children__head">
            <span class="children__title">Вложенные категории</span>
            <NuxtLink :to="`/categories/create?parent_id=${id}`" class="btn-add">Добавить внутрь</NuxtLink>
          </div>

          <ul v-if="children.length" class="children__list">
            <li v-for="child in children" :key="child.id" class="children__item">
              <NuxtLink :to="`/categories/${child.id}/edit`" class="children__link">{{ child.title }}</NuxtLink>
              <span class="children__count">
                {{ child.items_count ? `${child.items_count} предм.` : 'пусто' }}
              </span>
            </li>
          </ul>

          <div v-else class="children__empty">Вложенных категорий нет</div>
        </div>
      </section>

      <section v-if="activeTab === 'properties'" class="tab-section">
        <div v-if="propertiesLoading" class="loading">Загрузка...</div>
        <div v-else-if="propertiesError" class="error">{{ propertiesError }}</div>

        <template v-else>
          <p class="section-hint">
            Набор считается сервером по уже заполненным значениям и включает предметы
            вложенных категорий. Свойство появляется здесь само, как только его заполнят
            хотя бы у одного предмета.
          </p>

          <table v-if="properties.length" class="props-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Тип</th>
                <th>Группа</th>
                <th>Единица</th>
                <th>Справочник</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="property in properties" :key="property.id">
                <td data-label="ID">{{ property.id }}</td>
                <td data-label="Название">
                  <NuxtLink :to="`/properties/${property.id}/edit`" class="row-link">{{ property.title }}</NuxtLink>
                </td>
                <td data-label="Тип">{{ property.type_label }}</td>
                <td data-label="Группа">
                  <span v-if="property.group">{{ property.group.title }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td data-label="Единица">
                  <span v-if="property.unit">{{ property.unit.title_short }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td data-label="Справочник">
                  <span v-if="property.dictionary">
                    <NuxtLink :to="`/dictionaries/${property.dictionary.id}/edit?tab=values`" class="row-link">
                      {{ property.dictionary.title }}
                    </NuxtLink>
                  </span>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="empty">
            Для этой категории пока нет заполненных свойств
          </div>
        </template>
      </section>

      <section v-if="activeTab === 'stats'" class="tab-section">
        <EntityAuditStats entity-type="category" :entity-id="Number(id)" />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import { categoryParentOptions } from '~/composables/categorySelectOptions'
import type { CategoryResponse } from '~/repository/modules/category'
import type { PropertyResponse } from '~/repository/modules/property'

const { $api, $notify } = useNuxtApp()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const categories = ref<CategoryResponse[]>([])
const properties = ref<PropertyResponse[]>([])
const propertiesLoading = ref(false)
const propertiesError = ref<string | null>(null)

const form = reactive<{ title: string; parent_id: number | null }>({ title: '', parent_id: null })

const tabs = [
  { key: 'main', label: 'Основные параметры' },
  { key: 'properties', label: 'Свойства' },
  { key: 'stats', label: 'Статистика' },
]

const activeTab = computed(() => {
  const tab = route.query.tab

  return tab === 'stats' || tab === 'properties' ? tab : 'main'
})

const parentOptions = computed(() => categoryParentOptions(categories.value, Number(id)))

const children = computed(() =>
  categories.value
    .filter((category) => category.parent_id === Number(id))
    .sort((a, b) => a.id - b.id)
)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [category, all] = await Promise.all([
      $api.category.get(Number(id)),
      $api.category.all(),
    ])
    form.title = category.title
    form.parent_id = category.parent_id
    categories.value = all
  } catch (err: any) {
    loadError.value = formatApiError(err, 'Ошибка загрузки категории')
  } finally {
    loading.value = false
  }
}

async function loadProperties() {
  propertiesLoading.value = true
  propertiesError.value = null
  try {
    properties.value = await $api.category.properties(Number(id))
  } catch (err: any) {
    propertiesError.value = formatApiError(err, 'Ошибка загрузки свойств категории')
  } finally {
    propertiesLoading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api.category.update(Number(id), { title: form.title, parent_id: form.parent_id })
    $notify.add('Категория сохранена', { type: 'success' })
    // Дерево могло переехать, поэтому перечитываем его целиком: иначе
    // список вложенных и селект родителя остались бы от старой структуры.
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка сохранения'), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'properties' && properties.value.length === 0 && !propertiesError.value) {
    loadProperties()
  }
}, { immediate: true })

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
  width: 100%;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: #888;
  margin-bottom: 4px;
}

.field-input,
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

.field-input:focus,
.field-select:focus {
  border-color: #666;
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

.btn-save,
.btn-add {
  padding: 8px 20px;
  font-size: 14px;
  font-family: inherit;
  background: #2a5a2a;
  color: #cfc;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.btn-save:hover:not(:disabled) {
  background: #3a7a3a;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: default;
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

.children {
  border: 1px solid #2f2f2f;
  border-radius: 6px;
  padding: 14px;
  background: #202020;
}

.children__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.children__title {
  font-size: 13px;
  color: #888;
}

.children__head .btn-add {
  padding: 5px 12px;
  font-size: 13px;
}

.children__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.children__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid #2b2b2b;
}

.children__item:last-child {
  border-bottom: 0;
}

.children__link {
  color: #88a;
  font-size: 14px;
  text-decoration: none;
}

.children__link:hover {
  color: #aaf;
  text-decoration: underline;
}

.children__count {
  font-size: 12px;
  color: #666;
}

.children__empty {
  font-size: 13px;
  color: #777;
}

.section-hint {
  margin: 0;
  font-size: 12px;
  color: #777;
  line-height: 1.5;
}

.empty {
  padding: 20px;
  color: #888;
}

.props-table {
  width: 100%;
  border-collapse: collapse;
}

.props-table th,
.props-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.props-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.props-table td {
  color: #ccc;
}

.props-table tr:hover td {
  background: #252525;
}

.row-link {
  color: #88a;
  text-decoration: none;
}

.row-link:hover {
  color: #aaf;
  text-decoration: underline;
}

.muted {
  color: #666;
}

@media (max-width: 768px) {
  .form-actions {
    flex-wrap: wrap;
  }

  .props-table,
  .props-table tbody,
  .props-table tr,
  .props-table td {
    display: block;
  }

  .props-table thead {
    display: none;
  }

  .props-table tr {
    margin-bottom: 14px;
    padding: 10px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .props-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .props-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .props-table tr:hover td {
    background: transparent;
  }
}
</style>
