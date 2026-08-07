<template>
  <div class="toggler" ref="rootEl">
    <button class="toggler-btn" @click.stop="toggle" :title="itemId ? 'Добавить предмет в наборы' : 'Добавить хранилище в наборы'">
      📋<span v-if="inAnyList" class="toggler-dot" title="В наборах этикеток">●</span>
    </button>

    <div v-if="open" class="toggler-dropdown" @click.stop>
      <div v-if="loading" class="toggler-loading">Загрузка...</div>
      <template v-else-if="lists.length === 0">
        <div class="toggler-empty">Нет наборов</div>
      </template>
      <template v-else>
        <label
          v-for="list in lists"
          :key="list.id"
          class="toggler-item"
          :class="{ disabled: busy.has(list.id) }"
        >
          <input
            type="checkbox"
            :checked="isInList(list)"
            :disabled="busy.has(list.id)"
            @change="onToggle(list)"
          />
          <span class="toggler-item-title">{{ list.title }}</span>
        </label>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { LabelListResponse } from '~/repository/modules/labelList'
import { useLabelListTogglerState } from '~/composables/useLabelListTogglerState'

const { uid, activeUid } = useLabelListTogglerState()

const props = defineProps<{
  itemId?: number
  storeId?: number
  inAnyList?: boolean
}>()

const emit = defineEmits<{
  changed: [{ itemId?: number; storeId?: number; added: boolean }]
}>()

const { $api, $notify } = useNuxtApp()

const rootEl = ref<HTMLElement | null>(null)
const open = ref(false)
const loading = ref(true)
const lists = ref<LabelListResponse[]>([])
const busy = ref<Set<number>>(new Set())

// Close self when another toggler opens
watch(activeUid, (val) => {
  if (val !== uid) {
    open.value = false
  }
})

function isInList(list: LabelListResponse): boolean {
  if (props.itemId) {
    return list.items?.some(i => i.payload.id === props.itemId) ?? false
  }
  if (props.storeId) {
    return list.stores?.some(s => s.id === props.storeId) ?? false
  }
  return false
}

async function toggle() {
  if (open.value) {
    open.value = false
    return
  }
  activeUid.value = uid
  open.value = true
  if (lists.value.length === 0) {
    await loadLists()
  }
}

async function loadLists() {
  loading.value = true
  try {
    lists.value = await $api.labelList.all()
  } catch {
    $notify.add('Ошибка загрузки наборов', { type: 'error', timer: 5 })
  } finally {
    loading.value = false
  }
}

async function onToggle(list: LabelListResponse) {
  const checked = isInList(list)
  busy.value = new Set([...busy.value, list.id])

  try {
    if (props.itemId) {
      if (checked) {
        await $api.labelList.detachItem(list.id, props.itemId)
        list.items = (list.items ?? []).filter(i => i.payload.id !== props.itemId)
      } else {
        await $api.labelList.attachItem(list.id, props.itemId)
        list.items = [...(list.items ?? []), { type: 'item' as const, code: null, payload: { id: props.itemId, title: '', title_print: null, store_id: null, created_at: '', updated_at: '' }, store: null }]
      }
      emit('changed', { itemId: props.itemId, added: !checked })
    } else if (props.storeId) {
      if (checked) {
        await $api.labelList.detachStore(list.id, props.storeId)
        list.stores = (list.stores ?? []).filter(s => s.id !== props.storeId)
      } else {
        await $api.labelList.attachStore(list.id, props.storeId)
        list.stores = [...(list.stores ?? []), { id: props.storeId } as any]
      }
      emit('changed', { storeId: props.storeId, added: !checked })
    }
  } catch {
    $notify.add('Ошибка', { type: 'error', timer: 5 })
  } finally {
    const next = new Set(busy.value)
    next.delete(list.id)
    busy.value = next
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
.toggler {
  position: relative;
  display: inline-block;
}

.toggler-btn {
  padding: 2px 6px;
  font-size: 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  line-height: 1;
  color: #888;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.toggler-btn:hover {
  background: #2a2a2a;
  border-color: #444;
  color: #ccc;
}

.toggler-dot {
  color: #3a7a3a;
  font-size: 8px;
  vertical-align: super;
  margin-left: 1px;
}

.toggler-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 220px;
  max-height: 280px;
  overflow-y: auto;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 100;
  padding: 4px 0;
}

.toggler-loading,
.toggler-empty {
  padding: 10px 14px;
  font-size: 13px;
  color: #777;
}

.toggler-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 13px;
  color: #ccc;
  cursor: pointer;
  transition: background 0.1s;
}

.toggler-item:hover {
  background: #2a2a2a;
}

.toggler-item.disabled {
  opacity: 0.5;
  cursor: wait;
}

.toggler-item input[type="checkbox"] {
  accent-color: #3a7a3a;
  cursor: pointer;
}

.toggler-item.disabled input[type="checkbox"] {
  cursor: wait;
}

.toggler-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
