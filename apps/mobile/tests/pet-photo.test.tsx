import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { Image, Text } from 'react-native';
import { PetPhoto } from '../src/components/PetPhoto';
import { tokenStore } from '../src/auth/tokenStore';

vi.mock('../src/api/client', () => ({ resolveFileUrl: (path: string) => path }));
vi.mock('../src/auth/tokenStore', () => ({ tokenStore: { get: vi.fn() } }));

it('keeps the placeholder until the image loads and restores it on error', async () => {
  let resolveToken!: (token: string) => void;
  vi.mocked(tokenStore.get).mockReturnValue(new Promise((resolve) => { resolveToken = resolve; }));

  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PetPhoto path="/files/pets/photo.jpg" fallback={<Text>Placeholder</Text>} />);
  });

  try {
    const placeholders = () => tree.root.findAllByType(Text);
    expect(placeholders()).toHaveLength(1);
    expect(tree.root.findAllByType(Image)).toHaveLength(0);

    await act(async () => resolveToken('token'));
    const image = tree.root.findByType(Image);
    expect(placeholders()).toHaveLength(1);

    await act(async () => image.props.onLoad({}));
    expect(placeholders()).toHaveLength(0);

    await act(async () => image.props.onError({}));
    expect(placeholders()).toHaveLength(1);
  } finally {
    await act(async () => tree.unmount());
  }
});
