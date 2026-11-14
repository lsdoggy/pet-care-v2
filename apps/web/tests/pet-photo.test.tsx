import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePetPhoto } from '../src/lib/usePetPhoto'

vi.mock('../src/auth/tokenStore', () => ({ tokenStore: { get: () => 'test-token' } }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Photo({ path }: { path: string }) {
  const url = usePetPhoto(path)
  return url ? <img src={url} alt="" /> : <span>Placeholder</span>
}

it('loads a stored image with authorization and releases its URL on unmount', async () => {
  const path = '/files/pets/photo.png'
  const blob = new Blob(['photo'], { type: 'image/png' })
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob })
  const createObjectURL = vi.fn().mockReturnValue('blob:pet-photo')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }))

  const view = render(<Photo path={path} />)
  await waitFor(() => expect(view.container.querySelector('img')?.getAttribute('src')).toBe('blob:pet-photo'))
  expect(fetchMock).toHaveBeenCalledWith(path, expect.objectContaining({
    headers: { Authorization: 'Bearer test-token' },
    redirect: 'error',
  }))
  expect(createObjectURL).toHaveBeenCalledWith(blob)

  view.unmount()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:pet-photo')
})
