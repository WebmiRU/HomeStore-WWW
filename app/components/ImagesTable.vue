<template>
  <div class="images-manager">
    <div class="images-toolbar">
      <span class="images-toolbar__title">Изображения&nbsp;{{ sortedImages.length ? `(${sortedImages.length})` : '' }}</span>
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        class="file-input"
        @change="onFileChange"
      />
      <button type="button" class="btn-upload" :disabled="uploading" @click="fileInput?.click()">
        {{ uploading ? 'Загрузка...' : 'Загрузить' }}
      </button>
    </div>

    <div v-if="sortedImages.length" class="images-table-wrap">
      <table class="images-table">
        <thead>
          <tr>
            <th class="col-order">Порядок</th>
            <th class="col-id">ID</th>
            <th class="col-thumb">Изображение</th>
            <th class="col-alt">Alt</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(img, idx) in sortedImages"
            :key="img.id"
            class="images-table__row"
            :class="{ 'images-table__row--dragging': draggingId === img.id }"
            draggable="true"
            @dragstart="onDragStart($event, img.id)"
            @dragover.prevent="onDragOver"
            @drop.prevent="onDrop($event, idx)"
            @dragend="onDragEnd"
          >
            <td class="col-order">
              <div class="order-controls">
                <span class="drag-handle" title="Перетащить">⠿</span>
                <button
                  type="button"
                  class="btn-order"
                  title="Выше"
                  :disabled="idx === 0 || reordering"
                  @click="moveUp(idx)"
                >↑</button>
                <button
                  type="button"
                  class="btn-order"
                  title="Ниже"
                  :disabled="idx === sortedImages.length - 1 || reordering"
                  @click="moveDown(idx)"
                >↓</button>
              </div>
            </td>
            <td class="col-id">{{ img.id }}</td>
            <td class="col-thumb">
              <img :src="img.url" :width="80" :height="60" :alt="img.alt ?? ''" loading="lazy" />
            </td>
            <td class="col-alt">
              <input
                type="text"
                class="field-input alt-input"
                :value="img.alt ?? ''"
                :disabled="savingAltId === img.id"
                maxlength="255"
                placeholder="описание изображения"
                @blur="onAltBlur($event, img)"
              />
            </td>
            <td class="col-actions">
              <button
                type="button"
                class="btn-remove"
                :disabled="removingId === img.id"
                @click="removeImage(img.id)"
              >
                {{ removingId === img.id ? '...' : 'Удалить' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ImageResponse } from '~/repository/modules/image'

const props = defineProps<{
  entity: 'item' | 'store'
  entityId: number
  modelValue: ImageResponse[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ImageResponse[]): void
}>()

const { $api, $notify } = useNuxtApp()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const removingId = ref<number | null>(null)
const savingAltId = ref<number | null>(null)
const reordering = ref(false)
const draggingId = ref<number | null>(null)
const dragFromIndex = ref<number | null>(null)

const items = ref<ImageResponse[]>([...props.modelValue])

watch(
  () => props.modelValue,
  (value) => {
    items.value = [...value]
  }
)

const sortedImages = computed<ImageResponse[]>(() =>
  [...items.value].sort((a, b) => (a.weight ?? Number.MAX_SAFE_INTEGER) - (b.weight ?? Number.MAX_SAFE_INTEGER))
)

function emitItems() {
  emit('update:modelValue', items.value)
}

function applyOrder(newOrder: ImageResponse[]) {
  newOrder = newOrder.map((img, idx) => ({ ...img, weight: idx }))
  items.value = newOrder
  emitItems()
}

async function persistOrder() {
  const ids = sortedImages.value.map((img) => img.id)
  reordering.value = true
  try {
    if (props.entity === 'item') {
      await $api.image.reorderForItem(props.entityId, ids)
    } else {
      await $api.image.reorderForStore(props.entityId, ids)
    }
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка сохранения порядка'), { type: 'error', timer: 10 })
    items.value = [...props.modelValue]
    emitItems()
  } finally {
    reordering.value = false
  }
}

function moveUp(idx: number) {
  if (idx <= 0) return
  const order = [...sortedImages.value]
  ;[order[idx - 1], order[idx]] = [order[idx], order[idx - 1]]
  applyOrder(order)
  persistOrder()
}

function moveDown(idx: number) {
  if (idx >= sortedImages.value.length - 1) return
  const order = [...sortedImages.value]
  ;[order[idx], order[idx + 1]] = [order[idx + 1], order[idx]]
  applyOrder(order)
  persistOrder()
}

function onDragStart(event: DragEvent, id: number) {
  draggingId.value = id
  dragFromIndex.value = sortedImages.value.findIndex((img) => img.id === id)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver() {
  // preventDefault в шаблоне
}

function onDrop(event: DragEvent, toIndex: number) {
  const from = dragFromIndex.value
  draggingId.value = null
  dragFromIndex.value = null
  if (from === null || from === toIndex) return

  const order = [...sortedImages.value]
  const [moved] = order.splice(from, 1)
  order.splice(toIndex, 0, moved)
  applyOrder(order)
  persistOrder()
}

function onDragEnd() {
  draggingId.value = null
  dragFromIndex.value = null
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const img =
      props.entity === 'item'
        ? await $api.image.uploadForItem(props.entityId, file)
        : await $api.image.uploadForStore(props.entityId, file)
    items.value = [...items.value, { ...img, weight: sortedImages.value.length }]
    emitItems()
    $notify.add('Изображение загружено', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка загрузки'), { type: 'error', timer: 10 })
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeImage(imageId: number) {
  removingId.value = imageId
  try {
    await (props.entity === 'item'
      ? $api.image.deleteForItem(props.entityId, imageId)
      : $api.image.deleteForStore(props.entityId, imageId))
    items.value = items.value.filter((img) => img.id !== imageId)
    emitItems()
    $notify.add('Изображение удалено', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  } finally {
    removingId.value = null
  }
}

async function onAltBlur(event: Event, img: ImageResponse) {
  const input = event.target as HTMLInputElement
  const value = input.value.trim()
  if (value === (img.alt ?? '')) return

  savingAltId.value = img.id
  try {
    const updated =
      props.entity === 'item'
        ? await $api.image.updateAltForItem(props.entityId, img.id, value || null)
        : await $api.image.updateAltForStore(props.entityId, img.id, value || null)
    const idx = items.value.findIndex((i) => i.id === img.id)
    if (idx !== -1) {
      items.value[idx] = { ...items.value[idx], alt: updated.alt ?? null }
      emitItems()
    }
    $notify.add('Alt сохранён', { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка сохранения alt'), { type: 'error', timer: 10 })
  } finally {
    savingAltId.value = null
  }
}
</script>

<style scoped>
.images-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.file-input {
  display: none;
}

.btn-upload {
  padding: 8px 16px;
  font-size: 13px;
  font-family: inherit;
  color: #9fd8a6;
  background: #1f3a24;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  cursor: pointer;
}

.btn-upload:hover:not(:disabled) {
  background: #2a4d2e;
}

.btn-upload:disabled {
  opacity: 0.5;
  cursor: default;
}

.images-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.images-toolbar__title {
  font-size: 14px;
  color: #ccc;
}

.images-table-wrap {
  overflow-x: hidden;
}

.images-table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
}

.images-table th,
.images-table td {
  padding: 6px 10px;
  border: 1px solid #3a3a3a;
  text-align: left;
  vertical-align: middle;
}

.images-table th {
  font-size: 12px;
  color: #888;
  background: #202020;
  font-weight: normal;
}

.col-order {
  width: 96px;
  white-space: nowrap;
}

.col-id {
  width: 60px;
  color: #888;
  font-size: 13px;
}

.col-thumb {
  width: 80px;
  min-width: 80px;
}

.col-alt {
  width: auto;
}

.images-table .col-actions {
  width: 68px;
  text-align: center;
}

.col-thumb img {
  display: block;
  width: 80px;
  height: 60px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #222;
  object-fit: cover;
}

.order-controls {
  display: flex;
  align-items: center;
  gap: 2px;
}

.drag-handle {
  cursor: grab;
  color: #888;
  font-size: 16px;
  padding: 2px 6px;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.btn-order {
  padding: 2px 8px;
  font-size: 13px;
  font-family: inherit;
  color: #aaa;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.2;
}

.btn-order:hover:not(:disabled) {
  color: #ddd;
  background: #333;
}

.btn-order:disabled {
  opacity: 0.4;
  cursor: default;
}

.alt-input {
  width: 100%;
  min-width: 200px;
  padding: 6px 8px;
  font-size: 13px;
  font-family: inherit;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.alt-input:focus {
  border-color: #666;
}

.images-table__row--dragging {
  opacity: 0.4;
}

.btn-remove {
  padding: 4px 10px;
  font-size: 12px;
  font-family: inherit;
  color: #f8a8a8;
  background: #3a1f1f;
  border: 1px solid #7a3a3a;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-remove:hover:not(:disabled) {
  background: #4d2a2a;
}

.btn-remove:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>