import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import RecordFormModal from '../src/components/RecordFormModal'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('reuses the create and per-file keys after lost responses', async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error('Lost create response'))
    .mockResolvedValueOnce(Response.json({ id: 42 }, { status: 201 }))
    .mockResolvedValueOnce(Response.json({ id: 42 }))
    .mockRejectedValueOnce(new Error('Lost attachment response'))
    .mockResolvedValueOnce(Response.json({ id: 42 }))
  vi.stubGlobal('fetch', fetchMock)
  const saved = vi.fn()
  const { container } = render(
    <RecordFormModal petId={1} token="token" appointments={[]} existingRecordIds={[]}
      onClose={vi.fn()} onSaved={saved} />,
  )
  fireEvent.change(container.querySelector('input[type=file]')!, {
    target: { files: [new File(['one'], 'one.pdf'), new File(['two'], 'two.pdf')] },
  })
  const submit = () => fireEvent.submit(container.querySelector('form')!)

  submit()
  await screen.findByRole('alert')
  submit()
  await screen.findByRole('alert')
  submit()
  await waitFor(() => expect(saved).toHaveBeenCalledOnce())

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/records', '/api/v1/records',
    '/api/v1/records/42/attachments', '/api/v1/records/42/attachments', '/api/v1/records/42/attachments',
  ])
  const keys = fetchMock.mock.calls.map(([, options]) => options.headers['Idempotency-Key'])
  expect(keys.every(Boolean)).toBe(true)
  expect(keys[0]).toBe(keys[1])
  expect(keys[3]).toBe(keys[4])
  expect(keys[2]).not.toBe(keys[3])
})
