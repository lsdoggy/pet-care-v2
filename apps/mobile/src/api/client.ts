import type {
  ApiErrorBody,
  AuthResponse,
  CareTaskDto,
  CreateAppointmentRequest,
  CreateFoodProductRequest,
  CreatePetRequest,
  CreateRecordRequest,
  CreateTaskRequest,
  DeviceDto,
  CreateShoppingItemRequest,
  FoodProductDto,
  HistoryEventDto,
  NotificationDto,
  PetDto,
  PurchaseItemRequest,
  ShoppingItemDto,
  UpdateFoodProductRequest,
  UpdatePetRequest,
  UserDto,
  VetAppointmentDto,
  VetRecordDto,
} from './types';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const BASE_URL = `${API_URL}/api/v1`;

/** Resolves a relative photoUrl returned by the backend into an absolute URL. */
export function resolveFileUrl(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http')) return photoUrl;
  return `${API_URL}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: ApiErrorBody['details'];

  constructor(status: number, message: string, details: ApiErrorBody['details'] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(response.status, `Unexpected empty response (${response.status})`);
  }

  if (!response.ok) {
    const err = body as Partial<ApiErrorBody>;
    throw new ApiError(response.status, err.message ?? 'Request failed', err.details ?? []);
  }
  return body as T;
}

/** Design Sprint 1: optional profile fields accepted by the backend RegisterRequest. */
export interface RegisterProfile {
  firstName?: string;
  phone?: string;
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
  updateProfile: (body: { firstName: string; phone: string }, token: string) =>
    request<UserDto>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }, token),

  listPets: (token: string) => request<PetDto[]>('/pets', { method: 'GET' }, token),

  getPet: (id: number, token: string) => request<PetDto>(`/pets/${id}`, { method: 'GET' }, token),

  createPet: (body: CreatePetRequest, token: string) =>
    request<PetDto>('/pets', { method: 'POST', body: JSON.stringify(body) }, token),

  updatePet: (id: number, body: UpdatePetRequest, token: string) =>
    request<PetDto>(`/pets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deletePet: (id: number, token: string) =>
    request<void>(`/pets/${id}`, { method: 'DELETE' }, token),

  /** Uploads a photo picked via expo-image-picker (local file URI) for the given pet. */
  uploadPetPhoto: async (id: number, fileUri: string, fileName: string, token: string): Promise<PetDto> => {
    const form = new FormData();
    // RN fetch supports uploading from device URIs via this object shape.
    form.append('file', {
      uri: fileUri,
      name: fileName,
      type: 'image/jpeg',
    } as unknown as Blob);

    const response = await fetch(`${BASE_URL}/pets/${id}/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError(response.status, `Unexpected empty response (${response.status})`);
    }
    if (!response.ok) {
      const err = body as Partial<ApiErrorBody>;
      throw new ApiError(response.status, err.message ?? 'Upload failed', err.details ?? []);
    }
    return body as PetDto;
  },

  /* ---------- Care tasks (Sprint 3) ---------- */

  listUpcomingTasks: (token: string) => request<CareTaskDto[]>('/tasks/upcoming', { method: 'GET' }, token),

  /** All tasks incl. DONE and overdue PENDING (mirror of web client; GET /api/v1/tasks). */
  listTasks: (token: string) => request<CareTaskDto[]>('/tasks', { method: 'GET' }, token),

  /** Creates a care task (mirror of web client; POST /api/v1/tasks). */
  createTask: (body: CreateTaskRequest, token: string) =>
    request<CareTaskDto>('/tasks', { method: 'POST', body: JSON.stringify(body) }, token),

  /** Marks a task as done; if it has a recurrence rule the API returns the NEW pending task. */
  completeTask: (id: number, token: string) =>
    request<CareTaskDto>(`/tasks/${id}/complete`, { method: 'POST' }, token),

  /* ---------- Veterinary appointments & records (Sprint 4) ---------- */

  listAppointments: (token: string) =>
    request<VetAppointmentDto[]>('/appointments', { method: 'GET' }, token),

  createAppointment: (body: CreateAppointmentRequest, token: string) =>
    request<VetAppointmentDto>('/appointments', { method: 'POST', body: JSON.stringify(body) }, token),

  updateAppointment: (id: number, body: Partial<CreateAppointmentRequest>, token: string) =>
    request<VetAppointmentDto>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deleteAppointment: (id: number, token: string) =>
    request<void>(`/appointments/${id}`, { method: 'DELETE' }, token),

  createRecord: (body: CreateRecordRequest, token: string) =>
    request<VetRecordDto>('/records', { method: 'POST', body: JSON.stringify(body) }, token),

  deleteRecord: (id: number, token: string) => request<void>(`/records/${id}`, { method: 'DELETE' }, token),

  /** Merged chronology (appointments + records) for one pet, newest event first. */
  getPetHistory: (petId: number, token: string) =>
    request<HistoryEventDto[]>(`/pets/${petId}/history`, { method: 'GET' }, token),

  /** Uploads a picked document/photo (device file URI) and appends it to the record's attachments. */
  uploadRecordAttachment: async (
    id: number,
    fileUri: string,
    fileName: string,
    mimeType: string,
    token: string,
  ): Promise<VetRecordDto> => {
    const form = new FormData();
    // RN fetch supports uploading from device URIs via this object shape.
    form.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    const response = await fetch(`${BASE_URL}/records/${id}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError(response.status, `Unexpected empty response (${response.status})`);
    }
    if (!response.ok) {
      const err = body as Partial<ApiErrorBody>;
      throw new ApiError(response.status, err.message ?? 'Upload failed', err.details ?? []);
    }
    return body as VetRecordDto;
  },

  /* ---------- Notifications & devices (Sprint 6) ---------- */

  /** Idempotent registration of the Expo push token for the current user. */
  registerDevice: (token: string, platform: 'ios' | 'android' | 'web', jwt: string) =>
    request<DeviceDto>(
      '/devices/register',
      { method: 'POST', body: JSON.stringify({ token, platform }) },
      jwt,
    ),

  listDevices: (jwt: string) => request<DeviceDto[]>('/devices', { method: 'GET' }, jwt),

  listNotifications: (jwt: string) =>
    request<NotificationDto[]>('/notifications', { method: 'GET' }, jwt),

  unreadNotificationCount: (jwt: string) =>
    request<{ count: number }>('/notifications/unread-count', { method: 'GET' }, jwt),

  markNotificationRead: (id: number, jwt: string) =>
    request<NotificationDto>(`/notifications/${id}/read`, { method: 'POST' }, jwt),

  updateNotificationSettings: (pushEnabled: boolean, emailEnabled: boolean, jwt: string) =>
    request<UserDto>(
      '/users/notification-settings',
      { method: 'PATCH', body: JSON.stringify({ pushEnabled, emailEnabled }) },
      jwt,
    ),
  /* ---------- Food products & shopping list (Sprint 5) ---------- */

  listFoodProducts: (token: string) => request<FoodProductDto[]>('/food-products', { method: 'GET' }, token),

  createFoodProduct: (body: CreateFoodProductRequest, token: string) =>
    request<FoodProductDto>('/food-products', { method: 'POST', body: JSON.stringify(body) }, token),

  updateFoodProduct: (id: number, body: UpdateFoodProductRequest, token: string) =>
    request<FoodProductDto>(`/food-products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, token),

  deleteFoodProduct: (id: number, token: string) =>
    request<void>(`/food-products/${id}`, { method: 'DELETE' }, token),

  listShoppingItems: (token: string) => request<ShoppingItemDto[]>('/shopping-list/items', { method: 'GET' }, token),

  /** Linked mode (productId) or custom quick-add mode (customName). */
  createShoppingItem: (body: CreateShoppingItemRequest, token: string) =>
    request<ShoppingItemDto>('/shopping-list/items', { method: 'POST', body: JSON.stringify(body) }, token),

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
};
