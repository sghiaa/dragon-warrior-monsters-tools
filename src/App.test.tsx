import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('./data/monsters', () => ({
  __esModule: true,
  MONSTERS: [],
  BREEDING_PAIRS: [],
  RAW_BREEDING_PAIRS: [],
  initializeData: () => Promise.resolve(),
  canonicalMonsterId: (value: string) => value,
  getMonsterById: () => undefined
}));

test('renders app title', async () => {
  render(<App />);
  expect(screen.getByText(/Dragon Warrior Monsters 2 Breeding Planner/i)).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'My Collection' })).toBeInTheDocument();
  });
});

test('closes monster detail when switching tabs', async () => {
  window.location.hash = '#monster/roboster1';
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'My Collection' })).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByTestId('monster-detail-view')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: 'Goal Planner' }));

  await waitFor(() => {
    expect(screen.queryByTestId('monster-detail-view')).not.toBeInTheDocument();
  });
});

test('tab switch clears monster hash', async () => {
  window.location.hash = '#monster/roboster1';
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'My Collection' })).toBeInTheDocument();
  });

  await waitFor(() => {
    expect(screen.getByTestId('monster-detail-view')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: 'My Collection' }));

  await waitFor(() => {
    expect(window.location.hash.startsWith('#monster/')).toBe(false);
  });
});

test('shows share export and import controls', async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'My Collection' })).toBeInTheDocument();
  });

  expect(screen.getByRole('button', { name: 'Export Share' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import Share' })).toBeInTheDocument();
});
