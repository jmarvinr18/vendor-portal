// vendor-portal-api: app/routes/reference_data.py (GET /reference-data)
import ApiService from '../../ApiService'
import type { ReferenceData } from '@/schema'

export default {
  /** Dropdown options, statuses, stages and upload rules. */
  get(signal?: AbortSignal) {
    return ApiService.get<ReferenceData>('reference-data', { signal })
  },
}
