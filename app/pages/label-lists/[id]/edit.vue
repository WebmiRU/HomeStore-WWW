<template>
  <div class="edit-page">
    <h3 class="page-title">Редактирование списка #{{ id }}</h3>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <form @submit.prevent="save" class="edit-form">
        <fieldset class="fieldset">
          <legend class="legend">Основное</legend>
          <label class="field">
            <span class="field-label">Название</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
          </label>
          <label class="field">
            <span class="field-label">Шаблон этикетки</span>
            <select v-model="form.label_preset_id" class="field-select" required>
              <option :value="0" disabled>— выберите шаблон —</option>
              <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.title }}</option>
            </select>
          </label>
        </fieldset>

        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
          <NuxtLink to="/label-lists" class="btn-cancel">Отмена</NuxtLink>
        </div>
      </form>

      <section class="content-section">
        <h4 class="section-title">Предметы в списке ({{ listItems.length }})</h4>
        <div v-if="listItems.length === 0" class="section-empty">Нет предметов</div>
        <table v-else class="content-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Хранилище</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in listItems" :key="item.payload.id">
              <td>{{ item.payload.id }}</td>
              <td>{{ item.payload.title }}</td>
              <td>{{ item.store?.[0]?.title ?? '—' }}</td>
              <td class="actions">
                <a
                  href="#"
                  class="action-link action-del"
                  :class="{ disabled: removingItem === item.payload.id }"
                  @click.prevent="removeItem(item.payload.id)"
                >
                  {{ removingItem === item.payload.id ? '...' : 'уд.' }}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="content-section">
        <h4 class="section-title">Хранилища в списке ({{ listStores.length }})</h4>
        <div v-if="listStores.length === 0" class="section-empty">Нет хранилищ</div>
        <table v-else class="content-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="store in listStores" :key="store.id">
              <td>{{ store.id }}</td>
              <td>{{ store.title }}</td>
              <td class="actions">
                <a
                  href="#"
                  class="action-link action-del"
                  :class="{ disabled: removingStore === store.id }"
                  @click.prevent="removeStore(store.id)"
                >
                  {{ removingStore === store.id ? '...' : 'уд.' }}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { LabelPresetResponse } from '~/repository/modules/labelPreset'
 import type { ItemResponse } from '~/repository/modules/item'
import type { StoreResponse } from '~/repository/modules/store'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const presets = ref<LabelPresetResponse[]>([])
const listItems = ref<ItemResponse[]>([])
const listStores = ref<StoreResponse[]>([])
const removingItem = ref<number | null>(null)
const removingStore = ref<number | null>(null)

const form = reactive({
  title: '',
  label_preset_id: 0,
})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [list, presetsResult] = await Promise.all([
      $api.labelList.get(Number(id)),
      $api.labelPreset.list(),
    ])
    form.title = list.title
    form.label_preset_id = list.label_preset_id
    presets.value = presetsResult.data
    listItems.value = list.items ?? []
    listStores.value = list.stores ?? []
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api.labelList.update(Number(id), { title: form.title, label_preset_id: form.label_preset_id })
    $notify.add('Список сохранён', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка сохранения'), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

async function removeItem(itemId: number) {
  removingItem.value = itemId
  try {
    await $api.labelList.detachItem(Number(id), itemId)
    listItems.value = listItems.value.filter(i => i.payload.id !== itemId)
    $notify.add('Предмет удалён из списка', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  } finally {
    removingItem.value = null
  }
}

async function removeStore(storeId: number) {
  removingStore.value = storeId
  try {
    await $api.labelList.detachStore(Number(id), storeId)
    listStores.value = listStores.value.filter(s => s.id !== storeId)
    $notify.add('Хранилище удалено из списка', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  } finally {
    removingStore.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 18px;
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

.edit-form {
  max-width: 500px;
}

.fieldset {
  border: 1px solid #333;
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.legend {
  font-size: 13px;
  color: #888;
  padding: 0 6px;
}

.field {
  display: block;
  margin-bottom: 10px;
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

.content-section {
  margin-top: 24px;
}

.section-title {
  margin: 0 0 10px;
  font-size: 15px;
  color: #aaa;
}

.section-empty {
  padding: 12px;
  color: #666;
  font-size: 13px;
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
}

.content-table {
  width: 100%;
  border-collapse: collapse;
}

.content-table th,
.content-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.content-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.content-table td {
  color: #ccc;
}

.content-table tr:hover td {
  background: #252525;
}

.actions {
  white-space: nowrap;
  width: 1px;
}

.action-link {
  color: #88a;
  text-decoration: none;
  font-size: 13px;
}

.action-link:hover {
  color: #aaf;
}

.action-del {
  color: #a66;
}

.action-del:hover {
  color: #f88;
}

.action-del.disabled {
  opacity: 0.4;
  cursor: wait;
  color: #666;
}
</style>
