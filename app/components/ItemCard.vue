<template>
  <component :is="as" class="item-card">
    <ItemPhoto :images="item.images" :alt="item.title_print || item.title" />

    <div class="item-card__info">
      <div class="item-card__title">{{ item.title }}</div>
      <div v-if="item.title_print" class="item-card__print">
        {{ item.title_print }}
      </div>
      <div v-if="code" class="item-card__code">
        Код: {{ code }}
        <!--
          Метка ставится, когда тот же код заведён на нескольких предметах.
          Жёлтым, а не красным: коллизия — не ошибка, а «код не разбирает, по
          какому предмету пришёл». Красным в этом списке помечаются только
          непроходимые операции.
        -->
        <span
          v-if="collisionCount > 1"
          class="item-card__collision"
          :title="`Этот код есть у ${collisionCount} предметов`"
        >код у {{ collisionCount }} {{ plural(collisionCount, 'предмета', 'предметов', 'предметов') }}</span>
      </div>

      <!--
        Нижняя строка карточки: сколько предмета лежит. На всех трёх экранах
        она одна и та же, поэтому и обёртка своя — чтобы содержимое нельзя
        было случайно сдвинуть, а карточки разъехались.

        Обёртка нужна и единичным предметам: у них вместо количества
        объяснение, что операция будет на 1 шт.
      -->
      <div class="item-card__foot">
        <slot name="foot">
          <div v-if="item.quantity != null" class="item-card__stock">В наличии: {{ item.quantity }}</div>
          <div v-else-if="kind !== 'store'" class="item-card__hint">Еединичный предмет — операция на 1 шт.</div>
        </slot>
      </div>

      <div class="item-card__meta">Создано: {{ formatDate(item.created_at) }}</div>
    </div>

    <!--
      Правая колонка — там, где в строке сканирования стоит поле количества.
      На её месте то, чем предмет берут на этом экране: счётчик и удаление в
      операции, кнопка «Открыть» в поиске, плашка «Предыдущий выбор» в окне
      выбора. Это и есть единственное различие между тремя экранами, поэтому
      колонка общая: иначе «Открыть» и плашка висели бы по центру карточки, а
      счётчик по верху.

      Плашка типа — тоже здесь, а не рядом с кодом или названием. По коду не
      видно, что нашлось: предмет это или хранилище. Но любая строчка в левой
      колонке отстроила бы карточку от строки сканирования, а левая колонка у
      всех трёх экранов должна совпадать до пикселя. Правой колонке метка не
      мешает: там и так пусто, а карточка от неё не растёт.
    -->
    <div class="item-card__side">
      <slot name="side" />
      <span
        v-if="kind"
        class="item-card__kind"
        :class="kind === 'store' ? 'item-card__kind--store' : 'item-card__kind--item'"
      >{{ kind === 'store' ? 'Хранилище' : 'Предмет' }}</span>
    </div>

    <div class="item-card__where">
      <span v-if="item.user" class="item-card__owner">
        <span
          class="owner-name"
          :class="item.user.id === myUserId ? 'owner--me' : 'owner--other'"
        >{{ item.user.name }}</span>
      </span>

      <LocationChain :chain="chain" />
      <span v-if="chain.length === 0" class="item-card__none">Без склада</span>
    </div>
  </component>
</template>

<script setup lang="ts">
/**
 * Карточка предмета. Разметка перенесена из строки сканирования в режимах
 * «Пополнить»/«Списать» без изменений — тот же grid (фото, сведения, счётчик)
 * и та же цепочка хранения во всю ширину под ними.
 *
 * Общая карточка нужна потому, что предмет показывают три экрана: строка
 * сканирования, модалка выбора при неоднозначном коде и выдача поиска. Раньше
 * у них было три разные карточки, и они разъезжались: выбрал предмет в одном
 * месте, сверился в другом — а выглядят они по-разному.
 *
 * Различаются экраны только содержимым слота foot: у строки там состояние
 * операции, у модалки отметка о прошлом выборе, у поиска кнопка «Открыть».
 * Сам счётчик к операции нужен только в строке, поэтому он в слоте side.
 */
import { computed } from 'vue'
import type { ImageResponse } from '~/repository/modules/image'
import type { UserBrief } from '~/repository/modules/code'
import type { ChainCrumb } from '~/composables/useLocationChain'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { plural } from '~/utils/plural'

/**
 * Всё, что карточке нужно знать о предмете.
 *
 * Не ItemPayload, хотя этот тип подходит: по коду в поиске находится и
 * хранилище, а у него нет ни количества, ни печатного названия. Карточка от
 * отсутствия этих полей не меняется — на их месте в выдаче поиска стоит
 * кнопка «Открыть», а количество ей не полагается.
 */
type CardItem = {
  id: number
  title: string
  title_print?: string | null
  quantity?: number | null
  created_at: string
  images?: ImageResponse[]
  user?: UserBrief | null
}

const props = withDefaults(defineProps<{
  item: CardItem
  /** Показывать строку кода: он и есть причина, по которой предмет нашлись. */
  code?: string | null
  /** Что за запись: предмет или хранилище. Плашка нужна в выдаче поиска. */
  kind?: 'item' | 'store' | null
  /** Сколько предметов делят этот код — для метки «код у N предметов». */
  collisionCount?: number
  chain?: ChainCrumb[]
  /**
   * Корневой элемент. Карточка бывает блоком, кнопкой выбора и — в строке
   * сканирования — контейнером с полями ввода: одна вёрстка, разное
   * поведение.
   */
  as?: string
}>(), {
  code: null,
  kind: null,
  collisionCount: 1,
  chain: () => [],
  as: 'div',
})

const { currentUserId } = useCurrentUser()
const myUserId = computed(() => currentUserId.value)

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU')
}

</script>
