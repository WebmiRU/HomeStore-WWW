<template>
  <div class="create-page">
    <h3 class="page-title">{{ t('stores.create_title') }}</h3>

    <TabBar :tabs="tabs" class="create-tabs" />

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else @submit.prevent="save" class="create-form">
      <label class="field">
        <span class="field-label">{{ t('form.title') }}</span>
        <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
      </label>

      <label class="field">
        <span class="field-label">{{ t('form.title_print') }}</span>
        <input v-model="form.title_print" type="text" class="field-input" maxlength="500" />
      </label>

      <label class="field">
        <span class="field-label">{{ t('form.warehouse') }}</span>
        <select v-model.number="form.warehouse_id" class="field-select">
          <option :value="null">{{ t('placeholders.none') }}</option>
          <option v-for="opt in warehouseOptions" :key="opt.id" :value="opt.id" :disabled="!opt.can_create">
            {{ opt.title }}<template v-if="!opt.can_create"> — {{ t('form.readonly_word') }}</template>
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">{{ t('form.parent') }}</span>
        <select v-model.number="form.parent_id" class="field-select">
          <option :value="null">{{ t('placeholders.none') }}</option>
          <option
            v-for="opt in parentOptions"
            :key="opt.id"
            :value="opt.id"
          >{{ '\u2014'.repeat(opt.depth) }}{{ opt.depth > 0 ? ' ' : '' }}{{ opt.title }}</option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">{{ t('form.code') }}</span>
        <input v-model="form.code" type="text" class="field-input" maxlength="256" @keydown="onKeydown" />
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">{{ t('form.save') }}</button>
        <button type="button" @click="saveAndCopy" class="btn-save-copy" :disabled="saving">{{ t('form.save_and_clone') }}</button>
        <NuxtLink to="/stores" class="btn-cancel">{{ t('form.cancel') }}</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { StoreResponse } from '~/repository/modules/store'
import type { WarehouseResponse } from '~/repository/modules/warehouse'
import { useScanIntoField } from '~/composables/useScanIntoField'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const { onKeydown } = useScanIntoField()

const scannedCode = typeof route.query.code === 'string' ? route.query.code : ''
const copyTitle = typeof route.query.copy_title === 'string' ? route.query.copy_title : ''
const copyTitlePrint = typeof route.query.copy_title_print === 'string' ? route.query.copy_title_print : ''
const copyParentId = typeof route.query.copy_parent_id === 'string' ? Number(route.query.copy_parent_id) : null
const copyWarehouseId = typeof route.query.copy_warehouse_id === 'string' ? Number(route.query.copy_warehouse_id) : null

const tabs = computed(() => [{ key: 'main', label: t('stores.main_tab') }])

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)

const form = reactive({
  title: copyTitle,
  title_print: copyTitlePrint,
  warehouse_id: copyWarehouseId,
  parent_id: copyParentId,
  code: scannedCode,
})

const warehouseOptions = ref<WarehouseResponse[]>([])

interface ParentOption {
  id: number
  title: string
  depth: number
}

const parentOptions = ref<ParentOption[]>([])

interface TreeNode {
  store: StoreResponse
  children: TreeNode[]
}

function buildTree(stores: StoreResponse[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  for (const store of stores) {
    map.set(store.id, { store, children: [] })
  }

  for (const store of stores) {
    const node = map.get(store.id)!
    if (store.parent_id && map.has(store.parent_id)) {
      map.get(store.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function flattenTree(nodes: TreeNode[], depth: number = 0): ParentOption[] {
  const result: ParentOption[] = []
  for (const node of nodes) {
    result.push({ id: node.store.id, title: node.store.title, depth })
    result.push(...flattenTree(node.children, depth + 1))
  }
  return result
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [stores, warehouses] = await Promise.all([
      $api.store.list(),
      $api.warehouse.all(),
    ])
    warehouseOptions.value = warehouses
    const canCreateIn = (s: StoreResponse): boolean => {
      if (!s.warehouse_id) return true
      return warehouses.some((w) => w.can_create && w.id === s.warehouse_id)
    }
    const tree = buildTree(stores.filter(canCreateIn))
    parentOptions.value = flattenTree(tree)
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    const created = await $api.store.create({
      title: form.title,
      title_print: form.title_print || null,
      warehouse_id: form.warehouse_id,
      parent_id: form.parent_id,
      code: form.code.trim() || null,
    })
    $notify.add(t('form.created', { title: t('stores.one') }), { type: 'success' })
    router.push(`/stores/${created.id}`)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
  } finally {
    saving.value = false
  }
}

async function saveAndCopy() {
  saving.value = true
  try {
    const created = await $api.store.create({
      title: form.title,
      title_print: form.title_print || null,
      warehouse_id: form.warehouse_id,
      parent_id: form.parent_id,
      code: form.code.trim() || null,
    })
    $notify.add(t('form.created', { title: t('stores.one') }), { type: 'success' })
    router.push({
      path: '/stores/create',
      query: {
        copy_title: form.title,
        copy_title_print: form.title_print,
        copy_parent_id: form.parent_id,
        copy_warehouse_id: form.warehouse_id,
      },
    })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('form.create_failed')), { type: 'error', timer: 10 })
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
  color: var(--text-secondary);
}

.create-tabs {
  margin: 14px 0 20px;
}

.loading,
.error {
  color: var(--text-muted);
  padding: 12px 0;
}

.error {
  color: var(--danger);
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

.btn-save:disabled,
.btn-save-copy:disabled {
  opacity: 0.5;
  cursor: default;
}

/* См. .btn-save-copy на странице создания предмета: действие «создать копию»
   спокойное, яркой остаётся главная кнопка. */
.btn-save-copy {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  color: var(--text);
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.btn-save-copy:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-hover);
  border-color: var(--accent);
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
