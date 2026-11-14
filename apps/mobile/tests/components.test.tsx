import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';
import { QuickPurchaseModal, DashboardScreen } from '../src/screens/DashboardScreen';
import { AppState, changeAppState, listeners } from './nativeMock';
import { AddToGoogleCalendar } from '../src/components/AddToGoogleCalendar';
import { LanguageContext } from '../src/i18n/language';
import { api } from '../src/api/client';
vi.mock('../src/api/client', () => ({ api: { createShoppingItem: vi.fn(), createFoodProduct: vi.fn(), listPets: vi.fn(), listTasks: vi.fn(), listAppointments: vi.fn(), listFoodProducts: vi.fn() }, ApiError: Error, resolveFileUrl: () => null }));
vi.mock('../src/auth/tokenStore', () => ({ tokenStore: { get: vi.fn(async () => 'token') } }));
vi.mock('../src/navigation/AppStack', () => ({ useNavigation: () => ({ push: vi.fn() }) }));
vi.mock('../src/components/ScreenHeader', () => ({ ScreenHeader: () => null, headerActionStyles: {} }));
vi.mock('../src/components/DashboardSkeleton', () => ({ DashboardSkeleton: () => null }));
vi.mock('../src/components/Typography', () => ({ Text: 'Text', TextInput: 'TextInput' }));
vi.mock('@react-native-community/datetimepicker', () => ({ default: () => null }));
let tree: ReactTestRenderer;
const renderedText = () => tree.root.findAllByType('Text' as any)
  .flatMap((node) => node.children.filter((child) => typeof child === 'string')).join(' ');
const input = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const submit = () => input('Добавить покупку').props.onPress();
async function mountModal(onClose = vi.fn(), onCreated = vi.fn()) {
  await act(async () => { tree = create(<QuickPurchaseModal visible onClose={onClose} onCreated={onCreated} />); });
  return { onClose, onCreated };
}
beforeEach(() => { vi.clearAllMocks(); AppState.currentState = 'active'; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.useRealTimers(); });
it.each([
  ['ru', 'Добавить в Google Calendar'],
  ['en', 'Add to Google Calendar'],
] as const)('localizes the calendar action in %s', async (language, label) => {
  await act(async () => {
    tree = create(
      <LanguageContext.Provider value={language}>
        <AddToGoogleCalendar title="Visit" startsAt="2026-11-14T09:00:00Z" />
      </LanguageContext.Provider>,
    );
  });
  expect(input(`${label}: Visit`)).toBeDefined();
  expect(renderedText()).toContain(label);
});

describe('quick custom purchase API interaction', () => {
  it('trim/default PCS, closes/resets, never creates a product; refresh independent', async () => {
    const callbacks = await mountModal();
    await act(async () => input('Название товара').props.onChangeText('  Наполнитель  '));
    await act(async () => submit());
    expect(api.createShoppingItem).toHaveBeenCalledWith({ customName: 'Наполнитель', quantity: 1, unit: 'PCS' }, 'token');
    expect(api.createFoodProduct).not.toHaveBeenCalled();
    expect(callbacks.onClose).toHaveBeenCalledOnce(); expect(callbacks.onCreated).toHaveBeenCalledOnce();
    expect(input('Название товара').props.value).toBe(''); expect(input('Количество').props.value).toBe('1');
    await act(async () => tree.update(<QuickPurchaseModal visible={false} {...callbacks} />));
    await act(async () => tree.update(<QuickPurchaseModal visible {...callbacks} />));
    expect(input('Название товара').props.value).toBe(''); expect(input('Количество').props.value).toBe('1');
  });
  it.each(['', '0', '1000', '1.2', '1,2', 'abc'])('invalid quantity %s blocks POST', async (qty) => {
    await mountModal();
    await act(async () => { input('Название товара').props.onChangeText('Name'); input('Количество').props.onChangeText(qty); });
    await act(async () => submit()); expect(api.createShoppingItem).not.toHaveBeenCalled();
  });
  it('double tap guard, pending cancel disabled, error preserves input and retry succeeds', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(api.createShoppingItem).mockImplementationOnce(() => new Promise((_resolve, r) => { reject = r; }));
    const callbacks = await mountModal();
    await act(async () => { input('Название товара').props.onChangeText('Name'); input('Количество').props.onChangeText('999'); });
    await act(async () => { submit(); submit(); });
    expect(api.createShoppingItem).toHaveBeenCalledOnce(); expect(input('Добавить покупку').props.disabled).toBe(true);
    await act(async () => tree.root.findByType('Modal' as any).props.onRequestClose());
    expect(callbacks.onClose).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Network failed')));
    expect(input('Название товара').props.value).toBe('Name'); expect(input('Количество').props.value).toBe('999');
    expect(renderedText()).toContain('Network failed');
    await act(async () => submit()); expect(api.createShoppingItem).toHaveBeenCalledTimes(2); expect(callbacks.onClose).toHaveBeenCalledOnce();
  });
  it.each(['', ' '.repeat(3), 'x'.repeat(151)])('invalid name blocks POST', async (name) => {
    await mountModal(); await act(async () => input('Название товара').props.onChangeText(name));
    await act(async () => submit()); expect(api.createShoppingItem).not.toHaveBeenCalled();
    expect(renderedText()).toContain('Название должно содержать');
  });
  it.each([['x', '1'], ['x'.repeat(150), '999']])('accepts exact name and quantity boundaries', async (name, qty) => {
    await mountModal(); await act(async () => { input('Название товара').props.onChangeText(name); input('Количество').props.onChangeText(qty); });
    await act(async () => submit()); expect(api.createShoppingItem).toHaveBeenCalledWith({ customName: name, quantity: Number(qty), unit: 'PCS' }, 'token');
  });
  it('refresh failure cannot repeat POST or display creation error', async () => {
    // Dashboard.load catches its own GET failure; the modal receives a void callback.
    const refreshError = vi.fn();
    await mountModal(vi.fn(), vi.fn(() => { void Promise.reject(new Error('Refresh failed')).catch(refreshError); }));
    await act(async () => input('Название товара').props.onChangeText('Name'));
    await act(async () => submit());
    expect(refreshError).toHaveBeenCalledOnce();
    expect(api.createShoppingItem).toHaveBeenCalledOnce(); expect(input('Название товара').props.value).toBe('');
    expect(renderedText()).not.toContain('Refresh failed');
  });
  it('cancel before submit causes no mutations', async () => {
    const callbacks = await mountModal();
    await act(async () => tree.root.findByType('Modal' as any).props.onRequestClose());
    expect(callbacks.onClose).toHaveBeenCalledOnce(); expect(api.createShoppingItem).not.toHaveBeenCalled();
  });
});
describe('dashboard clock lifecycle and view model', () => {
  it('updates urgency/count/feed without network; foreground midnight; cleans resources', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T12:00:00+03:00'));
    vi.mocked(api.listPets).mockResolvedValue([{ id: 1, name: 'Pet', species: 'CAT', birthDate: null } as any]);
    vi.mocked(api.listTasks).mockResolvedValue([{ id: 1, title: 'Deadline', petName: 'Pet', status: 'PENDING', dueAt: new Date(Date.now() + 1).toISOString() } as any]);
    vi.mocked(api.listAppointments).mockResolvedValue([]); vi.mocked(api.listFoodProducts).mockResolvedValue([]);
    await act(async () => { tree = create(<DashboardScreen user={{ email: 'user@example.com' } as any} onLogout={vi.fn()} onTabChange={vi.fn()} />); });
    expect(renderedText()).toContain('На сегодня задач: 1');
    await act(async () => { vi.advanceTimersByTime(60_000); });
    const json = renderedText(); expect(json).toContain('Просрочено задач: 1'); expect(json).toContain('Просрочено сегодня'); expect(json).toContain('Впереди нет запланированных событий');
    expect(api.listTasks).toHaveBeenCalledOnce();
    await act(async () => changeAppState('background')); expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(new Date('2026-11-14T12:00:00+03:00'));
    await act(async () => changeAppState('active'));
    expect(renderedText()).toContain('Просрочено на 1 день'); expect(api.listTasks).toHaveBeenCalledOnce();
    await act(async () => tree.unmount()); expect(listeners.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
});
