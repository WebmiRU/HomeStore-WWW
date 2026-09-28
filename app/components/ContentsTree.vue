<template>
  <div class="contents">
    <div class="contents__bar">
      <span class="contents__summary">
        {{ tp('words.item_count', root?.items_total ?? 0) }}
        v {{ nodeWord }}
      </span>
      <div class="contents__tools">
        <button type="button" class="btn-tool" @click="expandAll(true)">{{ t('contents.expand_all') }}</button>
        <button type="button" class="btn-tool" @click="expandAll(false)">{{ t('contents.collapse_all') }}</button>
      </div>
    </div>

    <div v-if="loading" class="loading">{{ t('contents.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="root" class="contents__tree">
      <ContentsNodeRow
        :node="root"
        is-root
        :expanded="expanded"
        :shown-items="shownItems"
        @toggle="toggle"
        @show-all="showAll"
      />
    </div>
    <div v-else class="empty">{{ t('contents.empty') }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { ContentsNode as Node } from '~/repository/modules/store'

const props = defineProps<{
  /** 'store' — дерево от хранилища, 'warehouse' — от склада. */
  kind: 'store' | 'warehouse'
  entityId: number
}>()

const { tp } = useI18n()
const { $api, $notify } = useNuxtApp()

const root = ref<Node | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/** Развёрнутые узлы по id. */
const expanded = ref<Set<number>>(new Set())

/** Узлы, у которых человек нажал «показать все», и их полные списки. */
const shownItems = ref<Record<number, Node['items']>>({})

// Предложный падеж: «в складе» или «в хранилище» — от рода узла зависит
    // и подпись в подсказке, поэтому она тоже из словаря.
    const nodeWord = computed(() => t(props.kind === 'warehouse' ? 'contents.in_warehouse' : 'contents.in_storage'))

/**
 * Все узлы дерева сразу.
 *
 * Свёрнутым по умолчанию держать смысла нет: дерево — это и есть содержимое
 * вкладки, и человек приходит за обзором, а не за верхушкой. Свернуть всё
 * можно кнопкой.
 */
function collectIds(node: Node, acc: number[] = []): number[] {
  acc.push(node.id)
  node.children.forEach((child) => collectIds(child, acc))
  return acc
}

async function load() {
  loading.value = true
  error.value = null
  shownItems.value = {}

  try {
    root.value =
      props.kind === 'warehouse'
        ? await $api.warehouse.contents(props.entityId)
        : await $api.store.contents(props.entityId)

    expanded.value = root.value ? new Set(collectIds(root.value)) : new Set()
  } catch (err: any) {
    error.value = formatApiError(err, t('contents.load_failed'))
  } finally {
    loading.value = false
  }
}

function toggle(id: number) {
  const next = new Set(expanded.value)

  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }

  expanded.value = next
}

function expandAll(open: boolean) {
  if (!root.value) return

  expanded.value = open ? new Set(collectIds(root.value)) : new Set()
}

/**
 * Полный список предметов узла.
 *
 * Дерево отдаёт по двадцать предметов на узел, поэтому остальное
 * подгружается отдельно и только когда человек его запросил: заголовки
 * всех узлов за один показ вкладки весили бы заметно больше самой вкладки.
 */
async function showAll(node: Node) {
  try {
    const items = await $api.store.contentsItems(node.id)

    shownItems.value = { ...shownItems.value, [node.id]: items }
  } catch (err: any) {
    $notify.add(formatApiError(err, t('contents.items_load_failed')), { type: 'error', timer: 10 })
  }
}

onMounted(load)
watch(() => [props.kind, props.entityId], load)
</script>

<style scoped>
.contents {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.contents__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.contents__summary {
  font-size: 13px;
  color: #888;
}

.contents__tools {
  display: flex;
  gap: 8px;
}

.btn-tool {
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  color: #9aa;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.btn-tool:hover {
  color: #ccc;
  background: #333;
}

.contents__tree {
  display: flex;
  flex-direction: column;
}

.loading,
.error,
.empty {
  padding: 20px;
  color: #888;
}

.error {
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .contents__tools {
    width: 100%;
  }
}
</style>
