/** Cookie name for middleware session check. Must match middleware. */
export const AUTH_COOKIE_NAME = "tepal-access-token"

const MAX_AGE_DAYS = 7

export function setAuthCookie(accessToken: string): void {
  if (typeof document === "undefined") return
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(accessToken)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`
}
