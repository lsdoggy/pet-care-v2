import type {
  ApiErrorBody,
  AuthResponse,
  CareTaskDto,
  CreatePetRequest,
  PetDto,
  UpdatePetRequest,
  UserDto,
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

  /** Marks a task as done; if it has a recurrence rule the API returns the NEW pending task. */
  completeTask: (id: number, token: string) =>
    request<CareTaskDto>(`/tasks/${id}/complete`, { method: 'POST' }, token),
};
