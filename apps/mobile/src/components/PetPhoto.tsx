import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Image, Platform, StyleSheet } from 'react-native';
import type { ImageProps, ImageSourcePropType } from 'react-native';
import { resolveFileUrl } from '../api/client';
import { tokenStore } from '../auth/tokenStore';

type PetPhotoProps = Omit<ImageProps, 'source'> & {
  path?: string | null;
  fallback: ReactNode;
};

export function PetPhoto({ path, fallback, style, onLoad, onError, ...props }: PetPhotoProps) {
  const [loaded, setLoaded] = useState<{ path: string; source: ImageSourcePropType } | null>(null);

  const [visibleSource, setVisibleSource] = useState<ImageSourcePropType | null>(null);

  useEffect(() => {
    setLoaded(null);
    if (!path) return;
    const photoPath = path;
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
        setLoaded({ path: photoPath, source: { uri: photoUrl, headers } });
        return;
      }

      const response = await fetch(photoUrl, { headers, redirect: 'error', signal: controller.signal });
      if (!response.ok) return;
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ path: photoPath, source: { uri: objectUrl } });
    }

    void load(uri).catch(() => {
      if (!controller.signal.aborted) setLoaded(null);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!loaded || loaded.path !== path) return fallback;

  const { source } = loaded;
  const visible = source === visibleSource;

  return (
    <>
      {!visible && fallback}
      <Image
        {...props}
        source={source}
        style={visible ? style : [style, styles.loading]}
        accessible={visible ? props.accessible : false}
        onLoad={(event) => {
          setVisibleSource(source);
          onLoad?.(event);
        }}
        onError={(event) => {
          setVisibleSource(null);
          onError?.(event);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { position: 'absolute', opacity: 0 },
});
