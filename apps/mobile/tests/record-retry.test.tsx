import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { RecordFormScreen } from '../src/screens/RecordFormScreen';

const pop = vi.hoisted(() => vi.fn());
vi.mock('../src/navigation/AppStack', () => ({ useNavigation: () => ({ pop }) }));
vi.mock('../src/auth/tokenStore', () => ({ tokenStore: { get: async () => 'token' } }));
vi.mock('../src/components/Typography', () => ({ Text: 'Text', TextInput: 'TextInput' }));
vi.mock('../src/components/DateField', () => ({ DateField: () => null }));
vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => ({
    canceled: false,
    assets: [{ uri: 'file:///result.pdf', name: 'result.pdf', mimeType: 'application/pdf' }],
  }),
}));
vi.mock('./nativeMock', async (importOriginal) => ({
  ...await importOriginal<typeof import('./nativeMock')>(),
  Alert: { alert: vi.fn() },
}));

it('reuses keys on retry and resumes uploading to the saved record', async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error('Lost create response'))
    .mockResolvedValueOnce(Response.json({ id: 42 }, { status: 201 }))
    .mockRejectedValueOnce(new Error('Lost attachment response'))
    .mockResolvedValueOnce(Response.json({ id: 42 }));
  vi.stubGlobal('fetch', fetchMock);
  // Node FormData expects a Blob, while React Native accepts the device file URI.
  vi.stubGlobal('FormData', class { append() {} });
  const { Platform } = await import('./nativeMock');
  const platform = Platform.OS;
  Platform.OS = 'web';
  let tree: ReactTestRenderer | undefined;

  try {
    await act(async () => { tree = create(<RecordFormScreen petId={1} />); });
    const press = (label: RegExp) => {
      const button = tree!.root.findAllByType('Pressable' as never).find((node) =>
        node.findAllByType('Text' as never).some((text) => label.test(text.props.children)));
      expect(button).toBeDefined();
      button!.props.onPress();
    };

    await act(async () => press(/Прикрепить фото|Attach photo/));
    for (let attempt = 0; attempt < 3; attempt++) {
      await act(async () => press(/Сохранить запись|Save record/));
    }

    expect(pop).toHaveBeenCalledOnce();
    const requests = fetchMock.mock.calls.map(([url, options]) => [
      new URL(url).pathname,
      options.headers['Idempotency-Key'],
    ]);
    expect(requests).toEqual([
      ['/api/v1/records', expect.any(String)],
      ['/api/v1/records', requests[0][1]],
      ['/api/v1/records/42/attachments', expect.any(String)],
      ['/api/v1/records/42/attachments', requests[2][1]],
    ]);
    expect(requests[0][1]).not.toBe(requests[2][1]);
  } finally {
    await act(async () => tree?.unmount());
    Platform.OS = platform;
    vi.unstubAllGlobals();
  }
});
