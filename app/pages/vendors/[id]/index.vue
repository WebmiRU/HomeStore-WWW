<template>
  <div class="edit-page">
    <h3 class="page-title">{{ t('vendors.edit_title', { id }) }}</h3>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <form class="edit-form" @submit.prevent="save">
        <section v-if="activeTab === 'main'" class="tab-section">
          <div class="logo-block">
            <VendorLogo
              :logo-sha="logoSha"
              :logo-url="logoUrl"
              :logo-width="logoWidth"
              :logo-height="logoHeight"
              :logo-thumbs="logoThumbs"
              :title="form.title || t('vendors.one')"
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
                {{ uploading ? t('form.loading') : hasLogo ? t('vendors.logo_replace') : t('vendors.logo_upload') }}
              </button>
              <button
                v-if="hasLogo"
                type="button"
                class="btn-logo-remove"
                :disabled="removing"
                @click="removeLogo"
              >
                {{ removing ? t('vendors.removing') : t('vendors.logo_remove') }}
              </button>
            </div>
          </div>

          <label class="field">
            <span class="field-label">{{ t('form.title') }}</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
            <span class="field-hint">{{ t('properties.title_unique_hint') }}</span>
          </label>

          <label class="field">
            <span class="field-label">{{ t('list_common.description') }}</span>
            <textarea
              v-model="form.description"
              class="field-input field-textarea"
              rows="5"
              maxlength="5000"
            ></textarea>
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
            <NuxtLink to="/vendors" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
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
const { t } = useI18n()
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
const logoUrl = ref<string | null>(null)
/** Размеры логотипа: без них srcset предложил бы увеличенные варианты. */
const logoWidth = ref<number | null>(null)
const logoHeight = ref<number | null>(null)
const logoThumbs = ref<{ cover: number; contain: number } | null>(null)

const hasLogo = computed(() => Boolean(logoSha.value))

const form = reactive({
  title: '',
  description: '',
})

const tabs = computed(() => {
  const q = route.query.tab

  return typeof q === 'string' && q === 'stats'
    ? [{ key: 'main', label: t('vendors.main_tab') }, { key: 'stats', label: t('vendors.stats_tab') }]
    : [{ key: 'main', label: t('vendors.main_tab') }]
})

const activeTab = computed(() => (route.query.tab === 'stats' ? 'stats' : 'main'))

function applyLogo(vendor: { logo_sha: string | null }) {
  logoSha.value = vendor.logo_sha ?? null
  logoUrl.value = vendor.logo_url ?? null
  logoWidth.value = vendor.logo_width ?? null
  logoHeight.value = vendor.logo_height ?? null
  logoThumbs.value = vendor.logo_thumbs ?? null
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
    loadError.value = formatApiError(err, t('vendors.load_failed'))
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
    $notify.add(t('form.saved', { title: t('vendors.one') }), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.save_failed')), { type: 'error', timer: 10 })
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
    $notify.add(t('vendors.logo_updated'), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('vendors.logo_upload_failed')), { type: 'error', timer: 10 })
  } finally {
    uploading.value = false
    // Сброс значения нужно, чтобы повторный выбор того же файла
    // вызвал change и не остался незаметным для пользователя.
    input.value = ''
  }
}

async function removeLogo() {
  if (!confirm(t('vendors.logo_remove_confirm'))) return

  removing.value = true
  try {
    await $api.vendor.deleteLogo(Number(id))
    logoSha.value = null
    $notify.add(t('vendors.logo_removed'), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('vendors.logo_remove_failed')), { type: 'error', timer: 10 })
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
  color: var(--success-hover);
  background: var(--success-bg);
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
}

.btn-logo:hover:not(:disabled) {
  background: color-mix(in srgb, var(--success) 24%, var(--bg-elevated));
}

.btn-logo:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-logo-remove {
  padding: 6px 12px;
  font-size: 12px;
  font-family: inherit;
  color: var(--danger-ink);
  background: transparent;
  border: 1px solid var(--danger);
  border-radius: 4px;
  cursor: pointer;
}

.btn-logo-remove:hover:not(:disabled) {
  background: var(--danger-bg);
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

.field-input:focus {
  border-color: var(--border-strong);
}

.field-textarea {
  resize: vertical;
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
  margin-top: 24px;
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
  .logo-block {
    flex-wrap: wrap;
  }

  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
