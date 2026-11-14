import { localizeAuthError } from '../validation/auth';
import { useLanguage } from '../i18n/language';
/**
 * Design Sprint 1 · Auth screen (mobile).
 *
 * - Токены дизайн-системы (theme/tokens) вместо хардкод-цветов.
 * - Mobile-first, touch targets >= 44px (layout.minTouchTarget).
 * - Поля: email, password + (регистрация) firstName, phone (optional), confirmPassword.
 * - Клиентская валидация из ../validation/auth (зеркало web-версии).
 * - Ошибки API переводятся в понятные русские сообщения.
 * - Loading state кнопки; доступность: accessibilityRole/State/LiveRegion.
 * - Капча / social login / 2FA намеренно отсутствуют (требование спринта).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/Typography';
import { ApiError } from '../api/client';
import type { RegisterProfile } from '../api/client';
import { colors, spacing, stack, radius, layout, typography, fontSize } from '../theme/tokens';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateFirstName,
  validatePhone,
  validateLoginForm,
  validateRegisterForm,
  translateApiMessage,
  translateApiFieldMessage,
  apiErrorMessageForStatus,
  normalizeFieldName,
} from '../validation/auth';
import type { AuthFieldErrors, AuthFieldName } from '../validation/auth';

export type AuthMode = 'login' | 'register';

interface Props {
  mode: AuthMode;
  /**
   * Обратная совместимость: третий параметр (профиль) опционален —
   * существующие вызовы onSubmit(email, password) продолжают работать.
   */
  onSubmit: (email: string, password: string, profile?: RegisterProfile) => Promise<void>;
  onSwitchMode: () => void;
}

type TouchedState = Partial<Record<AuthFieldName, boolean>>;

export function AuthScreen({ mode, onSubmit, onSwitchMode }: Props) {
  const language = useLanguage();
  const isLogin = mode === 'login';

  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [touched, setTouched] = useState<TouchedState>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fieldError = (name: AuthFieldName): string | undefined =>
    touched[name] ? errors[name] : undefined;

  const setErrorFor = (name: AuthFieldName, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  };

  const markTouched = (name: AuthFieldName) =>
    setTouched((prev) => ({ ...prev, [name]: true }));

  /** Проверка одного поля при потере фокуса. */
  const handleBlur = (name: AuthFieldName) => () => {
    markTouched(name);
    switch (name) {
      case 'email':
        setErrorFor('email', validateEmail(email));
        break;
      case 'password':
        setErrorFor('password', validatePassword(password, isLogin));
        if (!isLogin) {
          setErrorFor('confirmPassword', validateConfirmPassword(password, confirmPassword));
        }
        break;
      case 'confirmPassword':
        setErrorFor('confirmPassword', validateConfirmPassword(password, confirmPassword));
        break;
      case 'firstName':
        setErrorFor('firstName', validateFirstName(firstName));
        break;
      case 'phone':
        setErrorFor('phone', validatePhone(phone));
        break;
    }
  };

  /** Маппинг ошибок backend в поля/баннер с русификацией (контракт не меняем). */
  const mapApiError = (e: unknown): string => {
    if (!(e instanceof ApiError)) {
      return 'Не удалось связаться с сервером. Проверьте подключение к сети и EXPO_PUBLIC_API_URL.';
    }
    const fieldErrors: AuthFieldErrors = {};
    let generic: string | null = null;
    for (const d of e.details) {
      const field = normalizeFieldName(d.field ?? '');
      if (field) {
        fieldErrors[field] = translateApiFieldMessage(field, d.message);
      } else {
        generic = translateApiMessage(d.message);
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
      setTouched((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.keys(fieldErrors).map((f) => [f, true])),
      }));
    }
    return (
      generic ??
      apiErrorMessageForStatus(e.status) ??
      translateApiMessage(e.message) ??
      'Запрос не выполнен. Попробуйте ещё раз.'
    );
  };

  const handleSubmit = async () => {
    setFormError(null);

    const nextErrors: AuthFieldErrors = isLogin
      ? validateLoginForm({ email, password })
      : validateRegisterForm({ firstName, email, phone, password, confirmPassword });

    setErrors(nextErrors);
    setTouched({
      email: true,
      password: true,
      ...(isLogin ? {} : { firstName: true, phone: true, confirmPassword: true }),
    });

    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const profile: RegisterProfile | undefined = isLogin
        ? undefined
        : {
            firstName: firstName.trim(),
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          };
      await onSubmit(email.trim().toLowerCase(), password, profile);
      // Успех обрабатывает родитель (AuthGate): экран заменяется Home/Dashboard.
    } catch (e) {
      setFormError(mapApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.logo} accessibilityElementsHidden>
            🐾
          </Text>
          <Text style={styles.title}>{isLogin ? (language === 'ru' ? 'Вход в аккаунт' : 'Sign in') : (language === 'ru' ? 'Создание аккаунта' : 'Create an account')}</Text>
          <Text style={styles.subtitle}>{language === 'ru' ? 'Pet Care — забота о питомце без напоминаний вслух' : 'Pet Care — keep track of your pet’s care'}</Text>

          {!isLogin && (
            <Field label={language === 'ru' ? 'Имя' : 'First name'} error={fieldError('firstName')}>
              <TextInput
                style={[styles.input, fieldError('firstName') ? styles.inputError : null]}
                placeholder={language === 'ru' ? 'Как к вам обращаться?' : 'What should we call you?'}
                value={firstName}
                onChangeText={(v) => {
                  setFirstName(v);
                  if (touched.firstName) setErrorFor('firstName', validateFirstName(v));
                }}
                onBlur={handleBlur('firstName')}
                autoComplete="name"
                textContentType="givenName"
                maxLength={80}
                editable={!busy}
                accessibilityLabel={language === 'ru' ? 'Имя' : 'First name'}
                accessibilityRole="text"
                accessibilityState={{ disabled: busy }}
              />
            </Field>
          )}

          <Field label={language === 'ru' ? 'Электронная почта' : 'Email'} error={fieldError('email')}>
            <TextInput
              style={[styles.input, fieldError('email') ? styles.inputError : null]}
              placeholder="name@example.com"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (touched.email) setErrorFor('email', validateEmail(v));
              }}
              onBlur={handleBlur('email')}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              maxLength={255}
              editable={!busy}
              accessibilityLabel={language === 'ru' ? 'Электронная почта' : 'Email'}
              accessibilityRole="text"
              accessibilityState={{ disabled: busy }}
            />
          </Field>

          {!isLogin && (
            <Field label={language === 'ru' ? 'Телефон' : 'Phone'} optional error={fieldError('phone')}>
              <TextInput
                style={[styles.input, fieldError('phone') ? styles.inputError : null]}
                placeholder="+7 900 123-45-67"
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  if (touched.phone) setErrorFor('phone', validatePhone(v));
                }}
                onBlur={handleBlur('phone')}
                autoComplete="tel"
                keyboardType="phone-pad"
                maxLength={20}
                editable={!busy}
                accessibilityLabel={language === 'ru' ? 'Телефон, необязательно' : 'Phone, optional'}
                accessibilityRole="text"
                accessibilityState={{ disabled: busy }}
              />
            </Field>
          )}

          <Field
            label={language === 'ru' ? 'Пароль' : 'Password'}
            error={fieldError('password')}
            trailing={
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={spacing.x2}
                style={({ pressed }) => [styles.eyeButton, pressed ? styles.pressed : null]}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? (language === 'ru' ? 'Скрыть пароль' : 'Hide password') : (language === 'ru' ? 'Показать пароль' : 'Show password')}
                accessibilityState={{ selected: showPassword }}
              >
                <Text style={styles.eyeIcon} accessibilityElementsHidden>
                  {showPassword ? '🙈' : '👁'}
                </Text>
              </Pressable>
            }
          >
            <TextInput
              style={[
                styles.input,
                styles.inputWithTrailing,
                fieldError('password') ? styles.inputError : null,
              ]}
              placeholder={isLogin ? (language === 'ru' ? 'Введите пароль' : 'Enter your password') : (language === 'ru' ? 'Минимум 8 символов' : 'At least 8 characters')}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (touched.password) setErrorFor('password', validatePassword(v, isLogin));
                if (!isLogin && touched.confirmPassword) {
                  setErrorFor('confirmPassword', validateConfirmPassword(v, confirmPassword));
                }
              }}
              onBlur={handleBlur('password')}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={isLogin ? 'password' : 'new-password'}
              textContentType={isLogin ? 'password' : 'newPassword'}
              maxLength={72}
              editable={!busy}
              accessibilityLabel={language === 'ru' ? 'Пароль' : 'Password'}
              accessibilityState={{ disabled: busy }}
            />
          </Field>

          {!isLogin && (
            <Field label={language === 'ru' ? 'Подтверждение пароля' : 'Confirm password'} error={fieldError('confirmPassword')}>
              <TextInput
                style={[styles.input, fieldError('confirmPassword') ? styles.inputError : null]}
                placeholder={language === 'ru' ? 'Повторите пароль' : 'Repeat password'}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (touched.confirmPassword) {
                    setErrorFor('confirmPassword', validateConfirmPassword(password, v));
                  }
                }}
                onBlur={handleBlur('confirmPassword')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                maxLength={72}
                editable={!busy}
                accessibilityLabel={language === 'ru' ? 'Подтверждение пароля' : 'Confirm password'}
                accessibilityState={{ disabled: busy }}
              />
            </Field>
          )}

          {formError !== null && (
            <View style={styles.errorBanner} accessibilityLiveRegion="polite">
              <Text style={styles.errorBannerText}>{localizeAuthError(formError, language)}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.pressed : null,
              busy ? styles.buttonDisabled : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isLogin ? (language === 'ru' ? 'Войти' : 'Sign in') : (language === 'ru' ? 'Создать аккаунт' : 'Create account')}
            accessibilityState={{ busy, disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>{isLogin ? (language === 'ru' ? 'Войти' : 'Sign in') : (language === 'ru' ? 'Создать аккаунт' : 'Create account')}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onSwitchMode}
            disabled={busy}
            hitSlop={spacing.x2}
            style={({ pressed }) => [styles.switchLink, pressed ? styles.pressed : null]}
            accessibilityRole="link"
            accessibilityLabel={isLogin ? (language === 'ru' ? 'Перейти к регистрации' : 'Go to sign up') : (language === 'ru' ? 'Перейти ко входу' : 'Go to sign in')}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.switchText}>
              {isLogin ? (language === 'ru' ? 'Нет аккаунта? Зарегистрироваться' : 'New to Pet Care? Sign up') : (language === 'ru' ? 'Уже есть аккаунт? Войти' : 'Already have an account? Sign in')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- helpers ---------- */

interface FieldProps {
  label: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
  trailing?: ReactNode;
}

function Field({ label, optional, error, children, trailing }: FieldProps) {
  const language = useLanguage();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>{language === 'ru' ? 'необязательно' : 'optional'}</Text> : null}
      </View>
      <View style={styles.inputWrap}>
        {children}
        {trailing}
      </View>
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {localizeAuthError(error, language)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBackground },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: layout.pagePaddingX,
    paddingVertical: spacing.x8,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.x6,
    gap: stack.base,
  },
  logo: { fontSize: fontSize['3xl'], textAlign: 'center' },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.x2,
  },
  field: { gap: spacing.x1 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.x2 },
  label: { ...typography.bodyStrong, color: colors.textPrimary },
  optional: { ...typography.caption, color: colors.textTertiary },
  inputWrap: { position: 'relative' },
  input: {
    minHeight: layout.minTouchTarget, // WCAG AA touch target
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
    fontSize: fontSize.md, // >=16dp: предотвращает zoom-on-focus на iOS
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputWithTrailing: { paddingRight: layout.minTouchTarget },
  inputError: { borderColor: colors.danger },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: { fontSize: fontSize.base },
  fieldError: { ...typography.caption, color: colors.danger },
  errorBanner: {
    backgroundColor: colors.dangerSubtle,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.x3,
  },
  errorBannerText: { ...typography.body, color: colors.danger },
  button: {
    minHeight: layout.minTouchTarget,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.x4,
    marginTop: spacing.x1,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { ...typography.button, color: colors.onPrimary },
  pressed: { opacity: 0.85 },
  switchLink: {
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: { ...typography.body, color: colors.primaryStrong },
});
