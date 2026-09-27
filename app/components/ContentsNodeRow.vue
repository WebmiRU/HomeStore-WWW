<template>
  <!--
    isLast нужен ради линии: вертикаль рисует каждый узел сам, и у последнего
    ребёнка она обрывается на середине строки, иначе ушла бы ниже последнего
    потомка и дерево выглядело бы так, будто у него есть ещё дети.
  -->
  <div
    class="cnode"
    :class="{
      'cnode--last': isLast,
      'cnode--root': isRoot,
      'cnode--leaf': isLeaf,
      'cnode--closed': isClosed,
    }"
    :style="{ '--depth': depth }"
  >
    <div class="cnode__head">
      <!--
        Квадратик с плюсом/минусом — как в «Проводнике»: он стоит прямо на
        линии дерева и ею же перечёркнут, поэтому вложенность читается и без
        чтения отступов. У листа место под квадратик остаётся — иначе строки
        наезжали бы друг на друга.
      -->
      <button
        v-if="node.children.length"
        type="button"
        class="cnode__toggle"
        :aria-expanded="isOpen"
        :aria-label="isOpen ? 'Свернуть' : 'Развернуть'"
        @click="$emit('toggle', node.id)"
      >
        {{ isOpen ? '−' : '+' }}
      </button>
      <span v-else class="cnode__toggle cnode__toggle--empty"></span>

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
/** Лист: потомков нет, а значит нет и вертикали, которая их соединяла бы. */
const isLeaf = computed(() => props.node.children.length === 0)

/**
 * Свёрнутый узел с потомками: вертикаль ему тоже не нужна — соединять не
 *чего, пока дети не показаны, и в свёрнутом виде она висела бы в воздухе
 * слева от строки.
 */
const isClosed = computed(() => props.node.children.length > 0 && !isOpen.value)
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
  Геометрия дерева держится на трёх числах:

  --indent  — шаг вложенности: расстояние от вертикали узла до вертикали его
              детей. Одновременно это и отступ содержимого узла;
  --toggle  — сторона квадратика с плюсом, стоящего на линии;
  --rowmid  — середина строки узла, к которой сходятся линии.

  Отступ задаётся только через --indent, без умножения на глубину. Умножать
  нельзя: вложенные узлы и так лежат в отступах родителей, и шаг
  складывался бы с шагом — на пятом уровне линии расходились на 47, 63, 79 и
  95 пикселей вместо ровных пятнадцати, и глубокие хранилища уезжали вправо.

  Расстояния считаются от левой грани блока узла, а не от координаты уровня:
  блок вложен в родителя, поэтому его левая грань уже сдвинута на все
  предыдущие шаги.
*/
.cnode {
  --indent: 15px;
  --toggle: 14px;
  --rowmid: 17px;
  /* Предметы лежат В хранилище, а не под ним, поэтому их строки сдвинуты
     влево от строки самого хранилища. Без этого список выглядит как
     продолжение дерева — как будто предметы ещё один уровень вложенности. */
  --inside: 8px;
  position: relative;
  padding-left: var(--indent);
}

/* Вертикаль узла — по его левой грани, от строки вниз через всех потомков.
   У последнего ребёнка обрывается на середине строки. */
.cnode::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-left: 1px solid #3a3a3a;
}

.cnode--last::before {
  bottom: auto;
  height: var(--rowmid);
}

/* У свёрнутого узла вертикали нет по той же причине, что у листа. */
.cnode--closed::before {
  display: none;
}

/* У листа вертикали нет вовсе: соединять нечего, а линия шла бы через его
   собственную строку. Зато отрезок нужен до самого содержимого: квадратика у
   листа не видно, и на его месте линия обрывалась бы в воздухе. */
.cnode--leaf::before {
  display: none;
}

.cnode--leaf .cnode__head::before {
  width: calc(2 * var(--indent));
}

/* Горизонтальный отрезок: от вертикали родителя (она на indent левее блока
   узла) к левой грани квадратика, центр которого совпадает с отрезком.
   Ширина — indent минус половина квадратика: с запасом линия вылезала бы
   справа из-под непрозрачного квадратика хвостиком, с недохватом не дошла бы
   до него. */
.cnode__head::before {
  content: '';
  position: absolute;
  left: calc(-2 * var(--indent));
  top: var(--rowmid);
  width: calc(var(--indent) - var(--toggle) / 2);
  border-top: 1px solid #3a3a3a;
}

.cnode__head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  padding: 3px 0;
  border-bottom: 1px solid #2b2b2b;
}

/* Квадратик с плюсом/минусом стоит на линии и ею перечёркнут: отступ до него
   считается от содержимого строки, а та начинается на indent правее линии. */
.cnode__toggle {
  position: absolute;
  left: calc(-1 * (var(--indent) + var(--toggle) / 2));
  top: 50%;
  transform: translateY(-50%);
  width: var(--toggle);
  height: var(--toggle);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 12px;
  line-height: 1;
  color: #aaa;
  background: #24242c;
  border: 1px solid #555;
  border-radius: 2px;
  cursor: pointer;
}

.cnode__toggle:hover {
  color: #fff;
  border-color: #8a8;
}

/* У листа место под квадратик остаётся, чтобы строки стояли вровень, но сам
   квадратик не рисуется: пустая рамка выглядит как неработающая кнопка. */
.cnode__toggle--empty {
  border-color: transparent;
  background: none;
  cursor: default;
}

/* Корень — сама карточка: квадратика у него нет (он и так раскрыт) и отрезка
   от собственной вертикали тоже. Вертикаль, наоборот, остаётся: к ней
   крепятся все прямые дети, и без неё их отрезки висели бы в воздухе.

   Важно: именно прямого потомка, а не любого вложенного. Корневой узел
   оборачивает всё дерево, поэтому селектор-потомок `.cnode--root .cnode__toggle`
   попадал во все вложенные узлы и гасил квадратики и отрезки по всему дереву —
   визуально это выглядело как «дерево без раскрытий». */
.cnode--root > .cnode__head::before,
.cnode--root > .cnode__head > .cnode__toggle {
  display: none;
}

.cnode__photo,
.cnode__item-photo {
  display: inline-flex;
  align-self: center;
  flex-shrink: 0;
}

.cnode__title {
  font-size: 15px;
  color: #cce;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  flex-shrink: 0;
  font-size: 12px;
  color: #b98;
}

.cnode__counts {
  margin-left: auto;
  padding-left: 10px;
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.cnode__body {
  padding-bottom: 4px;
}

.cnode__items {
  /* Влево от строки хранилища (--inside), а не вровень с ней: предмет лежит
     внутри ячейки, а не на следующем уровне дерева. */
  margin: 6px 0 4px calc(-1 * var(--inside));
  padding-left: 0;
  list-style: none;
}

.cnode__items li {
  display: flex;
  align-items: center;
  gap: 8px;
  /* Строки предметов слипались: между ними не было ни одного поля, и список
     читался как сплошная полоса текста. */
  padding: 2px 0;
}

.cnode__item {
  font-size: 14px;
  color: #aaa;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cnode__item:hover {
  color: #ccf;
  text-decoration: underline;
}

.cnode__more {
  margin: 4px 0 6px;
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
  /* Уменьшаем шаг через ту же переменную, которой считаются линии. */
  .cnode {
    --indent: 12px;
  }

  .cnode__counts {
    font-size: 11px;
  }
}
</style>
