<template>
  <div class="edit-page">
    <h3 class="page-title">Редактирование пользователя #{{ id }}</h3>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else @submit.prevent="save" class="edit-form">
      <label class="field">
        <span class="field-label">Имя</span>
        <input v-model="form.name" type="text" class="field-input" maxlength="255" required />
      </label>

      <label class="field">
        <span class="field-label">E-mail</span>
        <input v-model="form.email" type="email" class="field-input" maxlength="255" required />
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
        <NuxtLink to="/users" class="btn-cancel">Отмена</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const route = useRoute()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  email: '',
})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const user = await $api.userProfile.get(Number(id))
    form.name = user.name
    form.email = user.email
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api.userProfile.update(Number(id), { ...form })
    $notify.add('Пользователь сохранён', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка сохранения'), { type: 'error', timer: 10 })
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
