<template>
  <div class="edit-page">
    <h3 class="page-title">Производитель #{{ id }}</h3>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <form class="edit-form" @submit.prevent="save">
        <section v-if="activeTab === 'main'" class="tab-section">
          <div class="logo-block">
            <VendorLogo
              :logo-sha="logoSha"
              :title="form.title || 'Производитель'"
              :size="120"
            />

            <div class="logo-actions">
              <input
                ref="logoInput"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                class="logo-file"
                @change="onLogoChange"
              />
              <button type="button" class="btn-logo" :disabled="uploading" @click="logoInput?.click()">
                {{ uploading ? 'Загрузка...' : hasLogo ? 'Заменить логотип' : 'Загрузить логотип' }}
              </button>
              <button
                v-if="hasLogo"
                type="button"
                class="btn-logo-remove"
                :disabled="removing"
                @click="removeLogo"
              >
                {{ removing ? 'Удаление...' : 'Убрать логотип' }}
              </button>
            </div>
          </div>

          <label class="field">
            <span class="field-label">Название</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
            <span class="field-hint">У названия уникальность: поменять можно, занять чужое — нет</span>
          </label>

          <label class="field">
            <span class="field-label">Описание</span>
            <textarea
              v-model="form.description"
              class="field-input field-textarea"
              rows="5"
              maxlength="5000"
            ></textarea>
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
            <NuxtLink to="/vendors" class="btn-cancel">Отмена</NuxtLink>
          </div>
        </section>

        <section v-if="activeTab === 'stats'" class="tab-section">
          <EntityAuditStats entity-type="vendor" :entity-id="Number(id)" />
        </section>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const uploading = ref(false)
const removing = ref(false)
const logoInput = ref<HTMLInputElement | null>(null)

// Логотип держим отдельно от формы: он грузится отдельным запросом и
// сохраняется сразу, а не по кнопке «Сохранить». Держим только sha256 —
// по нему и браузер, и компонент логотипа берут миниатюру; оригинал в
// интерфейсе не используется.
const logoSha = ref<string | null>(null)

const hasLogo = computed(() => Boolean(logoSha.value))

const form = reactive({
  title: '',
  description: '',
})

const tabs = computed(() => {
  const q = route.query.tab

  return typeof q === 'string' && q === 'stats'
    ? [{ key: 'main', label: 'Основные параметры' }, { key: 'stats', label: 'Статистика' }]
    : [{ key: 'main', label: 'Основные параметры' }]
})

const activeTab = computed(() => (route.query.tab === 'stats' ? 'stats' : 'main'))

function applyLogo(vendor: { logo_sha: string | null }) {
  logoSha.value = vendor.logo_sha ?? null
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const vendor = await $api.vendor.get(Number(id))
    form.title = vendor.title
    form.description = vendor.description ?? ''
    applyLogo(vendor)
  } catch (err: any) {
    loadError.value = formatApiError(err, 'Ошибка загрузки производителя')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const updated = await $api.vendor.update(Number(id), {
      title: form.title,
      description: form.description,
    })
    form.description = updated.description ?? ''
    $notify.add('Производитель сохранён', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка сохранения'), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

async function onLogoChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    applyLogo(await $api.vendor.uploadLogo(Number(id), file))
    $notify.add('Логотип обновлён', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка загрузки логотипа'), { type: 'error', timer: 10 })
  } finally {
    uploading.value = false
    // Сброс значения нужно, чтобы повторный выбор того же файла
    // вызвал change и не остался незаметным для пользователя.
    input.value = ''
  }
}

async function removeLogo() {
  if (!confirm('Убрать логотип?')) return

  removing.value = true
  try {
    await $api.vendor.deleteLogo(Number(id))
    logoSha.value = null
    $notify.add('Логотип убран', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления логотипа'), { type: 'error', timer: 10 })
  } finally {
    removing.value = false
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
  width: 100%;
}

.logo-block {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 6px;
}

.logo-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.logo-file {
  display: none;
}

.btn-logo {
  padding: 8px 16px;
  font-size: 13px;
  font-family: inherit;
  color: #9fd8a6;
  background: #1f3a24;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-logo:hover:not(:disabled) {
  background: #2a4a2f;
}

.btn-logo:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-logo-remove {
  padding: 6px 12px;
  font-size: 12px;
  font-family: inherit;
  color: #d89a9a;
  background: transparent;
  border: 1px solid #6a3a3a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-logo-remove:hover:not(:disabled) {
  background: #3a1f1f;
}

.btn-logo-remove:disabled {
  opacity: 0.5;
  cursor: default;
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

.field-input:focus {
  border-color: #666;
}

.field-textarea {
  resize: vertical;
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
  margin-top: 24px;
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
  .logo-block {
    flex-wrap: wrap;
  }

  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
