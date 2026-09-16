<template>
  <div class="create-page">
    <h3 class="page-title">Добавление склада</h3>

    <form @submit.prevent="save" class="create-form">
      <label class="field">
        <span class="field-label">Название</span>
        <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
      </label>

      <label class="field">
        <span class="field-label">Пользователь</span>
        <select v-model.number="form.user_id" class="field-select" required>
          <option :value="null" disabled>[ВЫБЕРИТЕ]</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} ({{ u.email }})</option>
        </select>
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
        <NuxtLink to="/warehouses" class="btn-cancel">Отмена</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { UserProfileResponse } from '~/repository/modules/userProfile'

const { $api, $notify } = useNuxtApp()
const router = useRouter()

const saving = ref(false)
const users = ref<UserProfileResponse[]>([])

const form = reactive({
  title: '',
  user_id: null as number | null,
})

async function loadUsers() {
  try {
    users.value = await $api.userProfile.all()
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка загрузки пользователей'), { type: 'error', timer: 10 })
  }
}

async function save() {
  if (form.user_id === null) {
    $notify.add('Выберите пользователя', { type: 'warning', timer: 5 })
    return
  }
  saving.value = true
  try {
    const created = await $api.warehouse.create({ title: form.title, user_id: form.user_id })
    $notify.add('Склад создан', { type: 'success' })
    router.push(`/warehouses/${created.id}/edit`)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка создания'), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

onMounted(loadUsers)
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: #ccc;
}

.create-form {
  max-width: 500px;
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
