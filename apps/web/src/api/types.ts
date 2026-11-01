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
