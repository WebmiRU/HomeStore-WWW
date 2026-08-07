<template>
  <div class="create-page">
    <h3 class="page-title">Добавление шаблона этикетки</h3>

    <form @submit.prevent="save" class="create-form">
      <!-- Основное -->
      <fieldset class="fieldset">
        <legend class="legend">Основное</legend>
        <label class="field">
          <span class="field-label">Название</span>
          <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
        </label>
      </fieldset>

      <!-- Страница -->
      <fieldset class="fieldset">
        <legend class="legend">Страница</legend>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Ширина</span>
            <input v-model.number="form.page_width" type="number" class="field-input" min="1" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Высота</span>
            <input v-model.number="form.page_height" type="number" class="field-input" min="1" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Отступ сверху</span>
            <input v-model.number="form.page_margin_top" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Отступ справа</span>
            <input v-model.number="form.page_margin_right" type="number" class="field-input" min="0" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Отступ снизу</span>
            <input v-model.number="form.page_margin_bottom" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Отступ слева</span>
            <input v-model.number="form.page_margin_left" type="number" class="field-input" min="0" step="0.1" required />
          </label>
        </div>
      </fieldset>

      <!-- Ячейка -->
      <fieldset class="fieldset">
        <legend class="legend">Ячейка</legend>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Ширина</span>
            <input v-model.number="form.cell_width" type="number" class="field-input" min="1" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Высота</span>
            <input v-model.number="form.cell_height" type="number" class="field-input" min="1" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Отступ сверху</span>
            <input v-model.number="form.cell_pad_top" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Отступ справа</span>
            <input v-model.number="form.cell_pad_right" type="number" class="field-input" min="0" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Отступ снизу</span>
            <input v-model.number="form.cell_pad_bottom" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Отступ слева</span>
            <input v-model.number="form.cell_pad_left" type="number" class="field-input" min="0" step="0.1" required />
          </label>
        </div>
      </fieldset>

      <!-- Штрих-код -->
      <fieldset class="fieldset">
        <legend class="legend">Штрих-код</legend>
        <label class="field">
          <span class="field-label">Позиция</span>
          <select v-model="form.barcode_position" class="field-select" required>
            <option value="left">Слева</option>
            <option value="right">Справа</option>
            <option value="top">Сверху</option>
            <option value="bottom">Снизу</option>
          </select>
        </label>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Отступ текста</span>
            <input v-model.number="form.barcode_text_gap" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Размер</span>
            <input v-model.number="form.barcode_size" type="number" class="field-input" min="1" step="0.1" required />
          </label>
        </div>
      </fieldset>

      <!-- Шрифт -->
      <fieldset class="fieldset">
        <legend class="legend">Шрифт</legend>
        <label class="field">
          <span class="field-label">font_id</span>
          <input v-model.number="form.font_id" type="number" class="field-input" />
        </label>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Мин. размер</span>
            <input v-model.number="form.font_size_min" type="number" class="field-input" min="1" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Макс. размер</span>
            <input v-model.number="form.font_size_max" type="number" class="field-input" min="1" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">Шаг размера</span>
            <input v-model.number="form.font_size_step" type="number" class="field-input" min="0.1" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">Межстрочный</span>
            <input v-model.number="form.line_height_factor" type="number" class="field-input" min="0.5" step="0.1" required />
          </label>
        </div>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
        <NuxtLink to="/label-presets" class="btn-cancel">Отмена</NuxtLink>
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

const form = reactive({
  title: '',
  page_width: 210,
  page_height: 297,
  page_margin_top: 0,
  page_margin_right: 0,
  page_margin_bottom: 0,
  page_margin_left: 0,
  cell_width: 70,
  cell_height: 37,
  cell_pad_top: 1,
  cell_pad_right: 1,
  cell_pad_bottom: 1,
  cell_pad_left: 1,
  barcode_position: 'left' as 'left' | 'right' | 'top' | 'bottom',
  barcode_text_gap: 1,
  barcode_size: 8,
  font_id: null as number | null,
  font_size_min: 8,
  font_size_max: 14,
  font_size_step: 0.5,
  line_height_factor: 1.2,
})

async function save() {
  saving.value = true
  try {
    const created = await $api.labelPreset.create({ ...form })
    $notify.add('Шаблон создан', { type: 'success' })
    router.push(`/label-presets/${created.id}/edit`)
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

.create-form {
  max-width: 600px;
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

.field-half {
  flex: 1;
}

.field-row {
  display: flex;
  gap: 10px;
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
