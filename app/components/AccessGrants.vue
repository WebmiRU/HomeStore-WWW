<template>
  <div class="access-grants">
    <div v-if="loading" class="state">Загрузка...</div>
    <div v-else-if="error" class="state state--error">{{ error }}</div>

    <template v-else>
      <table v-if="grants.length" class="grants-table">
        <thead>
          <tr>
            <th v-if="!scopedWarehouse">Склад</th>
            <th>Пользователь</th>
            <th>Доступ</th>
            <th>Создан</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="grant in grants" :key="grant.id">
            <td v-if="!scopedWarehouse" data-label="Склад">{{ grant.warehouse?.title ?? '—' }}</td>
            <td data-label="Пользователь">
              <div class="grant-user">{{ grant.user?.name ?? '—' }}</div>
              <div v-if="grant.user" class="grant-email">{{ grant.user.email }}</div>
            </td>
            <td data-label="Доступ">
              <div class="grant-rights">
                <label class="grant-check" v-for="opt in rightOptions" :key="opt.key">
                  <input
                    type="checkbox"
                    :checked="grantRights(grant, opt.key)"
                    :disabled="savingRow === grant.id || (opt.key === 'view' && hasOtherRight(grant))"
                    :title="opt.key === 'view' && hasOtherRight(grant) ? 'Просмотр подразумевается другими правами' : undefined"
                    @change="toggleRight(grant, opt.key)"
                  />
                  <span>{{ opt.label }}</span>
                </label>
              </div>
            </td>
            <td data-label="Создан">{{ formatDate(grant.created_at) }}</td>
            <td class="actions">
              <a href="#" class="action-link action-del" title="Удалить" aria-label="Удалить" @click.prevent="removeGrant(grant)">
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="state">{{ scopedWarehouse ? 'Нет выданных прав' : 'Нет выданных прав' }}</div>

      <form class="grant-form" @submit.prevent="addGrant">
        <div class="grant-form__title">{{ scopedWarehouse ? `Выдать право на склад «${scopedWarehouseTitle}»` : 'Выдать право' }}</div>

        <label v-if="!scopedWarehouse" class="field">
          <span class="field-label">Склад</span>
          <select v-model.number="form.warehouse_id" class="field-select" required>
            <option :value="null" disabled>Выберите склад</option>
            <option v-for="w in ownWarehouses" :key="w.id" :value="w.id">{{ w.title }}</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">Пользователь</span>
          <select v-model.number="form.user_id" class="field-select" required>
            <option :value="null" disabled>Выберите пользователя</option>
            <option v-for="u in grantableUsers" :key="u.id" :value="u.id">{{ u.name }} ({{ u.email }})</option>
          </select>
        </label>

        <div class="field">
          <span class="field-label">Права</span>
          <div class="grant-rights">
            <label class="grant-check" v-for="opt in rightOptions" :key="opt.key">
              <input
                type="checkbox"
                :checked="form.rights.includes(opt.key)"
                @change="toggleFormRight(opt.key)"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>
        </div>

        <button type="submit" class="btn-add" :disabled="sending">Выдать</button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import { useCurrentUser } from '~/composables/useCurrentUser'
import type { AccessGrantResponse, AccessRight } from '~/repository/modules/access'
import type { UserProfileResponse } from '~/repository/modules/userProfile'
import type { WarehouseResponse } from '~/repository/modules/warehouse'

const props = defineProps<{
  scopedWarehouse?: WarehouseResponse | null
}>()

const { $api, $notify } = useNuxtApp()
const { currentUserId } = useCurrentUser()

const rightOptions: { key: AccessRight; label: string }[] = [
  { key: 'view', label: 'Просмотр' },
  { key: 'create', label: 'Создание' },
  { key: 'edit', label: 'Изменение' },
  { key: 'delete', label: 'Удаление' },
]

const loading = ref(true)
const error = ref<string | null>(null)
const sending = ref(false)
const savingRow = ref<number | null>(null)

const grants = ref<AccessGrantResponse[]>([])
const users = ref<UserProfileResponse[]>([])
const warehouses = ref<WarehouseResponse[]>([])

const form = reactive({
  warehouse_id: null as number | null,
  user_id: null as number | null,
  rights: [] as AccessRight[],
})

const scopedWarehouse = computed(() => props.scopedWarehouse ?? null)
const scopedWarehouseTitle = computed(() => scopedWarehouse.value?.title ?? '')

const ownWarehouses = computed(() =>
  warehouses.value.filter((w) => currentUserId.value !== null && w.user_id === currentUserId.value)
)

const grantableUsers = computed(() =>
  users.value.filter((u) => currentUserId.value === null || u.id !== currentUserId.value)
)

function grantRights(grant: AccessGrantResponse, right: AccessRight): boolean {
  return grant.rights.includes(right)
}

function hasOtherRight(grant: AccessGrantResponse): boolean {
  return grant.rights.some((r) => r !== 'view')
}

function toggleFormRight(right: AccessRight) {
  if (form.rights.includes(right)) {
    form.rights = form.rights.filter((r) => r !== right)
  } else {
    form.rights = [...form.rights, right]
  }
}

function normalizeRights(rights: AccessRight[]): AccessRight[] {
  const clean = Array.from(new Set(rights))
  if ((clean.includes('create') || clean.includes('edit') || clean.includes('delete')) && !clean.includes('view')) {
    clean.unshift('view')
  }
  return clean
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const hasScope = Boolean(scopedWarehouse.value)
    const [grantsResult, usersResult, warehousesResult] = await Promise.all([
      hasScope ? $api.access.forWarehouse(scopedWarehouse.value!.id) : $api.access.list(),
      $api.userProfile.all(),
      hasScope ? Promise.resolve([]) : $api.warehouse.all(),
    ])
    grants.value = grantsResult
    users.value = usersResult
    warehouses.value = warehousesResult

    const fallbackWarehouse = ownWarehouses.value[0]?.id ?? null
    form.warehouse_id = scopedWarehouse.value?.id ?? fallbackWarehouse
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function addGrant() {
  if (!form.warehouse_id || !form.user_id) return
  const rights = normalizeRights(form.rights)
  if (!rights.length) {
    $notify.add('Выберите хотя бы одно право', { type: 'warning', timer: 5 })
    return
  }

  sending.value = true
  try {
    await $api.access.create({
      warehouse_id: form.warehouse_id,
      user_id: form.user_id,
      rights,
    })
    $notify.add('Права выданы', { type: 'success' })
    form.user_id = null
    form.rights = []
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка выдачи прав'), { type: 'error', timer: 10 })
  } finally {
    sending.value = false
  }
}

async function toggleRight(grant: AccessGrantResponse, right: AccessRight) {
  const rights = normalizeRights(
    grant.rights.includes(right) ? grant.rights.filter((r) => r !== right) : [...grant.rights, right]
  )
  if (!rights.length) {
    $notify.add('Нужно хотя бы одно право. Чтобы убрать доступ полностью — удалите его', {
      type: 'warning',
      timer: 5,
    })
    return
  }

  if (rights.join(',') === grant.rights.join(',')) {
    return
  }

  savingRow.value = grant.id
  try {
    const updated = await $api.access.update(grant.id, { rights })
    grant.rights = updated.rights
    $notify.add('Права обновлены', { type: 'success', timer: 3 })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка обновления прав'), { type: 'error', timer: 10 })
  } finally {
    savingRow.value = null
  }
}

async function removeGrant(grant: AccessGrantResponse) {
  if (!confirm(`Убрать доступ пользователю «${grant.user?.name ?? '#' + grant.id}»?`)) return
  savingRow.value = grant.id
  try {
    await $api.access.delete(grant.id)
    grants.value = grants.value.filter((g) => g.id !== grant.id)
    $notify.add('Доступ убран', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления доступа'), { type: 'error', timer: 10 })
  } finally {
    savingRow.value = null
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

onMounted(load)
</script>

<style scoped>
.state {
  padding: 14px 0;
  color: #888;
}

.state--error {
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
  padding: 12px;
}

.grants-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
}

.grants-table th,
.grants-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.grants-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.grants-table td {
  color: #ccc;
  vertical-align: top;
}

.grants-table tr:hover td {
  background: #252525;
}

.grant-user {
  color: #ddd;
}

.grant-email {
  font-size: 12px;
  color: #777;
}

.grant-rights {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.grant-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #aaa;
  cursor: pointer;
  user-select: none;
}

.grant-check input {
  width: 16px;
  height: 16px;
  accent-color: #6a7fdb;
  cursor: pointer;
}

.grant-check input:disabled {
  opacity: 0.5;
  cursor: default;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: #88a;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.action-link img.action-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.action-del {
  color: #a66;
}

.action-del:hover {
  color: #f88;
}

.grant-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: #1e1e1e;
  border: 1px solid #2b2b2b;
  border-radius: 10px;
  max-width: 640px;
  box-sizing: border-box;
}

.grant-form__title {
  font-size: 15px;
  color: #ccc;
  font-weight: 600;
}

.field {
  display: block;
}

.field-label {
  display: block;
  font-size: 13px;
  color: #888;
  margin-bottom: 4px;
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

.field-select:focus {
  border-color: #666;
}

.btn-add {
  align-self: flex-start;
  padding: 8px 22px;
  font-size: 14px;
  font-family: inherit;
  background: #2a5a2a;
  color: #cfc;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-add:hover:not(:disabled) {
  background: #3a7a3a;
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: default;
}

@media (max-width: 768px) {
  .grants-table,
  .grants-table tbody,
  .grants-table tr,
  .grants-table td {
    display: block;
  }

  .grants-table thead {
    display: none;
  }

  .grants-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .grants-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .grants-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .grants-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .grants-table tr:hover td {
    background: transparent;
  }
}
</style>