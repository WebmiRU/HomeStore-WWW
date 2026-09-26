import type AccessModule from '../repository/modules/access'
import type AuditLogModule from '../repository/modules/auditLog'
import type AuthModule from '../repository/modules/auth'
import type CategoryModule from '../repository/modules/category'
import type CodeModule from '../repository/modules/code'
import type DictionaryModule from '../repository/modules/dictionary'
import type ImageModule from '../repository/modules/image'
import type ItemModule from '../repository/modules/item'
import type LabelListModule from '../repository/modules/labelList'
import type LabelPresetModule from '../repository/modules/labelPreset'
import type OperationModule from '../repository/modules/operation'
import type PropertyGroupModule from '../repository/modules/propertyGroup'
import type PropertyModule from '../repository/modules/property'
import type StoreModule from '../repository/modules/store'
import type UnitModule from '../repository/modules/unit'
import type UserProfileModule from '../repository/modules/userProfile'
import type WarehouseModule from '../repository/modules/warehouse'
import type { NotifyItem } from '../composables/useNotifyPool'

/** Набор модулей, который отдаёт плагин api.ts. */
interface ApiModules {
  access: AccessModule
  auditLog: AuditLogModule
  auth: AuthModule
  category: CategoryModule
  code: CodeModule
  dictionary: DictionaryModule
  image: ImageModule
  item: ItemModule
  labelList: LabelListModule
  labelPreset: LabelPresetModule
  operation: OperationModule
  property: PropertyModule
  propertyGroup: PropertyGroupModule
  store: StoreModule
  unit: UnitModule
  userProfile: UserProfileModule
  warehouse: WarehouseModule
}

declare module '#app' {
  interface NuxtApp {
    $api: ApiModules
    $notify: {
      items: Ref<NotifyItem[]>
      add: (message: string, options?: { type?: string; timer?: number }) => number
      remove: (id: number) => void
    }
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: ApiModules
  }
}

export {}
