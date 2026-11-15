import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../src/api/client'

afterEach(() => vi.unstubAllGlobals())

it.each(['/api/v1/record-attachments/test.pdf', '/files/records/test.png'])(
  'downloads %s with the owner session',
  async (path) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('fixture bytes'))
    vi.stubGlobal('fetch', fetchMock)

    const file = await api.fetchRecordAttachment(path, 'owner-session')
    expect(await file.text()).toBe('fixture bytes')
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(path, {
      headers: { Authorization: 'Bearer owner-session' },
      redirect: 'error',
    })
  },
)

it('rejects an external attachment URL before making a request', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  await expect(api.fetchRecordAttachment('https://example.org/test.pdf', 'owner-session')).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()
})
