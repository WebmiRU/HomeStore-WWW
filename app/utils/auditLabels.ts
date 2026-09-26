import type { AuditLogEntry } from '~/repository/modules/auditLog'

export const ACTION_LABELS: Record<string, string> = {
  'item.created': 'Предмет создан',
  'item.updated': 'Предмет изменён',
  'item.deleted': 'Предмет удалён',
  'store.created': 'Хранилище создано',
  'store.updated': 'Хранилище изменено',
  'store.deleted': 'Хранилище удалено',
  'warehouse.created': 'Склад создан',
  'warehouse.updated': 'Склад изменён',
  'warehouse.deleted': 'Склад удалён',
  'label_preset.created': 'Шаблон создан',
  'label_preset.updated': 'Шаблон изменён',
  'label_preset.deleted': 'Шаблон удалён',
  'label_list.created': 'Список создан',
  'label_list.updated': 'Список изменён',
  'label_list.deleted': 'Список удалён',
  'category.created': 'Категория создана',
  'category.updated': 'Категория изменена',
  'category.deleted': 'Категория удалена',
  'property.created': 'Свойство создано',
  'property.updated': 'Свойство изменено',
  'property.deleted': 'Свойство удалено',
  'property_group.created': 'Группа свойств создана',
  'property_group.updated': 'Группа свойств изменена',
  'property_group.deleted': 'Группа свойств удалена',
  'dictionary.created': 'Справочник создан',
  'dictionary.updated': 'Справочник изменён',
  'dictionary.deleted': 'Справочник удалён',
  'dictionary_value.created': 'Значение справочника добавлено',
  'dictionary_value.updated': 'Значение справочника изменено',
  'dictionary_value.deleted': 'Значение справочника удалено',
  'unit.created': 'Единица измерения создана',
  'unit.updated': 'Единица измерения изменена',
  'unit.deleted': 'Единица измерения удалена',
  'access_grant.created': 'Доступ выдан',
  'access_grant.updated': 'Доступ изменён',
  'access_grant.deleted': 'Доступ отозван',
  'user.created': 'Пользователь создан',
  'user.updated': 'Пользователь изменён',
  'user.deleted': 'Пользователь удалён',
  'operation.replenish': 'Пополнение',
  'operation.writeoff': 'Списание',
  'image.attached': 'Фото добавлено',
  'image.detached': 'Фото удалено',
  'image.alt_updated': 'Подпись фото изменена',
  'image.reordered': 'Порядок фото изменён',
  'label.generate': 'Генерация этикеток',
  'auth.login': 'Вход в систему',
  'auth.logout': 'Выход из системы',
}

export const ENTITY_LABELS: Record<string, string> = {
  item: 'Предметы',
  store: 'Хранилища',
  warehouse: 'Склады',
  label_preset: 'Шаблоны',
  label_list: 'Этикетки',
  category: 'Категории',
  property: 'Свойства',
  property_group: 'Группы свойств',
  dictionary: 'Справочники',
  dictionary_value: 'Значения справочников',
  unit: 'Единицы измерения',
  access_grant: 'Доступ',
  user: 'Пользователи',
  none: 'Без объекта',
}

export function actionLabel(key: string | null): string {
  return key ? (ACTION_LABELS[key] ?? key) : '—'
}

export function entityLabel(key: string | null): string {
  if (!key) return '—'
  return ENTITY_LABELS[key] ?? key
}

export function actionBadgeClass(action: string): string {
  if (action.includes('.deleted')) return 'badge--danger'
  if (action.includes('.created')) return 'badge--success'
  if (action === 'auth.login' || action === 'auth.logout') return 'badge--auth'
  if (action.startsWith('operation.')) return 'badge--op'
  if (action.startsWith('label.')) return 'badge--label'
  return ''
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function summarize(entry: AuditLogEntry): string {
  const p = entry.payload ?? {}
  const snapshot = p.snapshot
  const title = snapshot?.title || p.title
  if (title) {
    if (entry.action.includes('image.')) return title
    if (entry.action.startsWith('operation.')) {
      const parts = [title]
      if (p.delta != null) parts.push(`${p.before ?? '—'} → ${p.after ?? '—'} (${p.delta > 0 ? '+' : ''}${p.delta})`)
      return parts.join(' · ')
    }
    return title
  }
  // У единицы измерения нет title: у неё обозначение и полное название,
  // а в журнале они лежат в снапшоте — иначе строка вышла бы пустой.
  const short = snapshot?.title_short ?? p.title_short
  if (short) {
    const full = snapshot?.title_full ?? p.title_full

    return full ? `${short} — ${full}` : short
  }
  if (entry.action === 'label.generate' && p.count != null) return `этикеток: ${p.count}`
  if (entry.action === 'auth.login') return p.method ?? ''
  const changes = p.changes
  if (changes) {
    const keys = Object.keys(changes)
    return keys.length ? `изменено: ${keys.slice(0, 3).join(', ')}` : ''
  }
  return ''
}