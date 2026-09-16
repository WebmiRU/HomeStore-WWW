import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'
import CodeModule from '~/repository/modules/code'
import ImageModule from '~/repository/modules/image'
import ItemModule from '~/repository/modules/item'
import LabelListModule from '~/repository/modules/labelList'
import LabelPresetModule from '~/repository/modules/labelPreset'
import OperationModule from '~/repository/modules/operation'
import StoreModule from '~/repository/modules/store'
import UserProfileModule from '~/repository/modules/userProfile'
import WarehouseModule from '~/repository/modules/warehouse'

interface IApiInstance {
  code: CodeModule
  item: ItemModule
  image: ImageModule
  labelList: LabelListModule
  labelPreset: LabelPresetModule
  operation: OperationModule
  store: StoreModule
  userProfile: UserProfileModule
  warehouse: WarehouseModule
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
    image: new ImageModule(apiFetcher),
    labelList: new LabelListModule(apiFetcher),
    labelPreset: new LabelPresetModule(apiFetcher),
    operation: new OperationModule(apiFetcher),
    store: new StoreModule(apiFetcher),
    userProfile: new UserProfileModule(apiFetcher),
    warehouse: new WarehouseModule(apiFetcher),
  }

  return {
    provide: {
      api: modules,
    },
  }
})
