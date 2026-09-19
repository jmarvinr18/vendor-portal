// vendor-portal-api: app/routes/reference_data.py (GET /vendors/me)
import ApiService from '../../ApiService'
import type { Vendor } from '@/schema'

export default {
  /** The vendor making the request. */
  me(signal?: AbortSignal) {
    return ApiService.get<Vendor>('vendors/me', { signal })
  },
}
