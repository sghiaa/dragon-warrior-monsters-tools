import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

jest.mock('./data/monsters', () => ({
  __esModule: true,
  MONSTERS: [
    { id: 'slime', name: 'Slime', family: 'Slime' },
    { id: 'drakslime', name: 'DrakSlime', family: 'Dragon' },
    { id: 'spotking', name: 'SpotKing', family: 'Slime' }
  ],
  BREEDING_PAIRS: [],
  RAW_BREEDING_PAIRS: [],
  initializeData: () => Promise.resolve(),
  canonicalMonsterId: (value: string) => value,
  getMonsterById: (id: string) => {
    const byId: Record<string, { id: string; name: string; family: string }> = {
      slime: { id: 'slime', name: 'Slime', family: 'Slime' },
      drakslime: { id: 'drakslime', name: 'DrakSlime', family: 'Dragon' },
      spotking: { id: 'spotking', name: 'SpotKing', family: 'Slime' }
    };
    const monster = byId[id];
    if (!monster) {
      return undefined;
    }
    return {
      ...monster,
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    };
  },
  getBreedingResult: (parent1: string, parent2: string) => {
    const parents = [parent1, parent2].sort().join('+');
    if (parents === 'drakslime+slime') {
      return { parent1, parent2, result: 'spotking' };
    }
    return undefined;
  }
}));

beforeEach(() => {
  localStorage.clear();
});

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

test('breeding from stable removes parents and adds child egg', async () => {
  localStorage.setItem('dwm2-breeding-planner-data', JSON.stringify({
    userMonsters: [],
    ownedMonsters: [
      { id: 'male-slime', monsterId: 'slime', gender: 'male', nickname: 'Slib' },
      { id: 'female-drak', monsterId: 'drakslime', gender: 'female', nickname: 'Draki' }
    ],
    ownedKeys: [],
    ownedStoryKeyWorlds: [],
    plannerProgressByGoal: {},
    uiState: {},
    lastUpdated: new Date().toISOString()
  }));

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'My Collection' })).toBeInTheDocument();
  });

  expect(screen.getByText('My Stable (2)')).toBeInTheDocument();
  expect(screen.getByText('[Slib]')).toBeInTheDocument();
  expect(screen.getByText('[Draki]')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Breed' }));
  fireEvent.change(screen.getByLabelText('Pedigree'), { target: { value: 'male-slime' } });
  fireEvent.change(screen.getByLabelText('Mate'), { target: { value: 'female-drak' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Breed' }));

  await waitFor(() => {
    expect(screen.getByText('My Stable (1)')).toBeInTheDocument();
  });
  expect(screen.queryByText('[Slib]')).not.toBeInTheDocument();
  expect(screen.queryByText('[Draki]')).not.toBeInTheDocument();
  expect(screen.getByText('[Egg]')).toBeInTheDocument();
});
