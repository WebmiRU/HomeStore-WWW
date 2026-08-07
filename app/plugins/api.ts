import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'
import CodeModule from '~/repository/modules/code'
import ItemModule from '~/repository/modules/item'
import LabelListModule from '~/repository/modules/labelList'
import LabelPresetModule from '~/repository/modules/labelPreset'
import StoreModule from '~/repository/modules/store'

interface IApiInstance {
  code: CodeModule
  item: ItemModule
  labelList: LabelListModule
  labelPreset: LabelPresetModule
  store: StoreModule
}

export default defineNuxtPlugin(() => {
  // В dev-режиме запросы идут через Nuxt server proxy (/api/...),
  // в production — напрямую к API (если настроен reverse proxy на том же домене)
  const apiBaseUrl = '/api'

  const fetchOptions: FetchOptions = {
    baseURL: apiBaseUrl,
  }

  const apiFetcher = $fetch.create(fetchOptions)

  const modules: IApiInstance = {
    code: new CodeModule(apiFetcher),
    item: new ItemModule(apiFetcher),
    labelList: new LabelListModule(apiFetcher),
    labelPreset: new LabelPresetModule(apiFetcher),
    store: new StoreModule(apiFetcher),
  }

  return {
    provide: {
      api: modules,
    },
  }
})
