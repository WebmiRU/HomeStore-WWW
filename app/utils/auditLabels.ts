import type { AuditLogEntry } from '~/repository/modules/auditLog'
import type { TranslationKey } from '~/i18n/ru'

/**
 * Ключи действий и типов объектов, а не подписи: текст лежит в i18n
 * (audit_actions, audit_entities) и подставляется при отрисовке. Русский вариант
 * раньше был зашит здесь, и на английском журнал оставался русским.
 */
export const ACTION_KEYS = [
  'item.created',
  'item.updated',
  'item.deleted',
  'store.created',
  'store.updated',
  'store.deleted',
  'warehouse.created',
  'warehouse.updated',
  'warehouse.deleted',
  'label_preset.created',
  'label_preset.updated',
  'label_preset.deleted',
  'label_list.created',
  'label_list.updated',
  'label_list.deleted',
  'category.created',
  'category.updated',
  'category.deleted',
  'property.created',
  'property.updated',
  'property.deleted',
  'property_group.created',
  'property_group.updated',
  'property_group.deleted',
  'dictionary.created',
  'dictionary.updated',
  'dictionary.deleted',
  'dictionary_value.created',
  'dictionary_value.updated',
  'dictionary_value.deleted',
  'unit.created',
  'unit.updated',
  'unit.deleted',
  'vendor.created',
  'vendor.updated',
  'vendor.deleted',
  'access_grant.created',
  'access_grant.updated',
  'access_grant.deleted',
  'user.created',
  'user.updated',
  'user.deleted',
  'operation.replenish',
  'operation.writeoff',
  'image.attached',
  'image.detached',
  'image.alt_updated',
  'image.reordered',
  'label.generate',
  'auth.login',
  'auth.logout',
  'item.restored',
  'store.restored',
  'warehouse.restored',
  'label_preset.restored',
  'label_list.restored',
  'user.restored',
  'category.restored',
  'property.restored',
  'property_group.restored',
  'dictionary.restored',
  'dictionary_value.restored',
  'unit.restored',
  'vendor.restored',
] as const

export const ENTITY_KEYS = [
  'item',
  'store',
  'warehouse',
  'label_preset',
  'label_list',
  'category',
  'property',
  'property_group',
  'dictionary',
  'dictionary_value',
  'unit',
  'vendor',
  'access_grant',
  'user',
  'none',
] as const

export function actionLabel(key: string | null): string {
  if (!key) return '—'

  const { t } = useI18n()

  // Неизвестное действие показываем его же, а не пустотой: так видно, что
  // сервер прислал событие, для которого подписи ещё нет.
  return t(`audit_actions.${key}` as TranslationKey)
}

export function entityLabel(key: string | null): string {
  if (!key) return '—'

  const { t } = useI18n()

  return t(`audit_entities.${key}` as TranslationKey)
}

/**
 * Переведённые карты подписей для графика.
 *
 * График принимает готовый объект «ключ → подпись» и не знает про i18n, поэтому
 * карты собираются здесь: обычным объектом они заморозились бы на русском.
 */
export function useAuditLabelMaps() {
  const { t } = useI18n()

  const actions = computed<Record<string, string>>(() =>
    Object.fromEntries(ACTION_KEYS.map((key) => [key, t(`audit_actions.${key}` as TranslationKey)])))

  const entities = computed<Record<string, string>>(() =>
    Object.fromEntries(ENTITY_KEYS.map((key) => [key, t(`audit_entities.${key}` as TranslationKey)])))

  return { actions, entities }
}

export function actionBadgeClass(action: string): string {
  if (action.includes('.deleted')) return 'badge--danger'
  // Восстановление проверяется раньше created: иначе оно зеленело бы вместе
  // с созданием, а это разные события — вернули из корзины или завели заново.
  if (action.includes('.restored')) return 'badge--restore'
  if (action.includes('.created')) return 'badge--success'
  if (action === 'auth.login' || action === 'auth.logout') return 'badge--auth'
  if (action.startsWith('operation.')) return 'badge--op'
  if (action.startsWith('label.')) return 'badge--label'
  return ''
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(useI18n().locale.value, {
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
  if (entry.action === 'label.generate' && p.count != null) return useI18n().t('audit_chart.labels_count', { count: p.count })
  if (entry.action === 'auth.login') return p.method ?? ''
  const changes = p.changes
  if (changes) {
    const keys = Object.keys(changes)
    return keys.length ? useI18n().t('audit_chart.changed', { fields: keys.slice(0, 3).join(', ') }) : ''
  }
  return ''
}