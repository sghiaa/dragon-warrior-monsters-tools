import { calculateReachableMonsters, getDerivationSteps } from './breedingReachability';

jest.mock('../data/monsters', () => {
  const MONSTERS = [
    {
      id: 'fairydrak',
      name: 'FairyDrak',
      family: 'Dragon',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'spotslime',
      name: 'SpotSlime',
      family: 'Slime',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'drakslime',
      name: 'DrakSlime',
      family: 'Slime',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'dragonkid',
      name: 'DragonKid',
      family: 'Dragon',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    },
    {
      id: 'kingdrak',
      name: 'KingDrak',
      family: 'Dragon',
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
    { result: 'DrakSlime', parent1: 'FairyDrak', parent2: 'SpotSlime' },
    { result: 'DragonKid', parent1: 'Any Dragon', parent2: 'Any Slime' },
    { result: 'KingDrak', parent1: 'DragonKid', parent2: 'Any Slime' }
  ];

  return { MONSTERS, RAW_BREEDING_PAIRS };
});

describe('breedingReachability', () => {
  it('expands closure with selected species and generic source families', () => {
    const result = calculateReachableMonsters(['fairydrak', 'spotslime']);

    expect(result.sourceFamilies).toEqual(['Dragon', 'Slime']);
    expect(result.reachableMonsterIds).toEqual(
      expect.arrayContaining(['fairydrak', 'spotslime', 'drakslime', 'dragonkid', 'kingdrak'])
    );
    expect(result.breedableMonsterIds).toEqual(
      expect.arrayContaining(['drakslime', 'dragonkid', 'kingdrak'])
    );
  });

  it('records derivation witness as monster or family parents', () => {
    const result = calculateReachableMonsters(['fairydrak', 'spotslime']);
    const dragonKid = result.derivations.dragonkid;
    const drakSlime = result.derivations.drakslime;

    expect(dragonKid.parent1).toEqual({ kind: 'family', value: 'Dragon' });
    expect(dragonKid.parent2).toEqual({ kind: 'family', value: 'Slime' });
    expect(drakSlime.parent1).toEqual({ kind: 'monster', value: 'fairydrak' });
    expect(drakSlime.parent2).toEqual({ kind: 'monster', value: 'spotslime' });
  });

  it('builds derivation steps from prerequisites to target', () => {
    const selected = ['fairydrak', 'spotslime'];
    const result = calculateReachableMonsters(selected);
    const steps = getDerivationSteps('kingdrak', selected, result.derivations);

    expect(steps).toEqual([
      {
        parent1: { kind: 'family', value: 'Dragon' },
        parent2: { kind: 'family', value: 'Slime' },
        resultId: 'dragonkid'
      },
      {
        parent1: { kind: 'monster', value: 'dragonkid' },
        parent2: { kind: 'family', value: 'Slime' },
        resultId: 'kingdrak'
      }
    ]);
  });
});
