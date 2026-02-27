import { KEY_DESCRIPTORS, KEY_FAMILY_BY_CODE, KEY_FAMILY_OPTIONS } from '../data/keys';
import { OwnedKey } from '../types/monster';

interface KeyOptimizerState {
  mask: number;
  ids: string[];
  count: number;
  rarityScore: number;
}

export interface KeyOptimizationResult {
  keepKeys: OwnedKey[];
  dropKeys: OwnedKey[];
  coveredFamilies: string[];
  coverageCount: number;
  targetCoverageCount: number;
}

const descriptorRarityByName = new Map(KEY_DESCRIPTORS.map((name, index) => [name, index]));

const popcount = (value: number): number => {
  let count = 0;
  let current = value;
  while (current > 0) {
    count += current & 1;
    current >>= 1;
  }
  return count;
};

const compareMaskState = (a: KeyOptimizerState, b: KeyOptimizerState): number => {
  if (a.count !== b.count) {
    return a.count < b.count ? -1 : 1;
  }
  if (a.rarityScore !== b.rarityScore) {
    return a.rarityScore > b.rarityScore ? -1 : 1;
  }
  const aKey = a.ids.slice().sort().join('|');
  const bKey = b.ids.slice().sort().join('|');
  return aKey.localeCompare(bKey);
};

const compareGlobalState = (a: KeyOptimizerState, b: KeyOptimizerState): number => {
  const aCoverage = popcount(a.mask);
  const bCoverage = popcount(b.mask);
  if (aCoverage !== bCoverage) {
    return aCoverage > bCoverage ? -1 : 1;
  }
  return compareMaskState(a, b);
};

export const optimizeOwnedKeysForCoverage = (ownedKeys: OwnedKey[]): KeyOptimizationResult => {
  if (ownedKeys.length === 0) {
    return {
      keepKeys: [],
      dropKeys: [],
      coveredFamilies: [],
      coverageCount: 0,
      targetCoverageCount: 0
    };
  }

  const targetFamilies = Array.from(
    new Set(
      KEY_FAMILY_OPTIONS.flatMap((option) => option.availableFamilies)
    )
  ).sort((a, b) => a.localeCompare(b));
  const familyBitByName = new Map(targetFamilies.map((family, index) => [family, 1 << index]));
  const keyById = new Map(ownedKeys.map((key) => [key.id, key]));

  const keyMasks = ownedKeys.map((key) => {
    const option = KEY_FAMILY_BY_CODE.get(key.family);
    const mask = (option?.availableFamilies || []).reduce((acc, family) => {
      const familyBit = familyBitByName.get(family) || 0;
      return acc | familyBit;
    }, 0);
    const rarity = descriptorRarityByName.get(key.descriptor) || 0;
    return { key, mask, rarity };
  });

  const states = new Map<number, KeyOptimizerState>();
  states.set(0, { mask: 0, ids: [], count: 0, rarityScore: 0 });

  keyMasks.forEach(({ key, mask, rarity }) => {
    const snapshot = Array.from(states.values());
    snapshot.forEach((state) => {
      const nextMask = state.mask | mask;
      const nextState: KeyOptimizerState = {
        mask: nextMask,
        ids: [...state.ids, key.id],
        count: state.count + 1,
        rarityScore: state.rarityScore + rarity
      };
      const existing = states.get(nextMask);
      if (!existing || compareMaskState(nextState, existing) < 0) {
        states.set(nextMask, nextState);
      }
    });
  });

  const best = Array.from(states.values()).sort(compareGlobalState)[0];
  const keepIdSet = new Set(best?.ids || []);
  const keepKeys = (best?.ids || [])
    .map((id) => keyById.get(id))
    .filter((key): key is OwnedKey => !!key);
  const dropKeys = ownedKeys.filter((key) => !keepIdSet.has(key.id));
  const coveredFamilies = targetFamilies.filter((family) => {
    const bit = familyBitByName.get(family) || 0;
    return !!best && (best.mask & bit) !== 0;
  });

  return {
    keepKeys,
    dropKeys,
    coveredFamilies,
    coverageCount: coveredFamilies.length,
    targetCoverageCount: targetFamilies.length
  };
};
