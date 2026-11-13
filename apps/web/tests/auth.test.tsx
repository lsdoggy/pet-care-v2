import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  me: vi.fn().mockResolvedValue({ id: 1, email: 'owner@example.test' }),
  clear: vi.fn(),
}))
vi.mock('../src/api/client', () => ({ api: { me: mocks.me } }))
vi.mock('../src/auth/tokenStore', () => ({ tokenStore: { get: () => 'stored-token', clear: mocks.clear } }))
afterEach(cleanup)

it('real provider and hook share context; stored session bootstraps and logout clears it', async () => {
  // Import after Vitest resets mocks so the module-level bootstrap call is observable.
  vi.resetModules()
  const { AuthProvider } = await import('../src/auth/AuthProvider')
  const { useAuth } = await import('../src/auth/useAuth')
  function Consumer() {
    const auth = useAuth()
    return <><span>{auth.loading ? 'loading' : auth.user?.email ?? 'anonymous'}</span><button onClick={auth.logout}>logout</button></>
  }
  render(<AuthProvider><Consumer /></AuthProvider>)
  expect(await screen.findByText('owner@example.test')).toBeTruthy()
  expect(mocks.me).toHaveBeenCalledWith('stored-token')
  fireEvent.click(screen.getByRole('button', { name: 'logout' }))
  expect(screen.getByText('anonymous')).toBeTruthy()
  expect(mocks.clear).toHaveBeenCalledOnce()
})
