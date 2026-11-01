import type {
  ApiErrorBody,
  AuthResponse,
  CareTaskDto,
  CreatePetRequest,
  CreateTaskRequest,
  PetDto,
  UpdatePetRequest,
  UserDto,
} from './types'

const BASE_URL = '/api/v1'

/** Resolves a backend-relative photo URL (e.g. /files/uploads/pets/x.jpg) for the browser. */
export function resolveFileUrl(photoUrl: string | null): string | null {
  return photoUrl
}

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

  listPets: (token: string) => request<PetDto[]>('/pets', { method: 'GET' }, token),

  getPet: (id: number, token: string) => request<PetDto>(`/pets/${id}`, { method: 'GET' }, token),

  createPet: (body: CreatePetRequest, token: string) =>
    request<PetDto>('/pets', { method: 'POST', body: JSON.stringify(body) }, token),

  updatePet: (id: number, body: UpdatePetRequest, token: string) =>
    request<PetDto>(`/pets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deletePet: (id: number, token: string) =>
    request<void>(`/pets/${id}`, { method: 'DELETE' }, token),

  uploadPetPhoto: async (id: number, file: File, token: string): Promise<PetDto> => {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(`${BASE_URL}/pets/${id}/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }, // no Content-Type: browser sets multipart boundary
      body: form,
    })
    if (!response.ok) {
      let body: Partial<ApiErrorBody> | undefined
      try {
        body = (await response.json()) as Partial<ApiErrorBody>
      } catch {
        /* fall through */
      }
      throw new ApiError(response.status, body?.message ?? `Upload failed (${response.status})`, body?.details ?? [])
    }
    return (await response.json()) as PetDto
  },

  /* ---------- Care tasks (Sprint 3) ---------- */

  listTasks: (token: string) => request<CareTaskDto[]>('/tasks', { method: 'GET' }, token),

  listUpcomingTasks: (token: string) => request<CareTaskDto[]>('/tasks/upcoming', { method: 'GET' }, token),

  createTask: (body: CreateTaskRequest, token: string) =>
    request<CareTaskDto>('/tasks', { method: 'POST', body: JSON.stringify(body) }, token),

  updateTask: (id: number, body: Partial<CreateTaskRequest> & { status?: string }, token: string) =>
    request<CareTaskDto>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deleteTask: (id: number, token: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }, token),

  /** Marks a task as done; if it has a recurrence rule the API returns the NEW pending task. */
  completeTask: (id: number, token: string) =>
    request<CareTaskDto>(`/tasks/${id}/complete`, { method: 'POST' }, token),
}
