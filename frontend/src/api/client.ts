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

export function setTokenGetter(fn: TokenGetter) {
  tokenGetter = fn
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await tokenGetter()
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  const res = await fetch(`${base}/v1${path}`, { ...init, headers })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      message?: string
    }
    throw new ApiError(res.status, body.error ?? 'unknown', body.message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
