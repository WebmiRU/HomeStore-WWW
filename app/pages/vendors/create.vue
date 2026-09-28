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
  color: #ccc;
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
