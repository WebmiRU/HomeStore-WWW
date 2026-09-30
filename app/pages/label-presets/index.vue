<template>
  <div class="presets-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('label_presets.list') }}</h3>
      <NuxtLink to="/label-presets/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
    </div>

    <IndexTable
      :rows="presets"
      :columns="columns"
      :loading="loading"
      :error="error"
      :empty-text="t('label_presets.no_presets')"
      :page="meta.current_page || 1"
      :last-page="meta.last_page"
      :open-to="openTo"
      @page="goToPage"
    >
      <template #cell-title="{ row: p }">
        {{ p.title }}
        <span v-if="p.is_system" class="system-badge" :title="t('label_presets.system_hint')">
          {{ t('label_presets.system_word') }}
        </span>
      </template>
      <template #cell-page="{ row: p }">{{ p.page_width }}×{{ p.page_height }}</template>
      <template #cell-cell="{ row: p }">{{ p.cell_width }}×{{ p.cell_height }}</template>
      <template #cell-font="{ row: p }">{{ p.font?.name ?? (p.font_id ? '#' + p.font_id : '—') }}</template>
      <template #cell-user="{ row: p }">
        <NuxtLink v-if="p.user" :to="`/users/${p.user.id}`" class="row-link">{{ p.user.name }}</NuxtLink>
        <span v-else class="muted">—</span>
      </template>
      <template #actions="{ row: p }">
        <!-- Системный шаблон только для просмотра: править и удалять его
             нельзя, поэтому и ссылок на эти действия не показываем. -->
        <span v-if="p.is_system" class="action-lock" :title="t('label_presets.system_readonly')">
          <img src="/img/icon/view.svg" class="action-icon" alt="" />
        </span>
        <template v-else>
          <NuxtLink :to="`/label-presets/${p.id}`" class="action-link action-edit" :title="t('common.edit')" :aria-label="t('common.edit')">
            <img src="/img/icon/edit.svg" class="action-icon" alt="" />
          </NuxtLink>
          <a href="#" class="action-link action-del" :title="t('common.delete')" :aria-label="t('common.delete')" @click.prevent="deletePreset(p.id)">
            <img src="/img/icon/delete.svg" class="action-icon" alt="" />
          </a>
        </template>
      </template>
    </IndexTable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { LabelPresetResponse } from '~/repository/modules/labelPreset'
import { useCurrentUser } from '~/composables/useCurrentUser'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const { isOwner } = useCurrentUser()
const route = useRoute()
const router = useRouter()

const presets = ref<LabelPresetResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

/*
 * Системный шаблон по двойному клику не открывается: он только для чтения,
 * и открывать его карточку незачем — там нечего править.
 */
const openTo = (p: { id: number; is_system: boolean }): string | undefined =>
  p.is_system ? undefined : `/label-presets/${p.id}`

const showOwnerColumn = computed(() => presets.value.some(p => p.user && p.user.id))

const columns = computed(() => [
  { key: 'id', label: 'ID' },
  { key: 'title', label: t('common.title') },
  { key: 'page', label: t('label_presets.page') },
  { key: 'cell', label: t('label_presets.cell') },
  { key: 'labels_per_sheet', label: t('label_presets.per_sheet') },
  { key: 'barcode_position', label: t('label_presets.barcode') },
  { key: 'font', label: t('label_presets.font') },
  ...(showOwnerColumn.value ? [{ key: 'user', label: t('common.owner') }] : []),
])

async function loadPresets(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.labelPreset.list(page)
    presets.value = result.data
    meta.value = {
      current_page: result.meta.current_page,
      last_page: result.meta.last_page,
    }
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  router.push({ query: { page } })
}

async function deletePreset(id: number) {
  if (!confirm(t('label_presets.delete_confirm'))) return
  try {
    await $api.labelPreset.delete(id)
    $notify.add(t('label_presets.delete_done'), { type: 'success' })
    await loadPresets(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
  }
}

onMounted(() => {
  const page = Number(route.query.page) || 1
  loadPresets(page)
})

watch(() => route.query.page, (newPage) => {
  const page = Number(newPage) || 1
  loadPresets(page)
})
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
  color: var(--text-secondary);
}

.btn-add {
  padding: 6px 16px;
  font-size: 14px;
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
}

.btn-add:hover {
  background: var(--accent);
}

.loading,
.error,
.empty {
  padding: 20px;
  color: var(--text-muted);
}

.error {
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 4px;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: var(--link);
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
  color: var(--link-hover);
}

.action-del {
  color: var(--danger);
}

.action-del:hover {
  color: var(--danger);
}

.action-lock {
  color: var(--link);
  cursor: default;
  display: inline-flex;
  vertical-align: middle;
}

.action-lock img.action-icon {
  width: 18px;
  height: 18px;
  display: block;
  opacity: 0.7;
}

.system-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 7px;
  font-size: 11px;
  color: var(--note-ink);
  background: var(--note-bg);
  border: 1px solid var(--note);
  border-radius: 3px;
  vertical-align: middle;
  cursor: help;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
