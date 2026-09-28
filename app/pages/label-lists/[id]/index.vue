<template>
  <div class="edit-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('label_lists.edit_title', { id }) }}</h3>
      <button class="btn-download" :disabled="downloading" @click="downloadPdf">
        {{ downloading ? t('form.loading') : t('label_lists.download') }}
      </button>
    </div>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <template v-else>
      <TabBar :tabs="tabs" class="edit-tabs" />

      <form v-if="activeTab === 'main'" @submit.prevent="save" class="edit-form">
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

      <section v-if="activeTab === 'items'" class="content-section">
        <h4 class="section-title">{{ t('label_lists.stores_in_set', { count: listStores.length }) }}</h4>
        <div v-if="listItems.length === 0" class="section-empty">{{ t('items.no_items') }}</div>
        <table v-else class="content-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{{ t('form.title') }}</th>
              <th>{{ t('form.store') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in listItems" :key="item.payload.id">
              <td data-label="ID">{{ item.payload.id }}</td>
              <td :data-label="t('common.title')">{{ item.payload.title }}</td>
              <td :data-label="t('form.store')">{{ item.store?.[0]?.title ?? '—' }}</td>
              <td class="actions">
                <a
                  href="#"
                  class="action-link action-del"
                  :class="{ disabled: removingItem === item.payload.id }"
                  :title="t('common.delete')"
                  :aria-label="t('common.delete')"
                  @click.prevent="removeItem(item.payload.id)"
                >
                  <img v-if="removingItem === item.payload.id" src="/img/icon/add.svg" class="action-icon" alt="" />
                  <img v-else src="/img/icon/delete.svg" class="action-icon" alt="" />
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="activeTab === 'stores'" class="content-section">
        <h4 class="section-title">{{ t('label_lists.stores_in_set', { count: listStores.length }) }}</h4>
        <div v-if="listStores.length === 0" class="section-empty">{{ t('stores.no_stores') }}</div>
        <table v-else class="content-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{{ t('form.title') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="store in listStores" :key="store.id">
              <td data-label="ID">{{ store.id }}</td>
              <td :data-label="t('common.title')">{{ store.title }}</td>
              <td class="actions">
                <a
                  href="#"
                  class="action-link action-del"
                  :class="{ disabled: removingStore === store.id }"
                  :title="t('common.delete')"
                  :aria-label="t('common.delete')"
                  @click.prevent="removeStore(store.id)"
                >
                  <img v-if="removingStore === store.id" src="/img/icon/add.svg" class="action-icon" alt="" />
                  <img v-else src="/img/icon/delete.svg" class="action-icon" alt="" />
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="activeTab === 'stats'" class="content-section">
        <EntityAuditStats entity-type="label_list" :entity-id="Number(id)" />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { LabelPresetResponse } from '~/repository/modules/labelPreset'
import type { ItemResponse } from '~/repository/modules/item'
import type { StoreResponse } from '~/repository/modules/store'
import { formatApiError, readBlobApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()

const id = route.params.id as string

const tabs = computed(() => [
  { key: 'main', label: t('label_lists.main_tab') },
  { key: 'items', label: t('access_sections.items') },
  { key: 'stores', label: t('access_sections.stores') },
  { key: 'stats', label: t('form.stats_tab') },
])

const activeTab = computed(() => {
  const q = route.query.tab
  if (typeof q === 'string' && tabs.value.some((t) => t.key === q)) {
    return q
  }
  return 'main'
})

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const presets = ref<LabelPresetResponse[]>([])
const listItems = ref<ItemResponse[]>([])
const listStores = ref<StoreResponse[]>([])
const removingItem = ref<number | null>(null)
const removingStore = ref<number | null>(null)
const downloading = ref(false)

const form = reactive({
  title: '',
  label_preset_id: 0,
  print_all_codes: false,
})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [list, presetsResult] = await Promise.all([
      $api.labelList.get(Number(id)),
      $api.labelPreset.list(),
    ])
    form.title = list.title
    form.label_preset_id = list.label_preset_id
    form.print_all_codes = list.print_all_codes ?? false
    presets.value = presetsResult.data
    listItems.value = list.items ?? []
    listStores.value = list.stores ?? []
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await $api.labelList.update(Number(id), {
      title: form.title,
      label_preset_id: form.label_preset_id,
      print_all_codes: form.print_all_codes,
    })
    $notify.add(t('form.saved', { title: t('label_lists.one') }), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.save_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

async function removeItem(itemId: number) {
  removingItem.value = itemId
  try {
    await $api.labelList.detachItem(Number(id), itemId)
    listItems.value = listItems.value.filter(i => i.payload.id !== itemId)
    $notify.add(t('label_lists.item_removed'), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
  } finally {
    removingItem.value = null
  }
}

async function removeStore(storeId: number) {
  removingStore.value = storeId
  try {
    await $api.labelList.detachStore(Number(id), storeId)
    listStores.value = listStores.value.filter(s => s.id !== storeId)
    $notify.add(t('label_lists.store_removed'), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
  } finally {
    removingStore.value = null
  }
}

async function downloadPdf() {
  downloading.value = true
  try {
    const blob = await $api.labelList.generate(Number(id))
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `labels-${id}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    $notify.add(t('label_lists.download_started'), { type: 'success' })
  } catch (err: any) {
    $notify.add(await readBlobApiError(err, t('label_lists.download_failed')), { type: 'error', timer: 10 })
  } finally {
    downloading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.btn-download {
  padding: 6px 16px;
  font-size: 14px;
  font-family: inherit;
  background: var(--info-bg);
  color: var(--info);
  border: 1px solid var(--info);
  border-radius: 4px;
  cursor: pointer;
}

.btn-download:hover:not(:disabled) {
  background: var(--info);
}

.btn-download:disabled {
  opacity: 0.5;
  cursor: wait;
}

.loading,
.error {
  color: var(--text-muted);
  padding: 12px 0;
}

.error {
  color: var(--danger);
}

.edit-form {
  width: 100%;
}

.edit-tabs {
  margin: 14px 0 20px;
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
 * над input'ами: иначе подпись встала бы в строку с квадратиком, а
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

.content-section {
  margin-top: 24px;
}

.section-title {
  margin: 0 0 10px;
  font-size: 15px;
  color: var(--text-muted);
}

.section-empty {
  padding: 12px;
  color: var(--text-faint);
  font-size: 13px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.content-table {
  width: 100%;
  border-collapse: collapse;
}

.content-table th,
.content-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.content-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.content-table td {
  color: var(--text-secondary);
}

.content-table tr:hover td {
  background: var(--bg-elevated);
}

.actions {
  white-space: nowrap;
  width: 1px;
}

.action-link {
  color: var(--info);
  text-decoration: none;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.action-link img.action-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.action-link:hover {
  color: var(--info);
}

.action-del {
  color: var(--danger);
}

.action-del:hover {
  color: var(--danger);
}

.action-del.disabled {
  opacity: 0.4;
  cursor: wait;
  color: var(--text-faint);
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .content-table,
  .content-table tbody,
  .content-table tr,
  .content-table td {
    display: block;
  }

  .content-table thead {
    display: none;
  }

  .content-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .content-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
    font-size: 15px;
    white-space: normal;
  }

  .content-table td.cb-col {
    position: absolute;
    top: 12px;
    left: 14px;
    width: auto;
    padding: 0;
  }

  .content-table td.cb-col input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }

  .content-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .content-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .content-table tr:hover td {
    background: transparent;
  }
}
</style>
