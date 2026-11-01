import type { ApiErrorBody, AuthResponse, UserDto } from './types'

const BASE_URL = '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly details: ApiErrorBody['details']

  constructor(status: number, message: string, details: ApiErrorBody['details'] = []) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (response.status === 204) return undefined as T

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ApiError(response.status, `Unexpected empty response (${response.status})`)
  }

  if (!response.ok) {
    const err = body as Partial<ApiErrorBody>
    throw new ApiError(response.status, err.message ?? 'Request failed', err.details ?? [])
  }
  return body as T
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) => request<UserDto>('/users/me', { method: 'GET' }, token),
}
