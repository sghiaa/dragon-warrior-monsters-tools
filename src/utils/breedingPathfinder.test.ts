import { BreedingPathfinder } from './breedingPathfinder';
import { UserMonster } from '../types/monster';

jest.mock('../data/monsters', () => {
  const MONSTERS = [
    {
      id: 'grizzly',
      name: 'Grizzly',
      family: 'Beast',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'unicorn',
      name: 'Unicorn',
      family: 'Beast',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'saberman',
      name: 'Saberman',
      family: 'Beast',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'chimera',
      name: 'Chimera',
      family: 'Beast',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'dracolord1',
      name: 'Dracolord1',
      family: 'Boss',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'darkhorn',
      name: 'Darkhorn',
      family: 'Boss',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'slime_a',
      name: 'SlimeA',
      family: 'Slime',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    }
  ];

  const RAW_BREEDING_PAIRS = [
    { result: 'Grizzly', parent1: 'Any Beast', parent2: 'Any Devil' },
    { result: 'Saberman', parent1: 'Any Beast', parent2: 'Any Devil' },
    { result: 'Unicorn', parent1: 'Grizzly', parent2: 'Any Slime' },
    { result: 'Unicorn', parent1: 'Any Beast', parent2: 'Any Slime' },
    { result: 'Chimera', parent1: 'Grizzly', parent2: 'Any Slime' },
    { result: 'Chimera', parent1: 'Saberman', parent2: 'Any Slime' },
    { result: 'Dracolord1', parent1: 'Any Slime', parent2: 'Any Dragon' },
    { result: 'Darkhorn', parent1: 'Any Boss', parent2: 'Any Beast' }
  ];

  return {
    MONSTERS,
    RAW_BREEDING_PAIRS,
    getMonsterById: (id: string) => MONSTERS.find((monster) => monster.id === id)
  };
});

describe('BreedingPathfinder', () => {
  const emptyOwned: UserMonster[] = [];

  it('chooses the shortest valid breeding path', () => {
    const pathfinder = new BreedingPathfinder(emptyOwned);
    const plan = pathfinder.findBreedingPath('unicorn');

    expect(plan.isPossible).toBe(true);
    expect(plan.steps.length).toBe(1);
    expect(plan.steps[0]).toMatchObject({
      parent1: 'Any Beast',
      parent2: 'Any Slime',
      result: 'unicorn'
    });
    expect(plan.baseRequirements).toEqual({ Beast: 1, Slime: 1 });
  });

  it('prefers owned-friendly route when shortest-path costs are tied', () => {
    const pathfinder = new BreedingPathfinder([
      { monsterId: 'grizzly', count: 1, maleCount: 1, femaleCount: 0 }
    ]);
    const plan = pathfinder.findBreedingPath('chimera');

    expect(plan.isPossible).toBe(true);
    expect(plan.steps.length).toBe(2);
    expect(plan.steps[1]).toMatchObject({
      parent1: 'grizzly',
      parent2: 'Any Slime',
      result: 'chimera'
    });
  });

  it('expands generic Boss requirements through dracolord1', () => {
    const pathfinder = new BreedingPathfinder(emptyOwned);
    const plan = pathfinder.findBreedingPath('darkhorn');

    expect(plan.isPossible).toBe(true);
    expect(plan.steps.map((s) => s.result)).toEqual(['dracolord1', 'darkhorn']);
    expect(plan.baseRequirements).toEqual({ Beast: 1, Dragon: 1, Slime: 1 });
    expect(plan.totalBaseRequired).toBe(3);
  });

  it('reduces remaining requirements when owned exact and family monsters are available', () => {
    const owned: UserMonster[] = [
      { monsterId: 'grizzly', count: 1, maleCount: 1, femaleCount: 0 },
      { monsterId: 'slime_a', count: 1, maleCount: 0, femaleCount: 1 }
    ];
    const pathfinder = new BreedingPathfinder(owned);
    const plan = pathfinder.findBreedingPath('unicorn');

    expect(plan.isPossible).toBe(true);
    expect(plan.baseRequirements).toEqual({ Beast: 1, Slime: 1 });
    expect(plan.remainingRequirements).toEqual({});
    expect(plan.totalRemaining).toBe(0);
  });

  it('enforces seed-family constraints when planner is pinned', () => {
    const pathfinder = new BreedingPathfinder(emptyOwned, {
      seedMonsterIds: ['slime_a']
    });
    const plan = pathfinder.findBreedingPath('unicorn');

    expect(plan.isPossible).toBe(false);
    expect(plan.missingRequirements).toEqual([
      'No valid breeding route could be reduced to generic family requirements.'
    ]);
  });

  it('returns impossible for unknown target monsters', () => {
    const pathfinder = new BreedingPathfinder(emptyOwned);
    const plan = pathfinder.findBreedingPath('not_a_monster');

    expect(plan.isPossible).toBe(false);
    expect(plan.missingRequirements).toEqual(['Goal monster does not exist in loaded data.']);
  });
});
