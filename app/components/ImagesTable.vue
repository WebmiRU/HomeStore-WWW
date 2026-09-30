<template>
  <div class="images-manager">
    <div class="images-toolbar">
      <span class="images-toolbar__title">
        {{ t('images.title') }}&nbsp;{{ sortedImages.length ? `(${sortedImages.length})` : '' }}
        <span v-if="detached" class="images-toolbar__hint">{{ t('images.draft_hint') }}</span>
      </span>
      <input
        v-if="!readonly"
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        multiple
        class="file-input"
        @change="onFileChange"
      />
      <button v-if="!readonly" type="button" class="btn-upload" :disabled="uploading" @click="fileInput?.click()">
        {{ uploading ? t('images.uploading_progress', { done: progress.done, total: progress.total }) : t('images.upload') }}
      </button>
    </div>

    <div v-if="sortedImages.length" class="images-table-wrap">
      <table class="images-table">
        <thead>
          <tr>
            <th class="col-order">{{ t('images.order') }}</th>
            <th class="col-id">ID</th>
            <th class="col-thumb">{{ t('images.column') }}</th>
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
                <span class="drag-handle" :title="t('images.drag')">⠿</span>
                <button
                  type="button"
                  class="btn-order"
                  :title="t('images.order_up')"
                  :disabled="readonly || idx === 0 || reordering"
                  @click="moveUp(idx)"
                >↑</button>
                <button
                  type="button"
                  class="btn-order"
                  :title="t('images.order_down')"
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
                  :src="variantsOf(img).src"
                  :srcset="variantsOf(img).srcset"
                  :sizes="variantsOf(img).sizes"
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
                :placeholder="t('images.alt_placeholder')"
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
                {{ removingId === img.id ? '...' : t('common.delete') }}
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
  entity: 'item' | 'store' | 'warehouse'
  /**
   * Id сущности. В форме создания его ещё нет, и компонент переходит в
   * черновой режим: файлы грузятся без привязки, порядок и подписи живут
   * только в списке, а при сохранении отправляются вместе с сущностью.
   */
  entityId?: number
  modelValue: ImageResponse[]
  readonly?: boolean
}>(), {
  readonly: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: ImageResponse[]): void
}>()

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const { thumbVariants } = useThumbnail()

/**
 * Методы по типу сущности.
 *
 * Раньше здесь стояли троичные условия «предмет, иначе хранилище», и склад
 * пришлось бы дописывать в каждом из них. Карта выросла на одну строку вместе
 * с числом сущностей.
 */
const METHODS = {
  item: {
    upload: (id: number, file: File) => $api.image.uploadForItem(id, file),
    remove: (id: number, imageId: number) => $api.image.deleteForItem(id, imageId),
    saveAlt: (id: number, imageId: number, alt: string | null) => $api.image.updateAltForItem(id, imageId, alt),
    reorder: (id: number, ids: number[]) => $api.image.reorderForItem(id, ids),
  },
  store: {
    upload: (id: number, file: File) => $api.image.uploadForStore(id, file),
    remove: (id: number, imageId: number) => $api.image.deleteForStore(id, imageId),
    saveAlt: (id: number, imageId: number, alt: string | null) => $api.image.updateAltForStore(id, imageId, alt),
    reorder: (id: number, ids: number[]) => $api.image.reorderForStore(id, ids),
  },
  warehouse: {
    upload: (id: number, file: File) => $api.image.uploadForWarehouse(id, file),
    remove: (id: number, imageId: number) => $api.image.deleteForWarehouse(id, imageId),
    saveAlt: (id: number, imageId: number, alt: string | null) => $api.image.updateAltForWarehouse(id, imageId, alt),
    reorder: (id: number, ids: number[]) => $api.image.reorderForWarehouse(id, ids),
  },
} as const

const methods = computed(() => METHODS[props.entity])

/** Сущности ещё нет: работаем с локальным списком, сервер пока не знает о фото. */
const detached = computed(() => !props.entityId)

// Ячейка занимает 80×60 css-пикселей. Дальше браузер сам возьмёт из трёх
// вариантов тот, который нужен его экрану: 80 на обычном, 120 на 1.5×, 160 на
// Retina. Логотип в списке и фото здесь вписываются, а не режутся.
const THUMB_SIZE = 80

/**
 * Три атрибута считаются вместе: если sizes пообещает браузеру больше, чем
 * есть в файлах, он растянет маленький оригинал до этого размера.
 */
function variantsOf(img: ImageResponse) {
  return thumbVariants(img, THUMB_SIZE, 'contain', img.url)
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
/** Счётчик для кнопки: «Загрузка 3/7...» — иначе при десяти файлах не видно, идёт ли загрузка. */
const progress = ref({ done: 0, total: 0 })
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
  // В черновике порядок держится в самом списке: привязки ещё нет, и
  // переставлять нечего. Пересортировка сохранится при создании сущности.
  if (detached.value) return

  const ids = sortedImages.value.map((img) => img.id)
  reordering.value = true
  try {
    await methods.value.reorder(props.entityId, ids)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('images.order_save_failed')), { type: 'error', timer: 10 })
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

/**
 * Загрузка выбранных файлов — по одному, с уведомлением по каждому.
 *
 * По очереди, а не пачкой запросов: загрузка идёт в хранилище, и десяток
 * одновременных запросов на каждое фото растянул бы не столько саму загрузку,
 * сколько ожидание. Уведомление получает каждый файл: иначе при десяти
 * файлах непонятно, какой из них не загрузился, а различает их только имя
 * файла в сообщении.
 *
 * Список пополняется после каждого файла, а не в конце пачки: так видно,
 * что процесс идёт, и уже загруженное не теряется, если пачка прервётся
 * на середине.
 */
async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])

  if (props.readonly || files.length === 0) {
    input.value = ''
    return
  }

  uploading.value = true
  progress.value = { done: 0, total: files.length }

  for (const file of files) {
    progress.value = { ...progress.value, done: progress.value.done + 1 }

    try {
      if (detached.value) {
        // Файла у клиента ещё нет, и привязать его не к чему: грузим без
        // привязки, id запоминаем, а при сохранении сущности перечислим его
        // в поле images. Тот же файл может уже лежать в базе — сервер вернёт
        // ту же строку, и в списке она окажется дважды, если её не проверить.
        const image = await $api.image.uploadUnattached(file)

        if (items.value.some((img) => img.id === image.id)) {
          $notify.add(t('images.duplicate_skipped'), { type: 'info' })
          continue
        }

        items.value = [...items.value, { ...image, weight: sortedImages.value.length }]
        emitItems()
        $notify.add(t('images.uploaded', { name: file.name }), { type: 'success' })
        continue
      }

      const uploaded =
        await methods.value.upload(props.entityId as number, file)

      // Дубль: картинка уже была в списке, сервер новую привязку не создал.
      // В списке она уже есть, добавлять её второй раз нельзя — вместо
      // молчания говорим, что произошло: иначе повтор выглядит как сбой.
      if (!uploaded.attached) {
        $notify.add(
          uploaded.duplicatesRemoved > 1
            ? t('images.duplicates_removed', { count: uploaded.duplicatesRemoved })
            : t('images.duplicate_skipped'),
          { type: 'info' },
        )
        continue
      }

      items.value = [...items.value, { ...uploaded.image, weight: sortedImages.value.length }]
      emitItems()
      $notify.add(t('images.uploaded', { name: file.name }), { type: 'success' })
    } catch (err: any) {
      $notify.add(`${file.name}: ${formatApiError(err, t('images.upload_failed'))}`, { type: 'error', timer: 10 })
    }
  }

  uploading.value = false
  progress.value = { done: 0, total: 0 }
  // Сброс значения: без него повторный выбор того же файла не вызовет
  // change, и вторую попытку человек бы не увидел.
  input.value = ''
}

async function removeImage(imageId: number) {
  if (props.readonly) return
  removingId.value = imageId
  try {
    if (detached.value) {
      // Файл уже лежит в базе, но привязан к кому-то другому либо, наоборот,
      // пока ни к кому: удалять его с диска нельзя — это чужой файл. Убираем
      // только из списка, а строка без владельца, если она останется, чистится
      // при обслуживании.
      items.value = items.value.filter((img) => img.id !== imageId)
      emitItems()
      $notify.add(t('images.removed_from_draft'), { type: 'success' })
      return
    }

    await methods.value.remove(props.entityId as number, imageId)
    items.value = items.value.filter((img) => img.id !== imageId)
    emitItems()
    $notify.add(t('images.deleted'), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
  } finally {
    removingId.value = null
  }
}

async function onAltBlur(event: Event, img: ImageResponse) {
  const input = event.target as HTMLInputElement
  if (props.readonly) return
  const value = input.value.trim()
  if (value === (img.alt ?? '')) return

  // В черновике подпись ни к чему не привязана: храним её в списке и
  // отправляем вместе с остальным при сохранении.
  if (detached.value) {
    const idx = items.value.findIndex((i) => i.id === img.id)
    if (idx !== -1) {
      items.value[idx] = { ...items.value[idx], alt: value || null }
      emitItems()
    }
    return
  }

  savingAltId.value = img.id
  try {
    const updated =
      await methods.value.saveAlt(props.entityId as number, img.id, value || null)
    const idx = items.value.findIndex((i) => i.id === img.id)
    if (idx !== -1) {
      items.value[idx] = { ...items.value[idx], alt: updated.alt ?? null }
      emitItems()
    }
    $notify.add(t('images.alt_saved'), { type: 'success' })
  } catch (err: any) {
    $notify.add(formatApiError(err, t('images.alt_save_failed')), { type: 'error', timer: 10 })
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

/*
 * Рамка — цвет самой кнопки. Здесь стоял --accent, и зелёная кнопка
 * «Загрузить» получалась с синей рамкой: два разных цвета рядом, и выглядело
 * как ошибка вёрстки. По общему правилу рамка кнопки всегда того же цвета,
 * что и её заливка.
 */
.btn-upload {
  padding: 8px 16px;
  font-size: 13px;
  font-family: inherit;
  color: var(--success-ink);
  background: var(--success-bg);
  border: 1px solid var(--success);
  border-radius: 4px;
  cursor: pointer;
}

.btn-upload:hover:not(:disabled) {
  background: color-mix(in srgb, var(--success) 24%, var(--bg-elevated));
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
  color: var(--text-secondary);
}

/* Подсказка черновика: фото ещё ни к чему не привязаны. */
.images-toolbar__hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-muted);
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
  border: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
}

.images-table th {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg);
  font-weight: normal;
}

.col-order {
  width: 96px;
  white-space: nowrap;
}

.col-id {
  width: 60px;
  color: var(--text-muted);
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
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background: var(--bg-elevated);
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
  border: 2px solid var(--border-strong);
  border-top-color: var(--success-hover);
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
  color: var(--text-muted);
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
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.2;
}

.btn-order:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-hover);
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
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
}

.alt-input:focus {
  border-color: var(--border-strong);
}

.images-table__row--dragging {
  opacity: 0.4;
}

.btn-remove {
  padding: 4px 10px;
  font-size: 12px;
  font-family: inherit;
  color: var(--danger-ink);
  background: var(--danger-bg);
  border: 1px solid var(--danger);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-remove:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 24%, var(--bg-elevated));
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
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .images-table td {
    width: auto;
    display: block;
    padding: 0;
    border: 0;
    color: var(--text);
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
    color: var(--text-muted);
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