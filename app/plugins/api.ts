import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'
import AccessModule from '~/repository/modules/access'
import AuditLogModule from '~/repository/modules/auditLog'
import AuthModule from '~/repository/modules/auth'
import CategoryModule from '~/repository/modules/category'
import CodeModule from '~/repository/modules/code'
import DictionaryModule from '~/repository/modules/dictionary'
import ImageModule from '~/repository/modules/image'
import ItemModule from '~/repository/modules/item'
import LabelListModule from '~/repository/modules/labelList'
import LabelPresetModule from '~/repository/modules/labelPreset'
import OperationModule from '~/repository/modules/operation'
import PropertyGroupModule from '~/repository/modules/propertyGroup'
import PropertyModule from '~/repository/modules/property'
import StockOperationModule from '~/repository/modules/stockOperation'
import StoreModule from '~/repository/modules/store'
import UnitModule from '~/repository/modules/unit'
import UserProfileModule from '~/repository/modules/userProfile'
import WarehouseModule from '~/repository/modules/warehouse'

interface IApiInstance {
  access: AccessModule
  auditLog: AuditLogModule
  auth: AuthModule
  category: CategoryModule
  code: CodeModule
  dictionary: DictionaryModule
  item: ItemModule
  image: ImageModule
  labelList: LabelListModule
  labelPreset: LabelPresetModule
  operation: OperationModule
  property: PropertyModule
  propertyGroup: PropertyGroupModule
  stockOperation: StockOperationModule
  store: StoreModule
  unit: UnitModule
  userProfile: UserProfileModule
  warehouse: WarehouseModule
}

export default defineNuxtPlugin(() => {
  // В dev-режиме запросы идут через Nuxt server proxy (/api/...),
  // в production — напрямую к API (если настроен reverse proxy на том же домене)
  const apiBaseUrl = '/api'

  const isLoginRequest = (url?: string) => Boolean(url && url.endsWith('/login'))

  const fetchOptions: FetchOptions = {
    baseURL: apiBaseUrl,
    onRequest({ options, request }) {
      if (isLoginRequest(String(request))) {
        return
      }
      if (!import.meta.client) {
        return
      }
      const token = localStorage.getItem('home-store-token')
      if (token) {
        options.headers = {
          ...(options.headers as Record<string, string>),
          Authorization: `Bearer ${token}`,
        }
      }
    },
    onResponseError({ response, request }) {
      if (!import.meta.client || !response || response.status !== 401) {
        return
      }
      if (isLoginRequest(String(request))) {
        return
      }
      localStorage.removeItem('home-store-token')
      localStorage.removeItem('home-store-user-id')
      if (window.location.pathname !== '/login') {
        navigateTo('/login')
      }
    },
  }

  const apiFetcher = $fetch.create(fetchOptions)

  const modules: IApiInstance = {
    access: new AccessModule(apiFetcher),
    auditLog: new AuditLogModule(apiFetcher),
    auth: new AuthModule(apiFetcher),
    category: new CategoryModule(apiFetcher),
    code: new CodeModule(apiFetcher),
    dictionary: new DictionaryModule(apiFetcher),
    item: new ItemModule(apiFetcher),
    image: new ImageModule(apiFetcher),
    labelList: new LabelListModule(apiFetcher),
    labelPreset: new LabelPresetModule(apiFetcher),
    operation: new OperationModule(apiFetcher),
    property: new PropertyModule(apiFetcher),
    propertyGroup: new PropertyGroupModule(apiFetcher),
    stockOperation: new StockOperationModule(apiFetcher),
    store: new StoreModule(apiFetcher),
    unit: new UnitModule(apiFetcher),
    userProfile: new UserProfileModule(apiFetcher),
    warehouse: new WarehouseModule(apiFetcher),
  }

  return {
    provide: {
      api: modules,
    },
  }
})
