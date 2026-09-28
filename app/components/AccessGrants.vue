<template>
  <div class="access-grants">
    <div v-if="loading" class="state">{{ t('form.loading') }}</div>
    <div v-else-if="error" class="state state--error">{{ error }}</div>

    <template v-else>
      <table v-if="grants.length" class="grants-table">
        <thead>
          <tr>
            <th v-if="!scopedWarehouse">{{ t('form.warehouse') }}</th>
            <th>{{ t('access_rights.user') }}</th>
            <th>{{ t('access_rights.access') }}</th>
            <th>{{ t('common.created') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="grant in grants" :key="grant.id">
            <td v-if="!scopedWarehouse" :data-label="t('form.warehouse')">{{ grant.warehouse?.title ?? '—' }}</td>
            <td :data-label="t('access_rights.user')">
              <div class="grant-user">{{ grant.user?.name ?? '—' }}</div>
              <div v-if="grant.user" class="grant-email">{{ grant.user.email }}</div>
            </td>
            <td :data-label="t('access_rights.access')">
              <div class="grant-rights">
                <label class="grant-check grant-check--readonly">
                  <input type="checkbox" checked readonly @click.prevent @keydown.space.prevent @keydown.enter.prevent />
                  <span>{{ rightOptions[0].label }}</span>
                </label>
                <label class="grant-check" v-for="opt in rightOptions.slice(1)" :key="`${grant.id}-${opt.key}`">
                  <input
                    type="checkbox"
                    :checked="effectiveRightsFor(grant).includes(opt.key)"
                    :disabled="savingRow === grant.id"
                    @click.prevent="toggleRight(grant, opt.key)"
                  />
                  <span>{{ opt.label }}</span>
                </label>
              </div>
            </td>
            <td :data-label="t('common.created')">{{ formatDate(grant.created_at) }}</td>
            <td class="actions">
              <a href="#" class="action-link action-del" :title="t('common.delete')" :aria-label="t('common.delete')" @click.prevent="removeGrant(grant)">
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="state">{{ t('access_rights.no_grants') }}</div>

      <form class="grant-form" @submit.prevent="addGrant">
        <div class="grant-form__title">{{ scopedWarehouse ? t('access_rights.grant_for', { title: scopedWarehouseTitle }) : t('access_rights.grant') }}</div>

        <label v-if="!scopedWarehouse" class="field">
          <span class="field-label">{{ t('form.warehouse') }}</span>
          <select v-model.number="form.warehouse_id" class="field-select" required>
            <option :value="null" disabled>{{ t('access_rights.pick_warehouse') }}</option>
            <option v-for="w in ownWarehouses" :key="w.id" :value="w.id">{{ w.title }}</option>
          </select>
        </label>

        <label class="field">
          <span class="field-label">{{ t('access_rights.user') }}</span>
          <select v-model.number="form.user_id" class="field-select" required>
            <option :value="null" disabled>{{ t('access_rights.pick_user') }}</option>
            <option v-for="u in grantableUsers" :key="u.id" :value="u.id">{{ u.name }} ({{ u.email }})</option>
          </select>
        </label>

        <div class="field">
          <span class="field-label">{{ t('form.rights_tab') }}</span>
          <div class="grant-rights">
            <label class="grant-check grant-check--readonly">
              <input type="checkbox" checked readonly @click.prevent @keydown.space.prevent @keydown.enter.prevent />
              <span>{{ rightOptions[0].label }}</span>
            </label>
            <label class="grant-check" v-for="opt in rightOptions.slice(1)" :key="`form-${opt.key}-${effectiveFormRights().join(',')}`">
              <input
                type="checkbox"
                :checked="effectiveFormRights().includes(opt.key)"
                :disabled="savingRow"
                @click.prevent="toggleFormRight(opt.key)"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>
        </div>

        <button type="submit" class="btn-add" :disabled="sending">{{ t('access_rights.grant_submit') }}</button>
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
const { t } = useI18n()
const { currentUserId } = useCurrentUser()

const rightOptions: { key: AccessRight; label: string }[] = [
  { key: 'view', label: t('access_rights.view') },
  { key: 'create', label: t('access_rights.create') },
  { key: 'edit', label: t('access_rights.edit') },
  { key: 'delete', label: t('access_rights.delete') },
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

function effectiveRightsFor(grant: AccessGrantResponse): AccessRight[] {
  return grant.rights
}

function effectiveFormRights(): AccessRight[] {
  return form.rights
}

function toggleFormRight(right: AccessRight) {
  if (form.rights.includes(right)) {
    form.rights = form.rights.filter((r) => r !== right)
  } else {
    form.rights = [...form.rights, right]
  }
}

function normalizeRights(rights: AccessRight[]): AccessRight[] {
  return Array.from(new Set(rights))
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
    grants.value = grantsResult.map((g) => ({ ...g, rights: normalizeRights(g.rights) }))
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

  sending.value = true
  try {
    await $api.access.create({
      warehouse_id: form.warehouse_id,
      user_id: form.user_id,
      rights: ['view', ...form.rights],
    })
    $notify.add(t('access_rights.granted'), { type: 'success' })
    form.user_id = null
    form.rights = []
    await load()
  } catch (err: any) {
    $notify.add(formatApiError(err, t('access_rights.grant_failed')), { type: 'error', timer: 10 })
  } finally {
    sending.value = false
  }
}

async function toggleRight(grant: AccessGrantResponse, right: AccessRight) {
  const updatedRights = grant.rights.includes(right)
    ? grant.rights.filter((r) => r !== right)
    : [...grant.rights, right]

  const rights = normalizeRights(updatedRights)
  if (!rights.length) {
    $notify.add(t('access_rights.need_one'), {
      type: 'warning',
      timer: 5,
    })
    return
  }

  const currentRights = normalizeRights(grant.rights)
  if (rights.join(',') === currentRights.join(',')) {
    return
  }

  savingRow.value = grant.id
  try {
    const updated = await $api.access.update(grant.id, { rights })
    grants.value = grants.value.map((g) => (g.id === grant.id ? { ...g, rights: normalizeRights(updated.rights) } : g))
    $notify.add(t('access_rights.updated'), { type: 'success', timer: 3 })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('access_rights.update_failed')), { type: 'error', timer: 10 })
  } finally {
    savingRow.value = null
  }
}

async function removeGrant(grant: AccessGrantResponse) {
  if (!confirm(t('access_rights.revoke_confirm', { name: grant.user?.name ?? '#' + grant.id }))) return
  savingRow.value = grant.id
  try {
    await $api.access.delete(grant.id)
    grants.value = grants.value.filter((g) => g.id !== grant.id)
    $notify.add(t('access_rights.revoked'), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('access_rights.revoke_failed')), { type: 'error', timer: 10 })
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
  color: var(--text-muted);
}

.state--error {
  color: var(--danger);
  background: var(--danger-bg);
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
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.grants-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.grants-table td {
  color: var(--text-secondary);
  vertical-align: top;
}

.grants-table tr:hover td {
  background: var(--bg-elevated);
}

.grant-user {
  color: var(--text);
}

.grant-email {
  font-size: 12px;
  color: var(--text-dim);
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
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}

.grant-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--info-ink);
  cursor: pointer;
}

.grant-check input:disabled {
  opacity: 0.5;
  cursor: default;
}

.grant-check--readonly {
  cursor: default;
}

.grant-check--readonly input {
  cursor: default;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: var(--info);
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
  color: var(--danger);
}

.action-del:hover {
  color: var(--danger);
}

.grant-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  max-width: 640px;
  box-sizing: border-box;
}

.grant-form__title {
  font-size: 15px;
  color: var(--text-secondary);
  font-weight: 600;
}

.field {
  display: block;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
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

.field-select:focus {
  border-color: var(--border-strong);
}

.btn-add {
  align-self: flex-start;
  padding: 8px 22px;
  font-size: 14px;
  font-family: inherit;
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
}

.btn-add:hover:not(:disabled) {
  background: var(--accent);
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
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .grants-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
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
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .grants-table tr:hover td {
    background: transparent;
  }
}
</style>