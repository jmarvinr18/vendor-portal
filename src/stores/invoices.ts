import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError } from '@/services/ApiService'
import CommentApi from '@/services/api/invoice/comment'
import InvoiceApi from '@/services/api/invoice/invoice'
import type { Invoice, InvoiceListItem, InvoiceListQuery, InvoiceStatus } from '@/schema'

export interface ListFilters {
  search: string
  status: InvoiceStatus | ''
  dateFrom: string
  dateTo: string
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Invoice Status list and the invoice open on the detail pages. */
export const useInvoicesStore = defineStore('invoices', () => {
  // ----- List -----
  // UI state kept here so it survives visiting a detail page.
  const listState = reactive({
    filters: { search: '', status: '', dateFrom: '', dateTo: '' } as ListFilters,
    page: 1,
    pageSize: 10,
    selectedId: null as string | null,
  })
  const items = ref<InvoiceListItem[]>([])
  const total = ref(0)
  const pageCount = ref(1)
  const listLoading = ref(false)
  const listError = ref<ApiError | null>(null)
  let listController: AbortController | null = null

  async function fetchList() {
    // Only the latest request wins when filters change quickly.
    listController?.abort()
    const controller = (listController = new AbortController())
    listLoading.value = true
    listError.value = null
    const query: InvoiceListQuery = {
      ...listState.filters,
      page: listState.page,
      pageSize: listState.pageSize,
    }
    try {
      const { data: page } = await InvoiceApi.list(query, controller.signal)
      items.value = page.items
      total.value = page.total
      pageCount.value = page.pageCount
      listState.page = page.page
      if (!items.value.some((inv) => inv.id === listState.selectedId)) {
        listState.selectedId = items.value[0]?.id ?? null
      }
    } catch (error) {
      if (isAbort(error)) return
      listError.value =
        error instanceof ApiError ? error : new ApiError(0, 'Could not load invoices.')
    } finally {
      if (listController === controller) listLoading.value = false
    }
  }

  // ----- Detail -----
  const current = ref<Invoice | null>(null)
  const currentLoading = ref(false)
  const currentError = ref<ApiError | null>(null)

  async function fetchInvoice(id: string) {
    if (current.value?.id !== id) current.value = null
    currentLoading.value = true
    currentError.value = null
    try {
      current.value = (await InvoiceApi.get(id)).data
    } catch (error) {
      currentError.value =
        error instanceof ApiError ? error : new ApiError(0, 'Could not load the invoice.')
    } finally {
      currentLoading.value = false
    }
  }

  async function addComment(message: string) {
    if (!current.value) return
    const invoice = current.value
    const { data: comment } = await CommentApi.create(invoice.id, { message })
    invoice.comments.push(comment)
    invoice.commentCount += 1
    const listed = items.value.find((inv) => inv.id === invoice.id)
    if (listed) listed.commentCount += 1
  }

  return {
    listState,
    items,
    total,
    pageCount,
    listLoading,
    listError,
    fetchList,
    current,
    currentLoading,
    currentError,
    fetchInvoice,
    addComment,
  }
})
