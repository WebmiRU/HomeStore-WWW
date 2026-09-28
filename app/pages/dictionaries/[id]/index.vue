<template>
  <div class="edit-page">
    <h3 class="page-title">Редактирование справочника #{{ id }}</h3>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <section v-if="activeTab === 'main'" class="tab-section">
        <form class="edit-form" @submit.prevent="save">
          <label class="field">
            <span class="field-label">Название</span>
            <input v-model="form.title" type="text" class="field-input" maxlength="200" required />
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
            <NuxtLink to="/dictionaries" class="btn-cancel">Отмена</NuxtLink>
          </div>
        </form>
      </section>

      <section v-if="activeTab === 'values'" class="tab-section">
        <form class="value-add" @submit.prevent="addValue">
          <input
            v-model="newValue"
            type="text"
            class="field-input"
            maxlength="200"
            placeholder="Новое значение"
          />
          <button type="submit" class="btn-add" :disabled="adding || newValue.trim() === ''">Добавить</button>
        </form>

        <table v-if="values.length" class="values-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Значение</th>
              <th>Создан</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="value in values" :key="value.id">
              <td data-label="ID">{{ value.id }}</td>
              <td data-label="Значение">
                <input
                  v-model="edits[value.id]"
                  type="text"
                  class="field-input"
                  maxlength="200"
                  @keydown.enter.prevent="saveValue(value)"
                />
              </td>
              <td data-label="Создан">{{ formatDate(value.created_at) }}</td>
              <td class="actions">
                <button
                  type="button"
                  class="action-link action-save"
                  :disabled="!isDirty(value)"
                  title="Сохранить"
                  aria-label="Сохранить"
                  @click="saveValue(value)"
                >
                  <img src="/img/icon/edit.svg" class="action-icon" alt="" />
                </button>
                <button
                  type="button"
                  class="action-link action-del"
                  title="Удалить"
                  aria-label="Удалить"
                  @click="deleteValue(value)"
                >
                  <img src="/img/icon/delete.svg" class="action-icon" alt="" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="empty">
          В справочнике пока нет значений — без них выбирать его в свойствах нечего
        </div>

        <p class="values-hint">
          Значение нельзя удалить, если оно уже выбрано в каком-нибудь предмете: сервер
          вернёт ошибку. Сначала перезаполните эти предметы.
        </p>
      </section>

      <section v-if="activeTab === 'stats'" class="tab-section">
        <EntityAuditStats entity-type="dictionary" :entity-id="Number(id)" />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { formatDate } from '~/utils/auditLabels'
import { formatApiError } from '~/composables/formatApiError'
import type { DictionaryValueResponse } from '~/repository/modules/dictionary'

const { $api, $notify } = useNuxtApp()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const adding = ref(false)

const form = reactive({ title: '' })

const values = ref<DictionaryValueResponse[]>([])
/** Черновики названий: правим строку, отправляем только явно нажатой кнопкой. */
const edits = reactive<Record<number, string>>({})
const newValue = ref('')

const tabs = [
  { key: 'main', label: 'Основные параметры' },
  { key: 'values', label: 'Значения' },
  { key: 'stats', label: 'Статистика' },
]

const activeTab = computed(() => {
  const tab = route.query.tab

  return tab === 'stats' || tab === 'values' ? tab : 'main'
})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const dictionary = await $api.dictionary.get(Number(id))
    form.title = dictionary.title
    values.value = dictionary.values ?? []
    seedEdits()
  } catch (err: any) {
    loadError.value = formatApiError(err, 'Ошибка загрузки справочника')
  } finally {
    loading.value = false
  }
}

function seedEdits() {
  for (const value of values.value) {
    edits[value.id] = value.title
  }
}

function isDirty(value: DictionaryValueResponse): boolean {
  const draft = edits[value.id] ?? ''

  return draft.trim() !== '' && draft.trim() !== value.title
}

async function save() {
  saving.value = true
  try {
    await $api.dictionary.update(Number(id), { title: form.title })
    $notify.add('Справочник сохранён', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка сохранения'), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

async function addValue() {
  const title = newValue.value.trim()

  if (title === '') return

  adding.value = true
  try {
    const created = await $api.dictionary.createValue(Number(id), { title })
    values.value = [...values.value, created]
    edits[created.id] = created.title
    newValue.value = ''
    $notify.add('Значение добавлено', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка добавления значения'), { type: 'error', timer: 10 })
  } finally {
    adding.value = false
  }
}

async function saveValue(value: DictionaryValueResponse) {
  if (!isDirty(value)) return

  try {
    const updated = await $api.dictionary.updateValue(Number(id), value.id, { title: edits[value.id] })
    values.value = values.value.map((item) => (item.id === updated.id ? updated : item))
    edits[updated.id] = updated.title
    $notify.add('Значение сохранено', { type: 'success' })
  } catch (err: any) {
    // Название не принято — показываем то, что осталось в базе, иначе в
    // строке осталось бы правило, которое сервер отверг.
    edits[value.id] = value.title
    $notify.add(formatApiError(err, 'Ошибка сохранения значения'), { type: 'error', timer: 10 })
  }
}

async function deleteValue(value: DictionaryValueResponse) {
  if (!confirm(`Удалить значение «${value.title}»?`)) return

  try {
    await $api.dictionary.deleteValue(Number(id), value.id)
    values.value = values.value.filter((item) => item.id !== value.id)
    delete edits[value.id]
    $notify.add('Значение удалено', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления значения'), { type: 'error', timer: 10 })
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

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.btn-save,
.btn-add {
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

.btn-save:disabled,
.btn-add:disabled {
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

.value-add {
  display: flex;
  gap: 8px;
  align-items: center;
}

.value-add .field-input {
  flex: 1;
}

.value-add .btn-add {
  flex-shrink: 0;
  padding: 8px 16px;
}

.empty {
  padding: 20px;
  color: #888;
}

.values-table {
  width: 100%;
  border-collapse: collapse;
}

.values-table th,
.values-table td {
  padding: 6px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.values-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.values-table td {
  color: #ccc;
}

.values-table tr:hover td {
  background: #252525;
}

.actions {
  white-space: nowrap;
  width: 1%;
}

.action-link {
  background: none;
  border: none;
  padding: 0;
  margin-right: 8px;
  color: #88a;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.action-link img.action-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.action-link:hover:not(:disabled) {
  color: #aaf;
}

.action-link:disabled {
  opacity: 0.3;
  cursor: default;
}

.action-del {
  color: #a66;
}

.action-del:hover {
  color: #f88;
}

.values-hint {
  margin: 0;
  font-size: 12px;
  color: #777;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .form-actions {
    flex-wrap: wrap;
  }

  .values-table,
  .values-table tbody,
  .values-table tr,
  .values-table td {
    display: block;
  }

  .values-table thead {
    display: none;
  }

  .values-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .values-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .values-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .values-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .values-table tr:hover td {
    background: transparent;
  }
}
</style>
