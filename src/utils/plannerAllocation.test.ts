import { BreedingPlan, OwnedMonster } from '../types/monster';
import { computeAutoAssignments, deriveUserMonstersFromOwned } from './plannerAllocation';

jest.mock('../data/monsters', () => ({
  getMonsterById: (id: string) => {
    const familyMap: Record<string, string> = {
      pizzaro: 'Boss',
      kingleo: 'Beast',
      saberman: 'Beast',
      devila: 'Devil',
      goldslime: 'Slime',
      bar: 'Beast',
      foo: 'Beast'
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

  it('prioritizes family slot whose sibling is already assigned', () => {
    const selectedGoals = ['goal_landowl'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_landowl: {
        targetMonster: 'goal_landowl',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'landowl',
          left: { kind: 'monster', value: 'bullbird' },
          right: { kind: 'family', value: 'Any Devil' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-bullbird', monsterId: 'bullbird', gender: 'male', nickname: 'Bull' },
      { id: 'owned-devil', monsterId: 'devila', gender: 'female', nickname: 'Dev' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_landowl.checkedNodes).toContain('root.L');
    expect(assignments.goal_landowl.checkedNodes).toContain('root.R');
    expect(assignments.goal_landowl.checkedNodeNames['root.R']).toBe('Dev');
  });

  it('infers opposite gender on unfilled sibling when autofilling one side', () => {
    const selectedGoals = ['goal_landowl'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_landowl: {
        targetMonster: 'goal_landowl',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'landowl',
          left: { kind: 'monster', value: 'bullbird' },
          right: { kind: 'family', value: 'Any Devil' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-bullbird', monsterId: 'bullbird', gender: 'male', nickname: 'Bull' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_landowl.checkedNodes).toContain('root.L');
    expect(assignments.goal_landowl.checkedNodes).not.toContain('root.R');
    expect(assignments.goal_landowl.checkedNodeGenders['root.R']).toBe('female');
  });

  it('does not assign same-gender monsters into a checked sibling pair', () => {
    const selectedGoals = ['goal_landowl'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_landowl: {
        targetMonster: 'goal_landowl',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'landowl',
          left: { kind: 'monster', value: 'bullbird' },
          right: { kind: 'monster', value: 'saberman' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-bullbird', monsterId: 'bullbird', gender: 'male', nickname: 'B1' },
      { id: 'owned-saberman', monsterId: 'saberman', gender: 'male', nickname: 'S1' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_landowl.checkedNodes).toContain('root.L');
    expect(assignments.goal_landowl.checkedNodes).not.toContain('root.R');
    expect(assignments.goal_landowl.checkedNodeGenders['root.L']).toBe('male');
    expect(assignments.goal_landowl.checkedNodeGenders['root.R']).toBe('female');
  });

  it('prioritizes exact-match placement in the branch that is closer to completion', () => {
    const selectedGoals = ['goal_darkdrium_like'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_darkdrium_like: {
        targetMonster: 'goal_darkdrium_like',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'goal_darkdrium_like',
          left: {
            kind: 'monster',
            value: 'branch_left',
            left: { kind: 'monster', value: 'foo' },
            right: { kind: 'monster', value: 'goldslime' }
          },
          right: {
            kind: 'monster',
            value: 'branch_right',
            left: { kind: 'monster', value: 'bar' },
            right: { kind: 'monster', value: 'goldslime' }
          }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-bar', monsterId: 'bar', gender: 'male', nickname: 'Bar' },
      { id: 'owned-gold', monsterId: 'goldslime', gender: 'female', nickname: 'Gold' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_darkdrium_like.checkedNodes).toContain('root.R.L');
    expect(assignments.goal_darkdrium_like.checkedNodes).toContain('root.R.R');
    expect(assignments.goal_darkdrium_like.checkedNodes).not.toContain('root.L.R');
  });

  it('enforces opposite-gender pairing for family-slot assignment', () => {
    const selectedGoals = ['goal_gender_pair'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_gender_pair: {
        targetMonster: 'goal_gender_pair',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'goal_gender_pair',
          left: { kind: 'monster', value: 'bullbird' },
          right: { kind: 'family', value: 'Any Devil' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-bullbird', monsterId: 'bullbird', gender: 'male', nickname: 'Bull' },
      { id: 'owned-devil', monsterId: 'devila', gender: 'male', nickname: 'Dev' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_gender_pair.checkedNodes).toContain('root.L');
    expect(assignments.goal_gender_pair.checkedNodes).not.toContain('root.R');
  });

  it('assigns a compatible opposite-gender monster into the sibling slot when available', () => {
    const selectedGoals = ['goal_gender_pair_ok'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_gender_pair_ok: {
        targetMonster: 'goal_gender_pair_ok',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'goal_gender_pair_ok',
          left: { kind: 'monster', value: 'bullbird' },
          right: { kind: 'family', value: 'Any Devil' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-bullbird', monsterId: 'bullbird', gender: 'male', nickname: 'Bull' },
      { id: 'owned-devil-m', monsterId: 'devila', gender: 'male', nickname: 'DevM' },
      { id: 'owned-devil-f', monsterId: 'devila', gender: 'female', nickname: 'DevF' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_gender_pair_ok.checkedNodes).toContain('root.L');
    expect(assignments.goal_gender_pair_ok.checkedNodes).toContain('root.R');
    expect(assignments.goal_gender_pair_ok.checkedNodeGenders['root.R']).toBe('female');
    expect(assignments.goal_gender_pair_ok.checkedNodeNames['root.R']).toBe('DevF');
  });
});
