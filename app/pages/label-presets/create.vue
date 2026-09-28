<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('label_presets.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <form @submit.prevent="save" class="create-form">
      <!-- Основное -->
      <fieldset class="fieldset">
        <legend class="legend">{{ t('label_presets.legend_main') }}</legend>
        <label class="field">
          <span class="field-label">{{ t('form.title') }}</span>
          <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
        </label>
      </fieldset>

      <!-- Страница -->
      <fieldset class="fieldset">
        <legend class="legend">{{ t('label_presets.legend_page') }}</legend>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.width') }}</span>
            <input v-model.number="form.page_width" type="number" class="field-input" min="1" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.height') }}</span>
            <input v-model.number="form.page_height" type="number" class="field-input" min="1" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.margin_top') }}</span>
            <input v-model.number="form.page_margin_top" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.margin_right') }}</span>
            <input v-model.number="form.page_margin_right" type="number" class="field-input" min="0" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.margin_bottom') }}</span>
            <input v-model.number="form.page_margin_bottom" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.margin_left') }}</span>
            <input v-model.number="form.page_margin_left" type="number" class="field-input" min="0" step="0.1" required />
          </label>
        </div>
      </fieldset>

      <!-- Ячейка -->
      <fieldset class="fieldset">
        <legend class="legend">{{ t('label_presets.legend_cell') }}</legend>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.width') }}</span>
            <input v-model.number="form.cell_width" type="number" class="field-input" min="1" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.height') }}</span>
            <input v-model.number="form.cell_height" type="number" class="field-input" min="1" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.margin_top') }}</span>
            <input v-model.number="form.cell_pad_top" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.margin_right') }}</span>
            <input v-model.number="form.cell_pad_right" type="number" class="field-input" min="0" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.margin_bottom') }}</span>
            <input v-model.number="form.cell_pad_bottom" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.margin_left') }}</span>
            <input v-model.number="form.cell_pad_left" type="number" class="field-input" min="0" step="0.1" required />
          </label>
        </div>
      </fieldset>

      <!-- Штрих-код -->
      <fieldset class="fieldset">
        <legend class="legend">{{ t('label_presets.legend_barcode') }}</legend>
        <label class="field">
          <span class="field-label">{{ t('label_presets.position') }}</span>
          <select v-model="form.barcode_position" class="field-select" required>
            <option value="left">{{ t('label_presets.pos_left') }}</option>
            <option value="right">{{ t('label_presets.pos_right') }}</option>
            <option value="top">{{ t('label_presets.pos_top') }}</option>
            <option value="bottom">{{ t('label_presets.pos_bottom') }}</option>
          </select>
        </label>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.text_offset') }}</span>
            <input v-model.number="form.barcode_text_gap" type="number" class="field-input" min="0" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.size') }}</span>
            <input v-model.number="form.barcode_size" type="number" class="field-input" min="1" step="0.1" required />
          </label>
        </div>
        <label class="field field-check">
          <input v-model="form.show_text" type="checkbox" class="field-checkbox" />
          <span class="field-label">{{ t('label_presets.print_label') }}</span>
        </label>
      </fieldset>

      <!-- Шрифт -->
      <fieldset class="fieldset">
        <legend class="legend">{{ t('label_presets.legend_font') }}</legend>
        <label class="field">
          <span class="field-label">font_id</span>
          <input v-model.number="form.font_id" type="number" class="field-input" />
        </label>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.font_min') }}</span>
            <input v-model.number="form.font_size_min" type="number" class="field-input" min="1" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.font_max') }}</span>
            <input v-model.number="form.font_size_max" type="number" class="field-input" min="1" step="0.1" required />
          </label>
        </div>
        <div class="field-row">
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.font_step') }}</span>
            <input v-model.number="form.font_size_step" type="number" class="field-input" min="0.1" step="0.1" required />
          </label>
          <label class="field field-half">
            <span class="field-label">{{ t('label_presets.line_height') }}</span>
            <input v-model.number="form.line_height_factor" type="number" class="field-input" min="0.5" step="0.1" required />
          </label>
        </div>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <NuxtLink to="/label-presets" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const router = useRouter()

const saving = ref(false)

const tabs = computed(() => [{ key: 'main', label: t('label_presets.main_tab') }])

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
  show_text: true,
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
    $notify.add(t('form.created', { title: t('label_presets.one') }), { type: 'success' })
    router.push(`/label-presets/${created.id}`)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page-title {
  margin: 0 0 20px;
  font-size: 18px;
  color: var(--text-secondary);
}

.create-tabs {
  margin: 14px 0 20px;
}

.create-form {
  width: 100%;
}

.fieldset {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.legend {
  font-size: 13px;
  color: var(--text-muted);
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
  color: var(--text-muted);
  margin-bottom: 4px;
}

.field-input {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.field-input:focus,
.field-select:focus {
  border-color: var(--border-strong);
}

.field-select {
  width: 100%;
  padding: 8px 10px;
  font-size: 15px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.field-check {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-check .field-label {
  margin-bottom: 0;
}

.field-checkbox {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
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
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: var(--accent);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-muted);
  text-decoration: none;
  border: 1px dashed var(--border-strong);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
}

.btn-cancel:hover {
  color: var(--text);
  background: var(--bg-hover);
  border-style: solid;
}

@media (max-width: 768px) {
  .field-row {
    flex-wrap: wrap;
  }

  .field-half {
    flex: 1 1 100%;
  }

  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
