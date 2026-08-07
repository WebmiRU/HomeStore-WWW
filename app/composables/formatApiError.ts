/**
 * Форматирует ошибку API (в т.ч. 422 от Laravel) в читаемое сообщение.
 * Laravel 422 имеет вид { message: "...", errors: { field: [msg, ...] } }
 */
export function formatApiError(err: any, fallback: string): string {
  const data = err?.data ?? err?.response?._data

  if (data?.errors && typeof data.errors === 'object') {
    const lines: string[] = []
    if (typeof data.message === 'string') {
      lines.push(data.message)
    }
    for (const [field, messages] of Object.entries(data.errors)) {
      const msgs = Array.isArray(messages) ? messages : [messages]
      lines.push(`${field}: ${msgs.join(', ')}`)
    }
    return lines.join('\n')
  }

  if (typeof data?.error === 'string') return data.error
  if (typeof data?.message === 'string') return data.message
  if (typeof err?.message === 'string') return err.message

  return fallback
}
