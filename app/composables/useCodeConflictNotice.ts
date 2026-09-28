/**
 * Уведомление о коллизиях по кодам — «сохранено, но такой же код есть у…».
 *
 * Дубли не запрещаются: один штрихкод на несколько экземпляров это норма, и
 * ругаться ошибкой было бы неверно. Но сказать про них надо, иначе о
 * совпадении узнаешь только при сканировании — когда предмета уже два.
 *
 * Показывается ограниченное число ссылок: коллизия бывает и на сотню
 * предметов, а уведомление на пол-экрана перекрывает всё остальное. Полный
 * список — на странице «Коды → Коллизии», туда и ведёт многоточие.
 */
import type { ItemResponse } from '~/repository/modules/item'

/** Сколько предметов перечисляем в уведомлении. */
const MAX_LINKS = 5

/** Уведомление живёт дольше обычного: пять ссылок и прочитать, и успеть нажать. */
const TIMER = 12

export function useCodeConflictNotice() {
  const { $notify } = useNuxtApp()
  const { t, tp } = useI18n()

  function notifyCodeConflicts(saved: ItemResponse) {
    const conflicts = saved.conflicts
    if (!conflicts) return

    const entries = Object.entries(conflicts)
    if (entries.length === 0) return

    // Коллизия у нескольких кодов перечисляется один раз: в уведомлении
    // важно, что предмет столкнулся с кем-то, а не сколько у него спорных
    // кодов. Сколько именно — видно в подписи.
    const items = entries
      .flatMap(([, list]) => list)
      .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)

    if (items.length === 0) return

    $notify.add(
      // Фразу берём по форме множественного числа: вместе со словом меняется и
      // сказуемое — «встречается» или «встречаются».
      tp('codes_plural.conflict', entries.length, {
        codes: tp('codes_plural.code_word', entries.length),
        items: tp('codes_plural.item_word', items.length),
      }),
      {
        type: 'warning',
        timer: TIMER,
        links: items.slice(0, MAX_LINKS).map((item) => ({
          label: item.title,
          to: `/items/${item.id}`,
        })),
        more: items.length > MAX_LINKS ? t('codes_plural.more', { count: items.length - MAX_LINKS }) : '',
      },
    )
  }

  return { notifyCodeConflicts }
}
