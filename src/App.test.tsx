import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { UserMonster } from './types/monster';

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

jest.mock('./utils/breedingPathfinder', () => ({
  BreedingPathfinder: class MockBreedingPathfinder {
    userMonsters: UserMonster[];

    constructor(userMonsters: UserMonster[]) {
      this.userMonsters = userMonsters;
    }

    findBreedingPath(targetMonsterId: string) {
      const slimeCount = this.userMonsters
        .filter((monster) => monster.monsterId === 'slime')
        .reduce((sum, monster) => sum + monster.count, 0);
      const remaining = slimeCount > 0 ? {} : { Slime: 1 };

      return {
        targetMonster: targetMonsterId,
        isPossible: true,
        steps: [],
        missingMonsters: [],
        baseRequirements: { Slime: 1 },
        remainingRequirements: remaining,
        totalBaseRequired: 1,
        totalRemaining: slimeCount > 0 ? 0 : 1,
        tree: {
          kind: 'monster',
          value: targetMonsterId,
          left: { kind: 'family', value: 'Any Slime' },
          right: { kind: 'family', value: 'Any Slime' }
        }
      };
    }
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

test('hatching an egg applies the entered nickname', async () => {
  localStorage.setItem('dwm2-breeding-planner-data', JSON.stringify({
    userMonsters: [],
    ownedMonsters: [
      { id: 'egg-1', monsterId: 'slime', gender: 'male', nickname: 'Egg', isEgg: true }
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

  expect(screen.getByText('[Egg]')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hatch Male' }));
  fireEvent.change(screen.getByPlaceholderText('Nickname'), {
    target: { value: 'Slibo' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Hatch M' }));

  await waitFor(() => {
    expect(screen.getByText('[Slibo]')).toBeInTheDocument();
  });
  expect(screen.queryByText('[Egg]')).not.toBeInTheDocument();
});

test('planner totals in key interface update when adding a monster from collection', async () => {
  localStorage.setItem('dwm2-breeding-planner-data', JSON.stringify({
    userMonsters: [],
    ownedMonsters: [],
    ownedKeys: [{ id: 'k1', descriptor: 'Plain', family: 'Slime' }],
    ownedStoryKeyWorlds: [],
    plannerProgressByGoal: {},
    uiState: {
      activeTab: 'planner',
      selectedGoals: ['spotking'],
      plannerSeedMonsterIds: null
    },
    lastUpdated: new Date().toISOString()
  }));

  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Goal Planner' })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: 'My Collection' }));

  const findTotalsLine = () => screen.getByText((_content, node) => {
    if (!node || node.tagName !== 'P') {
      return false;
    }
    return (node.textContent || '').includes('Remaining after checked nodes:');
  });

  expect(findTotalsLine()).toHaveTextContent('Remaining after checked nodes: 1 (1 Slime (1 unassigned))');

  fireEvent.change(screen.getByPlaceholderText('Choose species...'), {
    target: { value: 'Slime' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add to Stable' }));

  await waitFor(() => {
    expect(findTotalsLine()).toHaveTextContent('Remaining after checked nodes: 0 (None)');
  });
});
