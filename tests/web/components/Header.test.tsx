import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Header } from '../../../src/web/components/layout/Header';

function renderWithRouter(component: React.ReactNode) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('Header', () => {
  it('renders app title', () => {
    renderWithRouter(<Header />);

    expect(screen.getByText('Git')).toBeDefined();
    expect(screen.getByText('Human')).toBeDefined();
  });

  it('renders navigation links', () => {
    renderWithRouter(<Header />);

    expect(screen.getByText('Staged Changes')).toBeDefined();
    expect(screen.getByText('Reviews')).toBeDefined();
  });

  it('renders repo name when provided', () => {
    renderWithRouter(<Header repoName="my-project" />);

    expect(screen.getByText('my-project')).toBeDefined();
  });

  it('renders branch when provided', () => {
    renderWithRouter(<Header repoName="my-project" branch="main" />);

    expect(screen.getByText('main')).toBeDefined();
  });

  it('does not render branch without repo name', () => {
    renderWithRouter(<Header branch="main" />);

    // Branch should not appear without repo name
    expect(screen.queryByText('main')).toBeNull();
  });

  it('links to correct routes', () => {
    renderWithRouter(<Header />);

    const stagedLink = screen.getByText('Staged Changes').closest('a');
    const reviewsLink = screen.getByText('Reviews').closest('a');
    const titleLink = screen.getByText('Git').closest('a');

    expect(stagedLink?.getAttribute('href')).toBe('/staged');
    expect(reviewsLink?.getAttribute('href')).toBe('/');
    expect(titleLink?.getAttribute('href')).toBe('/');
  });
});
