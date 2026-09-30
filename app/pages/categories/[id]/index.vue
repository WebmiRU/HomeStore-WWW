<template>
  <div class="edit-page">
    <h3 class="page-title">{{ t('categories.edit_title', { id }) }}</h3>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <section v-if="activeTab === 'main'" class="tab-section">
        <form class="edit-form" @submit.prevent="save">
          <label class="field">
            <span class="field-label">{{ t('form.title') }}</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="200" required />
          </label>

          <label class="field">
            <span class="field-label">{{ t('categories.parent') }}</span>
            <select v-model="form.parent_id" class="field-select">
              <option :value="null">{{ t('placeholders.root') }}</option>
              <option v-for="option in parentOptions" :key="option.id" :value="option.id">
                {{ '—'.repeat(option.depth) }}{{ option.depth > 0 ? ' ' : '' }}{{ option.title }}
              </option>
            </select>
            <span class="field-hint">{{ t('categories.no_self_hint') }}</span>
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
            <NuxtLink to="/categories" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
          </div>
        </form>

        <div class="children">
          <div class="children__head">
            <span class="children__title">{{ t('categories.children') }}</span>
            <NuxtLink :to="`/categories/create?parent_id=${id}`" class="btn-add">{{ t('categories.add_inside') }}</NuxtLink>
          </div>

          <ul v-if="children.length" class="children__list">
            <li v-for="child in children" :key="child.id" class="children__item">
              <NuxtLink :to="`/categories/${child.id}`" class="children__link">{{ child.title }}</NuxtLink>
              <span class="children__count">
                {{ child.items_count ? t('categories.items_short', { count: child.items_count }) : t('categories.empty_word') }}
              </span>
            </li>
          </ul>

          <div v-else class="children__empty">{{ t('categories.no_children') }}</div>
        </div>
      </section>

      <!--
        Фотографии категории: ею её узнают в списке и в «Каталоге».
      -->
      <section v-if="activeTab === 'images'" class="tab-section">
        <ImagesTable v-model="images" entity="category" :entity-id="Number(id)" />
      </section>

      <section v-if="activeTab === 'properties'" class="tab-section">
        <div v-if="propertiesLoading" class="loading">{{ t('form.loading') }}</div>
        <div v-else-if="propertiesError" class="error">{{ propertiesError }}</div>

        <template v-else>
          <p class="section-hint">
            {{ t('categories.properties_hint') }}</p>

          <table v-if="properties.length" class="props-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{{ t('form.title') }}</th>
                <th>{{ t('properties.type') }}</th>
                <th>{{ t('properties.group') }}</th>
                <th>{{ t('properties.unit') }}</th>
                <th>{{ t('properties.dictionary') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="property in properties" :key="property.id">
                <td data-label="ID">{{ property.id }}</td>
                <td :data-label="t('common.title')">
                  <NuxtLink :to="`/properties/${property.id}`" class="row-link">{{ property.title }}</NuxtLink>
                </td>
                <td :data-label="t('properties.type')">{{ property.type_label }}</td>
                <td :data-label="t('properties.group')">
                  <span v-if="property.group">{{ property.group.title }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td :data-label="t('properties.unit')">
                  <span v-if="property.unit">{{ property.unit.title_short }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td :data-label="t('properties.dictionary')">
                  <span v-if="property.dictionary">
                    <NuxtLink :to="`/dictionaries/${property.dictionary.id}?tab=values`" class="row-link">
                      {{ property.dictionary.title }}
                    </NuxtLink>
                  </span>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="empty">
            {{ t('categories.no_properties') }}
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
import type { ImageResponse } from '~/repository/modules/image'
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import { categoryParentOptions } from '~/composables/categorySelectOptions'
import type { CategoryResponse } from '~/repository/modules/category'
import type { PropertyResponse } from '~/repository/modules/property'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
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

const tabs = computed(() => [
  { key: 'main', label: t('categories.main_tab') },
  { key: 'images', label: t('form.images_tab') },
  { key: 'properties', label: t('form.properties_tab') },
  { key: 'stats', label: t('form.stats_tab') },
])

const activeTab = computed(() => {
  const tab = route.query.tab

  return ['stats', 'properties', 'images'].includes(tab as string) ? (tab as string) : 'main'
})

const parentOptions = computed(() => categoryParentOptions(categories.value, Number(id)))

/** Фотографии категории: вкладка и форма создания правят один и тот же список. */
const images = ref<ImageResponse[]>([])

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
    images.value = category.images ?? []
    categories.value = all
  } catch (err: any) {
    loadError.value = formatApiError(err, t('categories.card_load_failed'))
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
    propertiesError.value = formatApiError(err, t('categories.properties_load_failed'))
  } finally {
    propertiesLoading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api.category.update(Number(id), { title: form.title, parent_id: form.parent_id })
    $notify.add(t('form.saved', { title: t('categories.one') }), { type: 'success' })
    // Дерево могло переехать, поэтому перечитываем его целиком: иначе
    // список вложенных и селект родителя остались бы от старой структуры.
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.save_failed')), { type: 'error', timer: 10 })
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
  color: var(--text-secondary);
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
  width: 100%;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.field-input,
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

.field-input:focus,
.field-select:focus {
  border-color: var(--border-strong);
}

.field-hint {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
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
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.btn-save:hover:not(:disabled) {
  background: var(--accent);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-muted);
  text-decoration: none;
  border: 1px dashed var(--border-strong);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.btn-cancel:hover {
  color: var(--text);
  background: var(--bg-hover);
  border-style: solid;
}

.children {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
  background: var(--bg);
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
  color: var(--text-muted);
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
  border-bottom: 1px solid var(--border);
}

.children__item:last-child {
  border-bottom: 0;
}

.children__link {
  color: var(--link);
  font-size: 14px;
  text-decoration: none;
}

.children__link:hover {
  color: var(--link-hover);
  text-decoration: underline;
}

.children__count {
  font-size: 12px;
  color: var(--text-faint);
}

.children__empty {
  font-size: 13px;
  color: var(--text-dim);
}

.section-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
}

.empty {
  padding: 20px;
  color: var(--text-muted);
}

.props-table {
  width: 100%;
  border-collapse: collapse;
}

.props-table th,
.props-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.props-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.props-table td {
  color: var(--text-secondary);
}

.props-table tr:hover td {
  background: var(--bg-elevated);
}

.row-link {
  color: var(--link);
  text-decoration: none;
}

.row-link:hover {
  color: var(--link-hover);
  text-decoration: underline;
}

.muted {
  color: var(--text-faint);
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
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .props-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
    font-size: 15px;
    white-space: normal;
  }

  .props-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .props-table tr:hover td {
    background: transparent;
  }
}
</style>
