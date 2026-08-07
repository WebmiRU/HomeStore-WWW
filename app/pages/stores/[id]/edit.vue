<template>
  <div class="edit-page">
    <h3 class="page-title">Редактирование хранилища #{{ id }}</h3>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="loadError" class="error">{{ loadError }}</div>

    <form v-else @submit.prevent="save" class="edit-form">
      <label class="field">
        <span class="field-label">Название</span>
        <input v-model="form.title" type="text" class="field-input" maxlength="500" required />
      </label>

      <label class="field">
        <span class="field-label">Название для печати</span>
        <input v-model="form.title_print" type="text" class="field-input" maxlength="500" />
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

      <div v-if="saveError" class="save-error">{{ saveError }}</div>
      <div v-if="saveOk" class="save-ok">Сохранено</div>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="saving">Сохранить</button>
        <NuxtLink to="/stores" class="btn-cancel">Отмена</NuxtLink>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { StoreResponse } from '~/repository/modules/store'

const { $api } = useNuxtApp()
const route = useRoute()
const router = useRouter()

const id = route.params.id as string

const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const saveOk = ref(false)

const form = reactive({
  title: '',
  title_print: '',
  parent_id: null as number | null,
})

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
    const [store, stores] = await Promise.all([
      $api.store.get(Number(id)),
      $api.store.list(),
    ])

    form.title = store.title
    form.title_print = store.title_print ?? ''
    form.parent_id = store.parent_id

    // Строим дерево для селекта, исключая текущее хранилище
    const filtered = stores.filter(s => s.id !== store.id)
    const tree = buildTree(filtered)
    parentOptions.value = flattenTree(tree)
  } catch (err: any) {
    loadError.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  saveError.value = null
  saveOk.value = false
  try {
    await $api.store.update(Number(id), {
      title: form.title,
      title_print: form.title_print || null,
      parent_id: form.parent_id,
    })
    saveOk.value = true
    setTimeout(() => {
      router.push('/stores')
    }, 800)
  } catch (err: any) {
    saveError.value = err?.data?.error || err?.message || String(err)
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

.save-error {
  color: #f88;
  font-size: 13px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #3a1a1a;
  border-radius: 4px;
}

.save-ok {
  color: #8f8;
  font-size: 13px;
  margin-bottom: 12px;
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
