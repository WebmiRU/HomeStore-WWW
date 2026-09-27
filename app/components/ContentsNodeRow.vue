<template>
  <div class="cnode" :style="{ '--depth': depth }">
    <div class="cnode__head">
      <!-- Стрелка только у хранилищ с потомками: у листа её нажатие ничего
           не делало бы, а место занимало бы. -->
      <button
        v-if="node.children.length"
        type="button"
        class="cnode__caret"
        :aria-expanded="isOpen"
        :aria-label="isOpen ? 'Свернуть' : 'Развернуть'"
        @click="$emit('toggle', node.id)"
      >
        {{ isOpen ? '▾' : '▸' }}
      </button>
      <span v-else class="cnode__caret cnode__caret--empty"></span>

      <NuxtLink v-if="isStore" :to="`/stores/${node.id}/edit`" class="cnode__title">
        {{ node.title }}
      </NuxtLink>
      <span v-else class="cnode__title cnode__title--root">{{ node.title }}</span>

      <!-- Удалённое хранилище остаётся в дереве: предметы в нём живые, а
           это единственное место, где видно, где они лежат. -->
      <span v-if="node.deleted" class="cnode__deleted">[удалено]</span>

      <span v-if="counts" class="cnode__counts">{{ counts }}</span>
    </div>

    <div v-if="isOpen" class="cnode__body">
      <ul v-if="visibleItems.length" class="cnode__items">
        <li v-for="item in visibleItems" :key="item.id">
          <NuxtLink :to="`/items/${item.id}/edit`" class="cnode__item">{{ item.title }}</NuxtLink>
        </li>
      </ul>

      <button
        v-if="node.items_hidden > 0 && !isShownAll"
        type="button"
        class="cnode__more"
        @click="$emit('showAll', node)"
      >
        Показать все ({{ node.items_hidden }})
      </button>

      <ContentsNodeRow
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :expanded="expanded"
        :shown-items="shownItems"
        @toggle="$emit('toggle', $event)"
        @show-all="$emit('showAll', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ContentsNode, ContentsItem } from '~/repository/modules/store'

const props = defineProps<{
  node: ContentsNode
  depth: number
  expanded: Set<number>
  /** Полные списки предметов для узлов, где нажали «показать все». */
  shownItems: Record<number, ContentsItem[]>
}>()

defineEmits<{
  toggle: [id: number]
  showAll: [node: ContentsNode]
}>()

const isOpen = computed(() => props.expanded.has(props.node.id))
const isStore = computed(() => props.node.kind === 'store')
const isShownAll = computed(() => props.shownItems[props.node.id] !== undefined)

/** Полный список, если его подгрузили, иначе — превью из двадцати. */
const visibleItems = computed(() => props.shownItems[props.node.id] ?? props.node.items)

/**
 * Счётчики узла: «своих 26» и «всего 40».
 *
 * Обе цифры нужны, потому что по одной не отличить «здесь ничего не лежит,
 * всё в детях» от «здесь пусто вообще». Когда цифры совпадают, показывается
 * одна — «своих 26, всего 26» только шумит.
 */
const counts = computed(() => {
  const own = props.node.items_count
  const total = props.node.items_total

  if (own === 0 && total === 0) return ''
  if (own === total) return `своих ${own}`

  return `своих ${own}, всего ${total}`
})
</script>

<style scoped>
.cnode {
  /* Отступ уровня: одна вложенность — 18px, этого хватает, чтобы линия
     читалась, и не съедает ширину на глубоком дереве. */
  padding-left: calc(var(--depth) * 18px);
}

.cnode__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid #2b2b2b;
}

.cnode__caret {
  width: 16px;
  flex-shrink: 0;
  align-self: center;
  padding: 0;
  font-size: 11px;
  line-height: 1;
  color: #888;
  background: none;
  border: none;
  cursor: pointer;
}

.cnode__caret:hover {
  color: #ccc;
}

.cnode__caret--empty {
  cursor: default;
}

.cnode__title {
  font-size: 15px;
  color: #cce;
  text-decoration: none;
}

.cnode__title:hover {
  color: #aaf;
  text-decoration: underline;
}

.cnode__title--root {
  font-size: 17px;
  color: #ddd;
}

.cnode__deleted {
  font-size: 12px;
  color: #b98;
}

.cnode__counts {
  margin-left: auto;
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.cnode__body {
  padding-bottom: 4px;
}

.cnode__items {
  margin: 6px 0 4px;
  padding-left: 24px;
  list-style: none;
}

.cnode__item {
  display: block;
  padding: 3px 0;
  font-size: 14px;
  color: #aaa;
  text-decoration: none;
}

.cnode__item:hover {
  color: #ccf;
  text-decoration: underline;
}

.cnode__more {
  margin: 4px 0 6px 24px;
  padding: 4px 10px;
  font-size: 12px;
  font-family: inherit;
  color: #9aa;
  background: none;
  border: 1px dashed #444;
  border-radius: 4px;
  cursor: pointer;
}

.cnode__more:hover {
  color: #ccc;
  border-color: #666;
}

@media (max-width: 768px) {
  .cnode {
    padding-left: calc(var(--depth) * 10px);
  }

  .cnode__counts {
    font-size: 11px;
  }
}
</style>
