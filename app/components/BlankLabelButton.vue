<template>
  <div class="blank-wrap" ref="rootEl">
    <button
      class="blank-btn"
      :disabled="busy"
      @click.stop="toggle"
    >
      {{ busy ? 'Создаём...' : 'Сгенерировать набор' }}
    </button>

    <div v-if="open" class="blank-dropdown" @click.stop>
      <div class="blank-hint">
        Шаблон — столько кодов попадёт в набор. Коды не привязаны ни к
        чему: отсканировав наклейку, можно будет сразу завести предмет
        или хранилище.
      </div>

      <div v-if="loading" class="blank-loading">Загрузка...</div>

      <div v-else-if="presets.length === 0" class="blank-empty">
        Сначала создайте шаблон этикеток
      </div>

      <template v-else>
        <div
          v-for="preset in presets"
          :key="preset.id"
          class="blank-item"
          :class="{ disabled: busy === preset.id }"
          @click="generate(preset)"
        >
          <span class="blank-item-title">{{ preset.title }}</span>
          <span class="blank-item-count">{{ preset.labels_per_sheet }} шт.</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { LabelPresetResponse } from '~/repository/modules/labelPreset'
import { formatApiError, readBlobApiError } from '~/composables/formatApiError'

const emit = defineEmits<{
  done: []
}>()

const { $api, $notify } = useNuxtApp()

const rootEl = ref<HTMLElement | null>(null)
const open = ref(false)
const loading = ref(false)
const presets = ref<LabelPresetResponse[]>([])
const busy = ref<number | null>(null)

function toggle() {
  if (open.value) {
    open.value = false
    return
  }
  open.value = true
  loadPresets()
}

async function loadPresets() {
  loading.value = true
  try {
    const result = await $api.labelPreset.list()
    presets.value = result.data
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка загрузки шаблонов'), { type: 'error', timer: 5 })
  } finally {
    loading.value = false
  }
}

async function generate(preset: LabelPresetResponse) {
  if (busy.value !== null) return
  busy.value = preset.id

  try {
    const list = await $api.labelList.createBlank(preset.id)
    open.value = false
    $notify.add(`Создано этикеток: ${preset.labels_per_sheet}`, { type: 'success' })

    // Сразу отдаём PDF: заходить за ним отдельно не нужно, иначе
    // непонятно, что набор пустой и печатать нечего.
    try {
      const blob = await $api.labelList.generate(list.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `labels-${list.id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      $notify.add(await readBlobApiError(err, 'Ошибка скачивания'), { type: 'error', timer: 10 })
    }

    emit('done')
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка создания набора'), { type: 'error', timer: 10 })
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
.blank-wrap {
  position: relative;
  display: inline-block;
}

.blank-btn {
  padding: 6px 16px;
  font-size: 14px;
  font-family: inherit;
  background: #4a3a5a;
  color: #dcd0e8;
  border: 1px solid #5a4480;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.blank-btn:hover:not(:disabled) {
  background: #5a4480;
}

.blank-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.blank-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 280px;
  max-width: calc(100vw - 40px);
  max-height: 320px;
  overflow-y: auto;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  z-index: 100;
  padding: 4px 0;
}

.blank-hint {
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.4;
  color: #888;
  border-bottom: 1px solid #2b2b2b;
}

.blank-loading,
.blank-empty {
  padding: 10px 14px;
  font-size: 13px;
  color: #777;
}

.blank-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  font-size: 13px;
  color: #ccc;
  cursor: pointer;
  transition: background 0.1s;
}

.blank-item:hover {
  background: #2a2a2a;
}

.blank-item.disabled {
  opacity: 0.5;
  cursor: wait;
}

.blank-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.blank-item-count {
  flex-shrink: 0;
  font-size: 12px;
  color: #9a8ab8;
}
</style>
