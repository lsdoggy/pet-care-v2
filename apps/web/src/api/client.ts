import type {
  ApiErrorBody,
  AuthResponse,
  CareTaskDto,
  CreateAppointmentRequest,
  CreateFoodProductRequest,
  CreatePetRequest,
  CreateRecordRequest,
  CreateShoppingItemRequest,
  CreateTaskRequest,
  FoodProductDto,
  HistoryEventDto,
  NotificationDto,
  PetDto,
  PurchaseItemRequest,
  ShoppingItemDto,
  UpdateFoodProductRequest,
  UpdatePetRequest,
  UpdateShoppingItemRequest,
  UserDto,
  VetAppointmentDto,
  VetRecordDto,
} from './types'

/** Design Sprint 1: optional profile fields sent alongside {email,password}. */
export interface RegisterProfile {
  firstName?: string
  phone?: string
}

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
  register: (email: string, password: string, profile?: RegisterProfile) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      // Design Sprint 1: firstName/phone are optional in the backend DTO —
      // old contract {email,password} stays valid (backward compatible).
      body: JSON.stringify({ email, password, ...profile }),
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

  /** Generic multipart upload helper (Sprint 4: record attachments). */
  uploadFile: async <T,>(path: string, file: File, token: string): Promise<T> => {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(`${BASE_URL}${path}`, {
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
    return (await response.json()) as T
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

  /* ---------- Veterinary appointments & records (Sprint 4) ---------- */

  listAppointments: (token: string) =>
    request<VetAppointmentDto[]>('/appointments', { method: 'GET' }, token),

  getAppointment: (id: number, token: string) =>
    request<VetAppointmentDto>(`/appointments/${id}`, { method: 'GET' }, token),

  createAppointment: (body: CreateAppointmentRequest, token: string) =>
    request<VetAppointmentDto>('/appointments', { method: 'POST', body: JSON.stringify(body) }, token),

  updateAppointment: (id: number, body: Partial<CreateAppointmentRequest>, token: string) =>
    request<VetAppointmentDto>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deleteAppointment: (id: number, token: string) =>
    request<void>(`/appointments/${id}`, { method: 'DELETE' }, token),

  listRecords: (token: string) => request<VetRecordDto[]>('/records', { method: 'GET' }, token),

  getRecord: (id: number, token: string) =>
    request<VetRecordDto>(`/records/${id}`, { method: 'GET' }, token),

  createRecord: (body: CreateRecordRequest, token: string) =>
    request<VetRecordDto>('/records', { method: 'POST', body: JSON.stringify(body) }, token),

  updateRecord: (id: number, body: Partial<CreateRecordRequest>, token: string) =>
    request<VetRecordDto>(`/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deleteRecord: (id: number, token: string) => request<void>(`/records/${id}`, { method: 'DELETE' }, token),

  /** Attaches a PDF/image to an existing record; returns the updated record with new attachments[]. */
  uploadRecordAttachment: (id: number, file: File, token: string) =>
    api.uploadFile<VetRecordDto>(`/records/${id}/attachments`, file, token),

  /** Merged chronology (appointments + records) for one pet, newest event first. */
  getPetHistory: (petId: number, token: string) =>
    request<HistoryEventDto[]>(`/pets/${petId}/history`, { method: 'GET' }, token),

  /* ---------- Notifications (Sprint 6) ---------- */

  listNotifications: (token: string) =>
    request<NotificationDto[]>('/notifications', { method: 'GET' }, token),

  unreadNotificationCount: (token: string) =>
    request<{ count: number }>('/notifications/unread-count', { method: 'GET' }, token),

  markNotificationRead: (id: number, token: string) =>
    request<NotificationDto>(`/notifications/${id}/read`, { method: 'POST' }, token),

  updateNotificationSettings: (pushEnabled: boolean, emailEnabled: boolean, token: string) =>
    request<UserDto>(
      '/users/notification-settings',
      { method: 'PATCH', body: JSON.stringify({ pushEnabled, emailEnabled }) },
      token,
    ),
  /* ---------- Food products & shopping list (Sprint 5) ---------- */

  listFoodProducts: (token: string) => request<FoodProductDto[]>('/food-products', { method: 'GET' }, token),

  getFoodProduct: (id: number, token: string) =>
    request<FoodProductDto>(`/food-products/${id}`, { method: 'GET' }, token),

  createFoodProduct: (body: CreateFoodProductRequest, token: string) =>
    request<FoodProductDto>('/food-products', { method: 'POST', body: JSON.stringify(body) }, token),

  updateFoodProduct: (id: number, body: UpdateFoodProductRequest, token: string) =>
    request<FoodProductDto>(`/food-products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deleteFoodProduct: (id: number, token: string) =>
    request<void>(`/food-products/${id}`, { method: 'DELETE' }, token),

  listShoppingItems: (token: string) => request<ShoppingItemDto[]>('/shopping-list/items', { method: 'GET' }, token),

  createShoppingItem: (body: CreateShoppingItemRequest, token: string) =>
    request<ShoppingItemDto>('/shopping-list/items', { method: 'POST', body: JSON.stringify(body) }, token),

  updateShoppingItem: (id: number, body: UpdateShoppingItemRequest, token: string) =>
    request<ShoppingItemDto>(`/shopping-list/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deleteShoppingItem: (id: number, token: string) =>
    request<void>(`/shopping-list/items/${id}`, { method: 'DELETE' }, token),

  /** Marks an item purchased; optional addStockQuantity restocks the linked product atomically. */
  purchaseShoppingItem: (id: number, body: PurchaseItemRequest | null, token: string) =>
    request<ShoppingItemDto>(
      `/shopping-list/items/${id}/purchase`,
      { method: 'POST', body: body ? JSON.stringify(body) : undefined },
      token,
    ),

  /** Low-stock products without an open list entry — suggestion banner source. */
  listShoppingSuggestions: (token: string) =>
    request<FoodProductDto[]>('/shopping-list/suggestions', { method: 'GET' }, token),
}
