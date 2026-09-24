/**
 * Форматирует ошибку API (в т.ч. 422 от Laravel) в читаемое сообщение.
 * Laravel 422 имеет вид { message: "...", errors: { field: [msg, ...] } }
 *
 * Для запросов с responseType:'blob' тело ошибки лежит в Blob, а не в JSON,
 * поэтому обрабатывается отдельной функцией readBlobApiError.
 */
export function formatApiError(err: any, fallback: string): string {
  const data = err?.data ?? err?.response?._data

  const text = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value : null

  if (data?.errors && typeof data.errors === 'object') {
    const lines: string[] = []
    const message = text(data.message)
    if (message) lines.push(message)
    for (const [field, messages] of Object.entries(data.errors)) {
      const msgs = Array.isArray(messages) ? messages : [messages]
      lines.push(`${field}: ${msgs.join(', ')}`)
    }
    return lines.length ? lines.join('\n') : fallback
  }

  return text(data?.error) ?? text(data?.message) ?? text(err?.message) ?? fallback
}

/**
 * Читает ошибку API для blob-запросов (responseType:'blob').
 * ofetch кладёт тело 4xx/5xx в Blob — преобразует его в JSON и форматирует.
 */
export async function readBlobApiError(err: any, fallback: string): Promise<string> {
  const data = err?.data ?? err?.response?._data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      const textOf = (value: unknown): string | null =>
        typeof value === 'string' && value.trim().length > 0 ? value : null
      return textOf(parsed?.error) ?? textOf(parsed?.message) ?? fallback
    } catch {
      return fallback
    }
  }
  return formatApiError(err, fallback)
}