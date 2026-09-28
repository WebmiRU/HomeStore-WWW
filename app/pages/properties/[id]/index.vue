<template>
  <div class="edit-page">
    <h3 class="page-title">{{ t('properties.edit_title', { id }) }}</h3>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <section v-if="activeTab === 'main'" class="tab-section">
        <form class="edit-form" @submit.prevent="save">
          <label class="field">
            <span class="field-label">{{ t('properties.group') }}</span>
            <select v-model="form.group_id" class="field-select">
              <option :value="null">t('placeholders.no_group')</option>
              <option v-if="deletedGroup" :value="deletedGroup.id" disabled>
                {{ deletedGroup.label }}
              </option>
              <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.title }}</option>
            </select>
            <span class="field-hint">{{ t('properties.group_hint_short') }}</span>
          </label>

          <label class="field">
            <span class="field-label">{{ t('form.title') }}</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
          </label>

          <label class="field">
            <span class="field-label">{{ t('properties.type') }}</span>
            <select v-model="form.type" class="field-select" :disabled="lockedType">
              <option v-for="type in PROPERTY_TYPES" :key="type" :value="type">
                {{ propertyTypeLabel(type) }}
              </option>
            </select>
            <span class="field-hint">
              {{ lockedType
                ? t('properties.type_locked', { count: valuesCount })
                : t('properties.type_hint') }}
            </span>
          </label>

          <label v-if="acceptsUnit" class="field">
            <span class="field-label">{{ t('properties.unit') }}</span>
            <select v-model="form.unit_id" class="field-select">
              <option :value="null">t('placeholders.no_unit')</option>
              <option v-if="deletedUnit" :value="deletedUnit.id" disabled>
                {{ deletedUnit.label }}
              </option>
              <option v-for="unit in units" :key="unit.id" :value="unit.id">
                {{ unit.title_short }} — {{ unit.title_full }}
              </option>
            </select>
          </label>

          <label v-if="needsDictionary" class="field">
            <span class="field-label">{{ t('properties.dictionary') }}</span>
            <select v-model="form.dictionary_id" class="field-select">
              <option :value="null">t('placeholders.pick_dictionary')</option>
              <option v-if="deletedDictionary" :value="deletedDictionary.id" disabled>
                {{ deletedDictionary.label }}
              </option>
              <option v-for="dictionary in dictionaries" :key="dictionary.id" :value="dictionary.id">
                {{ dictionary.title }} ({{ dictionary.values_count }} t('properties.values_short') })
              </option>
            </select>
            <span v-if="dictionary" class="field-hint">
              <NuxtLink :to="`/dictionaries/${dictionary.id}?tab=values`" class="row-link">
                {{ t('properties.open_values', { title: dictionary.title }) }}
              </NuxtLink>
            </span>
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
            <NuxtLink to="/properties" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
          </div>
        </form>
      </section>

      <section v-if="activeTab === 'stats'" class="tab-section">
        <EntityAuditStats entity-type="property" :entity-id="Number(id)" />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import { deletedOption } from '~/composables/deletedOption'
import {
  PROPERTY_TYPES,
  propertyTypeLabel,
  propertyAcceptsUnit,
  propertyNeedsDictionary,
  type PropertyResponse,
  type PropertyType,
} from '~/repository/modules/property'
import type { UnitResponse } from '~/repository/modules/unit'
import type { PropertyGroupResponse } from '~/repository/modules/propertyGroup'
import type { DictionaryResponse } from '~/repository/modules/dictionary'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const units = ref<UnitResponse[]>([])
const groups = ref<PropertyGroupResponse[]>([])
const dictionaries = ref<DictionaryResponse[]>([])
const valuesCount = ref(0)

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

const tabs = computed(() => [
  { key: 'main', label: t('properties.main_tab') },
  { key: 'stats', label: t('form.stats_tab') },
])

const activeTab = computed(() => (route.query.tab === 'stats' ? 'stats' : 'main'))

const acceptsUnit = computed(() => propertyAcceptsUnit(form.type))
const needsDictionary = computed(() => propertyNeedsDictionary(form.type))

/** Сервер не даст сменить тип, когда значения уже заполнены — не даём и мы. */
const lockedType = computed(() => valuesCount.value > 0)

const dictionary = computed(
  () => dictionaries.value.find((item) => item.id === form.dictionary_id) ?? null,
)

/**
 * Позиция «текущее значение удалено» для селектов.
 *
 * Списки групп, единиц и справочников приходят уже без удалённых (их скрывает
 * мягкое удаление), а значение в property осталось — без такой позиции форма
 * показывала бы «без группы/единицы/справочника», что неправда.
 */
const propertyEntity = ref<PropertyResponse | null>(null)

const deletedGroup = computed(() =>
  deletedOption(groups.value, form.group_id, groupRelation.value),
)

const deletedUnit = computed(() => deletedOption(units.value, form.unit_id, unitRelation.value))

const deletedDictionary = computed(() =>
  deletedOption(dictionaries.value, form.dictionary_id, dictionaryRelation.value),
)

const groupRelation = computed(() => {
  const group = propertyEntity.value?.group

  return group ? { id: group.id, title: group.title, deleted: group.deleted } : null
})

const unitRelation = computed(() => {
  const unit = propertyEntity.value?.unit

  return unit
    ? { id: unit.id, title: `${unit.title_short} — ${unit.title_full}`, deleted: unit.deleted }
    : null
})

const dictionaryRelation = computed(() => {
  const dict = propertyEntity.value?.dictionary

  return dict ? { id: dict.id, title: dict.title, deleted: dict.deleted } : null
})

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
    const [property, allUnits, allGroups, allDictionaries] = await Promise.all([
      $api.property.get(Number(id)),
      $api.unit.all(),
      $api.propertyGroup.all(),
      $api.dictionary.all(),
    ])
    propertyEntity.value = property
    form.title = property.title
    form.type = property.type
    form.group_id = property.group_id
    form.unit_id = property.unit_id
    form.dictionary_id = property.dictionary_id
    valuesCount.value = property.values_count ?? 0
    units.value = allUnits
    groups.value = allGroups
    dictionaries.value = allDictionaries
  } catch (err: any) {
    loadError.value = formatApiError(err, t('properties.card_load_failed'))
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
    await $api.property.update(Number(id), {
      title: form.title,
      type: form.type,
      group_id: form.group_id,
      unit_id: acceptsUnit.value ? form.unit_id : null,
      dictionary_id: needsDictionary.value ? form.dictionary_id : null,
    })
    $notify.add(t('form.saved', { title: t('properties.one') }), { type: 'success' })
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

.field-select:disabled {
  opacity: 0.6;
  cursor: default;
}

.field-hint {
  display: block;
  font-size: 12px;
  color: #777;
  margin-top: 4px;
}

.row-link {
  color: #88a;
  text-decoration: none;
}

.row-link:hover {
  color: #aaf;
  text-decoration: underline;
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
