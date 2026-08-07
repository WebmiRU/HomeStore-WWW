import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'
import CodeModule from '~/repository/modules/code'
import ItemModule from '~/repository/modules/item'

interface IApiInstance {
  code: CodeModule
  item: ItemModule
}

export default defineNuxtPlugin(() => {
  // В dev-режиме запросы идут через Nuxt server proxy (/api/...),
  // в production — напрямую к API (если настроен reverse proxy на том же домене)
  const apiBaseUrl = '/api'

  const fetchOptions: FetchOptions = {
    baseURL: apiBaseUrl,
    onResponseError({ response }) {
      if (response.status === 422) {
        const body = response._data
        let message = 'Ошибка валидации'

        if (typeof body === 'string') {
          message = body
        } else if (body?.errors) {
          const errorMessages = Object.values(body.errors).flat()
          message = errorMessages.join('\n')
        } else if (body?.message) {
          message = body.message
        } else if (body?.error) {
          message = typeof body.error === 'string' ? body.error : JSON.stringify(body.error)
        } else if (body?.detail) {
          if (Array.isArray(body.detail)) {
            message = body.detail
              .map((err: { loc?: string[]; msg?: string; type?: string }) =>
                `${err.loc?.slice(1)?.join('.') || 'field'}: ${err.msg || err.type}`
              )
              .join('\n')
          } else {
            message = body.detail
          }
        }

        console.warn('API validation error:', message)
      }
    },
  }

  const apiFetcher = $fetch.create(fetchOptions)

  const modules: IApiInstance = {
    code: new CodeModule(apiFetcher),
    item: new ItemModule(apiFetcher),
  }

  return {
    provide: {
      api: modules,
    },
  }
})
