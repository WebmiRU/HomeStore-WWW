export function useThumbnail() {
  const config = useRuntimeConfig()

  function apiOrigin(): string {
    const base = String(config.public.apiBaseUrl ?? '')
    if (import.meta.dev && import.meta.client) {
      return `${window.location.protocol}//${window.location.hostname}`
    }
    return base.replace(/\/+$/, '')
  }

  function thumbUrl(sha256: string | null | undefined, key: string): string | null {
    if (!sha256) return null
    return `${apiOrigin()}/image/${key}/${sha256}`
  }

  return { apiOrigin, thumbUrl }
}
