import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useInvoicesStore } from '@/stores/invoices'

/** The invoice named by the `:id` route param. */
export function useCurrentInvoice() {
  const route = useRoute()
  const store = useInvoicesStore()
  return computed(() => store.getById(String(route.params.id)))
}
