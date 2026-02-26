import { BreedingPlan, OwnedMonster } from '../types/monster';
import { computeAutoAssignments, deriveUserMonstersFromOwned } from './plannerAllocation';

jest.mock('../data/monsters', () => ({
  MONSTERS: [
    { id: 'pizzaro', family: 'Boss' },
    { id: 'kingleo', family: 'Beast' },
    { id: 'saberman', family: 'Beast' },
    { id: 'almiraj', family: 'Beast' },
    { id: 'devila', family: 'Devil' },
    { id: 'goldslime', family: 'Slime' },
    { id: 'metalking', family: 'Slime' },
    { id: 'slime', family: 'Slime' },
    { id: 'slabbit', family: 'Slime' },
    { id: 'spotslime', family: 'Slime' },
    { id: 'bar', family: 'Beast' },
    { id: 'foo', family: 'Beast' },
    { id: 'bullbird', family: 'Bird' }
  ],
  RAW_BREEDING_PAIRS: [
    { result: 'landowl', parent1: 'bullbird', parent2: 'Any Devil' },
    { result: 'spotslime', parent1: 'Any Slime', parent2: 'Any Beast' },
    { result: 'fangslime', parent1: 'Any Slime', parent2: 'almiraj' }
  ],
  getMonsterById: (id: string) => {
    const familyMap: Record<string, string> = {
      pizzaro: 'Boss',
      kingleo: 'Beast',
      saberman: 'Beast',
      almiraj: 'Beast',
      devila: 'Devil',
      goldslime: 'Slime',
      metalking: 'Slime',
      slime: 'Slime',
      slabbit: 'Slime',
      spotslime: 'Slime',
      bar: 'Beast',
      foo: 'Beast'
    };
    const rankMap: Record<string, number> = {
      metalking: 8,
      spotslime: 1
    };

    if (!familyMap[id]) {
      return undefined;
    }

    return {
      id,
      name: id,
      family: familyMap[id],
      rank: rankMap[id] || 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    };
  },
  getBreedingResult: (parent1: string, parent2: string) => {
    const key = [parent1, parent2].sort().join('::');
    const resultByKey: Record<string, string> = {
      'bullbird::devila': 'landowl',
      'almiraj::slime': 'fangslime',
      'almiraj::slabbit': 'fangslime',
      'foo::slime': 'spotslime',
      'foo::slabbit': 'spotslime'
    };
    const result = resultByKey[key];
    return result ? { parent1, parent2, result } : undefined;
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

  it('counts eggs toward total but not male/female counts', () => {
    const owned: OwnedMonster[] = [
      { id: 'egg-1', monsterId: 'pizzaro', gender: 'male', nickname: 'Egg', isEgg: true },
      { id: 'male-1', monsterId: 'pizzaro', gender: 'male', nickname: 'Pizza' }
    ];

    const derived = deriveUserMonstersFromOwned(owned);
    expect(derived).toEqual([
      { monsterId: 'pizzaro', count: 2, maleCount: 1, femaleCount: 0 }
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

  it('uses egg as exact match and collapses node without assigning gender by default', () => {
    const selectedGoals = ['goal_egg_exact'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_egg_exact: {
        targetMonster: 'goal_egg_exact',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'goal_egg_exact',
          left: { kind: 'monster', value: 'pizzaro' },
          right: { kind: 'family', value: 'Any Beast' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'egg-pizzaro', monsterId: 'pizzaro', gender: 'male', nickname: 'Egg', isEgg: true }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_egg_exact.checkedNodes).toContain('root.L');
    expect(assignments.goal_egg_exact.checkedNodeNames['root.L']).toBe('Egg');
    expect(assignments.goal_egg_exact.checkedNodeGenders['root.L']).toBeUndefined();
  });

  it('assigns expected gender to egg when sibling already implies pairing direction', () => {
    const selectedGoals = ['goal_egg_pairing'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_egg_pairing: {
        targetMonster: 'goal_egg_pairing',
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
      { id: 'male-bullbird', monsterId: 'bullbird', gender: 'male', nickname: 'Bull' },
      { id: 'egg-devil', monsterId: 'devila', gender: 'male', nickname: 'Egg', isEgg: true }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(assignments.goal_egg_pairing.checkedNodes).toContain('root.L');
    expect(assignments.goal_egg_pairing.checkedNodes).toContain('root.R');
    expect(assignments.goal_egg_pairing.checkedNodeGenders['root.L']).toBe('male');
    expect(assignments.goal_egg_pairing.checkedNodeGenders['root.R']).toBe('female');
    expect(assignments.goal_egg_pairing.checkedNodeNames['root.R']).toBe('Egg');
  });

  it('prioritizes exact-match placement by higher tree level over branch completion', () => {
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
    expect(assignments.goal_darkdrium_like.checkedNodes).toContain('root.L.R');
    expect(assignments.goal_darkdrium_like.checkedNodes).not.toContain('root.R.R');
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
          value: 'landowl',
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
          value: 'landowl',
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

  it('prioritizes higher-rank owned monsters for generic family slots', () => {
    const selectedGoals = ['goal_one_slime_slot'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_one_slime_slot: {
        targetMonster: 'goal_one_slime_slot',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'goal_one_slime_slot',
          left: { kind: 'family', value: 'Any Slime' },
          right: { kind: 'family', value: 'Any Beast' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-spotslime', monsterId: 'spotslime', gender: 'male', nickname: 'Spot' },
      { id: 'owned-metalking', monsterId: 'metalking', gender: 'male', nickname: 'Metam' },
      { id: 'owned-beast', monsterId: 'foo', gender: 'female', nickname: 'Beasty' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);
    const goal = assignments.goal_one_slime_slot;

    expect(goal.checkedNodes).toContain('root.L');
    expect(goal.checkedNodeNames['root.L']).toBe('Metam');
  });

  it('prioritizes higher-level tree nodes and blocks descendant assignment on same branch', () => {
    const selectedGoals = ['goal_branch_block'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_branch_block: {
        targetMonster: 'goal_branch_block',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'goal_branch_block',
          left: {
            kind: 'monster',
            value: 'pizzaro',
            left: { kind: 'family', value: 'Any Slime' },
            right: { kind: 'family', value: 'Any Beast' }
          },
          right: { kind: 'family', value: 'Any Devil' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-pizzaro', monsterId: 'pizzaro', gender: 'male', nickname: 'Pizza' },
      { id: 'owned-slime', monsterId: 'goldslime', gender: 'female', nickname: 'Gold' },
      { id: 'owned-beast', monsterId: 'foo', gender: 'female', nickname: 'Beasty' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);
    const goal = assignments.goal_branch_block;

    expect(goal.checkedNodes).toContain('root.L');
    expect(goal.checkedNodes).not.toContain('root.L.L');
    expect(goal.checkedNodes).not.toContain('root.L.R');
  });

  it('avoids assigning a generic family monster that would change the intended immediate result', () => {
    const selectedGoals = ['goal_spotslime'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_spotslime: {
        targetMonster: 'goal_spotslime',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'spotslime',
          left: { kind: 'monster', value: 'slime' },
          right: { kind: 'family', value: 'Any Beast' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-slime', monsterId: 'slime', gender: 'male', nickname: 'Slim' },
      { id: 'owned-almiraj', monsterId: 'almiraj', gender: 'female', nickname: 'Ali' },
      { id: 'owned-safe-beast', monsterId: 'foo', gender: 'female', nickname: 'SafeBeast' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);
    const goal = assignments.goal_spotslime;

    expect(goal.checkedNodes).toContain('root.L');
    expect(goal.checkedNodes).toContain('root.R');
    expect(goal.checkedNodeNames['root.R']).toBe('SafeBeast');
  });

  it('validates sibling generic pair assignments against the intended parent result', () => {
    const selectedGoals = ['goal_spotslime_pair'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_spotslime_pair: {
        targetMonster: 'goal_spotslime_pair',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'spotslime',
          left: { kind: 'family', value: 'Any Slime' },
          right: { kind: 'family', value: 'Any Beast' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'owned-slabbit', monsterId: 'slabbit', gender: 'male', nickname: 'Slab' },
      { id: 'owned-almiraj', monsterId: 'almiraj', gender: 'female', nickname: 'Ali' },
      { id: 'owned-safe-beast', monsterId: 'foo', gender: 'female', nickname: 'SafeBeast' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);
    const goal = assignments.goal_spotslime_pair;

    expect(goal.checkedNodes).toContain('root.L');
    expect(goal.checkedNodes).toContain('root.R');
    expect(goal.checkedNodeNames['root.R']).toBe('SafeBeast');
    expect(goal.checkedNodeNames['root.R']).not.toBe('Ali');
  });
});
