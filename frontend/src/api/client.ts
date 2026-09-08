export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message?: string) {
    super(message ?? code)
    this.status = status
    this.code = code
  }
}

type TokenGetter = () => Promise<string | null>

let tokenGetter: TokenGetter = async () => null
let activeRequestCount = 0
const activityListeners = new Set<(count: number) => void>()
const GET_CACHE_MS = 30_000
const getCache = new Map<string, { loadedAt: number; value: unknown }>()
const pendingGets = new Map<string, Promise<unknown>>()

function publishActivity() {
  activityListeners.forEach((listener) => listener(activeRequestCount))
}

export function subscribeToApiActivity(listener: (count: number) => void) {
  activityListeners.add(listener)
  listener(activeRequestCount)
  return () => { activityListeners.delete(listener) }
}

export function setTokenGetter(fn: TokenGetter) {
  tokenGetter = fn
}

/** Clear cached reads after a write or sign-out. */
export function clearApiCache(prefix?: string) {
  if (!prefix) {
    getCache.clear()
    return
  }
  for (const key of getCache.keys()) {
    if (key.includes(prefix)) getCache.delete(key)
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  const cacheKey = `${base}/v1${path}`
  if (method === 'GET') {
    const cached = getCache.get(cacheKey)
    if (cached && Date.now() - cached.loadedAt < GET_CACHE_MS) return cached.value as T
    const pending = pendingGets.get(cacheKey)
    if (pending) return pending as Promise<T>
  }

  const requestPromise = (async () => {
  activeRequestCount += 1
  publishActivity()
  try {
    const request = async () => {
      const token = await tokenGetter()
      const headers = new Headers(init?.headers)
      headers.set('Accept', 'application/json')
      if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json')
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return fetch(`${base}/v1${path}`, { ...init, headers })
    }
    let res = await request()
    // On the first protected render, Firebase may finish registering its token
    // one microtask after a child page asks for data. Retry that one boundary
    // failure rather than rendering a false "patient not found" state.
    if (res.status === 401) res = await request()
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }
      throw new ApiError(res.status, body.error ?? 'unknown', body.message)
    }
    const value = res.status === 204 ? undefined as T : await res.json() as T
    if (method === 'GET') getCache.set(cacheKey, { loadedAt: Date.now(), value })
    return value
  } finally {
    activeRequestCount -= 1
    publishActivity()
  }
  })()

  if (method === 'GET') {
    pendingGets.set(cacheKey, requestPromise)
    void requestPromise.then(
      () => pendingGets.delete(cacheKey),
      () => pendingGets.delete(cacheKey),
    )
  }
  return requestPromise
}
