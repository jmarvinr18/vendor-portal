// vendor-portal-api: app/routes/document_extractions.py
import ApiService, { apiPath } from '../../ApiService'
import type { Extraction } from '@/schema'

// A 10MB scan can take a while on a slow connection.
const UPLOAD_TIMEOUT_MS = 2 * 60_000

export default {
  /**
   * POST /extractions — stores a scanned invoice in S3, which starts the OCR pipeline.
   * Returns a pending extraction; poll `get` until it is completed or failed.
   */
  upload(file: File) {
    const form = new FormData()
    form.append('file', file, file.name)
    return ApiService.post<Extraction>('extractions', form, { timeoutMs: UPLOAD_TIMEOUT_MS })
  },

  /** GET /extractions/{id} — status, text and candidate values once OCR has finished. */
  get(id: string, signal?: AbortSignal) {
    return ApiService.get<Extraction>(apiPath('extractions', id), { signal })
  },

  /** DELETE /extractions/{id} — discard the scan and its extracted text. */
  remove(id: string) {
    return ApiService.delete(apiPath('extractions', id))
  },
}
