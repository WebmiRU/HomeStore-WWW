<template>
  <!--
    isLast нужен ради линии: вертикаль рисует каждый узел сам, и у последнего
    ребёнка она обрывается на середине строки, иначе она уходит ниже последнего
    потомка и дерево выглядит так, будто у него есть ещё дети.
  -->
  <div
    class="cnode"
    :class="{ 'cnode--last': isLast, 'cnode--root': isRoot }"
    :style="{ '--depth': depth }"
  >
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

      <span class="cnode__photo">
        <ItemPhoto v-if="node.image" :images="[node.image]" :alt="node.title" :size="28" />
        <ItemPhotoPlaceholder v-else :size="28" />
      </span>

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
          <span class="cnode__item-photo">
            <ItemPhoto v-if="item.image" :images="[item.image]" :alt="item.title" :size="22" />
            <ItemPhotoPlaceholder v-else :size="22" />
          </span>
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
        v-for="(child, index) in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :is-last="index === node.children.length - 1"
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
  /** Последний ли узел среди братьев: влияет на линии дерева. */
  isLast?: boolean
  /** Корень дерева (само хранилище или склад): у него нет родительской линии. */
  isRoot?: boolean
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
/*
  Линии дерева — как в истории коммитов: от строки родителя вниз, от этой
  линии вбок к строке ребёнка.

  Рисует каждый узел сам, а не контейнер потомков: вертикаль у последнего
  ребёнка обрывается на середине его строки (--last), иначе она ушла бы
  ниже последнего потомка и дерево выглядело бы так, будто у него есть ещё
  дети. Отступ уровня и положение линий — одно и то же число (--indent),
  иначе на втором уровне горизонтальный отрезок не дойдёт до строки.
*/
.cnode {
  --indent: 18px;
  position: relative;
  padding-left: calc(var(--depth) * var(--indent) + var(--indent));
}

.cnode::before {
  content: '';
  position: absolute;
  left: calc(var(--depth) * var(--indent) + 6px);
  top: 0;
  bottom: 0;
  border-left: 1px solid #3a3a3a;
}

.cnode--last::before {
  bottom: auto;
  height: 15px;
}

.cnode__head::before {
  content: '';
  position: absolute;
  left: calc(var(--depth) * var(--indent) + 6px);
  top: 14px;
  width: calc(var(--indent) - 6px);
  border-top: 1px solid #3a3a3a;
}

.cnode__head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid #2b2b2b;
}

/* Корень — сама карточка, и линий у него нет: они рисуются по горизонтали
   относительно каждого уровня, и у корня отступ был бы лишней ступенькой. */
.cnode--root {
  padding-left: 0;
}

.cnode--root::before,
.cnode--root .cnode__head::before {
  display: none;
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

.cnode__photo,
.cnode__item-photo {
  display: inline-flex;
  align-self: center;
  flex-shrink: 0;
}

/* Пустое место, где у сущности картинки нет: квадрат того же размера, что и
   миниатюра, иначе строка дерева прыгает между узлами с картинкой и без. */
.cnode__photo-empty {
  width: 28px;
  height: 28px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #222;
}

.cnode__photo-empty--sm {
  width: 22px;
  height: 22px;
}

.cnode__items li {
  display: flex;
  align-items: center;
  gap: 8px;
  /* Строки предметов слипались: между ними не было ни одного поля, и список
     читался как сплошная полоса текста. */
  padding: 2px 0;
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
  padding-left: 20px;
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
  /* Уменьшаем отступ через ту же переменную, которой считаются линии: иначе
     горизонтальный отрезок на телефоне перестал бы доходить до строки. */
  .cnode {
    --indent: 12px;
  }

  .cnode__counts {
    font-size: 11px;
  }
}
</style>
