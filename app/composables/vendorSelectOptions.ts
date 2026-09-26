import type { VendorResponse } from '~/repository/modules/vendor'

export interface VendorSelectOption {
  id: number
  title: string
}

/**
 * Производители для селекта, по алфавиту.
 *
 * Сортировка делается здесь, а не доверивается серверу: порядок в селекте —
 * часть интерфейса, и опираться на порядок строк в ответе значило бы
 * сломать его любой правкой запроса. Сравнение через localeCompare с
 * русской локалью: сортировка кодовых точек ставит «Ё» после «Я», а не
 * между «Е» и «Ж», как в алфавите.
 */
export function vendorSelectOptions(vendors: VendorResponse[]): VendorSelectOption[] {
  return [...vendors]
    .map((vendor) => ({ id: vendor.id, title: vendor.title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
}
