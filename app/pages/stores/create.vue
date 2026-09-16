<template>
  <div class="create-page">
    <h3 class="page-title">Добавление хранилища</h3>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else @submit.prevent="save" class="create-form">
      <label class="field">
        <span class="field-label">Название</span>
        <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
      </label>

      <label class="field">
        <span class="field-label">Название для печати</span>
        <input v-model="form.title_print" type="text" class="field-input" maxlength="500" />
      </label>

      <label class="field">
        <span class="field-label">Склад</span>
        <select v-model.number="form.warehouse_id" class="field-select">
          <option :value="null">[НЕТ]</option>
          <option v-for="opt in warehouseOptions" :key="opt.id" :value="opt.id">
            {{ opt.title }}
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Родительское хранилище</span>
        <select v-model.number="form.parent_id" class="field-select">
          <option :value="null">[НЕТ]</option>
          <option
            v-for="opt in parentOptions"
            :key="opt.id"
            :value="opt.id"
          >{{ '\u2014'.repeat(opt.depth) }}{{ opt.depth > 0 ? ' ' : '' }}{{ opt.title }}</option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Код</span>
        <input v-model="form.code" type="text" class="field-input" maxlength="256" />
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
        <button type="button" @click="saveAndCopy" class="btn-save-copy" :disabled="saving">Сохранить и создать копию</button>
        <NuxtLink to="/stores" class="btn-cancel">Отмена</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { StoreResponse } from '~/repository/modules/store'
import type { WarehouseResponse } from '~/repository/modules/warehouse'

const { $api, $notify } = useNuxtApp()
const router = useRouter()
const route = useRoute()

const scannedCode = typeof route.query.code === 'string' ? route.query.code : ''
const copyTitle = typeof route.query.copy_title === 'string' ? route.query.copy_title : ''
const copyTitlePrint = typeof route.query.copy_title_print === 'string' ? route.query.copy_title_print : ''
const copyParentId = typeof route.query.copy_parent_id === 'string' ? Number(route.query.copy_parent_id) : null
const copyWarehouseId = typeof route.query.copy_warehouse_id === 'string' ? Number(route.query.copy_warehouse_id) : null

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
    const tree = buildTree(stores)
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
    $notify.add('Хранилище создано', { type: 'success' })
    router.push(`/stores/${created.id}/edit`)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка создания'), { type: 'error', timer: 10 })
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
    $notify.add('Хранилище создано', { type: 'success' })
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
    $notify.add(formatApiError(err, 'Ошибка создания'), { type: 'error', timer: 10 })
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

.btn-save:disabled,
.btn-save-copy:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-save-copy {
  padding: 8px 24px;
  font-size: 14px;
  font-family: inherit;
  background: #2a5a4a;
  color: #cfc;
  border: 1px solid #3a7a6a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-save-copy:hover:not(:disabled) {
  background: #3a7a6a;
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
