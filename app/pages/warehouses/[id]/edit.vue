<template>
  <div class="edit-page">
    <h3 class="page-title">Редактирование склада #{{ id }}</h3>

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
            <span class="field-label">Пользователь</span>
            <select v-model.number="form.user_id" class="field-select" required :disabled="!canEdit">
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.email }})</option>
            </select>
          </label>

          <div class="form-actions">
            <button type="submit" class="btn-save" :disabled="saving || !canEdit">Сохранить</button>
            <NuxtLink to="/warehouses" class="btn-cancel">Отмена</NuxtLink>
          </div>
        </section>

        <section v-if="activeTab === 'rights'" class="tab-section">
          <AccessGrants :scoped-warehouse="warehouse" />
        </section>

        <section v-if="activeTab === 'stats'" class="tab-section">
          <EntityAuditStats entity-type="warehouse" :entity-id="Number(id)" />
        </section>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import { useCurrentUser } from '~/composables/useCurrentUser'
import type { UserProfileResponse } from '~/repository/modules/userProfile'
import type { WarehouseResponse } from '~/repository/modules/warehouse'

const { $api, $notify } = useNuxtApp()
const { currentUserId } = useCurrentUser()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const users = ref<UserProfileResponse[]>([])
const warehouse = ref<WarehouseResponse | null>(null)

const form = reactive({
  title: '',
  user_id: null as number | null,
})

const tabs = computed(() => {
  const base = [{ key: 'main', label: 'Основные параметры' }]
  const isOwner = currentUserId.value !== null && warehouse.value?.user_id === currentUserId.value
  if (isOwner) {
    base.push({ key: 'rights', label: 'Права' })
  }
  base.push({ key: 'stats', label: 'Статистика' })
  return base
})

const canEdit = computed(() => warehouse.value?.rights?.includes('edit') ?? false)

const activeTab = computed(() => {
  const q = route.query.tab
  if (typeof q === 'string' && tabs.value.some((t) => t.key === q)) {
    return q
  }
  return 'main'
})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [warehouseResult, usersList] = await Promise.all([
      $api.warehouse.get(Number(id)),
      $api.userProfile.all(),
    ])
    warehouse.value = warehouseResult
    form.title = warehouseResult.title
    form.user_id = warehouseResult.user_id
    users.value = usersList
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api.warehouse.update(Number(id), {
      title: form.title,
      user_id: form.user_id ?? undefined,
    })
    $notify.add('Склад сохранён', { type: 'success' })
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

.edit-tabs {
  margin: 14px 0 20px;
}

.tab-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.field-input[readonly],
.field-select:disabled {
  opacity: 0.7;
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