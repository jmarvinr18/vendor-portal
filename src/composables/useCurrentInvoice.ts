import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useInvoicesStore } from '@/stores/invoices'

/** The invoice named by the `:id` route param, once InvoiceDetailLayout has loaded it. */
export function useCurrentInvoice() {
  const route = useRoute()
  const store = useInvoicesStore()
  return computed(() => (store.current?.id === String(route.params.id) ? store.current : undefined))
}
