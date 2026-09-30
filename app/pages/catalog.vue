<template>
  <div class="catalog-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('catalog.title') }}</h3>
      <NuxtLink v-if="selectedId !== null" to="/catalog" class="btn-back">
        ← {{ t('catalog.all_categories') }}
      </NuxtLink>
    </div>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <!--
        Мозаика: плитки по ширине содержимого, каждая — фотография категории с
        подписью. Плитка здесь единственное, чем эта страница отличается от
        списка категорий, и именно она нужна: видеть надо предмет, а не
        читать его название в таблице.
      -->
      <div v-if="!selectedId" class="mosaic">
        <button
          v-for="category in rootCategories"
          :key="category.id"
          type="button"
          class="tile"
          @click="select(category.id)"
        >
          <span class="tile__photo">
            <ItemPhoto :images="category.images" :alt="category.title" :size="200" />
          </span>
          <span class="tile__title">{{ category.title }}</span>
          <span class="tile__count">{{ t('catalog.items_count', { count: category.items_count ?? 0 }) }}</span>
        </button>

        <div v-if="!rootCategories.length" class="empty">{{ t('catalog.no_categories') }}</div>
      </div>

      <!--
        Внутри категории: подкатегории и предметы той же плиткой. Блока без
        содержимого нет вовсе — пустая рамка занимала бы место и читалась бы
        как ошибка там, где её нет.
      -->
      <template v-else>
        <div class="catalog-head">
          <ItemPhoto :images="selected?.images" :alt="selected?.title ?? ''" :size="48" />
          <h4 class="catalog-head__title">{{ selected?.title }}</h4>
          <NuxtLink :to="`/items?category_id=${selectedId}`" class="btn-add">{{ t('catalog.all_items') }}</NuxtLink>
        </div>

        <template v-if="children.length || items.length">
          <div v-if="children.length" class="catalog-block">
            <h5 class="catalog-block__title">{{ t('catalog.subcategories') }}</h5>
            <div class="mosaic">
              <button
                v-for="child in children"
                :key="child.id"
                type="button"
                class="tile"
                @click="select(child.id)"
              >
                <span class="tile__photo">
                  <ItemPhoto :images="child.images" :alt="child.title" :size="200" />
                </span>
                <span class="tile__title">{{ child.title }}</span>
                <span class="tile__count">{{ t('catalog.items_count', { count: child.items_count ?? 0 }) }}</span>
              </button>
            </div>
          </div>

          <div v-if="items.length" class="catalog-block">
            <h5 class="catalog-block__title">{{ t('catalog.items') }}</h5>
            <div class="mosaic">
              <NuxtLink
                v-for="item in items"
                :key="item.payload.id"
                :to="`/items/${item.payload.id}`"
                class="tile"
              >
                <span class="tile__photo">
                  <ItemPhoto :images="item.images" :alt="item.payload.title" :size="200" />
                </span>
                <span class="tile__title">{{ item.payload.title }}</span>
                <span class="tile__count">{{ t('catalog.pieces', { count: item.payload.quantity ?? 0 }) }}</span>
              </NuxtLink>
            </div>
          </div>
        </template>

        <div v-else class="empty">{{ t('catalog.category_empty') }}</div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { CategoryResponse } from '~/repository/modules/category'
import type { ItemResponse } from '~/repository/modules/item'

/**
 * Каталог: категории и то, что в них лежит, плиткой с фотографиями.
 *
 * Список категорий показывал строки текста, и чтобы понять, что в категории
 * лежит, её надо было открыть. Здесь категория — это картинка: видно, что
 * именно там находится, ещё до клика.
 *
 * Пустое не рисуется: ни блока подкатегорий без содержимого, ни рамки «пусто».
 * Там, где пусто действительно, остаётся одно предложение.
 */

const { $api } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const categories = ref<CategoryResponse[]>([])
const items = ref<ItemResponse[]>([])
const selectedId = ref<number | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const rootCategories = computed(() =>
  categories.value.filter((c) => c.parent_id === null).sort((a, b) => a.id - b.id),
)

const selected = computed(() => categories.value.find((c) => c.id === selectedId.value) ?? null)

const children = computed(() =>
  categories.value.filter((c) => c.parent_id === selectedId.value).sort((a, b) => a.id - b.id),
)

async function loadItems() {
  if (selectedId.value === null) {
    items.value = []
    return
  }

  // Одна страница: каталог показывает, что лежит в категории, а не весь
  // список, — постраничных кнопок в мозаике быть не может.
  const result = await $api.item.list(1, selectedId.value)
  items.value = result.data
}

async function load() {
  loading.value = true
  error.value = null
  try {
    categories.value = await $api.category.all()
    const fromQuery = Number(route.query.category_id)
    selectedId.value = Number.isFinite(fromQuery) && fromQuery > 0 ? fromQuery : null
    await loadItems()
  } catch (err: any) {
    error.value = formatApiError(err, t('catalog.load_failed'))
  } finally {
    loading.value = false
  }
}

function select(id: number) {
  selectedId.value = id
  void router.replace({ query: { category_id: String(id) } })
  void loadItems()
}

watch(selectedId, () => {
  if (!loading.value && selectedId.value !== null) void loadItems()
})

void load()
</script>

<style scoped>
.catalog-page {
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.btn-back {
  font-size: 14px;
  color: var(--link);
  text-decoration: none;
}

.btn-back:hover {
  text-decoration: underline;
}

/*
 * Мозаика: плитки по ширине содержимого.
 *
 * Ширина задана плиткой, а не колонками: колонки фиксированного числа оставляли
 * бы справа пустое поле, а колонки по одной — растягивали бы плитку на всю
 * ширину. Здесь плитка всегда примерно 200px, и их столько, сколько влезло.
 */
.mosaic {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  border: 1px solid var(--border);
  /* Скругление меньше, чем кажется нужным на первый взгляд: плитка 200px
     снятая с круглых 10px читалась как скруглённая карточка, а рядом с
     такими же прямоугольными блоками в остальном интерфейсе — как мягкая
     подушка. */
  border-radius: 6px;
  background: var(--bg);
  color: var(--text-secondary);
  font: inherit;
  text-align: left;
  text-decoration: none;
  overflow: hidden;
  cursor: pointer;
}

.tile:hover {
  border-color: var(--accent);
  background: var(--bg-elevated);
}

/*
 * Фотография занимает весь верх плитки, подписи живут под ней на общем фоне:
 * растянутая на всю ширину фотография и подпись в одной рамке читались бы как
 * один блок, и подпись терялась.
 *
 * Флексом с центрированием, а не просто блоком: заглушка «нет фото» — это
 * svg фиксированного размера, и без центрирования она прилипала к левому
 * верхнему углу плитки вместо середины.
 */
.tile__photo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  /* У самой фотографии углы прямые: плитка скруглена, а картинка — это её
     содержимое, и скруглённый снимок читался бы как вырезка из фотобумаги, а
     не как сама фотография. */
  border-radius: 0;
  background: var(--bg-elevated);
}

.tile__photo :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tile__title {
  padding: 10px 12px 0;
  font-size: 14px;
  color: var(--text);
  overflow-wrap: anywhere;
}

.tile__count {
  padding: 2px 12px 10px;
  font-size: 12px;
  color: var(--text-muted);
}

.catalog-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.catalog-head__title {
  margin: 0;
  flex: 1;
  font-size: 18px;
  color: var(--text-secondary);
}

.catalog-block {
  margin-bottom: 22px;
}

.catalog-block__title {
  margin: 0 0 10px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-faint);
}

.btn-add {
  padding: 6px 16px;
  font-size: 14px;
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  text-decoration: none;
}

.loading,
.empty {
  padding: 20px;
  color: var(--text-muted);
}

.error {
  padding: 20px;
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .mosaic {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
}
</style>
