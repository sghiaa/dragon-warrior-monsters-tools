import { OwnedKey } from '../types/monster';
import { optimizeOwnedKeysForCoverage } from './keyOptimizer';

describe('optimizeOwnedKeysForCoverage', () => {
  it('returns minimal key count for full coverage', () => {
    const ownedKeys: OwnedKey[] = [
      { id: 'k1', descriptor: 'Plain', family: 'Beast' },
      { id: 'k2', descriptor: 'Blue', family: 'Bug' },
      { id: 'k3', descriptor: 'Last', family: 'Grass' }
    ];

    const result = optimizeOwnedKeysForCoverage(ownedKeys);
    expect(result.keepKeys.map((key) => key.id)).toEqual(['k3']);
    expect(result.dropKeys.map((key) => key.id).sort()).toEqual(['k1', 'k2']);
  });

  it('breaks ties by rarity when count and coverage are equal', () => {
    const ownedKeys: OwnedKey[] = [
      { id: 'k1', descriptor: 'Plain', family: 'Beast' },
      { id: 'k2', descriptor: 'Last', family: 'Beast' },
      { id: 'k3', descriptor: 'Blue', family: 'Sky' }
    ];

    const result = optimizeOwnedKeysForCoverage(ownedKeys);
    expect(result.keepKeys.map((key) => key.id).sort()).toEqual(['k2', 'k3']);
    expect(result.coveredFamilies.sort()).toEqual(['Beast', 'Bird', 'Bug']);
  });

  it('maximizes coverage when full coverage is impossible', () => {
    const ownedKeys: OwnedKey[] = [
      { id: 'k1', descriptor: 'Green', family: 'Beast' },
      { id: 'k2', descriptor: 'Blue', family: 'Bug' }
    ];

    const result = optimizeOwnedKeysForCoverage(ownedKeys);
    expect(result.coveredFamilies.sort()).toEqual(['Beast', 'Bug']);
    expect(result.coverageCount).toBe(2);
    expect(result.targetCoverageCount).toBeGreaterThan(2);
  });

  it('handles dual-family key codes correctly', () => {
    const ownedKeys: OwnedKey[] = [
      { id: 'k1', descriptor: 'Misty', family: 'Cave' },
      { id: 'k2', descriptor: 'White', family: 'Water' }
    ];

    const result = optimizeOwnedKeysForCoverage(ownedKeys);
    expect(result.coveredFamilies.sort()).toEqual(['Dragon', 'Slime', 'Water']);
  });
});
