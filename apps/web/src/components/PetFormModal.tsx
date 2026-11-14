import { useLanguage } from '../i18n/language'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { PetDto, PetSpecies } from '../api/types'
import { ENGLISH_SPECIES_LABELS, SPECIES_LABELS } from '../api/types'
import Modal from './Modal'
import { petInitials } from '../lib/petFormat'
import {
  PET_BREED_MAX_LENGTH,
  PET_NAME_MAX_LENGTH,
  parseWeightKg,
  validatePetForm,
  isPetFormValid,
  mapPetApiError,
} from '../lib/petValidation'
import type { PetFieldErrors, PetFieldName, PetFormValues } from '../lib/petValidation'
import '../styles/pets.css'

/**
 * Design Sprint 3 · Pets — форма добавления/редактирования питомца (Web).
 *
 * Изменения против прежней версии:
 *  - новые поля «Порода» и «Вес» (backend V10, необязательные — обратная совместимость);
 *  - клиентская валидация из lib/petValidation (имя*, вид*, дата не в будущем, вес > 0)
 *    с русскими сообщениями и aria-invalid/aria-describedby (WCAG AA);
 *  - инлайн-стили заменены на CSS-классы токенов; на мобильных модалка
 *    отображается как bottom sheet (см. pets.css);
 *  - focus-trap / Escape / возврат фокуса — через базовый компонент Modal.
 *
 * Бизнес-логика сохранена: те же эндпоинты POST/PATCH /pets и POST /pets/{id}/photo.
 */

interface Props {
  /** When provided the form edits an existing pet, otherwise it creates a new one. */
  pet?: PetDto
  token: string
  onClose: () => void
  onSaved: (pet: PetDto) => void
}

const EMPTY_VALUES: PetFormValues = { name: '', species: '', breed: '', birthDate: '', weightKg: '' }

export default function PetFormModal({ pet, token, onClose, onSaved }: Props) {
  const { language } = useLanguage()
  const speciesLabels = language === 'ru' ? SPECIES_LABELS : ENGLISH_SPECIES_LABELS
  const [values, setValues] = useState<PetFormValues>(() =>
    pet
      ? {
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? '',
          birthDate: pet.birthDate ?? '',
          weightKg: pet.weightKg != null ? String(pet.weightKg).replace('.', ',') : '',
        }
      : EMPTY_VALUES,
  )
  const [touched, setTouched] = useState<Partial<Record<PetFieldName, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const allErrors: PetFieldErrors = useMemo(() => validatePetForm(values), [values])

  /** Показываем ошибку поля только после blur либо после попытки отправки. */
  function fieldError(field: PetFieldName): string | undefined {
    return touched[field] || submitAttempted ? allErrors[field] : undefined
  }

  function setValue<K extends keyof PetFormValues>(key: K, value: PetFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitAttempted(true)
    // Финальная проверка перед отправкой: ошибки уже в allErrors.
    if (!isPetFormValid(allErrors)) return

    setSaving(true)
    setFormError(null)
    try {
      const body = {
        name: values.name.trim(),
        species: values.species as PetSpecies,
        birthDate: values.birthDate || null,
        breed: values.breed.trim() || null,
        weightKg: parseWeightKg(values.weightKg),
      }

      let saved: PetDto
      if (pet) {
        saved = await api.updatePet(pet.id, body, token)
        if (photoFile) saved = await api.uploadPetPhoto(saved.id, photoFile, token)
      } else {
        saved = await api.createPet(body, token)
        if (photoFile) saved = await api.uploadPetPhoto(saved.id, photoFile, token)
      }
      onSaved(saved)
    } catch (err) {
      const mapped = mapPetApiError(err instanceof Error ? err.message : undefined)
      if (mapped.field) setTouched((prev) => ({ ...prev, [mapped.field as PetFieldName]: true }))
      setFormError(mapped.message)
    } finally {
      setSaving(false)
    }
  }

  const titleId = 'pet-form-title'
  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <Modal labelledBy={titleId} onClose={saving ? () => undefined : onClose} className="pc-modal--form">
      <h2 id={titleId} className="pc-modal__title">
        {pet ? (language === 'ru' ? 'Редактировать питомца' : 'Edit pet') : (language === 'ru' ? 'Добавить питомца' : 'Add a pet')}
      </h2>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Фото / placeholder */}
        <div className="pc-photo-preview">
          <span className="pc-photo-preview__avatar" aria-hidden="true">
            {photoFile ? (
              <img src={URL.createObjectURL(photoFile)} alt="" />
            ) : pet?.photoUrl ? (
              <img src={pet.photoUrl} alt="" />
            ) : (
              petInitials(values.name)
            )}
          </span>
          <label className="pc-field" style={{ flex: 1 }}>
            <span className="pc-field__label">{language === 'ru' ? 'Фото' : 'Photo'}</span>
            <input
              className="pc-field__input"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {/* Имя (обязательно) */}
        <div className="pc-field">
          <label className="pc-field__label" htmlFor="pet-name">
            {language === 'ru' ? 'Имя' : 'Name'} <span className="pc-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="pet-name"
            data-autofocus
            className={`pc-field__input${fieldError('name') ? ' pc-field__input--invalid' : ''}`}
            value={values.name}
            maxLength={PET_NAME_MAX_LENGTH}
            required
            autoComplete="off"
            placeholder={language === 'ru' ? 'Например, Рекс' : 'For example, Rex'}
            aria-invalid={!!fieldError('name')}
            aria-describedby={fieldError('name') ? 'pet-name-error' : undefined}
            onChange={(e) => setValue('name', e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          />
          {fieldError('name') && (
            <p id="pet-name-error" className="pc-field__error" role="alert">
              {fieldError('name')}
            </p>
          )}
        </div>

        {/* Вид + порода */}
        <div className="pc-field-row">
          <div className="pc-field">
            <label className="pc-field__label" htmlFor="pet-species">
              {language === 'ru' ? 'Вид' : 'Species'} <span className="pc-field__required" aria-hidden="true">*</span>
            </label>
            <select
              id="pet-species"
              className={`pc-field__input${fieldError('species') ? ' pc-field__input--invalid' : ''}`}
              value={values.species}
              required
              aria-invalid={!!fieldError('species')}
              aria-describedby={fieldError('species') ? 'pet-species-error' : undefined}
              onChange={(e) => setValue('species', e.target.value as PetSpecies | '')}
              onBlur={() => setTouched((t) => ({ ...t, species: true }))}
            >
              <option value="">{language === 'ru' ? 'Выберите вид…' : 'Select a species…'}</option>
              {(Object.keys(speciesLabels) as PetSpecies[]).map((s) => (
                <option key={s} value={s}>
                  {speciesLabels[s]}
                </option>
              ))}
            </select>
            {fieldError('species') && (
              <p id="pet-species-error" className="pc-field__error" role="alert">
                {fieldError('species')}
              </p>
            )}
          </div>

          <div className="pc-field">
            <label className="pc-field__label" htmlFor="pet-breed">
              {language === 'ru' ? 'Порода' : 'Breed'}
            </label>
            <input
              id="pet-breed"
              className={`pc-field__input${fieldError('breed') ? ' pc-field__input--invalid' : ''}`}
              value={values.breed}
              maxLength={PET_BREED_MAX_LENGTH}
              placeholder={language === 'ru' ? 'Например, лайка' : 'For example, husky'}
              autoComplete="off"
              aria-invalid={!!fieldError('breed')}
              aria-describedby={fieldError('breed') ? 'pet-breed-error' : undefined}
              onChange={(e) => setValue('breed', e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, breed: true }))}
            />
            {fieldError('breed') && (
              <p id="pet-breed-error" className="pc-field__error" role="alert">
                {fieldError('breed')}
              </p>
            )}
          </div>
        </div>

        {/* Дата рождения + вес */}
        <div className="pc-field-row">
          <div className="pc-field">
            <label className="pc-field__label" htmlFor="pet-birthdate">
              {language === 'ru' ? 'Дата рождения' : 'Birth date'}
            </label>
            <input
              id="pet-birthdate"
              type="date"
              className={`pc-field__input${fieldError('birthDate') ? ' pc-field__input--invalid' : ''}`}
              value={values.birthDate}
              max={todayIso}
              aria-invalid={!!fieldError('birthDate')}
              aria-describedby={fieldError('birthDate') ? 'pet-birthdate-error' : 'pet-birthdate-hint'}
              onChange={(e) => setValue('birthDate', e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, birthDate: true }))}
            />
            {fieldError('birthDate') ? (
              <p id="pet-birthdate-error" className="pc-field__error" role="alert">
                {fieldError('birthDate')}
              </p>
            ) : (
              <p id="pet-birthdate-hint" className="pc-field__hint">
                {language === 'ru' ? 'Возраст посчитаем автоматически.' : 'We calculate age automatically.'}
              </p>
            )}
          </div>

          <div className="pc-field">
            <label className="pc-field__label" htmlFor="pet-weight">
              {language === 'ru' ? 'Вес, кг' : 'Weight, kg'}
            </label>
            <input
              id="pet-weight"
              type="text"
              inputMode="decimal"
              className={`pc-field__input${fieldError('weightKg') ? ' pc-field__input--invalid' : ''}`}
              value={values.weightKg}
              placeholder="4,5"
              autoComplete="off"
              aria-invalid={!!fieldError('weightKg')}
              aria-describedby={fieldError('weightKg') ? 'pet-weight-error' : undefined}
              onChange={(e) => setValue('weightKg', e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, weightKg: true }))}
            />
            {fieldError('weightKg') && (
              <p id="pet-weight-error" className="pc-field__error" role="alert">
                {fieldError('weightKg')}
              </p>
            )}
          </div>
        </div>

        {formError && (
          <p className="pc-form-status pc-form-status--error" role="alert">
            {formError}
          </p>
        )}

        <div className="pc-modal__actions">
          <button type="button" className="pc-btn pc-btn--ghost" onClick={onClose} disabled={saving}>
            {language === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
          <button type="submit" className="pc-btn pc-btn--primary" disabled={saving}>
            {saving ? (language === 'ru' ? 'Сохранение…' : 'Saving…') : (language === 'ru' ? 'Сохранить' : 'Save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
