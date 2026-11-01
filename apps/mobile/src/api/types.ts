export interface UserDto {
  id: number;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: UserDto;
}

/** Mirrors backend com.petcare.backend.pet.PetSpecies enum. */
export type PetSpecies =
  | 'DOG'
  | 'CAT'
  | 'BIRD'
  | 'HAMSTER'
  | 'RABBIT'
  | 'TURTLE'
  | 'FISH'
  | 'OTHER';

export const PET_SPECIES: readonly PetSpecies[] = [
  'DOG',
  'CAT',
  'BIRD',
  'HAMSTER',
  'RABBIT',
  'TURTLE',
  'FISH',
  'OTHER',
] as const;

export const SPECIES_LABELS: Record<PetSpecies, string> = {
  DOG: 'Dog',
  CAT: 'Cat',
  BIRD: 'Bird',
  HAMSTER: 'Hamster',
  RABBIT: 'Rabbit',
  TURTLE: 'Turtle',
  FISH: 'Fish',
  OTHER: 'Other',
};

export interface PetDto {
  id: number;
  ownerId: number;
  name: string;
  species: PetSpecies;
  birthDate: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePetRequest {
  name: string;
  species: PetSpecies;
  birthDate?: string | null;
}

export type UpdatePetRequest = Partial<CreatePetRequest>;

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  status: number;
  error: string;
  message: string;
  details: FieldError[];
  timestamp: string;
}

/* ---------- Care tasks (Sprint 3) ---------- */

/** Mirrors backend com.petcare.backend.task.CareTaskType enum. */
export type CareTaskType =
  | 'VACCINATION'
  | 'VET'
  | 'FOOD'
  | 'GROOMING'
  | 'MEDICATION'
  | 'WALK'
  | 'OTHER';

export const TASK_TYPE_LABELS: Record<CareTaskType, string> = {
  VACCINATION: 'Vaccination',
  VET: 'Vet visit',
  FOOD: 'Food',
  GROOMING: 'Grooming',
  MEDICATION: 'Medication',
  WALK: 'Walk',
  OTHER: 'Other',
};

/** Mirrors backend com.petcare.backend.task.CareTaskStatus enum. */
export type CareTaskStatus = 'PENDING' | 'DONE';

export interface CareTaskDto {
  id: number;
  petId: number;
  petName: string;
  title: string;
  type: CareTaskType;
  /** UTC ISO instant — convert to local time for display. */
  dueAt: string;
  status: CareTaskStatus;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Formats a UTC ISO instant in the device's local timezone. */
export function formatDueAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
