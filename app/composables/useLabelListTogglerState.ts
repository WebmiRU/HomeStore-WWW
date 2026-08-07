/**
 * Shared state for LabelListToggler — ensures only one dropdown is open at a time.
 */
import { ref } from 'vue'

let uidCounter = 0
const activeUid = ref(0)

export function useLabelListTogglerState() {
  const uid = ++uidCounter

  return {
    uid,
    activeUid,
  }
}
