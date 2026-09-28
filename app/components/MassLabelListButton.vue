<template>
  <div class="mass-btn-wrap" ref="rootEl">
    <button
      v-if="totalCount > 0"
      class="mass-btn"
      @click.stop="toggle"
    >
      {{ t('label_lists.add_to_labels', { count: totalCount }) }}
    </button>

    <div v-if="open" class="mass-dropdown" @click.stop>
      <div v-if="loading" class="mass-loading">{{ t('form.loading') }}</div>
      <template v-else-if="lists.length === 0">
        <div class="mass-empty">{{ t('label_lists.no_lists') }}</div>
      </template>
      <template v-else>
        <div
          v-for="list in lists"
          :key="list.id"
          class="mass-item"
          :class="{ disabled: busy === list.id }"
          @click="addToList(list)"
        >
          <span class="mass-item-title">{{ list.title }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { LabelListResponse } from '~/repository/modules/labelList'

const props = defineProps<{
  itemIds: number[]
  storeIds: number[]
}>()

const emit = defineEmits<{
  done: []
}>()

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()

const rootEl = ref<HTMLElement | null>(null)
const open = ref(false)
const loading = ref(true)
const lists = ref<LabelListResponse[]>([])
const busy = ref<number | null>(null)

const totalCount = computed(() => props.itemIds.length + props.storeIds.length)

function toggle() {
  if (open.value) {
    open.value = false
    return
  }
  open.value = true
  if (lists.value.length === 0) {
    loadLists()
  }
}

async function loadLists() {
  loading.value = true
  try {
    lists.value = await $api.labelList.all()
  } catch {
    $notify.add(t('label_lists.load_failed'), { type: 'error', timer: 5 })
  } finally {
    loading.value = false
  }
}

async function addToList(list: LabelListResponse) {
  if (busy.value !== null) return
  busy.value = list.id

  try {
    for (const itemId of props.itemIds) {
      await $api.labelList.attachItem(list.id, itemId)
    }
    for (const storeId of props.storeIds) {
      await $api.labelList.attachStore(list.id, storeId)
    }
    $notify.add(t('label_lists.added_to', { title: list.title }), { type: 'success' })
    open.value = false
    emit('done')
  } catch {
    $notify.add(t('label_lists.add_failed'), { type: 'error', timer: 5 })
  } finally {
    busy.value = null
  }
}

function onClickOutside(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.mass-btn-wrap {
  position: relative;
  display: inline-block;
}

.mass-btn {
  padding: 6px 16px;
  font-size: 14px;
  font-family: inherit;
  background: var(--success);
  color: var(--accent-ink);
  border: 1px solid var(--success);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.mass-btn:hover {
  background: color-mix(in srgb, var(--success) 78%, var(--bg));
}

.mass-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 220px;
  max-width: calc(100vw - 40px);
  max-height: 280px;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--bg-sunken) 50%, transparent);
  z-index: 100;
  padding: 4px 0;
}

.mass-loading,
.mass-empty {
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-dim);
}

.mass-item {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.1s;
}

.mass-item:hover {
  background: var(--bg-elevated);
}

.mass-item.disabled {
  opacity: 0.5;
  cursor: wait;
}

.mass-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
