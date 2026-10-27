type RefreshTokenStore = {
  get(): Promise<string | null>
  set(token: string): Promise<void>
  clear(): Promise<void>
}

let store: RefreshTokenStore = {
  get: async () => null,
  set: async () => undefined,
  clear: async () => undefined,
}

export function configureRefreshTokenStore(next: RefreshTokenStore): void {
  store = next
}

export function getStoredRefreshToken(): Promise<string | null> {
  return store.get()
}

export function setStoredRefreshToken(token: string): Promise<void> {
  return store.set(token)
}

export function clearStoredRefreshToken(): Promise<void> {
  return store.clear()
}
