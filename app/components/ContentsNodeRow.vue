<template>
  <!--
    isLast нужен ради линии уровня: её рисует каждый узел сам, а у последнего в
    группе она обрывается на середине строки, иначе ушла бы ниже последнего
    потомка и дерево выглядело бы так, будто у него есть ещё дети.
  -->
  <div
    class="cnode"
    :class="{
      'cnode--last': isLast,
      'cnode--root': isRoot,
      'cnode--leaf': isLeaf,
      'cnode--branched': node.children.length > 0,
    }"
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

      <!--
        Корень на странице склада — сам склад, и он тоже открывается: раньше
        ссылка была только у хранилищ, и «Домашний склад» оставался текстом.
      -->
      <NuxtLink v-if="nodeHref" :to="nodeHref" class="cnode__title" :class="{ 'cnode__title--root': isRoot }">
        {{ node.title }}
      </NuxtLink>
      <span v-else class="cnode__title cnode__title--root">{{ node.title }}</span>

      <!-- Удалённое хранилище остаётся в дереве: предметы в нём живые, а
           это единственное место, где видно, где они лежат. -->
      <span v-if="node.deleted" class="cnode__deleted">[удалено]</span>

      <span v-if="counts" class="cnode__counts">{{ counts }}</span>
    </div>

    <div v-if="isOpen" class="cnode__body">
      <!--
        Предметы висят на одной вертикали с вложенными хранилищами: и то и
        другое — содержимое хранилища. Сама кнопка «показать все» лежит
        последней строкой списка, а не отдельным блоком: иначе вертикаль
        пришлось бы продлевать через две разные высоты.
      -->
      <ul v-if="visibleItems.length" class="cnode__items">
        <li v-for="item in visibleItems" :key="item.id" class="cnode__itemrow">
          <span class="cnode__item-photo">
            <ItemPhoto v-if="item.image" :images="[item.image]" :alt="item.title" :size="22" />
            <ItemPhotoPlaceholder v-else :size="22" />
          </span>
          <NuxtLink :to="`/items/${item.id}/edit`" class="cnode__item">{{ item.title }}</NuxtLink>
        </li>

        <li v-if="node.items_hidden > 0 && !isShownAll" class="cnode__itemrow">
          <button type="button" class="cnode__more" @click="$emit('showAll', node)">
            Показать все ({{ node.items_hidden }})
          </button>
        </li>
      </ul>

      <ContentsNodeRow
        v-for="(child, index) in node.children"
        :key="child.id"
        :node="child"
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
  /** Последний ли узел среди братьев: влияет на линии дерева. */
  isLast?: boolean
  /** Корень дерева (само хранилище или склад): над ним никого нет. */
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

/** Куда ведёт название: у склада и хранилища это разные карточки. */
const nodeHref = computed<string | null>(() => {
  if (props.node.kind === 'warehouse') return `/warehouses/${props.node.id}/edit`
  if (props.node.kind === 'store') return `/stores/${props.node.id}/edit`

  return null
})

/** Лист: потомков нет, а значит нет и вертикали, которая их соединяла бы. */
const isLeaf = computed(() => props.node.children.length === 0)

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
  У строк нет нижних подчёркиваний: в классическом дереве их не бывает, и
  горизонтальная черта под каждой строкой читалась не как разделитель, а как
  подчёркивание под названием хранилища — то есть как часть дерева, которой там
  нет. Строки разделяют сами линии и отступы.

  Геометрия дерева — как в файловых менеджерах. Числа, на которых она стоит:

  --step     — шаг вложенности: расстояние между вертикалями соседних уровней.
               Заодно это и отступ содержимого узла, поэтому вертикаль
               следующего уровня уезжает ровно настолько, насколько уехала
               миниатюра;
  --toggle   — сторона квадратика с плюсом, который стоит на вертикали;
  --rowh     — высота строки узла: линии сходятся к её середине;
  --photogap — просвет между вертикалью уровня и миниатюрой самой строки:
               вертикаль идёт по всей высоте строки, и без просвета линия
               липла к рамке миниатюры;
  --itemstub — длина отрезка от вертикали до миниатюры предмета;
  --itemh   — высота строки предмета: к её середине сводятся его отрезки;
  --rowgap   — поле от строки узла до первого предмета;
  --aftergap — поле от списка предметов до первого вложенного хранилища.

  Все расстояния считаются от левой грани блока узла, а не от номера уровня:
  блок вложен в родителя, поэтому его левая грань уже сдвинута всеми
  предыдущими шагами. Умножать шаг на глубину нельзя — вложенность и так
  складывается, и на пятом уровне линии расходились на 47, 63, 79 и 95
  пикселей вместо ровных двадцати двух, а глубокие хранилища уезжали вправо.

  Середина строки берётся процентом от её высоты, а не заданным числом
  пикселей: строки разной высоты, и заданное «на глаз» значение давало перекос
  — над линией оказывалось больше пустого места, чем под ней.
*/
.cnode {
  --step: 22px;
  --toggle: 13px;
  --rowh: 36px;
  --photogap: 6px;
  --itemstub: 22px;
  --itemh: 28px;
  --rowgap: 6px;
  --aftergap: 4px;
  position: relative;
  padding-left: var(--step);
}

/*
  Вертикаль узла — это линия уровня, на которой стоят его соседи: тот, кто
  идёт после, привязывается к ней ниже. Поэтому она идёт от верха своей
  строки до низа своего блока, а у последнего в группе обрывается на
  середине строки — ниже привязываться уже не к чему.
*/
.cnode::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-left: 1px solid #3a3a3a;
}

/* У последнего в группе, у свёрнутого и у корня линия уровня обрывается на
   середине строки. Рисуем её псевдоэлементом на строке, а не укороченным
   блоком: так она попадает ровно в середину строки любой высоты.

   Отрезок живёт на строке, а не на блоке, ещё и потому, что строка может
   оказаться выше или ниже ожидаемого — с блоком пришлось бы угадывать. */
.cnode--last::before,
.cnode--root::before {
  display: none;
}

.cnode--last > .cnode__head::after {
  content: '';
  position: absolute;
  /* Отступ --step обязателен: псевдоэлемент на голове отсчитывается от её
     внутреннего отступа, а вертикаль узла проходит по левой грани его блока.
     Без этого вычета последний ребёнок рисовал короткую линию на шаг правее
     линии уровня, и она ни с чем не соединялась. */
  left: calc(-1 * var(--step));
  top: 0;
  width: 1px;
  height: 50%;
  background: #3a3a3a;
}

/* Обрывается она только у корня: над ним линии уровня нет вообще, и короткий
   отрезок над квадратиком уезжал в пустоту.

   У остальных обрывать нельзя, даже первому в группе: линия уровня к нему
   приходит из строки родителя, и без верхней половины своей строки единственный
   ребёнок («Хранилище 1» у «Ящика 1») оставался без связи — от родителя до его
   квадратика не доходило 18 пикселей. */
.cnode--root > .cnode__head::after {
  display: none;
}

/*
  У корня линии уровня нет вообще: он ни в ком не состоит. Квадратик и
  отрезок, наоборот, остаются — корень можно свернуть, и после «Свернуть
  всё» его было нечем раскрыть обратно.

  Сдвиг вправо на половину квадратика: иначе половина кнопки уезжала бы за
  левый край дерева.
*/
.cnode--root {
  padding-left: calc(var(--step) + var(--toggle) / 2);
}

/*
  Отрезок листа идёт от линии уровня прямо к миниатюре: на месте невидимого
  квадратика обрываться некуда.

  Свою вертикаль лист при этом рисует — это линия уровня, на которой стоят его
  соседи, и она проходит через строку листа. Раньше лист её не рисовал, и
  между двумя соседними листьями (например «Стеллаж Г» и «Уголок мастерской»)
  линия рвалась: сверху обрывок последнего, снизу начало первого, между ними
  пусто.
*/
.cnode--leaf > .cnode__head::before {
  left: calc(-1 * var(--step));
  width: calc(var(--step) + var(--photogap));
}

/*
  Отрезок от квадратика к миниатюре. Слева от квадратика отрезка нет
  намеренно: вертикали под квадратиком и так достаточно, это и есть
  классический вид — «ветка» начинается от кнопки, а не отступает от неё.

  Начало отрезка — правая грань квадратика: сам квадратик непрозрачный, и
  линия под ним не видна, а лишние шесть пикселей просвета выглядели бы
  отростком, уходящим влево от линии уровня.
*/
.cnode__head::before {
  content: '';
  position: absolute;
  left: calc(-1 * (var(--step) - var(--toggle) / 2));
  top: 50%;
  width: calc(var(--step) + var(--photogap) - var(--toggle) / 2);
  border-top: 1px solid #3a3a3a;
}

.cnode__head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--rowh);
  /* Просвет до миниатюры. Отступ узла (--step) уводит вертикаль уровня под
     содержимое строки, а этот отступ отодвигает саму строку от вертикали. */
  padding-left: var(--photogap);
}

/* Квадратик с плюсом/минусом стоит на линии и ею перечёркнут: отступ до него
   считается от содержимого строки, а оно начинается на шаг правее линии. */
.cnode__toggle {
  position: absolute;
  left: calc(-1 * (var(--step) + var(--toggle) / 2));
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
   квадратик не рисуется: пустая рамка выглядит как неработающая кнопка.

   Рамки нет вовсе, а не прозрачная: прозрачная граница добавляла бы к
   стороне два пикселя, и невидимое место уезжало бы на пиксель правее, чем
   стоит настоящий квадратик у соседа. */
.cnode__toggle--empty {
  border: 0;
  background: none;
  cursor: default;
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
  position: relative;
  padding-bottom: 4px;
}

/*
  Вертикаль уровня начинается в середине строки хранилища, а не под ней. Без
  этого отрезка первый вложенный узел висел бы на линии, которая появляется
  только от нижней грани строки родителя, и до его квадратика она не доходила:
  между отрезком родителя и квадратиком оставалась бы дыра в 18 пикселей.

  Отрезок занимает ровно нижнюю половину строки, поэтому уходить ниже не
  может: дальше вертикаль ведут сами вложенные узлы, и лишний хвост у
  последнего из них уходил бы вниз по всей его ветке.
*/
.cnode--branched > .cnode__body::before {
  content: '';
  position: absolute;
  left: 0;
  top: calc(-1 * var(--rowh) / 2);
  width: 1px;
  height: calc(var(--rowh) / 2);
  background: #3a3a3a;
}

/*
  Предметы висят на вертикали вложенных хранилищ: список предметов — это
  содержимое хранилища, а не следующий уровень дерева. Отступ --itemstub —
  длина отрезка от вертикали до миниатюры предмета, он короче отступа
  хранилища, и предметы читаются как «внутри», а не как «под».
*/
.cnode__items {
  position: relative;
  margin: var(--rowgap) 0 var(--aftergap);
  padding-left: var(--itemstub);
  list-style: none;
}

/* Вертикаль предметов: от середины строки хранилища вниз. Когда ниже есть
   ещё и вложенные хранилища, линия идёт до верха их строк — иначе между
   последним предметом и первым хранилищем оставалась бы дыра в 18 пикселей. */
.cnode__items::before {
  content: '';
  position: absolute;
  left: 0;
  top: calc(-1 * (var(--rowh) / 2 + var(--rowgap)));
  bottom: calc(var(--itemh) / 2);
  width: 1px;
  background: #3a3a3a;
}

.cnode--branched .cnode__items::before {
  bottom: calc(-1 * var(--aftergap));
}

.cnode__itemrow {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--itemh);
}

.cnode__itemrow::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--itemstub));
  top: 50%;
  width: var(--itemstub);
  border-top: 1px solid #3a3a3a;
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
  padding: 3px 10px;
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
    --step: 18px;
    --rowh: 32px;
    --itemstub: 10px;
  }

  .cnode__counts {
    font-size: 11px;
  }
}
</style>
