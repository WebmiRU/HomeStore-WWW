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

    const codeWord = countWord(entries.length, 'код', 'кода', 'кодов')

    $notify.add(
      `Сохранено, но ${codeWord} встречается ещё у ${countWord(items.length, 'предмета', 'предметов', 'предметов')}`,
      {
        type: 'warning',
        timer: TIMER,
        links: items.slice(0, MAX_LINKS).map((item) => ({
          label: item.title,
          to: `/items/${item.id}/edit`,
        })),
        more: items.length > MAX_LINKS ? `…и ещё ${items.length - MAX_LINKS}` : '',
      },
    )
  }

  /** Русское склонение по числу: 1 код, 2 кода, 5 кодов. */
  function countWord(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10
    const mod100 = n % 100
    const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many
    return `${n} ${word}`
  }

  return { notifyCodeConflicts }
}
