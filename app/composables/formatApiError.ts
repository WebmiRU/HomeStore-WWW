/**
 * Форматирует ошибку API (в т.ч. 422 от Laravel) в читаемое сообщение.
 * Laravel 422 имеет вид { message: "...", errors: { field: [msg, ...] } }
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