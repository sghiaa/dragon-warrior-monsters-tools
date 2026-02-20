import { BreedingPlan, OwnedMonster } from '../types/monster';
import { computeAutoAssignments, deriveUserMonstersFromOwned } from './plannerAllocation';

jest.mock('../data/monsters', () => ({
  getMonsterById: (id: string) => {
    const familyMap: Record<string, string> = {
      pizzaro: 'Boss',
      kingleo: 'Beast',
      saberman: 'Beast'
    };

    if (!familyMap[id]) {
      return undefined;
    }

    return {
      id,
      name: id,
      family: familyMap[id],
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    };
  }
}));

describe('deriveUserMonstersFromOwned', () => {
  it('aggregates counts and genders by species', () => {
    const owned: OwnedMonster[] = [
      { id: '1', monsterId: 'pizzaro', gender: 'male', nickname: 'Pizza' },
      { id: '2', monsterId: 'pizzaro', gender: 'female', nickname: '' },
      { id: '3', monsterId: 'kingleo', gender: 'female', nickname: 'Leo' }
    ];

    const derived = deriveUserMonstersFromOwned(owned)
      .sort((a, b) => a.monsterId.localeCompare(b.monsterId));

    expect(derived).toEqual([
      { monsterId: 'kingleo', count: 1, maleCount: 0, femaleCount: 1 },
      { monsterId: 'pizzaro', count: 2, maleCount: 1, femaleCount: 1 }
    ]);
  });
});

describe('computeAutoAssignments', () => {
  const planWithPizzaroLeaf = (goalId: string): BreedingPlan => ({
    targetMonster: goalId,
    steps: [],
    isPossible: true,
    missingMonsters: [],
    tree: {
      kind: 'monster',
      value: goalId,
      left: { kind: 'monster', value: 'pizzaro' },
      right: { kind: 'family', value: 'Any Beast' }
    }
  });

  it('uses each owned monster at most once across all selected goals', () => {
    const selectedGoals = ['goal_a', 'goal_b'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_a: planWithPizzaroLeaf('goal_a'),
      goal_b: planWithPizzaroLeaf('goal_b')
    };
    const owned: OwnedMonster[] = [
      { id: 'owned-1', monsterId: 'pizzaro', gender: 'male', nickname: 'Pizza' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    const totalChecks =
      assignments.goal_a.checkedNodes.length + assignments.goal_b.checkedNodes.length;

    expect(totalChecks).toBe(1);
  });

  it('breaks tie by goal order when candidates are otherwise equal', () => {
    const selectedGoals = ['goal_top', 'goal_bottom'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_top: planWithPizzaroLeaf('goal_top'),
      goal_bottom: planWithPizzaroLeaf('goal_bottom')
    };
    const owned: OwnedMonster[] = [
      { id: 'owned-1', monsterId: 'pizzaro', gender: 'male', nickname: 'Pizza' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_top.checkedNodes).toContain('root.L');
    expect(assignments.goal_top.checkedNodeNames['root.L']).toBe('Pizza');
    expect(assignments.goal_bottom.checkedNodes).not.toContain('root.L');
  });
});
