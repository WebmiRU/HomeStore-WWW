<template>
  <div class="edit-page">
    <h3 class="page-title">{{ t('properties.unit_titles.edit_title', { id }) }}</h3>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <form class="edit-form" @submit.prevent="save">
        <section v-if="activeTab === 'main'" class="tab-section">
          <label class="field">
            <span class="field-label">{{ t('properties.abbreviation') }}</span>
            <input v-model="form.title_short" type="text" class="field-input" maxlength="50" required />
            <span class="field-hint">{{ t('properties.unit_unique_hint') }}</span>
          </label>

          <label class="field">
            <span class="field-label">{{ t('form.title') }}</span>
            <input v-model="form.title_full" type="text" class="field-input" maxlength="200" required />
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
            <NuxtLink to="/units" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
          </div>
        </section>

        <section v-if="activeTab === 'stats'" class="tab-section">
          <EntityAuditStats entity-type="unit" :entity-id="Number(id)" />
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

const form = reactive({
  title_short: '',
  title_full: '',
})

const tabs = computed(() => {
  const q = route.query.tab

  return typeof q === 'string' && q === 'stats'
    ? [{ key: 'main', label: t('properties.main_tab') }, { key: 'stats', label: t('properties.stats_tab') }]
    : [{ key: 'main', label: t('properties.main_tab') }]
})

const activeTab = computed(() => (route.query.tab === 'stats' ? 'stats' : 'main'))

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const unit = await $api.unit.get(Number(id))
    form.title_short = unit.title_short
    form.title_full = unit.title_full
  } catch (err: any) {
    loadError.value = formatApiError(err, t('properties.unit_card_load_failed'))
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api.unit.update(Number(id), {
      title_short: form.title_short,
      title_full: form.title_full,
    })
    $notify.add(t('form.saved', { title: t('properties.unit_one') }), { type: 'success' })
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
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
