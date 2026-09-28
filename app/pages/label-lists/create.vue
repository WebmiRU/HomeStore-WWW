<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('label_lists.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <form @submit.prevent="save" class="create-form">
      <fieldset class="fieldset">
        <legend class="legend">{{ t('label_presets.legend_main') }}</legend>
        <label class="field">
          <span class="field-label">{{ t('form.title') }}</span>
          <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
        </label>
        <label class="field">
          <span class="field-label">{{ t('label_lists.template_label') }}</span>
          <select v-model="form.label_preset_id" class="field-select" required>
            <option :value="0" disabled>{{ t('placeholders.pick_template') }}</option>
            <option v-for="p in presets" :key="p.id" :value="p.id">{{ p.title }}</option>
          </select>
        </label>
        <label class="field field--check">
          <input v-model="form.print_all_codes" type="checkbox" class="field-check" />
          <span>{{ t('label_lists.print_all_codes') }}</span>
          <span class="field-hint">
            {{ t('label_lists.codes_hint') }}
          </span>
        </label>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <NuxtLink to="/label-lists" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import type { LabelPresetResponse } from '~/repository/modules/labelPreset'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const router = useRouter()

const saving = ref(false)
const presets = ref<LabelPresetResponse[]>([])

const tabs = computed(() => [{ key: 'main', label: t('label_lists.main_tab') }])

const form = reactive({
  title: '',
  label_preset_id: 0,
  print_all_codes: false,
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
    const created = await $api.labelList.create({
      title: form.title,
      label_preset_id: form.label_preset_id,
      print_all_codes: form.print_all_codes,
    })
    $notify.add(t('form.created', { title: t('label_lists.one') }), { type: 'success' })
    router.push(`/label-lists/${created.id}`)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
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

.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

/*
 * Крыжик — не поле, а строка из трёх частей: сам checkbox, подпись и
 * пояснение под ними. Поэтому здесь flex, а не block, как у .field-label
 * надinput'ами: иначе подпись встала бы в строку с квадратиком, а
 * пояснение — под всем рядом, и строка расползлась бы на две лишние.
 */
.field--check {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 8px;
  row-gap: 2px;
}

.field-check {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.field-hint {
  flex: 1 1 100%;
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
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
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
