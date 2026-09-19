<template>
  <div class="create-page">
    <h3 class="page-title">Добавление пользователя</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <form @submit.prevent="save" class="create-form">
      <label class="field">
        <span class="field-label">Имя</span>
        <input v-model="form.name" type="text" class="field-input" maxlength="255" required />
      </label>

      <label class="field">
        <span class="field-label">E-mail</span>
        <input v-model="form.email" type="email" class="field-input" maxlength="255" required />
      </label>

      <label class="field">
        <span class="field-label">Пароль</span>
        <input v-model="form.password" type="password" class="field-input" minlength="6" maxlength="255" required autocomplete="new-password" />
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
        <NuxtLink to="/users" class="btn-cancel">Отмена</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const router = useRouter()

const saving = ref(false)

const tabs = [{ key: 'main', label: 'Основные параметры' }]

const form = reactive({
  name: '',
  email: '',
  password: '',
})

async function save() {
  saving.value = true
  try {
    const created = await $api.userProfile.create({ ...form })
    $notify.add('Пользователь создан', { type: 'success' })
    router.push(`/users/${created.id}/edit`)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка создания'), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: #ccc;
}

.create-tabs {
  margin: 14px 0 20px;
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
