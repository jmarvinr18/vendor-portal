import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, errorMessage } from '@/services/ApiService'
import ExtractionApi from '@/services/api/invoice/extraction'
import type { ExtractableField, Extraction } from '@/schema'
import { useInvoiceStore } from './invoice'

export type EntryMode = 'manual' | 'scan'
export type ScanPhase = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'timeout'

/** An extracted value the vendor can edit and tag as an invoice field. */
export interface ScanRow {
  id: string
  value: string
  source: string
  entityType: string | null
  score: number | null
  field: ExtractableField | null
}

// OCR usually finishes in 5–30 seconds; poll quickly at first, then back off.
const POLL_DELAYS_MS = [1500, 2000, 2000, 3000, 3000, 5000]
const POLL_TIMEOUT_MS = 3 * 60_000

/**
 * "Scan invoice" entry mode: uploads a scanned invoice (POST /extractions), waits for the OCR
 * pipeline, and holds the extracted values while the vendor tags them. Uploading a scan is
 * the vendor's explicit request to read it; it does not create an invoice.
 */
export const useInvoiceScanStore = defineStore('invoiceScan', () => {
  const mode = ref<EntryMode>('manual')
  const phase = ref<ScanPhase>('idle')
  const file = ref<File | null>(null)
  const extraction = ref<Extraction | null>(null)
  const rows = ref<ScanRow[]>([])
  const error = ref<string | null>(null)
  /** Fields most recently filled from the scan (for the review note). */
  const appliedFields = ref<ExtractableField[]>([])

  let pollController: AbortController | null = null
  let pollTimer: ReturnType<typeof setTimeout> | undefined

  const busy = computed(() => phase.value === 'uploading' || phase.value === 'processing')

  function stopPolling() {
    clearTimeout(pollTimer)
    pollController?.abort()
    pollController = null
  }

  function onCompleted(result: Extraction) {
    extraction.value = result
    phase.value = 'completed'
    rows.value = result.candidates.map((c) => ({
      id: c.id,
      value: c.value,
      source: c.source,
      entityType: c.entityType,
      score: c.score,
      field: c.suggestedField,
    }))
    // The scan is the invoice itself, so it goes with the supporting documents.
    if (file.value) useInvoiceStore().setScannedInvoice(file.value)
  }

  function poll(id: string) {
    stopPolling()
    const controller = (pollController = new AbortController())
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let attempt = 0

    const tick = async () => {
      try {
        const { data } = await ExtractionApi.get(id, controller.signal)
        if (controller.signal.aborted) return
        if (data.status === 'completed') return onCompleted(data)
        if (data.status === 'failed') {
          extraction.value = data
          phase.value = 'failed'
          error.value = data.errorMessage ?? 'Text could not be extracted from this document.'
          return
        }
      } catch (e) {
        if (controller.signal.aborted) return
        // Keep polling through brief network problems; give up on anything else.
        if (!(e instanceof ApiError && (e.isNetworkError || e.status >= 500))) {
          phase.value = 'failed'
          error.value = errorMessage(e, 'The scan could not be checked.')
          return
        }
      }
      if (Date.now() > deadline) {
        phase.value = 'timeout'
        return
      }
      pollTimer = setTimeout(tick, POLL_DELAYS_MS[Math.min(attempt++, POLL_DELAYS_MS.length - 1)])
    }
    pollTimer = setTimeout(tick, POLL_DELAYS_MS[attempt++])
  }

  /** Uploads a scanned invoice and waits for its text. Replaces any previous scan. */
  async function scan(scanned: File) {
    await discard()
    file.value = scanned
    phase.value = 'uploading'
    try {
      const { data } = await ExtractionApi.upload(scanned)
      extraction.value = data
      phase.value = 'processing'
      poll(data.id)
    } catch (e) {
      phase.value = 'failed'
      error.value =
        e instanceof ApiError && e.messages.length
          ? e.messages.join(' ')
          : errorMessage(e, 'The scanned invoice could not be uploaded.')
    }
  }

  /** After a timeout: keep waiting for the same scan. */
  function keepWaiting() {
    if (!extraction.value) return
    phase.value = 'processing'
    poll(extraction.value.id)
  }

  /** Tags a row. A field can only come from one row, so it is taken off any other row. */
  function tag(rowId: string, field: ExtractableField | null) {
    for (const row of rows.value) {
      if (row.id === rowId) row.field = field
      else if (field && row.field === field) row.field = null
    }
  }

  function clearLocal() {
    stopPolling()
    phase.value = 'idle'
    file.value = null
    extraction.value = null
    rows.value = []
    error.value = null
    appliedFields.value = []
  }

  /** Removes the scan: deletes it on the server and takes it off the supporting documents. */
  async function discard() {
    const id = extraction.value?.id
    const hadScan = !!file.value
    clearLocal()
    if (hadScan) useInvoiceStore().setScannedInvoice(null)
    if (id) {
      try {
        await ExtractionApi.remove(id)
      } catch {
        // Best effort: unused scans also expire from S3 via a lifecycle rule.
      }
    }
  }

  /** Clears everything when the wizard is reset; the server copy is deleted in the background. */
  function reset() {
    const id = extraction.value?.id
    clearLocal()
    mode.value = 'manual'
    if (id) ExtractionApi.remove(id).catch(() => {})
  }

  return {
    mode,
    phase,
    file,
    extraction,
    rows,
    error,
    appliedFields,
    busy,
    scan,
    keepWaiting,
    tag,
    discard,
    reset,
  }
})
