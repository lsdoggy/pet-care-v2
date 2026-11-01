export interface UserDto {
  id: number
  email: string
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  user: UserDto
}

export interface FieldError {
  field: string
  message: string
}

export interface ApiErrorBody {
  status: number
  error: string
  message: string
  details: FieldError[]
  timestamp: string
}

export type PetSpecies =
  | 'DOG'
  | 'CAT'
  | 'BIRD'
  | 'HAMSTER'
  | 'RABBIT'
  | 'TURTLE'
  | 'FISH'
  | 'OTHER'

export const PET_SPECIES: PetSpecies[] = [
  'DOG',
  'CAT',
  'BIRD',
  'HAMSTER',
  'RABBIT',
  'TURTLE',
  'FISH',
  'OTHER',
]

export const SPECIES_LABELS: Record<PetSpecies, string> = {
  DOG: 'Dog',
  CAT: 'Cat',
  BIRD: 'Bird',
  HAMSTER: 'Hamster',
  RABBIT: 'Rabbit',
  TURTLE: 'Turtle',
  FISH: 'Fish',
  OTHER: 'Other',
}

export interface PetDto {
  id: number
  ownerId: number
  name: string
  species: PetSpecies
  birthDate: string | null
  photoUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface CreatePetRequest {
  name: string
  species: PetSpecies
  birthDate?: string | null
}

export interface UpdatePetRequest {
  name?: string
  species?: PetSpecies
  birthDate?: string | null
}

/* ---------- Care tasks (Sprint 3) ---------- */

export type CareTaskType = 'VACCINATION' | 'VET' | 'FOOD' | 'GROOMING' | 'MEDICATION' | 'WALK' | 'OTHER'

export const TASK_TYPES: CareTaskType[] = [
  'VACCINATION',
  'VET',
  'FOOD',
  'GROOMING',
  'MEDICATION',
  'WALK',
  'OTHER',
]

export const TASK_TYPE_LABELS: Record<CareTaskType, string> = {
  VACCINATION: 'Vaccination',
  VET: 'Vet visit',
  FOOD: 'Food',
  GROOMING: 'Grooming',
  MEDICATION: 'Medication',
  WALK: 'Walk',
  OTHER: 'Other',
}

export type CareTaskStatus = 'PENDING' | 'DONE'

export interface CareTaskDto {
  id: number
  petId: number
  petName: string
  title: string
  type: CareTaskType
  /** UTC ISO instant — convert to local time for display. */
  dueAt: string
  status: CareTaskStatus
  recurrenceRule: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTaskRequest {
  petId: number
  title: string
  type: CareTaskType
  /** UTC ISO instant. */
  dueAt: string
  recurrenceRule?: string | null
}

export interface UpdateTaskRequest {
  title?: string
  type?: CareTaskType
  dueAt?: string
  status?: CareTaskStatus
  recurrenceRule?: string | null
}

export const RECURRENCE_UNITS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type RecurrenceUnit = (typeof RECURRENCE_UNITS)[number]

/** Formats a UTC ISO instant in the user's local timezone. */
export function formatDueAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
