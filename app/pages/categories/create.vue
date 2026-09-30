<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('categories.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else class="create-form" @submit.prevent="save">
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
        <span class="field-hint">{{ t('categories.parent_hint') }}</span>
      </label>

      <!--
        Фотографии в форме создания работают в черновом режиме: файлы уходят в
        базу без привязки и ждут владельца, а при сохранении отправляются
        вместе с категорией.
      -->
      <section v-if="activeTab === 'images'" class="tab-section">
        <ImagesTable v-model="images" entity="category" />
      </section>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <NuxtLink to="/categories" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import { categoryParentOptions } from '~/composables/categorySelectOptions'
import type { CategoryResponse } from '~/repository/modules/category'
import type { ImageResponse } from '~/repository/modules/image'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const categories = ref<CategoryResponse[]>([])

const tabs = computed(() => [
  { key: 'main', label: t('categories.main_tab') },
  { key: 'images', label: t('form.images_tab') },
])

const activeTab = computed(() => (route.query.tab === 'images' ? 'images' : 'main'))

// Открывается как «добавить внутрь» из страницы категории: ?parent_id=3
const preselectedParent = typeof route.query.parent_id === 'string' ? Number(route.query.parent_id) : null

const images = ref<ImageResponse[]>([])

/** Фотографии уходят вместе с категорией: id перечислены, привязка — на сервере. */
function imagesPayload(): { id: number; alt?: string | null }[] {
  return [...images.value]
    .filter((image) => image.id > 0)
    .map((image) => ({ id: image.id, alt: image.alt ?? null }))
}

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
    loadError.value = formatApiError(err, t('categories.load_failed'))
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const created = await $api.category.create({ title: form.title, parent_id: form.parent_id, images: imagesPayload() })
    $notify.add(t('form.created', { title: t('categories.one') }), { type: 'success' })
    router.push(`/categories/${created.id}`)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
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
  color: var(--text-secondary);
}

.create-tabs {
  margin: 14px 0 20px;
}

.loading,
.error {
  color: var(--text-muted);
  padding: 12px 0;
}

.error {
  color: var(--danger);
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

@media (max-width: 768px) {
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
