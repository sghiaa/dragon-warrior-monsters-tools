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
    { id: 'bullbird', family: 'Bird' },
    { id: 'gorago', family: 'Boss' },
    { id: 'darkhorn', family: 'Boss' },
    { id: 'dracolord1', family: 'Boss' },
    { id: 'orochi', family: 'Dragon' },
    { id: 'beavern', family: 'Beast' },
    { id: 'deathmore3', family: 'Boss' },
    { id: '1eyeclown', family: 'Devil' },
    { id: 'orc', family: 'Devil' },
    { id: 'madmirror', family: 'Material' },
    { id: 'babble', family: 'Slime' },
    { id: 'snaily', family: 'Slime' },
    { id: 'grakos', family: 'Water' },
    { id: 'antbear', family: 'Beast' },
    { id: 'beastnite', family: 'Beast' },
    { id: 'fairydrak', family: 'Dragon' },
    { id: 'facer', family: 'Material' },
    { id: 'spikyboy', family: 'Material' },
    { id: 'granslime', family: 'Slime' },
    { id: 'deadnite', family: 'Undead' }
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
      foo: 'Beast',
      gorago: 'Boss',
      darkhorn: 'Boss',
      dracolord1: 'Boss',
      orochi: 'Dragon',
      beavern: 'Beast',
      deathmore3: 'Boss',
      '1eyeclown': 'Devil',
      orc: 'Devil',
      madmirror: 'Material',
      babble: 'Slime',
      snaily: 'Slime',
      grakos: 'Water',
      antbear: 'Beast',
      beastnite: 'Beast',
      fairydrak: 'Dragon',
      facer: 'Material',
      spikyboy: 'Material',
      granslime: 'Slime',
      deadnite: 'Undead'
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

  it('is deterministic for equivalent candidates regardless of stable input order', () => {
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

    const ownedOrderA: OwnedMonster[] = [
      { id: 'bullbird-1', monsterId: 'bullbird', gender: 'male', nickname: 'Bull' },
      { id: 'dev-2', monsterId: 'devila', gender: 'female', nickname: 'DevTwo' },
      { id: 'dev-1', monsterId: 'devila', gender: 'female', nickname: 'DevOne' }
    ];
    const ownedOrderB: OwnedMonster[] = [
      { id: 'bullbird-1', monsterId: 'bullbird', gender: 'male', nickname: 'Bull' },
      { id: 'dev-1', monsterId: 'devila', gender: 'female', nickname: 'DevOne' },
      { id: 'dev-2', monsterId: 'devila', gender: 'female', nickname: 'DevTwo' }
    ];

    const a = computeAutoAssignments(selectedGoals, breedingPlans, ownedOrderA);
    const b = computeAutoAssignments(selectedGoals, breedingPlans, ownedOrderB);

    expect(a.goal_landowl.checkedNodes).toEqual(b.goal_landowl.checkedNodes);
    expect(a.goal_landowl.checkedNodeNames['root.R']).toBe('DevOne');
    expect(b.goal_landowl.checkedNodeNames['root.R']).toBe('DevOne');
  });

  it('returns identical assignments on repeated runs for identical inputs', () => {
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
      { id: 'bullbird-1', monsterId: 'bullbird', gender: 'male', nickname: 'Bull' },
      { id: 'dev-1', monsterId: 'devila', gender: 'female', nickname: 'DevOne' },
      { id: 'dev-2', monsterId: 'devila', gender: 'female', nickname: 'DevTwo' }
    ];

    const first = computeAutoAssignments(selectedGoals, breedingPlans, owned);
    const second = computeAutoAssignments(selectedGoals, breedingPlans, owned);

    expect(first).toEqual(second);
  });

  it('uses screenshot stable snapshot and infers male for unchecked Any Beast under Darkhorn', () => {
    const selectedGoals = ['goal_gorago'];
    const breedingPlans: Record<string, BreedingPlan> = {
      goal_gorago: {
        targetMonster: 'gorago',
        steps: [],
        isPossible: true,
        missingMonsters: [],
        tree: {
          kind: 'monster',
          value: 'gorago',
          left: {
            kind: 'monster',
            value: 'darkhorn',
            left: { kind: 'family', value: 'Any Beast' },
            right: { kind: 'monster', value: 'dracolord1' }
          },
          right: { kind: 'monster', value: 'orochi' }
        }
      }
    };

    const owned: OwnedMonster[] = [
      { id: 'egg-1', monsterId: 'spotslime', gender: 'male', nickname: 'Egg', isEgg: true },
      { id: 'egg-2', monsterId: 'spotslime', gender: 'male', nickname: 'Egg', isEgg: true },
      { id: 'egg-3', monsterId: 'deadnite', gender: 'male', nickname: 'Egg', isEgg: true },
      { id: 'm-1', monsterId: 'beavern', gender: 'male', nickname: 'BeaM1' },
      { id: 'm-2', monsterId: 'deathmore3', gender: 'male', nickname: 'Death' },
      { id: 'm-3', monsterId: '1eyeclown', gender: 'male', nickname: '1EyM1' },
      { id: 'm-4', monsterId: 'orc', gender: 'male', nickname: 'OrcM1' },
      { id: 'm-5', monsterId: 'orochi', gender: 'male', nickname: 'OroM1' },
      { id: 'm-6', monsterId: 'orochi', gender: 'male', nickname: 'OroM2' },
      { id: 'm-7', monsterId: 'madmirror', gender: 'male', nickname: 'MadM1' },
      { id: 'm-8', monsterId: 'babble', gender: 'male', nickname: 'BabM1' },
      { id: 'm-9', monsterId: 'snaily', gender: 'male', nickname: 'SnaM1' },
      { id: 'm-10', monsterId: 'grakos', gender: 'male', nickname: 'Grako' },
      { id: 'f-1', monsterId: 'antbear', gender: 'female', nickname: 'AntF1' },
      { id: 'f-2', monsterId: 'beastnite', gender: 'female', nickname: 'BeaF2' },
      { id: 'f-3', monsterId: 'beastnite', gender: 'female', nickname: 'BeaF4' },
      { id: 'f-4', monsterId: 'dracolord1', gender: 'female', nickname: 'DloF1' },
      { id: 'f-5', monsterId: '1eyeclown', gender: 'female', nickname: '1EyF1' },
      { id: 'f-6', monsterId: 'fairydrak', gender: 'female', nickname: 'FDrk4' },
      { id: 'f-7', monsterId: 'fairydrak', gender: 'female', nickname: 'FDrk7' },
      { id: 'f-8', monsterId: 'facer', gender: 'female', nickname: 'FacF1' },
      { id: 'f-9', monsterId: 'spikyboy', gender: 'female', nickname: 'SpiF1' },
      { id: 'f-10', monsterId: 'granslime', gender: 'female', nickname: 'Grann' },
      { id: 'f-11', monsterId: 'spotslime', gender: 'female', nickname: 'SpoF1' }
    ];

    const assignments = computeAutoAssignments(selectedGoals, breedingPlans, owned);
    const goal = assignments.goal_gorago;

    expect(goal.checkedNodes).toContain('root.R');
    expect(['OroM1', 'OroM2']).toContain(goal.checkedNodeNames['root.R']);
    expect(goal.checkedNodeGenders['root.R']).toBe('male');
    expect(goal.checkedNodes).toContain('root.L.R');
    expect(goal.checkedNodeNames['root.L.R']).toBe('DloF1');
    expect(goal.checkedNodeGenders['root.L.R']).toBe('female');
    expect(goal.checkedNodes).not.toContain('root.L.L');
    expect(goal.checkedNodeGenders['root.L.L']).toBe('male');
  });
});
