<template>
  <div class="edit-page">
    <h3 class="page-title">{{ t('properties.group_titles.edit_title', { id }) }}</h3>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <form class="edit-form" @submit.prevent="save">
        <section v-if="activeTab === 'main'" class="tab-section">
          <label class="field">
            <span class="field-label">{{ t('form.title') }}</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="200" required />
            <span class="field-hint">{{ t('properties.rename_hint') }}</span>
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
            <NuxtLink to="/property-groups" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
          </div>
        </section>

        <section v-if="activeTab === 'stats'" class="tab-section">
          <EntityAuditStats entity-type="property_group" :entity-id="Number(id)" />
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

const form = reactive({ title: '' })

const tabs = computed(() => [
  { key: 'main', label: t('properties.main_tab') },
  { key: 'stats', label: t('form.stats_tab') },
])

const activeTab = computed(() => (route.query.tab === 'stats' ? 'stats' : 'main'))

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const group = await $api.propertyGroup.get(Number(id))
    form.title = group.title
  } catch (err: any) {
    loadError.value = formatApiError(err, t('properties.group_card_load_failed'))
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api.propertyGroup.update(Number(id), { title: form.title })
    $notify.add(t('form.saved', { title: t('properties.group_one') }), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.save_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
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
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
