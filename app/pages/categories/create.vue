<template>
  <div class="create-page">
    <h3 class="page-title">Добавление категории</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else class="create-form" @submit.prevent="save">
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
        <span class="field-hint">Без родителя категория будет в корне дерева</span>
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
        <NuxtLink to="/categories" class="btn-cancel">Отмена</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import { categoryParentOptions } from '~/composables/categorySelectOptions'
import type { CategoryResponse } from '~/repository/modules/category'

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const categories = ref<CategoryResponse[]>([])

const tabs = [{ key: 'main', label: 'Основные параметры' }]

// Открывается как «добавить внутрь» из страницы категории: ?parent_id=3
const preselectedParent = typeof route.query.parent_id === 'string' ? Number(route.query.parent_id) : null

const form = reactive<{ title: string; parent_id: number | null }>({
  title: '',
  parent_id: Number.isFinite(preselectedParent) ? preselectedParent : null,
})

// Категории ещё нет, поэтому исключать из списка нечего — сервер отдаст
// дерево целиком, а null означает «не исключать ничего».
const parentOptions = computed(() => categoryParentOptions(categories.value, null))

async function load() {
  loading.value = true
  loadError.value = null
  try {
    categories.value = await $api.category.all()
  } catch (err: any) {
    loadError.value = formatApiError(err, 'Ошибка загрузки категорий')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const created = await $api.category.create({ title: form.title, parent_id: form.parent_id })
    $notify.add('Категория создана', { type: 'success' })
    router.push(`/categories/${created.id}/edit`)
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
