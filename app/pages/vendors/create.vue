<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('vendors.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <form class="create-form" @submit.prevent="save">
      <label class="field">
        <span class="field-label">{{ t('form.title') }}</span>
        <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
        <span class="field-hint">{{ t('vendors.title_unique_hint') }}</span>
      </label>

      <label class="field">
        <span class="field-label">{{ t('list_common.description') }}</span>
        <textarea
          v-model="form.description"
          class="field-input field-textarea"
          rows="4"
          maxlength="5000"
          :placeholder="t('vendors.description_placeholder')"
        ></textarea>
        <span class="field-hint">{{ t('vendors.description_hint') }}</span>
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <NuxtLink to="/vendors" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const router = useRouter()

const saving = ref(false)

const tabs = computed(() => [{ key: 'main', label: t('vendors.main_tab') }])

const form = reactive({
  title: '',
  description: '',
})

async function save() {
  saving.value = true
  try {
    const created = await $api.vendor.create({
      title: form.title,
      description: form.description,
    })
    $notify.add(t('form.created', { title: t('vendors.one') }), { type: 'success' })
    router.push(`/vendors/${created.id}`)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}
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
