import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Header } from '../../../src/web/components/layout/Header'
import { ThemeProvider } from '../../../src/web/contexts/ThemeContext'

function renderWithRouter(component: React.ReactNode) {
  return render(
    <BrowserRouter>
      <ThemeProvider>{component}</ThemeProvider>
    </BrowserRouter>
  )
}

describe('Header', () => {
  it('renders app title', () => {
    renderWithRouter(<Header />)

    expect(screen.getByText('Git')).toBeDefined()
    expect(screen.getByText('Human')).toBeDefined()
  })

  it('renders navigation links', () => {
    renderWithRouter(<Header />)

    expect(screen.getAllByText('Changes').length).toBeGreaterThan(0)
    expect(screen.getByText('Reviews')).toBeDefined()
  })

  it('renders repo name when provided', () => {
    renderWithRouter(<Header repoName='my-project' />)

    expect(screen.getByText('my-project')).toBeDefined()
  })

  it('renders branch when provided', () => {
    renderWithRouter(<Header repoName='my-project' branch='main' />)

    expect(screen.getByText('main')).toBeDefined()
  })

  it('does not render branch without repo name', () => {
    renderWithRouter(<Header branch='main' />)

    // Branch should not appear without repo name
    expect(screen.queryByText('main')).toBeNull()
  })

  it('links to correct routes', () => {
    renderWithRouter(<Header />)

    const stagedLink = screen.getAllByText('Changes')[0].closest('a')
    const reviewsLink = screen.getByText('Reviews').closest('a')
    const titleLink = screen.getByText('Git').closest('a')

    expect(stagedLink?.getAttribute('href')).toBe('/')
    expect(reviewsLink?.getAttribute('href')).toBe('/reviews')
    expect(titleLink?.getAttribute('href')).toBe('/')
  })
})
