import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MonsterList } from './MonsterList';
import { loadPlannerProgress } from '../utils/storage';

jest.mock('../data/monsters', () => ({
  MONSTERS: [
    { id: 'pizzaro', name: 'Pizzaro', family: 'Boss' },
    { id: 'slime', name: 'Slime', family: 'Slime' },
    { id: 'drakslime', name: 'DrakSlime', family: 'Dragon' },
    { id: 'spotking', name: 'SpotKing', family: 'Slime' }
  ],
  getMonsterById: (id: string) => {
    const byId: Record<string, { id: string; name: string; family: string }> = {
      pizzaro: { id: 'pizzaro', name: 'Pizzaro', family: 'Boss' },
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

  it('shows eggs with hatch gender actions before nickname input is shown', () => {
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
    expect(screen.getByRole('button', { name: 'Hatch Male' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hatch Female' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Hatch nickname...')).not.toBeInTheDocument();
  });

  it('allows choosing male hatch, then entering nickname and confirming', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Hatch Male' }));
    const hatchControls = screen.getByTestId('egg-hatch-controls-egg-1');
    expect(within(hatchControls).getByPlaceholderText('Nickname')).toBeInTheDocument();
    expect(within(hatchControls).getByRole('button', { name: 'Hatch M' })).toBeInTheDocument();
    const actionStack = within(hatchControls).getByTestId('egg-hatch-action-stack-egg-1');
    expect(within(actionStack).getByRole('button', { name: 'Hatch M' })).toBeInTheDocument();
    expect(within(actionStack).getByRole('button', { name: 'Back' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Nickname'), {
      target: { value: 'HatchedOne' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hatch M' }));
    expect(onOwnedMonsterHatch).toHaveBeenCalledWith('egg-1', 'male', 'HatchedOne');
  });

  it('allows choosing female hatch, then entering nickname and confirming', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Hatch Female' }));
    fireEvent.change(screen.getByPlaceholderText('Nickname'), {
      target: { value: 'HatchedOne' }
    });

    expect(screen.getByRole('button', { name: 'Hatch F' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hatch F' }));
    expect(onOwnedMonsterHatch).toHaveBeenCalledWith('egg-1', 'female', 'HatchedOne');
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

  it('opens breed flow, filters mates to opposite gender, and previews result', () => {
    render(
      <MonsterList
        {...baseProps}
        ownedMonsters={[
          { id: 'male-slime', monsterId: 'slime', gender: 'male', nickname: 'Slib' },
          { id: 'female-drak', monsterId: 'drakslime', gender: 'female', nickname: 'Draki' },
          { id: 'male-pizz', monsterId: 'pizzaro', gender: 'male', nickname: 'Piz' }
        ]}
        ownedKeys={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Breed' }));

    const pedigreeSelect = screen.getByLabelText('Pedigree');
    fireEvent.change(pedigreeSelect, { target: { value: 'male-slime' } });

    const mateSelect = screen.getByLabelText('Mate');
    expect(within(mateSelect).getByRole('option', { name: /DrakSlime \[Draki\] \(Female\)/i })).toBeInTheDocument();
    expect(within(mateSelect).queryByRole('option', { name: /Pizzaro \[Piz\] \(Male\)/i })).not.toBeInTheDocument();

    fireEvent.change(mateSelect, { target: { value: 'female-drak' } });
    expect(screen.getByText('Result Preview')).toBeInTheDocument();
    expect(screen.getByText('SpotKing')).toBeInTheDocument();
  });

  it('confirms breeding by removing parents, adding child egg, and closing the popover', () => {
    const onOwnedMonsterRemove = jest.fn();
    const onOwnedMonsterAdd = jest.fn();

    render(
      <MonsterList
        {...baseProps}
        onOwnedMonsterRemove={onOwnedMonsterRemove}
        onOwnedMonsterAdd={onOwnedMonsterAdd}
        ownedMonsters={[
          { id: 'male-slime', monsterId: 'slime', gender: 'male', nickname: 'Slib' },
          { id: 'female-drak', monsterId: 'drakslime', gender: 'female', nickname: 'Draki' }
        ]}
        ownedKeys={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Breed' }));
    fireEvent.change(screen.getByLabelText('Pedigree'), { target: { value: 'male-slime' } });
    fireEvent.change(screen.getByLabelText('Mate'), { target: { value: 'female-drak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Breed' }));

    expect(onOwnedMonsterRemove).toHaveBeenCalledWith('male-slime');
    expect(onOwnedMonsterRemove).toHaveBeenCalledWith('female-drak');
    expect(onOwnedMonsterAdd).toHaveBeenCalledWith('spotking', 'male', 'Egg', true);
    expect(screen.queryByText('Result Preview')).not.toBeInTheDocument();
  });

  it('renders breed action in stable header actions container', () => {
    render(
      <MonsterList
        {...baseProps}
        ownedMonsters={[
          { id: 'male-slime', monsterId: 'slime', gender: 'male', nickname: 'Slib' },
          { id: 'female-drak', monsterId: 'drakslime', gender: 'female', nickname: 'Draki' }
        ]}
        ownedKeys={[]}
      />
    );

    const headerActions = screen.getByTestId('stable-header-actions');
    expect(within(headerActions).getByRole('button', { name: 'Breed' })).toBeInTheDocument();
  });

  it('renders add monster form in grouped container with dedicated egg toggle control', () => {
    render(
      <MonsterList
        {...baseProps}
        ownedMonsters={[]}
        ownedKeys={[]}
      />
    );

    expect(screen.getByTestId('stable-add-form')).toBeInTheDocument();
    const eggControl = screen.getByTestId('add-as-egg-control');
    expect(within(eggControl).getByLabelText('Add as Egg')).toBeInTheDocument();
  });

  it('renders breed panel with grouped form and secondary cancel action styling', () => {
    render(
      <MonsterList
        {...baseProps}
        ownedMonsters={[
          { id: 'male-slime', monsterId: 'slime', gender: 'male', nickname: 'Slib' },
          { id: 'female-drak', monsterId: 'drakslime', gender: 'female', nickname: 'Draki' }
        ]}
        ownedKeys={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Breed' }));
    expect(screen.getByTestId('breed-form-grid')).toBeInTheDocument();

    const actions = screen.getByTestId('breed-actions');
    expect(within(actions).getByRole('button', { name: 'Confirm Breed' })).toBeInTheDocument();
    expect(within(actions).getByRole('button', { name: 'Cancel' })).toHaveClass('breed-cancel-btn');
  });
});
