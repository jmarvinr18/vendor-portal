import type { App } from 'vue'
import JwtService from '@/core/services/JwtService'
import router from '@/router'

/**
 * @description service to call HTTP requests via the browser's native `fetch`
 * (replaces axios / vue-axios: no third-party HTTP library in the supply chain).
 *
 * Keeps the axios-style surface (`ApiService.get(...)` resolving to `{ data, status, headers }`)
 * with safer defaults:
 * - Requests can only target the configured API base URL. Resources are relative
 *   ('invoices', 'invoices/<id>'); absolute URLs, protocol-relative URLs and '..' are rejected,
 *   so the Authorization / X-Vendor-Id headers never leave the API origin.
 * - Redirects are rejected (`redirect: 'error'`) instead of being followed with our headers.
 * - Cookies are only sent to the same origin (`credentials: 'same-origin'`).
 * - Every request has a timeout (15s default) and accepts an AbortSignal.
 * - Responses are only parsed as JSON when the server says they are JSON.
 */

export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue>

export interface ApiRequestConfig {
  /** Query-string parameters; empty values are skipped. */
  params?: Query
  signal?: AbortSignal
  timeoutMs?: number
  /** How to read a successful response. Defaults to 'json'. */
  responseType?: 'json' | 'blob'
}

export interface ApiResponse<T> {
  data: T
  status: number
  headers: Headers
}

/** An error response from the API, or a network / timeout failure (status 0). */
export class ApiError extends Error {
  readonly status: number
  /** First message per field, e.g. { invoiceNo: 'Invoice number is required.' }. */
  readonly fieldErrors: Record<string, string>
  /** Every message the server sent, flattened (e.g. per-file upload problems). */
  readonly messages: string[]

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
    messages: string[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.messages = messages
  }

  get isNetworkError() {
    return this.status === 0
  }
}

/** Joins URI-encoded path segments into a relative resource: apiPath('invoices', id). */
export function apiPath(...segments: (string | number)[]): string {
  return segments.map((s) => encodeURIComponent(String(s))).join('/')
}

/** A user-facing message for any error thrown by the API modules. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  return error instanceof ApiError ? error.message : fallback
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_API_BASE = '/api/v1'
const VALIDATION_LOCATIONS = ['json', 'query', 'form', 'files', 'headers', 'cookies', 'path']

/**
 * The base every API resource resolves against.
 *
 * `VITE_APP_API_URL` is normally a path ('/api/v1'), so it resolves against the page's own
 * origin: the browser makes a same-origin request that the Vite dev proxy (and nginx in the
 * Docker image) forwards to the Flask API, so no CORS preflight is ever involved. Pointing
 * this at the proxy *target* instead (http://localhost:8000) is what makes the browser call
 * the API cross-origin and get blocked by CORS.
 *
 * An absolute URL is still honoured for deployments that genuinely serve the API from another
 * origin — that API has to send the CORS headers itself.
 */
function resolveBaseUrl(): URL {
  const configured = import.meta.env.VITE_APP_API_URL?.trim() || DEFAULT_API_BASE
  // Trailing slash so relative resources resolve under the base path.
  return new URL(configured.replace(/\/*$/, '/'), window.location.origin)
}

/**
 * flask-smorest errors look like { code, status, message?, errors? } where `errors` is either
 * { json: { field: [msg] } } (request validation), { field: msg } (business rules) or
 * { files: [msg, ...] } (upload problems).
 */
function flattenErrors(errors: unknown, fieldErrors: Record<string, string>, messages: string[]) {
  if (!errors || typeof errors !== 'object') return
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const isLocation = VALIDATION_LOCATIONS.includes(key)
    if (isLocation && value && typeof value === 'object' && !Array.isArray(value)) {
      flattenErrors(value, fieldErrors, messages)
      continue
    }
    const list = (Array.isArray(value) ? value : [value]).filter(
      (v): v is string => typeof v === 'string',
    )
    if (list.length) {
      fieldErrors[key] ??= list[0]!
      messages.push(...list)
    }
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || `Request failed (${response.status})`
  const fieldErrors: Record<string, string> = {}
  const messages: string[] = []
  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await response.json()
      if (typeof body?.message === 'string') message = body.message
      else if (typeof body?.status === 'string') message = body.status
      flattenErrors(body?.errors, fieldErrors, messages)
    } catch {
      // Keep the status text.
    }
  }
  if (response.status === 422 && message === 'Unprocessable Entity') {
    message = 'Some fields are invalid.'
  }
  return new ApiError(response.status, message, fieldErrors, messages)
}

class ApiService {
  /**
   * @description property to share vue instance
   */
  public static vueInstance: App

  private static baseURL = resolveBaseUrl()
  private static headers = new Headers({ Accept: 'application/json' })

  /**
   * @description initialize the API base URL and default headers
   */
  public static init(app: App<Element>) {
    ApiService.vueInstance = app
    ApiService.baseURL = resolveBaseUrl()

    // Placeholder for real authentication: the API identifies the vendor by this header.
    // Development only — anything in a VITE_ variable is visible in the browser bundle.
    const vendorId = import.meta.env.VITE_VENDOR_ID?.trim()
    if (vendorId) ApiService.headers.set('X-Vendor-Id', vendorId)
    ApiService.setHeader()
  }

  /**
   * @description set the default HTTP request headers
   */
  public static setHeader(): void {
    const token = JwtService.getToken()
    if (token) ApiService.headers.set('Authorization', `Bearer ${token}`)
    else ApiService.headers.delete('Authorization')
    ApiService.headers.set('Accept', 'application/json')
  }

  /**
   * @description send the GET HTTP request with query parameters
   */
  public static query<T>(resource: string, config?: ApiRequestConfig) {
    return ApiService.request<T>('GET', resource, undefined, config)
  }

  /**
   * @description send the GET HTTP request
   */
  public static get<T>(resource: string, config?: ApiRequestConfig) {
    return ApiService.request<T>('GET', resource, undefined, config)
  }

  /**
   * @description send the POST HTTP request (JSON, or multipart when given FormData)
   */
  public static post<T>(resource: string, params?: unknown, config?: ApiRequestConfig) {
    return ApiService.request<T>('POST', resource, params, config)
  }

  /**
   * @description send the PATCH HTTP request
   */
  public static patch<T>(resource: string, params?: unknown, config?: ApiRequestConfig) {
    return ApiService.request<T>('PATCH', resource, params, config)
  }

  /**
   * @description send the UPDATE (PUT resource/slug) HTTP request
   */
  public static update<T>(resource: string, slug: string, params?: unknown) {
    return ApiService.request<T>('PUT', `${resource}/${encodeURIComponent(slug)}`, params)
  }

  /**
   * @description send the PUT HTTP request
   */
  public static put<T>(resource: string, params?: unknown, config?: ApiRequestConfig) {
    return ApiService.request<T>('PUT', resource, params, config)
  }

  /**
   * @description send the DELETE HTTP request
   */
  public static delete<T = void>(resource: string, config?: ApiRequestConfig) {
    return ApiService.request<T>('DELETE', resource, undefined, config)
  }

  /**
   * @description POST that reads a `text/event-stream` response
   *
   * Calls `onEvent` for every server-sent event as it arrives. Resolves when the stream ends.
   * The timeout covers the wait for the response only — once the server starts answering, a
   * long reply is fine; pass `config.signal` to let the caller stop it.
   */
  public static async postStream(
    resource: string,
    params: unknown,
    onEvent: (name: string, data: unknown) => void,
    config: ApiRequestConfig = {},
  ): Promise<unknown | undefined> {
    const headers = new Headers(ApiService.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('Accept', 'text/event-stream')

    const timeout = AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const signal = config.signal ? AbortSignal.any([config.signal, timeout]) : timeout

    let response: Response
    try {
      response = await fetch(ApiService.buildUrl(resource, config.params), {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal,
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
      })
    } catch (error) {
      if (config.signal?.aborted) throw error
      throw new ApiError(
        0,
        timeout.aborted
          ? 'The server took too long to respond. Please try again.'
          : 'Unable to reach the server. Check your connection and try again.',
      )
    }

    if (!response.ok) {
      const error = await toApiError(response)
      if (response.status === 401) ApiService.onUnauthorized()
      throw error
    }
    const contentType = response.headers.get('content-type') ?? ''
    // An endpoint (or a proxy) that answers with the whole body instead of a stream: hand it
    // back so the caller can use it as a complete response.
    if (contentType.includes('application/json')) return await response.json()
    if (!response.body || !contentType.includes('text/event-stream')) {
      throw new ApiError(response.status, 'Unexpected response from the server.')
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += value
        // Events are separated by a blank line; keep the unfinished tail for the next chunk.
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() ?? ''
        for (const block of blocks) ApiService.emitEvent(block, onEvent)
      }
      if (buffer.trim()) ApiService.emitEvent(buffer, onEvent)
    } finally {
      reader.cancel().catch(() => {})
    }
  }

  private static emitEvent(block: string, onEvent: (name: string, data: unknown) => void) {
    let name = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) name = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (!data.length) return
    const raw = data.join('\n')
    try {
      onEvent(name, JSON.parse(raw))
    } catch {
      onEvent(name, raw)
    }
  }

  private static buildUrl(resource: string, params?: Query): URL {
    if (/^[a-z][a-z\d+.-]*:/i.test(resource) || resource.startsWith('//')) {
      throw new Error(`API resources must be relative to the API base: ${resource}`)
    }
    const relative = resource.replace(/^\/+/, '')
    if (relative.split(/[/?#]/).some((segment) => segment === '..' || segment === '.')) {
      throw new Error(`Invalid API resource: ${resource}`)
    }
    const url = new URL(relative, ApiService.baseURL)
    if (url.origin !== ApiService.baseURL.origin) {
      throw new Error('Refusing to call a different origin.')
    }
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
    return url
  }

  private static async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    resource: string,
    params?: unknown,
    config: ApiRequestConfig = {},
  ): Promise<ApiResponse<T>> {
    const headers = new Headers(ApiService.headers)
    let body: BodyInit | undefined
    if (params instanceof FormData) {
      body = params // The browser sets the multipart boundary.
    } else if (params !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(params)
    }

    const timeout = AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    const signal = config.signal ? AbortSignal.any([config.signal, timeout]) : timeout

    let response: Response
    try {
      response = await fetch(ApiService.buildUrl(resource, config.params), {
        method,
        headers,
        body,
        signal,
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
      })
    } catch (error) {
      if (config.signal?.aborted) throw error // Cancelled by the caller: let them ignore it.
      throw new ApiError(
        0,
        timeout.aborted
          ? 'The server took too long to respond. Please try again.'
          : 'Unable to reach the server. Check your connection and try again.',
      )
    }

    if (!response.ok) {
      const error = await toApiError(response)
      if (response.status === 401) ApiService.onUnauthorized()
      throw error
    }

    let data: unknown
    if (response.status === 204) {
      data = undefined
    } else if (config.responseType === 'blob') {
      data = await response.blob()
    } else if (response.headers.get('content-type')?.includes('application/json')) {
      data = await response.json()
    } else {
      throw new ApiError(response.status, 'Unexpected response from the server.')
    }
    return { data: data as T, status: response.status, headers: response.headers }
  }

  /** Sends the user to sign in, once a sign-in page exists (avoids a redirect loop until then). */
  private static onUnauthorized() {
    JwtService.destroyToken()
    ApiService.setHeader()
    if (router.hasRoute('sign-in') && router.currentRoute.value.name !== 'sign-in') {
      router.push({ name: 'sign-in' })
    }
  }
}

export default ApiService
