<template>
  <div class="edit-page">
    <h3 class="page-title">Редактирование предмета #{{ id }}</h3>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <form @submit.prevent="save" class="edit-form">
        <section v-if="activeTab === 'main'" class="tab-section">
          <label class="field">
            <span class="field-label">Название</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="500" required :readonly="!canEdit" />
          </label>

          <label class="field">
            <span class="field-label">Название для печати</span>
            <input v-model="form.title_print" type="text" class="field-input" maxlength="500" :readonly="!canEdit" />
          </label>

          <label class="field">
            <span class="field-label">Хранилище</span>
            <select v-model.number="form.store_id" class="field-select" :disabled="!canEdit">
              <option :value="null">[НЕТ]</option>
              <optgroup v-for="group in storeGroups" :key="group.label" :label="group.label">
                <option
                  v-for="opt in group.options"
                  :key="opt.id"
                  :value="opt.id"
                >{{ opt.own ? '●' : '○' }} {{ '\u2014'.repeat(opt.depth) }}{{ opt.depth > 0 ? ' ' : '' }}{{ opt.title }}</option>
              </optgroup>
            </select>
            <span class="field-hint">● — своё хранилище, ○ — доступ по правам</span>
          </label>

          <label class="field">
            <span class="field-label">Код</span>
            <div class="code-field">
              <input
                v-model="form.code"
                type="text"
                class="field-input"
                :class="{ 'field-input--changed': codeChanged }"
                maxlength="256"
                :readonly="!canEdit"
              />
              <button v-if="codeChanged && canEdit" type="button" class="btn-reset-code" @click="resetCode">Сброс</button>
            </div>
          </label>

          <label class="field">
            <span class="field-label">Количество</span>
            <input
              v-model="quantityInput"
              type="number"
              class="field-input"
              step="1"
              placeholder="без количества"
              :readonly="!canEdit"
            />
          </label>
        </section>

        <section v-if="activeTab === 'images'" class="tab-section">
          <ImagesTable v-model="images" entity="item" :entity-id="Number(id)" :readonly="!canEdit" />
        </section>

        <section v-if="activeTab === 'balance'" class="tab-section">
          <EntityBalanceChart entity-type="item" :entity-id="Number(id)" />
        </section>

        <section v-if="activeTab === 'stats'" class="tab-section">
          <EntityAuditStats entity-type="item" :entity-id="Number(id)" />
        </section>

        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="saving || !canEdit">Сохранить</button>
          <NuxtLink to="/items" class="btn-cancel">Отмена</NuxtLink>
        </div>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { ItemPayload } from '~/repository/modules/code'
import type { ItemResponse } from '~/repository/modules/item'
import type { ImageResponse } from '~/repository/modules/image'
import type { StoreResponse } from '~/repository/modules/store'
import { useStoreSelectOptions, type StoreSelectGroup } from '~/composables/storeSelectOptions'

const { $api, $notify } = useNuxtApp()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const originalCode = ref('')
const quantityInput = ref('')
const images = ref<ImageResponse[]>([])
const itemEntity = ref<ItemResponse | null>(null)

const canEdit = computed(() => itemEntity.value?.rights?.includes('edit') ?? false)

const tabs = [
  { key: 'main', label: 'Основные параметры' },
  { key: 'images', label: 'Картинки' },
  { key: 'balance', label: 'Остатки' },
  { key: 'stats', label: 'Статистика' },
]

const activeTab = computed(() => {
  const q = route.query.tab
  if (typeof q === 'string' && tabs.some((t) => t.key === q)) {
    return q
  }
  return 'main'
})

const stores = ref<StoreResponse[]>([])

const storeGroups = computed<StoreSelectGroup[]>(() => useStoreSelectOptions(stores.value, itemEntity.value?.payload?.store_id ?? null))

const form = reactive({
  title: '',
  title_print: '',
  store_id: null as number | null,
  code: '',
})

const codeChanged = computed(() => originalCode.value !== '' && form.code !== originalCode.value)

function resetCode() {
  form.code = originalCode.value
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [item, list] = await Promise.all([
      $api.item.get(Number(id)),
      $api.store.list(),
    ])

    stores.value = list
    itemEntity.value = item
    form.title = item.payload.title
    form.title_print = item.payload.title_print ?? ''
    form.store_id = item.payload.store_id
    form.code = item.code ?? ''
    originalCode.value = item.code ?? ''
    quantityInput.value = item.payload.quantity != null ? String(item.payload.quantity) : ''
    images.value = item.images ?? []
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const payload: Partial<ItemPayload> & { code?: string | null } = {
      title: form.title,
      title_print: form.title_print || null,
      store_id: form.store_id,
      code: form.code.trim() || null,
    }
    const qty = String(quantityInput.value).trim()
    if (qty !== '') {
      payload.quantity = Number(qty)
    }
    await $api.item.update(Number(id), payload)
    $notify.add('Предмет сохранён', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка сохранения'), { type: 'error', timer: 10 })
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
  max-width: none;
  width: 100%;
}

.field {
  display: block;
  margin-bottom: 14px;
}

.tab-section .field {
  margin-bottom: 0;
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
.field-input:focus,
.field-select:focus {
  border-color: #666;
}

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

.field-hint {
  display: block;
  font-size: 12px;
  color: #777;
  margin-top: 4px;
}

.code-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-input--changed {
  border-color: #e8a33d;
  box-shadow: 0 0 0 1px #e8a33d;
}

.btn-reset-code {
  flex-shrink: 0;
  padding: 8px 14px;
  font-size: 13px;
  font-family: inherit;
  color: #f0b45c;
  background: #2e2414;
  border: 1px solid #e8a33d;
  border-radius: 4px;
  cursor: pointer;
}

.btn-reset-code:hover {
  background: #3a2e1a;
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
