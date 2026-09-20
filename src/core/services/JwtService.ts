// Holds the API access token once authentication exists (the API currently identifies the
// vendor with X-Vendor-Id instead). Kept in sessionStorage so it is cleared when the tab closes;
// prefer an HttpOnly cookie set by the server when real auth is added.
const ID_TOKEN_KEY = 'id_token' as const

/**
 * @description get token from storage
 */
export const getToken = (): string | null => {
  try {
    return window.sessionStorage.getItem(ID_TOKEN_KEY)
  } catch {
    return null
  }
}

/**
 * @description save token into storage
 */
export const saveToken = (token: string): void => {
  try {
    window.sessionStorage.setItem(ID_TOKEN_KEY, token)
  } catch {
    // Storage unavailable (private mode): the token only lives for this request cycle.
  }
}

/**
 * @description remove token from storage
 */
export const destroyToken = (): void => {
  try {
    window.sessionStorage.removeItem(ID_TOKEN_KEY)
  } catch {
    // Nothing to remove.
  }
}

export default { getToken, saveToken, destroyToken }
