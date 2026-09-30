<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('properties.dictionary_titles.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <form class="create-form" @submit.prevent="save">
      <label class="field">
        <span class="field-label">{{ t('form.title') }}</span>
        <input v-model="form.title" type="text" class="field-input" maxlength="200" required />
        <span class="field-hint">{{ t('properties.dictionary_hint_short') }}</span>
      </label>

      <!--
        Значения вводятся здесь же, а не следующим заходом на страницу
        правки. Пустой справочник ни к одному свойству не применить, и
        заводить его в два захода — значило оставлять после себя недоделку,
        про которую ничего не напоминает. Плюс два круга туда-обратно ради
        списка, который всё равно тут же.
      -->
      <section v-if="activeTab === 'values'" class="tab-section">
        <form class="value-add" @submit.prevent="addValue">
          <input
            v-model="newValue"
            type="text"
            class="field-input"
            maxlength="200"
            :placeholder="t('properties.new_value')"
          />
          <button type="submit" class="btn-add" :disabled="newValue.trim() === ''">{{ t('common.add') }}</button>
        </form>

        <ul v-if="values.length" class="values-list">
          <li v-for="(title, index) in values" :key="`${title}-${index}`" class="values-list__row">
            <span class="values-list__title">{{ title }}</span>
            <button
              type="button"
              class="action-link action-del"
              :title="t('common.delete')"
              :aria-label="t('common.delete')"
              @click="removeValue(index)"
            >
              <img src="/img/icon/delete.svg" class="action-icon" alt="" />
            </button>
          </li>
        </ul>

        <div v-else class="empty">
          {{ t('properties.no_values') }}
        </div>

        <p class="field-hint">{{ t('properties.value_delete_hint') }}</p>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <NuxtLink to="/dictionaries" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const saving = ref(false)

const tabs = computed(() => [
  { key: 'main', label: t('properties.main_tab') },
  { key: 'values', label: t('form.values_tab') },
])

const activeTab = computed(() => {
  const q = route.query.tab

  if (typeof q === 'string' && tabs.value.some((tab) => tab.key === q)) {
    return q
  }

  return 'main'
})

const form = reactive({ title: '' })

/** Значения набираются до сохранения и уходят вместе со справочником. */
const values = ref<string[]>([])
const newValue = ref('')

/** Повтор внутри одного списка — опечатка, а не два разных значения. */
function addValue() {
  const title = newValue.value.trim()

  if (title === '' || values.value.includes(title)) {
    newValue.value = ''

    return
  }

  values.value = [...values.value, title]
  newValue.value = ''
}

function removeValue(index: number) {
  values.value = values.value.filter((_, i) => i !== index)
}

async function save() {
  saving.value = true
  try {
    const created = await $api.dictionary.create({
      title: form.title,
      values: values.value,
    })
    $notify.add(t('form.created', { title: t('properties.dictionary_one') }), { type: 'success' })
    // Сразу на страницу редактирования: там добавляются значения, а
    // пустой справочник отдельно показывать нечего.
    router.push(`/dictionaries/${created.id}`)
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

.field {
  display: block;
  margin-bottom: 14px;
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

.field-input:focus {
  border-color: var(--border-strong);
}

.field-hint {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

.value-add {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.value-add .field-input {
  flex: 1;
}

.value-add .btn-add {
  flex-shrink: 0;
  padding: 8px 16px;
  font-size: 14px;
  font-family: inherit;
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
}

.value-add .btn-add:disabled {
  opacity: 0.5;
  cursor: default;
}

/*
 * Список набранных значений — тот же вид, что таблица на странице правки,
 * только без колонок: у набора ещё нет ни идентификаторов, ни дат, а
 * показывать пустые колонки было бы враньём.
 */
.values-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--border);
}

.values-list__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  color: var(--text-secondary);
}

.values-list__row:hover {
  background: var(--bg-elevated);
}

.values-list__title {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.action-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--link);
  cursor: pointer;
  flex-shrink: 0;
}

.action-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.empty {
  padding: 20px;
  color: var(--text-muted);
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
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
