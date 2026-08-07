<template>
  <div class="create-page">
    <h3 class="page-title">Добавление набора этикеток</h3>

    <form @submit.prevent="save" class="create-form">
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
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import type { LabelPresetResponse } from '~/repository/modules/labelPreset'

const { $api, $notify } = useNuxtApp()
const router = useRouter()

const saving = ref(false)
const presets = ref<LabelPresetResponse[]>([])

const form = reactive({
  title: '',
  label_preset_id: 0,
})

async function loadPresets() {
  try {
    const result = await $api.labelPreset.list()
    presets.value = result.data
  } catch {
    // ignore
  }
}

async function save() {
  saving.value = true
  try {
    const created = await $api.labelList.create({ title: form.title, label_preset_id: form.label_preset_id })
    $notify.add('Набор создан', { type: 'success' })
    router.push(`/label-lists/${created.id}/edit`)
  } catch (err: any) {
    $notify.add(err?.data?.error || err?.message || 'Ошибка создания', { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

onMounted(loadPresets)
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
</style>
