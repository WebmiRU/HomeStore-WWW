<template>
  <div class="lists-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('label_lists.list') }}</h3>
      <div class="page-actions">
        <BlankLabelButton @done="loadLists(meta.current_page)" />
        <NuxtLink to="/label-lists/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
      </div>
    </div>

    <IndexTable
      :rows="lists"
      :columns="columns"
      :loading="loading"
      :error="error"
      :empty-text="t('label_lists.no_lists')"
      :page="meta.current_page || 1"
      :last-page="meta.last_page"
      :open-to="(list) => `/label-lists/${list.id}`"
      @page="goToPage"
    >
      <template #cell-title="{ row: list }">
        {{ list.title }}
        <span v-if="list.codes_count" class="blank-badge" :title="t('label_lists.codes_generated', { count: list.codes_count })">
          {{ t('label_lists.preset_without_text') }}
        </span>
      </template>
      <template #cell-label_preset="{ row: list }">
        <!-- Шаблон удаляется мягко, а список его переживает: название остаётся
             видимым с пометкой, назначить можно другой. -->
        <span v-if="list.label_preset">{{ list.label_preset.title }}<template v-if="list.label_preset.deleted">{{ t('placeholders.deleted') }}</template></span>
        <span v-else class="muted">{{ t('label_lists.no_template') }}</span>
      </template>
      <template #cell-user="{ row: list }">
        <NuxtLink v-if="list.user" :to="`/users/${list.user.id}`" class="row-link">{{ list.user.name }}</NuxtLink>
        <span v-else class="muted">—</span>
      </template>
      <template #cell-created_at="{ row: list }">{{ formatDate(list.created_at) }}</template>
      <template #cell-updated_at="{ row: list }">{{ formatDate(list.updated_at) }}</template>
      <template #actions="{ row: list }">
        <NuxtLink :to="`/label-lists/${list.id}`" class="action-link action-edit" :title="t('common.edit')" :aria-label="t('common.edit')">
          <img src="/img/icon/edit.svg" class="action-icon" alt="" />
        </NuxtLink>
        <a href="#" class="action-link action-del" :title="t('common.delete')" :aria-label="t('common.delete')" @click.prevent="deleteList(list)">
          <img src="/img/icon/delete.svg" class="action-icon" alt="" />
        </a>
        <a
          href="#"
          class="action-link action-download"
          :class="{ disabled: downloading === list.id }"
          @click.prevent="downloadPdf(list.id)"
        >
          <img v-if="downloading !== list.id" src="/img/icon/download.svg" class="action-icon" alt="" />
          <span v-else class="download-spinner">...</span>
        </a>
      </template>
    </IndexTable>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { LabelListResponse } from '~/repository/modules/labelList'
import { formatApiError, readBlobApiError } from '~/composables/formatApiError'
import { useCurrentUser } from '~/composables/useCurrentUser'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const { isOwner } = useCurrentUser()
const route = useRoute()
const router = useRouter()

const lists = ref<LabelListResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

const showOwnerColumn = computed(() => lists.value.some(l => l.user && l.user.id))

const columns = computed(() => [
  { key: 'id', label: 'ID' },
  { key: 'title', label: t('common.title') },
  { key: 'label_preset', label: t('label_lists.template') },
  { key: 'created_at', label: t('common.created') },
  { key: 'updated_at', label: t('common.updated') },
  ...(showOwnerColumn.value ? [{ key: 'user', label: t('common.owner') }] : []),
])
const downloading = ref<number | null>(null)

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

async function loadLists(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.labelList.list(page)
    lists.value = result.data
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

async function downloadPdf(id: number) {
  downloading.value = id
  try {
    const blob = await $api.labelList.generate(id)
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
    downloading.value = null
  }
}

async function deleteList(list: LabelListResponse) {
  // Набор с кодами удаляется не вместе с кодами: наклейки уже наклеены.
  // Без этой оговорки выглядит так, будто мы только что потеряли кусок
  // этикеток, который печатали специально.
  const question = list.codes_count
    ? t('label_lists.delete_confirm_codes', { title: list.title, count: list.codes_count })
    : t('label_lists.delete_confirm', { title: list.title })

  if (!confirm(question)) return

  try {
    await $api.labelList.delete(list.id)
    $notify.add(t('label_lists.delete_done'), { type: 'success' })
    await loadLists(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
  }
}

onMounted(() => {
  const page = Number(route.query.page) || 1
  loadLists(page)
})

watch(() => route.query.page, (newPage) => {
  const page = Number(newPage) || 1
  loadLists(page)
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

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.action-download {
  color: var(--success);
}

.action-download:hover {
  color: var(--success-ink);
}

.action-download.disabled {
  opacity: 0.4;
  cursor: wait;
  color: var(--text-faint);
}

.action-del {
  color: var(--danger);
}

.action-del:hover {
  color: var(--danger);
}

.blank-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 7px;
  font-size: 11px;
  color: var(--note-ink);
  background: var(--note-bg);
  border: 1px solid var(--note);
  border-radius: 3px;
  vertical-align: middle;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
