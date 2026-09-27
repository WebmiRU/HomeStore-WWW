<template>
  <div class="stores-page">
    <div class="page-header">
      <h3 class="page-title">Список хранилищ</h3>
      <div class="page-header-actions">
        <MassLabelListButton
          :item-ids="[]"
          :store-ids="selectedIds"
          @done="clearSelection"
        />
        <NuxtLink to="/stores/create" class="btn-add">Добавить</NuxtLink>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table class="stores-table" v-if="flatList.length">
        <thead>
          <tr>
            <th class="cb-col">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate.prop="someSelected && !allSelected"
                @change="toggleAll"
              />
            </th>
            <th>ID</th>
            <th class="img-col">Фото</th>
            <th>Название</th>
            <th>Создан</th>
            <th>Обновлён</th>
            <th v-if="showOwnerColumn">Владелец</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in pageList" :key="node.store.id" @dblclick="openRow($event, `/stores/${node.store.id}/edit`)">
            <td class="cb-col">
              <input
                type="checkbox"
                :checked="selected.has(node.store.id)"
                @change="toggleOne(node.store.id)"
              />
            </td>
            <td data-label="ID">{{ node.store.id }}</td>
            <td class="img-col">
              <ItemPhoto :images="node.store.images" :alt="node.store.title" :size="40" lightbox />
            </td>
            <td data-label="Название">
              <span class="tree-prefix">{{ '\u2014'.repeat(node.depth) }}</span>
              <span v-if="node.depth > 0" class="tree-space"> </span>
              {{ node.store.title }}
            </td>
            <td data-label="Создан">{{ formatDate(node.store.created_at) }}</td>
            <td data-label="Обновлён">{{ formatDate(node.store.updated_at) }}</td>
            <td v-if="showOwnerColumn" data-label="Владелец">
              <span
                v-if="node.store.user"
                class="owner-name"
                :class="isOwner(node.store.user) ? 'owner--me' : 'owner--other'"
              >{{ node.store.user.name }}</span>
              <span v-else>—</span>
            </td>
            <td class="actions">
              <LabelListToggler :store-id="node.store.id" :in-any-list="storesInLists.has(node.store.id)" @changed="onTogglerChanged" />
              <NuxtLink
                v-if="canEdit(node.store)"
                :to="`/stores/${node.store.id}/edit`"
                class="action-link action-edit"
                title="Редактировать"
                aria-label="Редактировать"
              >
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <NuxtLink
                v-else
                :to="`/stores/${node.store.id}/edit`"
                class="action-link action-view"
                title="Открыть"
                aria-label="Открыть"
              >
                <img src="/img/icon/view.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a
                href="#"
                class="action-link action-del"
                :class="{ 'action-del--forbidden': !canDelete(node.store) }"
                :title="canDelete(node.store) ? 'Удалить' : 'Нельзя удалить'"
                :aria-label="canDelete(node.store) ? 'Удалить' : 'Нельзя удалить'"
                @click.prevent="deleteStore(node.store.id)"
              >
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Нет хранилищ</div>

      <TablePagination :page="page" :last-page="lastPage" @go="goToPage" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { StoreResponse } from '~/repository/modules/store'
import type { AccessRight } from '~/repository/modules/access'
import { useCurrentUser } from '~/composables/useCurrentUser'

const { $api, $notify } = useNuxtApp()
const { isOwner } = useCurrentUser()
const { openRow } = useRowOpen()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref<string | null>(null)
const flatList = ref<{ store: StoreResponse; depth: number }[]>([])
const selected = ref<Set<number>>(new Set())
const storesInLists = ref<Set<number>>(new Set())
const page = ref(1)

// Хранилища приходят одним списком и тут же складываются в дерево, поэтому
// постраничный вывод считается на развёрнутом дереве, а не на ответе сервера.
// Иначе страница могла бы начаться с вложенного хранилища, родителя которого
// осталось на предыдущей странице, — отступ-«ёлочка» смотрел бы в пустоту.
// Отступ поэтому и показан: по нему видно, что запись вложена.
const PER_PAGE = 10
const lastPage = computed(() => Math.max(1, Math.ceil(flatList.value.length / PER_PAGE)))
const pageList = computed(() =>
  flatList.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE)
)

function goToPage(to: number) {
  const target = Math.min(Math.max(1, to), lastPage.value)
  router.push({ query: { ...route.query, page: target } })
}

// Номер страницы живёт в адресной строке, а не в памяти: перезагрузка и кнопка
// «назад» должны возвращать ту же страницу, а не первую.
//
// Считывать его надо и при загрузке списка, а не только по смене адреса:
// при прямом заходе на ?page=2 адрес с момента появления страницы не менялся,
// и подписка молчала — список открывался на первой странице, а в адресной
// строке стояло 2. Расхождение выглядело как сбой пагинации.
function syncPage() {
  page.value = Math.min(Math.max(1, Number(route.query.page) || 1), lastPage.value)
}

const selectedIds = computed(() => [...selected.value])
const someSelected = computed(() => selected.value.size > 0)
// «Выделить все» отмечает то, что видно на странице, а не всё дерево разом.
const allSelected = computed(() => pageList.value.length > 0 && pageList.value.every(n => selected.value.has(n.store.id)))
const showOwnerColumn = computed(() => flatList.value.some(n => n.store.user && n.store.user.id))

const rightsOf = (store: StoreResponse): AccessRight[] => store.rights ?? []
const canEdit = (store: StoreResponse): boolean => rightsOf(store).includes('edit')
const canDelete = (store: StoreResponse): boolean => rightsOf(store).includes('delete')

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(pageList.value.map(n => n.store.id))
  }
}

function toggleOne(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selected.value = next
}

function clearSelection() {
  selected.value = new Set()
  loadLabelListInfo()
}

function onTogglerChanged(e: { itemId?: number; storeId?: number; added: boolean }) {
  if (e.storeId) {
    const next = new Set(storesInLists.value)
    if (e.added) next.add(e.storeId)
    else next.delete(e.storeId)
    storesInLists.value = next
  }
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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

function flattenTree(nodes: TreeNode[], depth: number = 0): { store: StoreResponse; depth: number }[] {
  const result: { store: StoreResponse; depth: number }[] = []
  for (const node of nodes) {
    result.push({ store: node.store, depth })
    result.push(...flattenTree(node.children, depth + 1))
  }
  return result
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const stores = await $api.store.list()
    const tree = buildTree(stores)
    flatList.value = flattenTree(tree)
    selected.value = new Set()
    // Читаем страницу из адреса после того, как известно общее число записей:
    // хранилище могли удалить, и страниц могло остаться больше, чем есть.
    syncPage()
    await loadLabelListInfo()
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function loadLabelListInfo() {
  try {
    const lists = await $api.labelList.all()
    const ids = new Set<number>()
    for (const list of lists) {
      for (const store of list.stores ?? []) {
        ids.add(store.id)
      }
    }
    storesInLists.value = ids
  } catch {
    // silently ignore
  }
}

async function deleteStore(id: number) {
  const store = flatList.value.find(n => n.store.id === id)?.store
  if (store && !canDelete(store)) return
  if (!confirm('Удалить хранилище?')) return
  try {
    await $api.store.delete(id)
    $notify.add('Хранилище удалено', { type: 'success' })
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  }
}

onMounted(load)

onMounted(load)

watch(() => route.query.page, syncPage)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: #ccc;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-add {
  padding: 6px 16px;
  font-size: 14px;
  background: #2a5a2a;
  color: #cfc;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
}

.btn-add:hover {
  background: #3a7a3a;
}

.loading,
.error,
.empty {
  padding: 20px;
  color: #888;
}

.error {
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
}

.stores-table {
  width: 100%;
  border-collapse: collapse;
}

.stores-table th,
.stores-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.stores-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.stores-table td {
  color: #ccc;
}

.stores-table tr:hover td {
  background: #252525;
}

.cb-col {
  width: 1px;
  white-space: nowrap;
  padding-right: 0;
}

.cb-col input[type="checkbox"] {
  accent-color: #3a7a3a;
  cursor: pointer;
}

.tree-prefix {
  color: #555;
}

.tree-space {
  display: inline;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: #88a;
  text-decoration: none;
  margin-right: 8px;
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
  color: #aaf;
}

.action-del {
  color: #a66;
}

.action-del:hover {
  color: #f88;
}

.action-view {
  color: #88a;
}

.action-del--forbidden {
  color: #666;
  cursor: not-allowed;
}

.action-del--forbidden:hover {
  color: #666;
}

.action-del--forbidden .action-icon {
  filter: grayscale(1);
  opacity: 0.55;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .stores-table,
  .stores-table tbody,
  .stores-table tr,
  .stores-table td {
    display: block;
  }

  .stores-table thead {
    display: none;
  }

  .stores-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .stores-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .stores-table td.cb-col {
    position: absolute;
    top: 12px;
    left: 14px;
    width: auto;
    padding: 0;
  }

  .stores-table td.cb-col input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }

  /* Картинка в узком экране встаёт в верхнюю полосу карточки рядом с галочкой,
     а не отдельной строкой с подписью «Фото»: подпись над картинкой в сорок
     пикселей читается как название, и строка получается вдвое выше карточки.
     Полоса под это и отведена — 44px, из них на картинку уходит 40. */
  .stores-table td.img-col {
    position: absolute;
    top: 1px;
    left: 42px;
    width: auto;
    padding: 0;
  }

  .stores-table td.img-col::before {
    display: none;
  }

  .stores-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .stores-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .stores-table tr:hover td {
    background: transparent;
  }
}
</style>
