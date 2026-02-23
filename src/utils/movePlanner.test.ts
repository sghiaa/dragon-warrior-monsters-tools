import {
  getCombinableSkills,
  getMonstersWithMove,
  getMoveUsageInfo,
  planMoveAcquisition,
  planMoveAcquisitionForTargets
} from './movePlanner';
import { SkillRecipe } from './skillData';
import { Monster } from '../types/monster';

describe('movePlanner', () => {
  const recipes: SkillRecipe[] = [
    { name: 'MegaMagic', combineFrom: ['Blazemost', 'Firebolt', 'Explodet'] },
    { name: 'BigBang', combineFrom: ['WhiteAir', 'WhiteFire', 'Explodet'] },
    { name: 'Firebolt', combineFrom: [] },
    { name: 'Blazemost', combineFrom: [] },
    { name: 'Explodet', combineFrom: [], precursor: 'Boom' },
    { name: 'WhiteAir', combineFrom: [], precursor: 'FrigidAir' },
    { name: 'WhiteFire', combineFrom: [], precursor: 'FireAir' },
    { name: 'FrigidAir', combineFrom: [] },
    { name: 'FireAir', combineFrom: [] },
    { name: 'Boom', combineFrom: [] },
    { name: 'Vivify', combineFrom: [] },
    { name: 'Revive', combineFrom: [], precursor: 'Vivify' }
  ];

  const monsters = (rows: Array<Partial<Monster> & { id: string; name: string }>): Monster[] =>
    rows.map((row) => ({
      family: 'Slime',
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1,
      ...row
    })) as Monster[];

  it('returns only skills with combine-from as combinable', () => {
    expect(getCombinableSkills(recipes).map((r) => r.name)).toEqual([
      'BigBang',
      'Explodet',
      'MegaMagic',
      'Revive',
      'WhiteAir',
      'WhiteFire'
    ]);
  });

  it('finds a minimum-step covering set of monsters for required skills', () => {
    const result = planMoveAcquisition(
      'MegaMagic',
      recipes,
      monsters([
        { id: 'a', name: 'Alpha', skills: ['Blazemost'] },
        { id: 'b', name: 'Beta', skills: ['Firebolt'] },
        { id: 'c', name: 'Gamma', skills: ['Blazemost', 'Firebolt', 'Explodet'] }
      ]),
      {
        a: 2,
        b: 2,
        c: 3
      }
    );

    expect(result.requiredSkills).toEqual(['Blazemost', 'Boom', 'Firebolt']);
    expect(result.uncoveredSkills).toEqual([]);
    expect(result.selectedMonsters.map((m) => m.monsterId)).toEqual(['c']);
  });

  it('falls back to best partial coverage when not all skills are reachable', () => {
    const result = planMoveAcquisition(
      'MegaMagic',
      recipes,
      monsters([
        { id: 'a', name: 'Alpha', skills: ['Blazemost'] }
      ]),
      { a: 2 }
    );

    expect(result.selectedMonsters.map((m) => m.monsterId)).toEqual(['a']);
    expect(result.uncoveredSkills).toEqual(['Boom', 'Firebolt']);
  });

  it('resolves high-tier combo requirements to tier-1 precursor roots', () => {
    const result = planMoveAcquisition(
      'BigBang',
      recipes,
      monsters([
        { id: 'f', name: 'Flare', skills: ['FireAir'] },
        { id: 'i', name: 'Ice', skills: ['FrigidAir'] },
        { id: 'b', name: 'Bomber', skills: ['Boom'] },
        { id: 'h', name: 'HighTier', skills: ['WhiteAir', 'WhiteFire', 'Explodet'] }
      ]),
      { f: 1, i: 1, b: 1, h: 10 }
    );

    expect(result.requiredSkills).toEqual(['Boom', 'FireAir', 'FrigidAir']);
    expect(result.uncoveredSkills).toEqual([]);
    expect(result.selectedMonsters.map((m) => m.monsterId)).toEqual(['b', 'f', 'i']);
  });

  it('supports precursor-based moves like Revive', () => {
    const result = planMoveAcquisition(
      'Revive',
      recipes,
      monsters([
        { id: 'v', name: 'Vivifier', skills: ['Vivify'] }
      ]),
      { v: 4 }
    );

    expect(result.requiredSkills).toEqual(['Vivify']);
    expect(result.uncoveredSkills).toEqual([]);
    expect(result.selectedMonsters.map((m) => m.monsterId)).toEqual(['v']);
  });

  it('supports planning across multiple target moves in one optimal set', () => {
    const result = planMoveAcquisitionForTargets(
      ['MegaMagic', 'Revive'],
      recipes,
      monsters([
        { id: 'a', name: 'Alpha', skills: ['Blazemost'] },
        { id: 'b', name: 'Beta', skills: ['Firebolt'] },
        { id: 'c', name: 'Gamma', skills: ['Boom'] },
        { id: 'd', name: 'Delta', skills: ['Vivify'] },
        { id: 'e', name: 'Epsilon', skills: ['Blazemost', 'Firebolt', 'Boom', 'Vivify'] }
      ]),
      {
        a: 2,
        b: 2,
        c: 2,
        d: 2,
        e: 5
      }
    );

    expect(result.requiredSkills).toEqual(['Blazemost', 'Boom', 'Firebolt', 'Vivify']);
    expect(result.uncoveredSkills).toEqual([]);
    expect(result.selectedMonsters.map((m) => m.monsterId)).toEqual(['e']);
  });

  it('treats direct target moves as required skills in multi-target planning', () => {
    const result = planMoveAcquisitionForTargets(
      ['Vivify'],
      recipes,
      monsters([
        { id: 'v', name: 'Vivifier', skills: ['Vivify'] }
      ]),
      { v: 4 }
    );

    expect(result.requiredSkills).toEqual(['Vivify']);
    expect(result.uncoveredSkills).toEqual([]);
    expect(result.selectedMonsters.map((m) => m.monsterId)).toEqual(['v']);
  });

  it('lists all monsters that directly have a basic move, sorted by steps then name', () => {
    const learners = getMonstersWithMove(
      'Vivify',
      monsters([
        { id: 'z', name: 'Zulu', skills: ['Vivify'] },
        { id: 'a', name: 'Alpha', skills: ['Vivify'] },
        { id: 'b', name: 'Beta', skills: ['Vivify'] }
      ]),
      { z: 8, a: 3, b: 3 }
    );

    expect(learners.map((m) => m.monsterId)).toEqual(['a', 'b', 'z']);
  });

  it('reports if a move is used by other move combinations or precursors', () => {
    const usage = getMoveUsageInfo('Vivify', recipes);
    expect(usage.usedInCombinations).toEqual([]);
    expect(usage.usedAsPrecursorFor).toEqual(['Revive']);
    expect(usage.eventualUnlocks).toEqual(['Revive']);

    const usage2 = getMoveUsageInfo('Firebolt', recipes);
    expect(usage2.usedInCombinations).toEqual(['MegaMagic']);
    expect(usage2.eventualUnlocks).toEqual(['MegaMagic']);
  });

  it('includes downstream unlocks through precursor chains (Boom -> Explodet -> combos)', () => {
    const usage = getMoveUsageInfo('Boom', recipes);
    expect(usage.usedAsPrecursorFor).toEqual(['Explodet']);
    expect(usage.eventualUnlocks).toEqual(['BigBang', 'Explodet', 'MegaMagic']);
  });
});
