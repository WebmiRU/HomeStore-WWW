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

export type NavItem = {
  key: string
  label: string
  to: string
}

export type NavGroup = {
  key: string
  label: string
  items: NavItem[]
}

export type NavEntry = NavItem | NavGroup

export const navTree: NavEntry[] = [
  { key: 'home', label: 'Главная', to: '/' },
  { key: 'items', label: 'Предметы', to: '/items' },
  { key: 'stores', label: 'Хранилища', to: '/stores' },
  { key: 'warehouses', label: 'Склады', to: '/warehouses' },
  { key: 'categories', label: 'Категории', to: '/categories' },
  { key: 'vendors', label: 'Производители', to: '/vendors' },
  {
    key: 'properties',
    label: 'Свойства',
    items: [
      { key: 'property_list', label: 'Свойства', to: '/properties' },
      { key: 'property_groups', label: 'Группы свойств', to: '/property-groups' },
      { key: 'units', label: 'Ед. изм.', to: '/units' },
      // Справочник — такой же источник значений, как единица измерения: тип
      // свойства ссылается на оба. Держать их порознь в шапке незачем.
      { key: 'dictionaries', label: 'Справочники', to: '/dictionaries' },
    ],
  },
  { key: 'movements', label: 'Движения', to: '/stock-operations' },
  {
    key: 'marking',
    label: 'Маркировка',
    items: [
      { key: 'label_lists', label: 'Этикетки', to: '/label-lists' },
      { key: 'label_presets', label: 'Шаблоны', to: '/label-presets' },
    ],
  },
  {
    // Люди и их права — два раздела об одном, поэтому в шапке они одним пунктом.
    // «Команда» короче «Пользователи и доступ» и звучит в том же просторе,
    // что остальные пункты.
    key: 'team',
    label: 'Команда',
    items: [
      { key: 'users', label: 'Пользователи', to: '/users' },
      { key: 'access', label: 'Доступ', to: '/access' },
    ],
  },
  { key: 'journal', label: 'Журнал', to: '/journal' },
  { key: 'trash', label: 'Корзина', to: '/trash' },
  {
    // Коды — одна сущность с двумя разными неприятностями: одни и те же
    // значения у разных предметов (надо найти и починить) и осиротевшие
    // (надо вычистить). Отдельными пунктами в меню это два места про одно,
    // поэтому в шапке они одним разделом.
    key: 'codes',
    label: 'Коды',
    items: [
      { key: 'code_conflicts', label: 'Коллизии', to: '/code-conflicts' },
      { key: 'orphan_codes', label: 'Очистка', to: '/orphan-codes' },
    ],
  },
  {
    key: 'options',
    label: 'Настройки',
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

/** Подпись пункта по ключу: верхнего уровня или вложенного. */
export function navLabel(key: string, entries: NavEntry[] = navTree): string {
  for (const entry of entries) {
    if (entry.key === key) return entry.label

    if (isNavGroup(entry)) {
      const found = entry.items.find((item) => item.key === key)
      if (found) return found.label
    }
  }

  return key
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
