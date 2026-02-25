import {
  collectCheckedCoverage,
  computeAdjustedRemaining,
  computeRemainingGenderRequirements,
  combineRemainingByFamilyGender,
  renderFamilyGenderRequirements,
  collectRemainingMoves,
  collectSubtreePaths
} from './breedingPlanTree';
import { BreedingTreeNode } from '../types/monster';

const sampleTree: BreedingTreeNode = {
  kind: 'monster',
  value: 'darkdrium',
  left: {
    kind: 'monster',
    value: 'esterk',
    left: { kind: 'family', value: 'Any Beast' },
    right: { kind: 'family', value: 'Any Slime' }
  },
  right: { kind: 'family', value: 'Any Dragon' }
};

describe('breedingPlanTree utilities', () => {
  it('collects checked coverage by collapsing checked branch requirements', () => {
    const coverage = collectCheckedCoverage(sampleTree, new Set(['root.L']));
    expect(coverage).toEqual({ Beast: 1, Slime: 1 });
  });

  it('computes adjusted remaining from base requirements and checked coverage', () => {
    const adjusted = computeAdjustedRemaining(
      { Beast: 2, Slime: 1, Dragon: 1 },
      undefined,
      { Beast: 1, Slime: 1 }
    );
    expect(adjusted).toEqual({ Beast: 1, Dragon: 1 });
  });

  it('computes and renders remaining family/gender breakdown', () => {
    const byFamily = computeRemainingGenderRequirements(
      sampleTree,
      new Set(),
      { 'root.L.L': 'male', 'root.R': 'female' }
    );
    expect(byFamily).toEqual({
      Beast: { total: 1, male: 1, female: 0, unassigned: 0 },
      Dragon: { total: 1, male: 0, female: 1, unassigned: 0 },
      Slime: { total: 1, male: 0, female: 0, unassigned: 1 }
    });

    expect(renderFamilyGenderRequirements(byFamily)).toBe(
      '1 Beast (1 male), 1 Dragon (1 female), 1 Slime (1 unassigned)'
    );
  });

  it('falls back to adjusted remaining when tree breakdown has no entries', () => {
    const combined = combineRemainingByFamilyGender({}, { Beast: 2 });
    expect(combined).toEqual({ Beast: { total: 2, male: 0, female: 0, unassigned: 2 } });
  });

  it('collects remaining moves from uncollapsed monster nodes only', () => {
    const getSkills = (monsterId: string): string[] => {
      const byMonster: Record<string, string[]> = {
        darkdrium: ['BigBang'],
        esterk: ['Bang', 'Bolt']
      };
      return byMonster[monsterId] || [];
    };

    expect(collectRemainingMoves(sampleTree, new Set(), getSkills)).toEqual(['Bang', 'BigBang', 'Bolt']);
    expect(collectRemainingMoves(sampleTree, new Set(['root.L']), getSkills)).toEqual(['BigBang']);
  });

  it('collects all subtree paths for collapse toggles', () => {
    expect(collectSubtreePaths(sampleTree.left as BreedingTreeNode, 'root.L')).toEqual([
      'root.L',
      'root.L.L',
      'root.L.R'
    ]);
  });
});
