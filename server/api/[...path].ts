export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiBaseUrl = import.meta.dev ? 'http://localhost' : config.public.apiBaseUrl

  // event.context.params.path содержит остаток пути после /api/
  const path = event.context.params?.path ?? ''
  const query = getQuery(event)

  const url = `${apiBaseUrl}/${path}`

  try {
    const data = await $fetch(url, {
      method: event.method,
      query,
    })
    return data
  } catch (err: any) {
    const status = err.status || 500
    setResponseStatus(event, status)
    return {
      error: err.message || 'Internal Server Error',
      status,
    }
  }
})
