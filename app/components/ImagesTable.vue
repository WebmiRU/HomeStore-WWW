<template>
  <div class="images-manager">
    <div class="images-toolbar">
      <span class="images-toolbar__title">Изображения&nbsp;{{ sortedImages.length ? `(${sortedImages.length})` : '' }}</span>
      <input
        v-if="!readonly"
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        class="file-input"
        @change="onFileChange"
      />
      <button v-if="!readonly" type="button" class="btn-upload" :disabled="uploading" @click="fileInput?.click()">
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
            :draggable="!readonly"
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
                  :disabled="readonly || idx === 0 || reordering"
                  @click="moveUp(idx)"
                >↑</button>
                <button
                  type="button"
                  class="btn-order"
                  title="Ниже"
                  :disabled="readonly || idx === sortedImages.length - 1 || reordering"
                  @click="moveDown(idx)"
                >↓</button>
              </div>
            </td>
            <td class="col-id" >{{ img.id }}</td>
            <td class="col-thumb" >
              <div class="thumb-wrap">
                <span v-if="!loadedIds.has(img.id)" class="thumb-spinner" aria-hidden="true" />
                <img
                  :src="thumbSrc(img)"
                  :class="{ 'thumb--loading': !loadedIds.has(img.id) }"
                  :alt="img.alt ?? ''"
                  loading="lazy"
                  @load="onThumbLoad(img)"
                  @error="onThumbError($event, img)"
                />
              </div>
            </td>
            <td class="col-alt" >
              <input
                type="text"
                class="field-input alt-input"
                :value="img.alt ?? ''"
                :disabled="readonly || savingAltId === img.id"
                :readonly="readonly"
                maxlength="255"
                placeholder="описание изображения"
                @blur="onAltBlur($event, img)"
              />
            </td>
            <td class="col-actions">
              <button
                v-if="!readonly"
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

const props = withDefaults(defineProps<{
  entity: 'item' | 'store'
  entityId: number
  modelValue: ImageResponse[]
  readonly?: boolean
}>(), {
  readonly: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: ImageResponse[]): void
}>()

const { $api, $notify } = useNuxtApp()
const { thumbUrl } = useThumbnail()

const THUMB_KEY = '100x100_contain'

function thumbSrc(img: ImageResponse): string {
  return thumbUrl(img.sha256, THUMB_KEY) ?? img.url
}

const loadedIds = ref<Set<number>>(new Set())

function markLoaded(img: ImageResponse) {
  if (loadedIds.value.has(img.id)) return
  loadedIds.value = new Set(loadedIds.value).add(img.id)
}

function onThumbLoad(img: ImageResponse) {
  markLoaded(img)
}

function onThumbError(event: Event, img: ImageResponse) {
  const el = event.target as HTMLImageElement
  if (el.dataset.fallback === '1') {
    markLoaded(img)
    return
  }
  el.dataset.fallback = '1'
  el.src = img.url
}

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
  if (props.readonly || idx <= 0) return
  const order = [...sortedImages.value]
  ;[order[idx - 1], order[idx]] = [order[idx], order[idx - 1]]
  applyOrder(order)
  persistOrder()
}

function moveDown(idx: number) {
  if (props.readonly || idx >= sortedImages.value.length - 1) return
  const order = [...sortedImages.value]
  ;[order[idx], order[idx + 1]] = [order[idx + 1], order[idx]]
  applyOrder(order)
  persistOrder()
}

function onDragStart(event: DragEvent, id: number) {
  if (props.readonly) {
    event.preventDefault()
    return
  }
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
  if (props.readonly) {
    input.value = ''
    return
  }
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
  if (props.readonly) return
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
  if (props.readonly) return
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

.thumb-wrap {
  position: relative;
  width: 80px;
  height: 60px;
  overflow: hidden;
  border: 1px solid #444;
  border-radius: 4px;
  background: #222;
}

.col-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.15s ease;
}

.thumb--loading {
  opacity: 0;
}

.thumb-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border: 2px solid #444;
  border-top-color: #9fd8a6;
  border-radius: 50%;
  animation: thumb-spin 0.7s linear infinite;
}

@keyframes thumb-spin {
  to {
    transform: rotate(360deg);
  }
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

@media (max-width: 768px) {
  .images-toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .images-table,
  .images-table tbody {
    display: block;
  }

  .images-table thead {
    display: none;
  }

  .images-table tr {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      "order id actions"
      "thumb thumb thumb"
      "alt   alt   alt";
    gap: 10px;
    align-items: center;
    margin-bottom: 14px;
    padding: 12px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .images-table td {
    width: auto;
    display: block;
    padding: 0;
    border: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
    text-align: left;
  }

  .images-table td.col-order {
    grid-area: order;
    justify-self: start;
  }

  .images-table td.col-id {
    grid-area: id;
    justify-self: center;
    align-self: center;
    color: #888;
    text-align: center;
  }

  .images-table td.col-id::before {
    content: 'ID ';
  }

  .images-table td.col-actions {
    grid-area: actions;
    justify-self: end;
    text-align: right;
  }

  .images-table td.col-thumb {
    grid-area: thumb;
    text-align: left;
  }

  .images-table td.col-thumb .thumb-wrap {
    width: 120px;
    height: 90px;
    margin-right: auto;
  }

  .images-table td.col-alt {
    grid-area: alt;
  }

  .images-table tr:hover td {
    background: transparent;
  }

  .order-controls .drag-handle {
    display: none;
  }

  .btn-order {
    padding: 6px 12px;
    font-size: 15px;
  }

  .alt-input {
    width: 100%;
  }
}
</style>