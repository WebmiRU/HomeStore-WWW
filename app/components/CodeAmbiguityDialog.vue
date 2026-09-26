<template>
  <div v-if="request" class="modal-backdrop" @click.self="cancel">
    <div class="modal modal--wide">
      <div class="modal__head">
        <span class="modal__title">Этот код у нескольких предметов</span>
        <button type="button" class="modal__close" aria-label="Закрыть" @click="cancel">×</button>
      </div>

      <p class="modal__lead">
        Код <span class="modal__code">{{ request.code }}</span> заведён сразу на нескольких предметах.
        Выберите, к какому относится эта штука{{ pendingCount > 0 ? ` — в очереди ещё ${pendingCount}` : '' }}.
      </p>

      <!--
        Карточка предмета — общая (ItemCard), та же, что в строке сканирования
        и в выдаче поиска. Отличие одно: у варианта, который уже выбирали, в
        правой колонке — там, где в операции стоит счётчик, — плашка
        «Предыдущий выбор». Всё остальное, включая строку «В наличии», остаётся
        на своих местах: выбирать приходится между предметами, которые
        отличаются количеством не меньше, чем названием.
      -->
      <ul class="pick-list">
        <li v-for="item in request.items" :key="item.id">
          <ItemCard
            as="button"
            :item="item"
            :code="request.code"
            :collision-count="request.items.length"
            :chain="chains[item.id] ?? []"
            class="pick-card"
            :class="{ 'pick-card--chosen': item.id === request.preselectedId }"
            @click="choose(item)"
          >
            <template v-if="item.id === request.preselectedId" #side>
              <span
                class="item-card__prev"
                title="Для этого кода в прошлый раз выбрали этот предмет"
              >Предыдущий выбор</span>
            </template>
          </ItemCard>
        </li>
      </ul>

      <div class="modal__actions">
        <button type="button" class="btn-plain" @click="cancel">Пропустить</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ItemPayload } from '~/repository/modules/code'
import { useLocationChain, type ChainCrumb } from '~/composables/useLocationChain'

export type AmbiguityRequest = {
  code: string
  items: ItemPayload[]
  /** Что выбирали для этого кода раньше в этой сессии — подсвечивается. */
  preselectedId: number | null
}

const props = defineProps<{
  request: AmbiguityRequest | null
  /** Сколько ещё сканирований ждут своей очереди. */
  pendingCount: number
}>()

const emit = defineEmits<{
  choose: [item: ItemPayload]
  cancel: []
}>()

const { chainForStore } = useLocationChain()

/**
 * Цепочки хранилищ по id предмета.
 *
 * Считаются здесь, а не передаются готовыми: окно само знает, что ему
 * показать, и не тянет на страницу расчёт того, что нужно рисованию. Дерево
 * хранилищ кэшируется в composable, поэтому повторные сканы не ходят в сеть.
 */
const chains = ref<Record<number, ChainCrumb[]>>({})

watch(
  () => props.request,
  async (request) => {
    if (!request) return

    for (const item of request.items) {
      chains.value = {
        ...chains.value,
        [item.id]: await chainForStore(item.store_id),
      }
    }
  },
  { immediate: true },
)

function choose(item: ItemPayload) {
  emit('choose', item)
}

function cancel() {
  emit('cancel')
}
</script>
