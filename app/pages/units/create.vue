<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('properties.unit_titles.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <form class="create-form" @submit.prevent="save">
      <label class="field">
        <span class="field-label">{{ t('properties.abbreviation') }}</span>
        <input v-model="form.title_short" type="text" class="field-input" maxlength="50" required />
        <span class="field-hint">{{ t('properties.unit_hint') }}</span>
      </label>

      <label class="field">
        <span class="field-label">{{ t('form.title') }}</span>
        <input v-model="form.title_full" type="text" class="field-input" maxlength="200" required />
        <span class="field-hint">{{ t('properties.unit_full_hint') }}</span>
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <NuxtLink to="/units" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
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

const tabs = computed(() => [{ key: 'main', label: t('properties.main_tab') }])

const form = reactive({
  title_short: '',
  title_full: '',
})

async function save() {
  saving.value = true
  try {
    const created = await $api.unit.create({
      title_short: form.title_short,
      title_full: form.title_full,
    })
    $notify.add(t('form.created', { title: t('properties.unit_one') }), { type: 'success' })
    router.push(`/units/${created.id}`)
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
