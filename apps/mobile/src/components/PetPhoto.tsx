import { useEffect, useState } from 'react';
import { Image, Platform } from 'react-native';
import type { ImageProps, ImageSourcePropType } from 'react-native';
import { resolveFileUrl } from '../api/client';
import { tokenStore } from '../auth/tokenStore';

export function PetPhoto({ path, ...props }: Omit<ImageProps, 'source'> & { path: string }) {
  const [loaded, setLoaded] = useState<{ path: string; source: ImageSourcePropType } | null>(null);

  useEffect(() => {
    if (!/^\/files\/(?:uploads\/)?pets\/[\w.-]+$/.test(path)) return;
    const uri = resolveFileUrl(path);
    if (!uri) return;

    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load(photoUrl: string) {
      const token = await tokenStore.get();
      if (!token || controller.signal.aborted) return;
      const headers = { Authorization: `Bearer ${token}` };

      if (Platform.OS !== 'web') {
        setLoaded({ path, source: { uri: photoUrl, headers } });
        return;
      }

      const response = await fetch(photoUrl, { headers, redirect: 'error', signal: controller.signal });
      if (!response.ok) return;
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ path, source: { uri: objectUrl } });
    }

    void load(uri).catch(() => {
      if (!controller.signal.aborted) setLoaded(null);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return loaded?.path === path ? <Image {...props} source={loaded.source} /> : null;
}
