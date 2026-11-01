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
