import { useEffect, useState } from 'react'
import { fetchPetPhoto } from '../api/client'
import { tokenStore } from '../auth/tokenStore'

export function usePetPhoto(photo: string | File | null | undefined): string | null {
  const token = tokenStore.get()
  const [loaded, setLoaded] = useState<{ photo: string | File; token: string | null; url: string } | null>(null)

  useEffect(() => {
    if (!photo) return
    const controller = new AbortController()
    let url: string | undefined

    const load = (blob: Blob) => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob)
      setLoaded({ photo, token, url })
    }

    if (photo instanceof File) {
      load(photo)
    } else if (token) {
      void fetchPetPhoto(photo, token, controller.signal).then(load).catch(() => {
        if (!controller.signal.aborted) setLoaded(null)
      })
    }

    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [photo, token])

  return loaded && loaded.photo === photo && loaded.token === token ? loaded.url : null
}
