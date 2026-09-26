export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  // В dev адрес бэкенда задаётся переменной окружения (по умолчанию — локальный
  // контейнер на 18080), в сборке — публичной конфигурацией для reverse proxy.
  const apiBaseUrl = import.meta.dev ? config.devApiBaseUrl : config.public.apiBaseUrl

  // event.context.params.path содержит остаток пути после /api/
  const path = event.context.params?.path ?? ''
  const query = getQuery(event)

  const url = `${apiBaseUrl}/${path}`

  const authorization = getHeader(event, 'authorization')
  const authHeaders = authorization ? { authorization } : {}

  try {
    if (event.method === 'GET' || event.method === 'HEAD') {
      return await $fetch(url, {
        method: event.method,
        query,
        headers: authHeaders,
      })
    }

    // Для не-GET запросов передаём тело как есть (важно для multipart/form-data)
    const contentType = getHeader(event, 'content-type')

    if (contentType?.startsWith('multipart/form-data')) {
      const rawBody = await readRawBody(event, false)
      return await $fetch(url, {
        method: event.method,
        query,
        body: rawBody,
        headers: { 'content-type': contentType, ...authHeaders },
      })
    }

    const rawBody = await readRawBody(event, 'utf-8')
    const body = rawBody && rawBody.length > 0 ? JSON.parse(rawBody) : undefined
    return await $fetch(url, {
      method: event.method,
      query,
      body,
      headers: authHeaders,
    })
  } catch (err: any) {
    const status = err.status || 500
    setResponseStatus(event, status)
    return err.data ?? { error: err.message || 'Internal Server Error', status }
  }
})