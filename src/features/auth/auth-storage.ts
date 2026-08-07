const refreshTokenKey = "devhub.refresh-token"

export function clearStoredRefreshToken() {
  try {
    window.localStorage.removeItem(refreshTokenKey)
  } catch {
    // Storage can be unavailable in privacy modes; there is nothing else to clear.
  }
}
