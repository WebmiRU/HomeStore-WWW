<template>
  <div class="index-table">
    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table v-if="rows.length" class="index-table__table">
        <thead>
          <tr>
            <!--
              Колонка отметки — только если страница передала слот ячейки. Сам
              флажок «отметить все» тоже слот: у списков своя логика выбора, и
              каркас не должен решать, отмечается ли одна строка или половина.
            -->
            <th v-if="$slots['cell-select']" class="index-table__select">
              <slot name="select-all" />
            </th>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="column.class"
              :style="column.width ? { width: column.width } : undefined"
            >
              {{ column.label }}
            </th>
            <th v-if="$slots.actions" class="index-table__actions-head" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="keyOf(row, index)"
            @dblclick="onRowDblClick($event, row)"
          >
            <td v-if="$slots['cell-select']" class="index-table__select">
              <slot name="cell-select" :row="row" :index="index" />
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              :class="column.class"
              :data-label="column.label"
            >
              <slot :name="`cell-${column.key}`" :row="row" :index="index">
                {{ textOf(row, column.key) }}
              </slot>
            </td>
            <td v-if="$slots.actions" class="index-table__actions">
              <slot name="actions" :row="row" :index="index" />
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">{{ emptyText }}</div>

      <TablePagination :page="page" :last-page="lastPage" @go="$emit('page', $event)" />
    </template>
  </div>
</template>

<script setup lang="ts">
import TablePagination from '~/components/TablePagination.vue'
import type { Column } from '~/components/IndexTable.vue'

/**
 * Каркас индексной таблицы.
 *
 * Списков много, и устроены они были одинаково, но написаны каждый заново:
 * состояние загрузки, пустой список, постраничная навигация, переход в
 * карточку по двойному клику и раскладка «строка превращается в карточку»
 * на узком экране. Одну и ту же правку приходилось повторять по десяти
 * страницам: ужимали отступы в таблице — и правили в «предметах», «складах» и
 * «хранилищах» по отдельности, потому что общего у них не было ничего.
 *
 * Здесь всё общее. Колонки и содержимое ячеек остаются за страницей и
 * передаются слотами: у предметов их двенадцать, у категорий пять, и
 * описывать их в компоненте означало бы вписать туда двенадцать разных
 * списков — сложнее, чем сами страницы.
 */

export type Column = {
  /** Ключ строки в объекте: по нему и слот, и значение по умолчанию. */
  key: string
  /** Подпись колонки. На узком экране она же подпись ячейки. */
  label: string
  /** Класс колонки: ширина, выравнивание, особое поведение. */
  class?: string
  /** Ширина колонки, если она задана числом или строкой CSS. */
  width?: string | number
}

const props = withDefaults(
  defineProps<{
    /** Строки таблицы. */
    rows: Record<string, any>[]
    /** Колонки по порядку. */
    columns: Column[]
    loading?: boolean
    error?: string | null
    /** Что писать, когда строк нет. */
    emptyText: string
    /** Страница пагинации, как отдаёт сервер. */
    page?: number
    lastPage?: number
    /** Карточка строки для двойного клика; без него клик ничего не делает. */
    /**
     * Карточка строки для двойного клика.
     *
     * Пустая строка или undefined означает «не открывать»: у системных шаблонов
     * ярлыков двойной клик не должен вести в карточку, где нечего править.
     */
    openTo?: (row: Record<string, any>) => string | undefined
    /** Ключ строки; по умолчанию берётся id. */
    rowKey?: (row: Record<string, any>, index: number) => string | number
  }>(),
  {
    loading: false,
    error: null,
    page: 1,
    lastPage: 1,
    openTo: undefined,
    rowKey: undefined,
  },
)

defineEmits<{ page: [page: number] }>()

const { t } = useI18n()
const { openRow } = useRowOpen()

function keyOf(row: Record<string, any>, index: number): string | number {
  return props.rowKey ? props.rowKey(row, index) : (row.id ?? index)
}

/**
 * Значение ячейки без своего слота.
 *
 * Поле берётся по ключу колонки, поэтому простые таблицы — «ID», «Название»,
 * «Создан» — не пишут ни одной лишней разметки.
 */
function textOf(row: Record<string, any>, key: string): string {
  const value = row[key]
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'object' ? String(value.title ?? '') : String(value)
}

function onRowDblClick(event: MouseEvent, row: Record<string, any>) {
  if (!props.openTo) return
  const to = props.openTo(row)
  if (!to) return
  openRow(event, to)
}
</script>

<style scoped>
.index-table__table {
  width: 100%;
  border-collapse: collapse;
}

.index-table__table th,
.index-table__table td {
  /*
   * Вертикальный отступ 6px, а не 8px.
   *
   * Высоту строки задаёт содержимое — обычно миниатюра, — и на десяти строках
   * каждые два пикселя — это 20px, которых не хватало кнопкам пагинации, чтобы
   * поместиться на экране ноутбука. По горизонтали 12px: там они держат
   * колонки, а высоты строки не касаются.
   */
  padding: 6px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
  /*
   * По центру строки, а не по верху: с картинкой в 48px содержимое прижималось
   * к верхней кромке и строка читалась как сдвинутая — особенно в складах и
   * хранилищах, где колонка с картинкой высокая, а соседние короткие.
   */
  vertical-align: middle;
}

.index-table__table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.index-table__table td {
  color: var(--text-secondary);
}

.index-table__table tbody tr:hover td {
  background: var(--bg-elevated);
}

.index-table__select {
  width: 1px;
  white-space: nowrap;
  padding-right: 0;
}

.index-table__select input[type='checkbox'] {
  accent-color: var(--accent);
  cursor: pointer;
}

.index-table__actions,
.index-table__actions-head {
  white-space: nowrap;
  width: 1px;
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

/*
 * Узкий экран: строка становится карточкой.
 *
 * Без этого таблица в 12 колонок уезжала за край и страница получала
 * горизонтальную прокрутку. Каждая ячейка знает свою подпись из data-label и
 * подписывает себя ею сама — список колонок при этом не нужен.
 */
@media (max-width: 768px) {
  .index-table__table,
  .index-table__table tbody,
  .index-table__table tr,
  .index-table__table td {
    display: block;
  }

  .index-table__table thead {
    display: none;
  }

  .index-table__table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .index-table__table td {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }

  .index-table__table tr td:last-child {
    border-bottom: none;
  }

  .index-table__table td::before {
    content: attr(data-label);
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 12px;
  }

  /*
   * Колонка с картинкой уезжает в угол карточки и подписи не получает.
   *
   * Иначе аватар или миниатюра занимали целую строку карточки и отодвигали
   * остальные поля вниз: на телефоне список из десяти карточек превращался в
   * два экрана, где половина — картинки.
   */
  .index-table__table td.img-col {
    position: absolute;
    top: 12px;
    left: 14px;
    width: auto;
    padding: 0;
  }

  .index-table__table td.img-col::before {
    display: none;
  }

  .index-table__table tr:has(td.img-col) td:not(.img-col) {
    padding-left: 62px;
  }

  /*
   * Значки правки и удаления уходят в правый верхний угол карточки.
   *
   * Отдельной строкой они занимали половину карточки и висели слева без
   * подписи — читались как часть данных, а не как действия над ними.
   */
  /*
   * Флажок отметки на телефоне — обычная строка без подписи: подпись у него
   * пустая, и пустая строка над списком только занимала высоту карточки.
   */
  .index-table__table td.index-table__select {
    position: static;
    width: auto;
    padding: 6px 0;
  }

  .index-table__table td.index-table__select::before {
    display: none;
  }

  .index-table__table td.index-table__actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .index-table__table td.index-table__actions::before {
    display: none;
  }

  .index-table__table tr:has(td.index-table__actions) td:not(.index-table__actions) {
    padding-right: 72px;
  }
}
</style>