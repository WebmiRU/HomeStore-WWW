export function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

export function todayRange(): [string, string] {
  const to = startOfDay(new Date())
  return [isoLocal(to), isoLocal(to)]
}

function addMonths(d: Date, delta: number): Date {
  const total = d.getFullYear() * 12 + d.getMonth() + delta
  const year = Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(d.getDate(), lastDay)
  return new Date(year, month, day)
}

export function thisWeekRange(): [string, string] {
  const to = startOfDay(new Date())
  const dow = to.getDay()
  const diff = dow === 0 ? 6 : dow - 1
  const from = new Date(to)
  from.setDate(to.getDate() - diff)
  const end = new Date(from)
  end.setDate(from.getDate() + 6)
  return [isoLocal(from), isoLocal(end)]
}

export function currentMonthRange(): [string, string] {
  const to = new Date()
  const from = new Date(to.getFullYear(), to.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth() + 1, 0)
  return [isoLocal(from), isoLocal(end)]
}

export function currentYearRange(): [string, string] {
  const to = new Date()
  return [
    isoLocal(new Date(to.getFullYear(), 0, 1)),
    isoLocal(new Date(to.getFullYear(), 11, 31)),
  ]
}

export function lastNDaysRange(n: number): [string, string] {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - (n - 1))
  return [isoLocal(from), isoLocal(to)]
}

export function lastMonthsRange(n: number): [string, string] {
  const to = new Date()
  return [isoLocal(addMonths(to, -n)), isoLocal(to)]
}

export function lastYearsRange(n: number): [string, string] {
  const to = new Date()
  const from = new Date(to)
  from.setFullYear(to.getFullYear() - n)
  return [isoLocal(from), isoLocal(to)]
}

export type PeriodPreset = { label: string; range: () => [string, string] | null }

/**
 * Подписи периодов берутся из i18n, а не из строк здесь: список показывается
 * в выпадающих меню трёх страниц, и на английском он остался бы русским.
 */
export function defaultPeriodPresets(): PeriodPreset[] {
  const { t } = useI18n()

  return [
    { label: t('periods.today'), range: () => lastNDaysRange(1) },
    { label: t('periods.this_week'), range: thisWeekRange },
    { label: t('periods.this_month'), range: currentMonthRange },
    { label: t('periods.this_year'), range: currentYearRange },
    { label: t('periods.week'), range: () => lastNDaysRange(7) },
    { label: t('periods.month'), range: () => lastMonthsRange(1) },
    { label: t('periods.year'), range: () => lastYearsRange(1) },
    { label: t('periods.all_time'), range: () => null },
  ]
}