import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MonsterList } from './MonsterList';
import { loadPlannerProgress } from '../utils/storage';

jest.mock('../data/monsters', () => ({
  MONSTERS: [
    { id: 'pizzaro', name: 'Pizzaro', family: 'Boss' }
  ],
  getMonsterById: (id: string) => {
    if (id === 'pizzaro') {
      return {
        id: 'pizzaro',
        name: 'Pizzaro',
        family: 'Boss',
        rank: 1,
        hpGrowth: 1,
        mpGrowth: 1,
        attackGrowth: 1,
        defenseGrowth: 1,
        agilityGrowth: 1,
        intelligenceGrowth: 1
      };
    }
    return undefined;
  }
}));

jest.mock('../utils/storage', () => ({
  loadPlannerProgress: jest.fn(() => null)
}));

describe('MonsterList key family highlighting', () => {
  const mockedLoadPlannerProgress = loadPlannerProgress as jest.MockedFunction<typeof loadPlannerProgress>;

  beforeEach(() => {
    mockedLoadPlannerProgress.mockReset();
    mockedLoadPlannerProgress.mockReturnValue(null);
  });

  const baseProps = {
    ownedMonsters: [],
    ownedStoryKeyWorlds: [],
    selectedGoals: [],
    breedingPlans: {},
    plannerSeedMonsterIds: null,
    monsterStepCounts: {},
    onOwnedMonsterAdd: jest.fn(),
    onOwnedMonsterRemove: jest.fn(),
    onOwnedMonsterGenderChange: jest.fn(),
    onOwnedMonsterHatch: jest.fn(),
    onOwnedKeyAdd: jest.fn(),
    onOwnedKeyRemove: jest.fn(),
    onToggleOwnedStoryKeyWorld: jest.fn()
  };

  it('highlights only keys that contain the selected family and toggles off when clicked again', () => {
    render(
      <MonsterList
        {...baseProps}
        ownedKeys={[
          { id: 'k1', descriptor: 'Plain', family: 'Beast' },
          { id: 'k2', descriptor: 'Blue', family: 'Water' }
        ]}
      />
    );

    const beastCard = screen.getByText('Plain Beast').closest('.key-card');
    const waterCard = screen.getByText('Blue Water').closest('.key-card');
    expect(beastCard).toBeInTheDocument();
    expect(waterCard).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Beast' }));
    expect(beastCard).toHaveClass('highlighted');
    expect(waterCard).toHaveClass('dimmed');

    fireEvent.click(screen.getByRole('button', { name: 'Beast' }));
    expect(beastCard).not.toHaveClass('highlighted');
    expect(waterCard).not.toHaveClass('dimmed');
  });

  it('suggests keys sorted by matched needed monsters, then descriptor rarity descending', () => {
    render(
      <MonsterList
        {...baseProps}
        selectedGoals={['darkdrium']}
        breedingPlans={{
          darkdrium: {
            targetMonster: 'darkdrium',
            isPossible: true,
            steps: [],
            missingMonsters: [],
            remainingRequirements: { Beast: 2, Slime: 1 }
          }
        }}
        ownedKeys={[
          { id: 'k1', descriptor: 'Plain', family: 'Beast' },
          { id: 'k2', descriptor: 'Last', family: 'Beast' },
          { id: 'k3', descriptor: 'Misty', family: 'Cave' },
          { id: 'k4', descriptor: 'Blue', family: 'Water' }
        ]}
      />
    );

    const suggestions = screen
      .getAllByText(/Matches \d+ needed monster/)
      .map((node) => node.closest('.suggestion-card'))
      .filter(Boolean) as HTMLElement[];

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toHaveTextContent('Last Beast');
    expect(suggestions[1]).toHaveTextContent('Plain Beast');
    expect(suggestions[2]).toHaveTextContent('Misty Cave');
    expect(screen.queryByText('Blue Water')).toBeInTheDocument();
    expect(screen.getByText('Blue Water').closest('.suggestion-card')).toBeNull();
  });

  it('uses checked planner progress to suggest keys for still-unfilled families', () => {
    mockedLoadPlannerProgress.mockImplementation((goalKey: string) => {
      if (goalKey === 'darkdrium::') {
        return {
          checkedNodes: ['root.L'],
          checkedNodeGenders: {},
          checkedNodeNames: {},
          lastUpdated: new Date().toISOString()
        };
      }
      return null;
    });

    render(
      <MonsterList
        {...baseProps}
        selectedGoals={['darkdrium']}
        breedingPlans={{
          darkdrium: {
            targetMonster: 'darkdrium',
            isPossible: true,
            steps: [],
            missingMonsters: [],
            baseRequirements: { Dragon: 1, Plant: 1 },
            remainingRequirements: {},
            tree: {
              kind: 'monster',
              value: 'darkdrium',
              left: { kind: 'family', value: 'Any Dragon' },
              right: { kind: 'family', value: 'Any Plant' }
            }
          }
        }}
        ownedKeys={[
          { id: 'k1', descriptor: 'Green', family: 'Mine' },
          { id: 'k2', descriptor: 'Blue', family: 'Lake' }
        ]}
      />
    );

    const suggestionCards = screen.getAllByText(/Matches \d+ needed monster/);
    expect(suggestionCards).toHaveLength(1);
    expect(screen.getByTestId('key-suggestion-k1')).toHaveTextContent('Green Mine');
    expect(screen.queryByTestId('key-suggestion-k2')).not.toBeInTheDocument();
  });

  it('shows eggs in stable and allows hatching to a selected gender', () => {
    const onOwnedMonsterHatch = jest.fn();
    render(
      <MonsterList
        {...baseProps}
        onOwnedMonsterHatch={onOwnedMonsterHatch}
        ownedMonsters={[
          { id: 'egg-1', monsterId: 'pizzaro', gender: 'male', nickname: 'Egg', isEgg: true }
        ]}
        ownedKeys={[]}
      />
    );

    expect(screen.getByText('Eggs (1)')).toBeInTheDocument();
    expect(screen.getByText('[Egg]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hatch Male' }));
    expect(onOwnedMonsterHatch).toHaveBeenCalledWith('egg-1', 'male');

    fireEvent.click(screen.getByRole('button', { name: 'Hatch Female' }));
    expect(onOwnedMonsterHatch).toHaveBeenCalledWith('egg-1', 'female');
  });

  it('allows adding a monster as an egg from the add form', () => {
    const onOwnedMonsterAdd = jest.fn();
    render(
      <MonsterList
        {...baseProps}
        onOwnedMonsterAdd={onOwnedMonsterAdd}
        ownedMonsters={[]}
        ownedKeys={[]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Choose species...'), {
      target: { value: 'Pizzaro' }
    });
    fireEvent.click(screen.getByLabelText('Add as Egg'));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Stable' }));

    expect(onOwnedMonsterAdd).toHaveBeenCalledWith('pizzaro', 'male', 'Egg', true);
  });
});
