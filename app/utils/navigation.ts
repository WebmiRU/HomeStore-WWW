/**
 * Меню приложения: единственный источник, кто и в каком порядке стоит.
 *
 * Ключ у пункта обязателен и не должен меняться: он кладётся в настройки
 * пользователя (порядок и скрытие), и переименование ключа молча сбросило бы
 * у человека его расстановку. Подпись (`label`) для этого можно менять
 * свободно, ключ — нет.
 *
 * Вложенные пункты ключами не пересекаются с верхним уровнем: `properties`
 * — это группа в шапке, а `property_groups` — её раздел «Группы свойств».
 * Благодаря этому порядок и скрытие хранятся одним плоским списком, а
 * вложенность остаётся здесь, в коде: настройками нельзя сделать группу
 * пунктом, и это правильно.
 *
 * Права пользователей однажды тоже будут решать, что показывать. Место для
 * них — `navTree` после фильтрации по скрытым пунктам: порядок и скрытие
 * настройками, права отдельным фильтром, и путать их не надо.
 */

import type { TranslationKey } from '~/i18n/ru'

export type NavItem = {
  key: string
  /** Ключ перевода, а не текст: текст живёт в словарях. */
  labelKey: TranslationKey
  to: string
}

export type NavGroup = {
  key: string
  labelKey: TranslationKey
  items: NavItem[]
}

export type NavEntry = NavItem | NavGroup

export const navTree: NavEntry[] = [
  { key: 'home', labelKey: 'nav.home', to: '/' },
  { key: 'items', labelKey: 'nav.items', to: '/items' },
  // Каталог сразу после предметов: он и отвечает на вопрос «что у нас есть»,
  // и в нём те же предметы, только по категориям и с картинками.
  { key: 'catalog', labelKey: 'nav.catalog', to: '/catalog' },
  { key: 'stores', labelKey: 'nav.stores', to: '/stores' },
  { key: 'warehouses', labelKey: 'nav.warehouses', to: '/warehouses' },
  { key: 'categories', labelKey: 'nav.categories', to: '/categories' },
  { key: 'vendors', labelKey: 'nav.vendors', to: '/vendors' },
  {
    key: 'properties',
    labelKey: 'nav.properties',
    items: [
      { key: 'property_list', labelKey: 'nav.property_list', to: '/properties' },
      { key: 'property_groups', labelKey: 'nav.property_groups', to: '/property-groups' },
      { key: 'units', labelKey: 'nav.units', to: '/units' },
      // Справочник — такой же источник значений, как единица измерения: тип
      // свойства ссылается на оба. Держать их порознь в шапке незачем.
      { key: 'dictionaries', labelKey: 'nav.dictionaries', to: '/dictionaries' },
    ],
  },
  { key: 'movements', labelKey: 'nav.movements', to: '/stock-operations' },
  {
    key: 'marking',
    labelKey: 'nav.marking',
    items: [
      { key: 'label_lists', labelKey: 'nav.label_lists', to: '/label-lists' },
      { key: 'label_presets', labelKey: 'nav.label_presets', to: '/label-presets' },
    ],
  },
  {
    // Люди и их права — два раздела об одном, поэтому в шапке они одним пунктом.
    // «Команда» короче «Пользователи и доступ» и звучит в том же просторе,
    // что остальные пункты.
    key: 'team',
    labelKey: 'nav.team',
    items: [
      { key: 'users', labelKey: 'nav.users', to: '/users' },
      { key: 'access', labelKey: 'nav.access', to: '/access' },
    ],
  },
  { key: 'journal', labelKey: 'nav.journal', to: '/journal' },
  { key: 'trash', labelKey: 'nav.trash', to: '/trash' },
  {
    // Коды — одна сущность с двумя разными неприятностями: одни и те же
    // значения у разных предметов (надо найти и починить) и осиротевшие
    // (надо вычистить). Отдельными пунктами в меню это два места про одно,
    // поэтому в шапке они одним разделом.
    key: 'codes',
    labelKey: 'nav.codes',
    items: [
      { key: 'code_conflicts', labelKey: 'nav.code_conflicts', to: '/code-conflicts' },
      { key: 'orphan_codes', labelKey: 'nav.orphan_codes', to: '/orphan-codes' },
    ],
  },
  {
    key: 'options',
    labelKey: 'nav.options',
    to: '/options',
  },
]

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

/** Все ключи меню, верхнего уровня и вложенные, — в порядке объявления. */
export function navKeys(entries: NavEntry[] = navTree): string[] {
  return entries.flatMap((entry) =>
    isNavGroup(entry) ? [entry.key, ...entry.items.map((item) => item.key)] : [entry.key],
  )
}

/**
 * Раскладывает ключи по уровням: верхний и по одному списку на группу.
 *
 * Нужно странице настроек: она переставляет и прячет пункты внутри каждой
 * группы отдельно, а хранить это одним плоским списком.
 */
export function navKeysByLevel(entries: NavEntry[] = navTree): Record<string, string[]> {
  const levels: Record<string, string[]> = {}

  for (const entry of entries) {
    if (isNavGroup(entry)) {
      levels[entry.key] = entry.items.map((item) => item.key)
    } else {
      levels.top = [...(levels.top ?? []), entry.key]
    }
  }

  return levels
}

/**
 * Ключ перевода пункта по ключу меню: верхнего уровня или вложенного.
 *
 * Ключ, которого в меню нет, отдаётся как есть: t() покажет его текстом, и
 * это лучше пустой строки — видно, что за путь сломался.
 */
export function navLabelKey(key: string, entries: NavEntry[] = navTree): TranslationKey {
  for (const entry of entries) {
    if (entry.key === key) return entry.labelKey

    if (isNavGroup(entry)) {
      const found = entry.items.find((item) => item.key === key)
      if (found) return found.labelKey
    }
  }

  return 'nav.home'
}

/**
 * Расставляет ключи по сохранённому порядку.
 *
 * Ключа, которого в порядке нет, относим в конец — так появляется пункт,
 * добавленный в приложение после того, как человек настроил меню. Ключи,
 * которых в меню больше нет, в сортировку не попадают вовсе: отменять их в
 * настройках незачем, они просто перестают что-либо значить.
 *
 * Работает с ключами одного уровня, а порядок общий плоский: важно лишь,
 * кто раньше кого внутри уровня.
 */
export function sortNavKeys(keys: string[], order: string[]): string[] {
  if (order.length === 0) return [...keys]

  return keys
    .map((key, position) => {
      const index = order.indexOf(key)

      return {
        key,
        rank: index === -1 ? Number.MAX_SAFE_INTEGER : index,
        position,
      }
    })
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((item) => item.key)
}
