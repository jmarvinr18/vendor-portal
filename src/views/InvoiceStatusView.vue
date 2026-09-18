<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useInvoicesStore } from '@/stores/invoices'
import { invoiceStatuses, statusInfo } from '@/data/invoices'
import { formatCurrency, formatDate, formatIsoDateTime } from '@/utils/format'
import { useInvoiceFiles } from '@/composables/useInvoiceFiles'
import StatusBadge from '@/components/StatusBadge.vue'
import StatusTimelineMini from '@/components/StatusTimelineMini.vue'

const store = useInvoicesStore()
const { invoices, listState } = storeToRefs(store)
const { downloadSummary } = useInvoiceFiles()

const pageSizes = [5, 10, 20, 50]

// Edited in the filter bar; applied to the list only on Search / Enter.
const draft = reactive({ ...listState.value.filters })

function applyFilters() {
  if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
    ;[draft.dateFrom, draft.dateTo] = [draft.dateTo, draft.dateFrom]
  }
  listState.value.filters = { ...draft }
  listState.value.page = 1
}

function resetFilters() {
  Object.assign(draft, { search: '', status: '', dateFrom: '', dateTo: '' })
  applyFilters()
}

const filtered = computed(() => {
  const { search, status, dateFrom, dateTo } = listState.value.filters
  const term = search.trim().toLowerCase()
  return invoices.value
    .filter((inv) => {
      if (status && inv.status !== status) return false
      if (dateFrom && inv.invoiceDate < dateFrom) return false
      if (dateTo && inv.invoiceDate > dateTo) return false
      if (!term) return true
      return [inv.invoiceNo, inv.poPrNo, inv.description].some((v) =>
        v.toLowerCase().includes(term),
      )
    })
    .sort(
      (a, b) =>
        b.invoiceDate.localeCompare(a.invoiceDate) ||
        (b.submittedOn ?? '').localeCompare(a.submittedOn ?? ''),
    )
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / listState.value.pageSize)),
)
const pageItems = computed(() => {
  const start = (listState.value.page - 1) * listState.value.pageSize
  return filtered.value.slice(start, start + listState.value.pageSize)
})
const rangeLabel = computed(() => {
  const total = filtered.value.length
  if (!total) return 'No invoices found'
  const start = (listState.value.page - 1) * listState.value.pageSize + 1
  const end = start + pageItems.value.length - 1
  return `Showing ${start} to ${end} of ${total} invoices`
})

// Up to five page buttons centred on the current page.
const pageNumbers = computed(() => {
  const total = pageCount.value
  const current = listState.value.page
  const start = Math.max(1, Math.min(current - 2, total - 4))
  return Array.from({ length: Math.min(5, total) }, (_, i) => start + i)
})

function goTo(page: number) {
  listState.value.page = Math.min(Math.max(page, 1), pageCount.value)
}

watchEffect(() => {
  if (listState.value.page > pageCount.value) listState.value.page = pageCount.value
  // Keep a visible invoice selected for the overview panel.
  if (!pageItems.value.some((inv) => inv.id === listState.value.selectedId)) {
    listState.value.selectedId = pageItems.value[0]?.id ?? null
  }
})

const selected = computed(() =>
  listState.value.selectedId ? store.getById(listState.value.selectedId) : undefined,
)
</script>

<template>
  <div>
    <h1 class="page-title">Invoice Status</h1>
    <p class="section-subtitle mb-4">Track the real-time status and progress of your invoices.</p>

    <form class="vp-card filter-bar mb-4" @submit.prevent="applyFilters">
      <div class="row g-3 align-items-end">
        <div class="col-lg-4">
          <label for="search" class="form-label visually-hidden">Search</label>
          <div class="search-box">
            <input
              id="search"
              v-model="draft.search"
              type="search"
              class="form-control"
              placeholder="Search by invoice no., PO/PR no., or description"
            />
            <i class="bi bi-search"></i>
          </div>
        </div>
        <div class="col-sm-4 col-lg-2">
          <label for="statusFilter" class="form-label">Status</label>
          <select id="statusFilter" v-model="draft.status" class="form-select">
            <option value="">All Statuses</option>
            <option v-for="status in invoiceStatuses" :key="status">{{ status }}</option>
          </select>
        </div>
        <div class="col-sm-4 col-lg-2">
          <label for="dateFrom" class="form-label">Date From</label>
          <input id="dateFrom" v-model="draft.dateFrom" type="date" class="form-control" />
        </div>
        <div class="col-sm-4 col-lg-2">
          <label for="dateTo" class="form-label">Date To</label>
          <input id="dateTo" v-model="draft.dateTo" type="date" class="form-control" />
        </div>
        <div class="col-lg-2 d-flex gap-2 justify-content-lg-end">
          <button
            type="button"
            class="btn btn-outline-vp flex-fill flex-lg-grow-0"
            @click="resetFilters"
          >
            Reset
          </button>
          <button type="submit" class="btn btn-gold flex-fill flex-lg-grow-0">Search</button>
        </div>
      </div>
    </form>

    <div class="row g-4">
      <div class="col-xl-7">
        <div class="vp-card p-0 h-100 d-flex flex-column">
          <div class="table-responsive flex-grow-1">
            <table class="table invoice-table mb-0">
              <thead>
                <tr>
                  <th scope="col">Invoice No.</th>
                  <th scope="col">Invoice Date</th>
                  <th scope="col">PO/PR No.</th>
                  <th scope="col">Description</th>
                  <th scope="col" class="text-end">Invoice Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="inv in pageItems"
                  :key="inv.id"
                  :class="{ selected: inv.id === listState.selectedId }"
                  :aria-selected="inv.id === listState.selectedId"
                  tabindex="0"
                  @click="listState.selectedId = inv.id"
                  @keydown.enter="listState.selectedId = inv.id"
                >
                  <td>
                    <RouterLink
                      :to="{ name: 'invoice-details', params: { id: inv.id } }"
                      class="invoice-link"
                      @click.stop
                      >{{ inv.invoiceNo }}</RouterLink
                    >
                  </td>
                  <td class="text-nowrap">{{ formatDate(inv.invoiceDate) }}</td>
                  <td class="text-nowrap">{{ inv.poPrNo || '—' }}</td>
                  <td class="description-cell" :title="inv.description">
                    <span>{{ inv.description }}</span>
                  </td>
                  <td class="text-end text-nowrap">{{ formatCurrency(inv.invoiceAmount) }}</td>
                  <td><StatusBadge :status="inv.status" /></td>
                </tr>
                <tr v-if="!pageItems.length">
                  <td colspan="6" class="text-center text-body-secondary py-5">
                    No invoices match your filters.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="table-footer">
            <span class="small text-body-secondary">{{ rangeLabel }}</span>
            <div class="d-flex flex-wrap align-items-center gap-3">
              <nav aria-label="Invoice pages">
                <ul class="pagination pagination-sm vp-pagination mb-0">
                  <li class="page-item" :class="{ disabled: listState.page === 1 }">
                    <button class="page-link" aria-label="First page" @click="goTo(1)">
                      <i class="bi bi-chevron-bar-left"></i>
                    </button>
                  </li>
                  <li class="page-item" :class="{ disabled: listState.page === 1 }">
                    <button
                      class="page-link"
                      aria-label="Previous page"
                      @click="goTo(listState.page - 1)"
                    >
                      <i class="bi bi-chevron-left"></i>
                    </button>
                  </li>
                  <li
                    v-for="n in pageNumbers"
                    :key="n"
                    class="page-item"
                    :class="{ active: n === listState.page }"
                  >
                    <button
                      class="page-link"
                      :aria-current="n === listState.page ? 'page' : undefined"
                      @click="goTo(n)"
                    >
                      {{ n }}
                    </button>
                  </li>
                  <li class="page-item" :class="{ disabled: listState.page === pageCount }">
                    <button
                      class="page-link"
                      aria-label="Next page"
                      @click="goTo(listState.page + 1)"
                    >
                      <i class="bi bi-chevron-right"></i>
                    </button>
                  </li>
                  <li class="page-item" :class="{ disabled: listState.page === pageCount }">
                    <button class="page-link" aria-label="Last page" @click="goTo(pageCount)">
                      <i class="bi bi-chevron-bar-right"></i>
                    </button>
                  </li>
                </ul>
              </nav>
              <select
                v-model.number="listState.pageSize"
                class="form-select form-select-sm page-size"
                aria-label="Invoices per page"
                @change="listState.page = 1"
              >
                <option v-for="size in pageSizes" :key="size" :value="size">
                  {{ size }} / page
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="col-xl-5">
        <aside v-if="selected" class="vp-card overview h-100">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="section-title mb-0">Invoice Overview</h2>
            <button
              type="button"
              class="btn btn-outline-vp btn-sm"
              @click="downloadSummary(selected)"
            >
              <i class="bi bi-download me-1"></i>Download
            </button>
          </div>

          <dl class="overview-grid">
            <dt>Invoice No.</dt>
            <dd>{{ selected.invoiceNo }}</dd>
            <dt>Invoice Amount</dt>
            <dd class="text-end">{{ formatCurrency(selected.invoiceAmount) }}</dd>
            <dt>Invoice Date</dt>
            <dd>{{ formatDate(selected.invoiceDate) }}</dd>
            <dt>Credit Terms</dt>
            <dd class="text-end">{{ selected.creditTerms }}</dd>
            <dt>Vendor</dt>
            <dd>{{ selected.vendorName }}</dd>
            <dt>Date Received</dt>
            <dd class="text-end">{{ formatDate(selected.dateReceived) }}</dd>
            <dt>PO/PR No.</dt>
            <dd>{{ selected.poPrNo || '—' }}</dd>
            <dt>Submitted On</dt>
            <dd class="text-end">{{ formatIsoDateTime(selected.submittedOn) }}</dd>
            <dt>Description</dt>
            <dd class="span-3">{{ selected.description }}</dd>
          </dl>

          <hr />

          <div class="d-flex align-items-center gap-2 mb-1">
            <h3 class="fs-6 fw-bold mb-0">Current Status</h3>
            <StatusBadge :status="selected.status" />
          </div>
          <p class="small text-body-secondary mb-4">{{ statusInfo[selected.status].message }}</p>

          <h3 class="fs-6 fw-bold mb-3">Status Timeline</h3>
          <StatusTimelineMini :invoice="selected" />

          <div class="d-flex flex-wrap gap-2 mt-4 pt-3 border-top">
            <RouterLink
              :to="{ name: 'invoice-details', params: { id: selected.id } }"
              class="btn btn-gold btn-sm"
            >
              View Details
            </RouterLink>
            <RouterLink
              :to="{ name: 'invoice-timeline', params: { id: selected.id } }"
              class="btn btn-outline-vp btn-sm"
            >
              Status Timeline
            </RouterLink>
            <RouterLink
              :to="{ name: 'invoice-comments', params: { id: selected.id } }"
              class="btn btn-outline-vp btn-sm"
            >
              Comments
              <span v-if="selected.comments.length" class="badge text-bg-light ms-1">{{
                selected.comments.length
              }}</span>
            </RouterLink>
          </div>
        </aside>
        <div v-else class="vp-card h-100 d-grid place-items-center text-body-secondary text-center">
          Select an invoice to see its overview.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-box {
  position: relative;
}

.search-box .form-control {
  padding-right: 2.5rem;
}

.search-box .bi-search {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--vp-muted);
  pointer-events: none;
}

.invoice-table {
  font-size: 0.8125rem;
  --bs-table-bg: transparent;
}

.invoice-table th {
  font-weight: 600;
  color: var(--vp-text);
  padding: 1rem 0.5rem;
  white-space: nowrap;
  border-bottom-color: var(--vp-border);
}

.invoice-table td {
  padding: 0.75rem 0.5rem;
  vertical-align: middle;
  border-bottom-color: var(--vp-border);
}

.invoice-table th:first-child,
.invoice-table td:first-child {
  padding-left: 1.25rem;
}

.invoice-table tbody tr {
  cursor: pointer;
}

.invoice-table tbody tr:hover td {
  background: #f7f9fc;
}

.invoice-table tbody tr.selected td {
  background: #e8eef7;
  box-shadow:
    inset 0 1px 0 #b9c9e0,
    inset 0 -1px 0 #b9c9e0;
}

.invoice-table tbody tr:focus-visible {
  outline: 2px solid var(--vp-gold);
  outline-offset: -2px;
}

.invoice-link {
  color: var(--vp-text);
  text-decoration: none;
  white-space: nowrap;
}

.invoice-link:hover {
  color: var(--bs-link-color);
  text-decoration: underline;
}

.description-cell {
  min-width: 140px;
}

.description-cell > span {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.table-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--vp-border);
}

.vp-pagination {
  --bs-pagination-color: var(--vp-text);
  --bs-pagination-border-color: #cdd2d9;
  --bs-pagination-hover-color: var(--vp-text);
  --bs-pagination-hover-bg: #f1f3f6;
  --bs-pagination-focus-box-shadow: 0 0 0 0.2rem rgba(244, 180, 58, 0.25);
  --bs-pagination-active-bg: var(--vp-navy);
  --bs-pagination-active-border-color: var(--vp-navy);
  --bs-pagination-disabled-color: #aeb4bd;
  gap: 0.375rem;
}

.vp-pagination .page-link {
  border-radius: 0.3rem !important;
  min-width: 32px;
  text-align: center;
}

.page-size {
  width: auto;
}

.overview-grid {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 0.625rem 1rem;
  font-size: 0.8125rem;
  margin: 0;
}

.overview-grid dt {
  font-weight: 400;
  color: var(--vp-muted);
  white-space: nowrap;
}

.overview-grid dd {
  margin: 0;
}

.overview-grid .span-3 {
  grid-column: span 3;
}

.place-items-center {
  place-items: center;
}

@media (max-width: 575.98px) {
  .overview-grid {
    grid-template-columns: auto 1fr;
  }

  .overview-grid .span-3 {
    grid-column: auto;
  }

  .overview-grid dd.text-end {
    text-align: left !important;
  }
}
</style>
