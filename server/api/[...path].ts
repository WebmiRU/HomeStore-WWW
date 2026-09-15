export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiBaseUrl = import.meta.dev ? 'http://localhost' : config.public.apiBaseUrl

  // event.context.params.path содержит остаток пути после /api/
  const path = event.context.params?.path ?? ''
  const query = getQuery(event)

  const url = `${apiBaseUrl}/${path}`

  try {
    if (event.method === 'GET' || event.method === 'HEAD') {
      return await $fetch(url, {
        method: event.method,
        query,
      })
    }

    // Для не-GET запросов передаём тело как есть (важно для multipart/form-data)
    const contentType = getHeader(event, 'content-type')

    if (contentType?.startsWith('multipart/form-data')) {
      const rawBody = await readRawBody(event, false)
      return await $fetch.raw(url, {
        method: event.method,
        query,
        body: rawBody,
        headers: { 'content-type': contentType },
      }).then((r) => r._data)
    }

    const rawBody = await readRawBody(event, 'utf-8')
    const body = rawBody && rawBody.length > 0 ? JSON.parse(rawBody) : undefined
    return await $fetch(url, {
      method: event.method,
      query,
      body,
    })
  } catch (err: any) {
    const status = err.status || 500
    setResponseStatus(event, status)
    return err.data ?? { error: err.message || 'Internal Server Error', status }
  }
})