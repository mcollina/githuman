import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { VersionBanner } from '../../../src/web/components/VersionBanner'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage })

describe('VersionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when no update is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.5.1' }) // Same as current
    })

    const { container } = render(<VersionBanner />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('https://registry.npmjs.org/githuman/latest')
    })

    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { container } = render(<VersionBanner />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false
    })

    const { container } = render(<VersionBanner />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    expect(container.firstChild).toBeNull()
  })

  it('renders banner when update is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.0.0' }) // Newer than current
    })

    render(<VersionBanner />)

    await waitFor(() => {
      expect(screen.getByText(/A new version of GitHuman is available/)).toBeDefined()
    })

    expect(screen.getByText('v1.0.0')).toBeDefined()
  })

  it('renders nothing when dismissed', async () => {
    mockSessionStorage.getItem.mockReturnValue('true')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.0.0' })
    })

    const { container } = render(<VersionBanner />)

    // Should not fetch when dismissed
    expect(mockFetch).not.toHaveBeenCalled()
    expect(container.firstChild).toBeNull()
  })

  it('dismisses banner when dismiss button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.0.0' })
    })

    render(<VersionBanner />)

    await waitFor(() => {
      expect(screen.getByText(/A new version of GitHuman is available/)).toBeDefined()
    })

    const dismissButton = screen.getByLabelText('Dismiss')
    fireEvent.click(dismissButton)

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('githuman-version-dismissed', 'true')
  })

  it('shows update command instruction', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '1.0.0' })
    })

    render(<VersionBanner />)

    await waitFor(() => {
      expect(screen.getByText('npm update -g githuman')).toBeDefined()
    })
  })
})
