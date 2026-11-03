export interface UserDto {
  id: number;
  email: string;
  /** Sprint 6: profile push switch (Push On/Off). */
  pushNotificationsEnabled: boolean;
  /** Sprint 6: profile email switch (Email On/Off, opt-in). */
  emailNotificationsEnabled: boolean;
  createdAt: string;
}

/** Mirrors backend ChannelStatus enum (stored lowercase in the DB). 'read' = user has seen it. */
export type NotificationChannelStatus = 'pending' | 'sent' | 'failed' | 'read';

/** Mirrors backend NotificationType enum: delivery channel of the notification. */
export type NotificationType = 'push' | 'email';

/** One row of GET /api/v1/notifications (newest first). */
export interface NotificationDto {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  /** Raw JSON string with extra context, e.g. {"careTaskId":42,"dueAt":"..."}. */
  payloadJson: string | null;
  channelStatus: NotificationChannelStatus;
  sentAt: string | null;
  createdAt: string;
}

/** Device row from GET /api/v1/devices — token is masked server-side. */
export interface DeviceDto {
  id: number;
  tokenPreview: string;
  platform: 'ios' | 'android' | 'web';
  pushEnabled: boolean;
  createdAt: string;
  lastSeenAt: string;
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

/* ---------- Veterinary appointments & records (Sprint 4) ---------- */

/** Mirrors backend com.petcare.backend.vet.AppointmentStatus enum. */
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export interface VetAppointmentDto {
  id: number;
  petId: number;
  petName: string;
  clinicName: string;
  doctorName: string | null;
  /** UTC ISO instant — convert to local time for display. */
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  address: string | null;
  cost: number | null;
  currency: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentRequest {
  petId: number;
  clinicName: string;
  doctorName?: string | null;
  /** UTC ISO instant. */
  scheduledAt: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
  address?: string | null;
  cost?: number | null;
  currency?: string | null;
  notes?: string | null;
}

export interface AttachmentDto {
  /** Backend-relative URL, e.g. /files/records/<uuid>.pdf */
  url: string;
  name: string;
  /** Extension without dot: pdf | jpg | jpeg | png | webp */
  type: string;
  size: number;
}

export interface VetRecordDto {
  id: number;
  appointmentId: number | null;
  petId: number;
  petName: string;
  /** Local calendar date, YYYY-MM-DD. */
  visitDate: string;
  diagnosisText: string | null;
  recommendationsText: string | null;
  prescriptionsText: string | null;
  attachments: AttachmentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecordRequest {
  petId: number;
  appointmentId?: number | null;
  /** YYYY-MM-DD, must be today or earlier. */
  visitDate: string;
  diagnosisText?: string | null;
  recommendationsText?: string | null;
  prescriptionsText?: string | null;
}

export type HistoryEventKind = 'APPOINTMENT' | 'RECORD';

/** One merged timeline event from GET /api/v1/pets/{id}/history; exactly one payload is set. */
export interface HistoryEventDto {
  kind: HistoryEventKind;
  /** Appointment: scheduledAt; Record: visitDate at start of day (UTC). */
  eventAt: string;
  appointment: VetAppointmentDto | null;
  record: VetRecordDto | null;
}

/* ---------- Food products & shopping list (Sprint 5) ---------- */

export type FoodCategory = 'DRY' | 'WET' | 'TREAT' | 'SUPPLEMENT' | 'LITTER';

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  DRY: 'Dry food',
  WET: 'Wet food',
  TREAT: 'Treats',
  SUPPLEMENT: 'Supplement',
  LITTER: 'Litter',
};

export type StockUnit = 'PCS' | 'KG' | 'G';

export interface FoodProductDto {
  id: number;
  name: string;
  brand: string | null;
  category: FoodCategory;
  packageSizeGrams: number | null;
  dailyPortionGrams: number | null;
  stockQuantity: number;
  reorderThreshold: number;
  unit: StockUnit;
  notes: string | null;
  /** True when stockQuantity <= reorderThreshold. */
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingItemDto {
  id: number;
  /** Null for custom one-off items. */
  productId: number | null;
  customName: string;
  quantity: number;
  unit: StockUnit;
  isPurchased: boolean;
  purchasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFoodProductRequest {
  name: string;
  brand?: string | null;
  category: FoodCategory;
  packageSizeGrams?: number | null;
  dailyPortionGrams?: number | null;
  stockQuantity?: number | null;
  reorderThreshold?: number | null;
  unit: StockUnit;
  notes?: string | null;
}

/** PATCH semantics: null/undefined = keep current value. */
export type UpdateFoodProductRequest = Partial<CreateFoodProductRequest>;

export interface CreateShoppingItemRequest {
  /** Linked mode ("Add to Shopping List"). */
  productId?: number | null;
  /** Custom mode (quick-add): required if productId is omitted. */
  customName?: string | null;
  quantity?: number | null;
  unit?: StockUnit | null;
}

export interface PurchaseItemRequest {
  /** Optional restock amount applied to the linked product in the same transaction. */
  addStockQuantity?: number | null;
}
