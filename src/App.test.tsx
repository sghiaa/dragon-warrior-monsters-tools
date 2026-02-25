import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders app title', () => {
  render(<App />);
  expect(screen.getByText(/Dragon Warrior Monsters 2 Breeding Planner/i)).toBeInTheDocument();
});

test('closes monster detail when switching tabs', async () => {
  window.location.hash = '#monster/roboster1';
  render(<App />);

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
    expect(screen.getByTestId('monster-detail-view')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: 'My Collection' }));

  await waitFor(() => {
    expect(window.location.hash.startsWith('#monster/')).toBe(false);
  });
});
