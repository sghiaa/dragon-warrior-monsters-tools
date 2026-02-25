import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MovePlanner } from './MovePlanner';
import { loadSkillRecipesFromXml } from '../utils/skillData';

const mockBreedingPlan = jest.fn();

jest.mock('../data/monsters', () => {
  const MONSTERS = [
    {
      id: 'wizard',
      name: 'Wizard',
      family: 'Devil',
      rank: 4,
      hpGrowth: 100,
      mpGrowth: 120,
      attackGrowth: 80,
      defenseGrowth: 90,
      agilityGrowth: 85,
      intelligenceGrowth: 130,
      skills: ['BigBang']
    },
    {
      id: 'caster',
      name: 'Caster',
      family: 'Devil',
      rank: 3,
      hpGrowth: 95,
      mpGrowth: 110,
      attackGrowth: 75,
      defenseGrowth: 80,
      agilityGrowth: 70,
      intelligenceGrowth: 120,
      skills: ['Bang']
    },
    {
      id: 'spark',
      name: 'Spark',
      family: 'Slime',
      rank: 2,
      hpGrowth: 90,
      mpGrowth: 100,
      attackGrowth: 70,
      defenseGrowth: 75,
      agilityGrowth: 80,
      intelligenceGrowth: 95,
      skills: ['Bolt']
    }
  ];

  return {
    MONSTERS,
    RAW_BREEDING_PAIRS: [],
    getMonsterById: (id: string) => MONSTERS.find((monster) => monster.id === id)
  };
});

jest.mock('../utils/skillData', () => ({
  loadSkillRecipesFromXml: jest.fn()
}));

jest.mock('./BreedingPlan', () => ({
  BreedingPlan: (props: { showNativeMoves?: boolean }) => {
    mockBreedingPlan(props);
    return (
      <div
        data-testid="mock-breeding-plan"
        data-show-native-moves={props.showNativeMoves ? 'true' : 'false'}
      />
    );
  }
}));

describe('MovePlanner native learners', () => {
  const mockedLoadSkillRecipesFromXml = loadSkillRecipesFromXml as jest.MockedFunction<typeof loadSkillRecipesFromXml>;

  beforeEach(() => {
    mockBreedingPlan.mockReset();
    mockedLoadSkillRecipesFromXml.mockReset();
    mockedLoadSkillRecipesFromXml.mockResolvedValue([
      {
        name: 'BigBang',
        combineFrom: ['Bang', 'Bolt'],
        requirements: { level: 20, hp: 100, mp: 100, attack: 0, defense: 0, agility: 0, intelligence: 200 }
      },
      {
        name: 'Bang',
        combineFrom: []
      },
      {
        name: 'Bolt',
        combineFrom: []
      }
    ]);
  });

  it('shows native learners even for combinable selected moves', async () => {
    render(<MovePlanner userMonsters={[]} stableStepCounts={{ wizard: 2, caster: 1, spark: 1 }} />);

    const input = await screen.findByPlaceholderText('Select a combo move...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'BigBang' } });

    const option = await screen.findByRole('button', { name: /BigBang/i });
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.getByText('Monsters That Natively Learn Selected Moves')).toBeInTheDocument();
    });

    expect(screen.getByTestId('native-move-BigBang')).toHaveTextContent('Wizard');
  });

  it('passes native move rendering flag to breeding plans', async () => {
    render(<MovePlanner userMonsters={[]} stableStepCounts={{ wizard: 2, caster: 1, spark: 1 }} />);

    const input = await screen.findByPlaceholderText('Select a combo move...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'BigBang' } });

    const option = await screen.findByRole('button', { name: /BigBang/i });
    fireEvent.click(option);

    const plans = await screen.findAllByTestId('mock-breeding-plan');
    expect(plans.length).toBeGreaterThan(0);
    plans.forEach((plan) => {
      expect(plan).toHaveAttribute('data-show-native-moves', 'true');
    });
  });
});
