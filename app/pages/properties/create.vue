<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('properties.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else class="create-form" @submit.prevent="save">
      <label class="field">
        <span class="field-label">{{ t('properties.group') }}</span>
        <select v-model="form.group_id" class="field-select">
          <option :value="null">{{ t('placeholders.no_group') }}</option>
          <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.title }}</option>
        </select>
        <span class="field-hint">{{ t('properties.group_hint_short') }}</span>
      </label>

      <label class="field">
        <span class="field-label">{{ t('form.title') }}</span>
        <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
        <span class="field-hint">{{ t('properties.title_hint') }}</span>
      </label>

      <label class="field">
        <span class="field-label">{{ t('properties.type') }}</span>
        <select v-model="form.type" class="field-select">
          <option v-for="type in PROPERTY_TYPES" :key="type" :value="type">
            {{ propertyTypeLabel(type) }}
          </option>
        </select>
        <span class="field-hint">
          {{ t('properties.type_hint_create') }}
        </span>
      </label>

      <label v-if="acceptsUnit" class="field">
        <span class="field-label">{{ t('properties.unit') }}</span>
        <select v-model="form.unit_id" class="field-select">
          <option :value="null">{{ t('placeholders.no_unit') }}</option>
          <option v-for="unit in units" :key="unit.id" :value="unit.id">
            {{ unit.title_short }} — {{ unit.title_full }}
          </option>
        </select>
      </label>

      <label v-if="needsDictionary" class="field">
        <span class="field-label">{{ t('properties.dictionary') }}</span>
        <select v-model="form.dictionary_id" class="field-select">
          <option :value="null">{{ t('placeholders.pick_dictionary') }}</option>
          <option v-for="dictionary in dictionaries" :key="dictionary.id" :value="dictionary.id">
            {{ dictionary.title }} ({{ dictionary.values_count }} {{ t('properties.values_short') }})
          </option>
        </select>
        <span class="field-hint">
          {{ t('properties.dictionary_hint_create') }}
        </span>
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <NuxtLink to="/properties" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import {
  PROPERTY_TYPES,
  propertyTypeLabel,
  propertyAcceptsUnit,
  propertyNeedsDictionary,
  type PropertyType,
} from '~/repository/modules/property'
import type { UnitResponse } from '~/repository/modules/unit'
import type { PropertyGroupResponse } from '~/repository/modules/propertyGroup'
import type { DictionaryResponse } from '~/repository/modules/dictionary'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const router = useRouter()

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const units = ref<UnitResponse[]>([])
const groups = ref<PropertyGroupResponse[]>([])
const dictionaries = ref<DictionaryResponse[]>([])

const tabs = computed(() => [{ key: 'main', label: t('properties.main_tab') }])

const form = reactive<{
  title: string
  type: PropertyType
  group_id: number | null
  unit_id: number | null
  dictionary_id: number | null
}>({
  title: '',
  type: 'string',
  group_id: null,
  unit_id: null,
  dictionary_id: null,
})

const acceptsUnit = computed(() => propertyAcceptsUnit(form.type))
const needsDictionary = computed(() => propertyNeedsDictionary(form.type))

// Единица и справочник запрещены типам, для которых они не имеют смысла:
// оставить выбранное значение значило бы получить 422 от сервера.
watch(
  () => form.type,
  () => {
    if (!acceptsUnit.value) form.unit_id = null
    if (!needsDictionary.value) form.dictionary_id = null
  },
)

async function load() {
  loading.value = true
  loadError.value = null
  try {
    ;[units.value, groups.value, dictionaries.value] = await Promise.all([
      $api.unit.all(),
      $api.propertyGroup.all(),
      $api.dictionary.all(),
    ])
  } catch (err: any) {
    loadError.value = formatApiError(err, t('properties.form_load_failed'))
  } finally {
    loading.value = false
  }
}

async function save() {
  if (needsDictionary.value && form.dictionary_id === null) {
    $notify.add(t('properties.choose_dictionary'), { type: 'error', timer: 10 })
    return
  }

  saving.value = true
  try {
    const created = await $api.property.create({
      title: form.title,
      type: form.type,
      group_id: form.group_id,
      unit_id: acceptsUnit.value ? form.unit_id : null,
      dictionary_id: needsDictionary.value ? form.dictionary_id : null,
    })
    $notify.add(t('form.created', { title: t('properties.one') }), { type: 'success' })
    router.push(`/properties/${created.id}`)
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
