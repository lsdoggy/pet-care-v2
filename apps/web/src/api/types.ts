export interface UserDto {
  id: number
  email: string
  /** Design Sprint 1: optional display name collected at sign-up. */
  firstName: string | null
  /** Design Sprint 1: optional contact phone collected at sign-up. */
  phone: string | null
  /** Sprint 6: profile push switch (Push On/Off). */
  pushNotificationsEnabled: boolean
  /** Sprint 6: profile email switch (Email On/Off, opt-in). */
  emailNotificationsEnabled: boolean
  createdAt: string
}

/** Mirrors backend ChannelStatus enum (stored lowercase in the DB). 'read' = user has seen it. */
export type NotificationChannelStatus = 'pending' | 'sent' | 'failed' | 'read'

/** Mirrors backend NotificationType enum: delivery channel of the notification. */
export type NotificationType = 'push' | 'email'

/** One row of GET /api/v1/notifications (newest first). */
export interface NotificationDto {
  id: number
  type: NotificationType
  title: string
  body: string
  /** Raw JSON string with extra context, e.g. {"careTaskId":42,"dueAt":"..."}. */
  payloadJson: string | null
  channelStatus: NotificationChannelStatus
  sentAt: string | null
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

// Design Sprint 2: UI copy language is Russian (approved in the sprint plan).
// Backend enum values stay unchanged — only display labels are localized.
export const SPECIES_LABELS: Record<PetSpecies, string> = {
  DOG: 'Собака',
  CAT: 'Кошка',
  BIRD: 'Птица',
  HAMSTER: 'Хомяк',
  RABBIT: 'Кролик',
  TURTLE: 'Черепаха',
  FISH: 'Рыбка',
  OTHER: 'Другое',
}

export interface PetDto {
  id: number
  ownerId: number
  name: string
  species: PetSpecies
  birthDate: string | null
  photoUrl: string | null
  /** Design Sprint 3 (backend V10 migration): optional breed, ≤ 80 chars. */
  breed: string | null
  /** Design Sprint 3 (backend V10 migration): optional weight in kg, > 0. */
  weightKg: number | null
  createdAt: string
  updatedAt: string
}

export interface CreatePetRequest {
  name: string
  species: PetSpecies
  birthDate?: string | null
  /** Design Sprint 3: optional new fields — old clients keep omitting them (backward compatible). */
  breed?: string | null
  weightKg?: number | null
}

export interface UpdatePetRequest {
  name?: string
  species?: PetSpecies
  birthDate?: string | null
  breed?: string | null
  weightKg?: number | null
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
  VACCINATION: 'Прививка',
  VET: 'Визит к врачу',
  FOOD: 'Кормление',
  GROOMING: 'Груминг',
  MEDICATION: 'Лекарство',
  WALK: 'Прогулка',
  OTHER: 'Другое',
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

/* ---------- Veterinary appointments & records (Sprint 4) ---------- */

export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED']

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Запланирован',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
}

export interface VetAppointmentDto {
  id: number
  petId: number
  petName: string
  clinicName: string
  doctorName: string | null
  /** UTC ISO instant — convert to local time for display. */
  scheduledAt: string
  durationMinutes: number
  status: AppointmentStatus
  address: string | null
  cost: number | null
  currency: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAppointmentRequest {
  petId: number
  clinicName: string
  doctorName?: string | null
  /** UTC ISO instant. */
  scheduledAt: string
  durationMinutes?: number
  status?: AppointmentStatus
  address?: string | null
  cost?: number | null
  currency?: string | null
  notes?: string | null
}

export type UpdateAppointmentRequest = Partial<Omit<CreateAppointmentRequest, 'petId'>>

export interface AttachmentDto {
  /** Backend-relative URL, e.g. /files/records/<uuid>.pdf */
  url: string
  name: string
  /** Extension without dot: pdf | jpg | jpeg | png | webp */
  type: string
  size: number
}

export interface VetRecordDto {
  id: number
  appointmentId: number | null
  petId: number
  petName: string
  /** Local calendar date, YYYY-MM-DD. */
  visitDate: string
  diagnosisText: string | null
  recommendationsText: string | null
  prescriptionsText: string | null
  attachments: AttachmentDto[]
  createdAt: string
  updatedAt: string
}

export interface CreateRecordRequest {
  petId: number
  appointmentId?: number | null
  /** YYYY-MM-DD, must be today or earlier. */
  visitDate: string
  diagnosisText?: string | null
  recommendationsText?: string | null
  prescriptionsText?: string | null
}

export type UpdateRecordRequest = Omit<Partial<CreateRecordRequest>, 'petId' | 'appointmentId'>

export type HistoryEventKind = 'APPOINTMENT' | 'RECORD'

/** One merged timeline event from GET /api/v1/pets/{id}/history; exactly one payload is set. */
export interface HistoryEventDto {
  kind: HistoryEventKind
  /** Appointment: scheduledAt; Record: visitDate at start of day (UTC). */
  eventAt: string
  appointment: VetAppointmentDto | null
  record: VetRecordDto | null
}

/* ---------- Food products & shopping list (Sprint 5) ---------- */

export type FoodCategory = 'DRY' | 'WET' | 'TREAT' | 'SUPPLEMENT' | 'LITTER'

export const FOOD_CATEGORIES: FoodCategory[] = ['DRY', 'WET', 'TREAT', 'SUPPLEMENT', 'LITTER']

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  DRY: 'Сухой корм',
  WET: 'Влажный корм',
  TREAT: 'Лакомства',
  SUPPLEMENT: 'Добавка',
  LITTER: 'Наполнитель',
}

export type StockUnit = 'PCS' | 'KG' | 'G'

export const STOCK_UNITS: StockUnit[] = ['PCS', 'KG', 'G']

export interface FoodProductDto {
  id: number
  name: string
  brand: string | null
  category: FoodCategory
  packageSizeGrams: number | null
  dailyPortionGrams: number | null
  stockQuantity: number
  reorderThreshold: number
  unit: StockUnit
  notes: string | null
  /** True when stockQuantity <= reorderThreshold (drives progress bar color / suggestions). */
  lowStock: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateFoodProductRequest {
  name: string
  brand?: string | null
  category: FoodCategory
  packageSizeGrams?: number | null
  dailyPortionGrams?: number | null
  stockQuantity?: number | null
  reorderThreshold?: number | null
  unit: StockUnit
  notes?: string | null
}

export type UpdateFoodProductRequest = Partial<CreateFoodProductRequest>

export interface ShoppingItemDto {
  id: number
  /** Null for custom one-off items. */
  productId: number | null
  customName: string
  quantity: number
  unit: StockUnit
  isPurchased: boolean
  /** UTC ISO instant, set when marked purchased; null while open. */
  purchasedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateShoppingItemRequest {
  /** Linked mode ("Add to Shopping List"): product of the current user. */
  productId?: number | null
  /** Custom mode (quick-add): required if productId is omitted. */
  customName?: string | null
  quantity?: number | null
  unit?: StockUnit | null
}

export interface UpdateShoppingItemRequest {
  customName?: string | null
  quantity?: number | null
  unit?: StockUnit | null
}

export interface PurchaseItemRequest {
  /** Optional restock amount applied to the linked product in the same transaction. */
  addStockQuantity?: number | null
}
