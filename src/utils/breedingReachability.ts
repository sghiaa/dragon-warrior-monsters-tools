import { MONSTERS, RAW_BREEDING_PAIRS } from '../data/monsters';

const normalizeId = (value: string): string => {
  const normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (normalized === 'roboster1') {
    return 'roboster';
  }
  return normalized;
};

const FAMILY_ALIASES: Record<string, string> = {
  slime: 'Slime',
  dragon: 'Dragon',
  beast: 'Beast',
  bird: 'Bird',
  plant: 'Plant',
  bug: 'Bug',
  devil: 'Devil',
  demon: 'Devil',
  undead: 'Undead',
  zombie: 'Undead',
  material: 'Material',
  water: 'Water',
  boss: 'Boss'
};

const parseAnyFamily = (token: string): string | null => {
  const match = token.trim().match(/^Any\s+(.+)$/i);
  if (!match) {
    return null;
  }
  const raw = match[1].trim().toLowerCase();
  return FAMILY_ALIASES[raw] || `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
};

export interface ReachabilityResult {
  breedableMonsterIds: string[];
  reachableMonsterIds: string[];
  sourceFamilies: string[];
  derivations: Record<string, DerivationWitness>;
}

export interface DerivationParent {
  kind: 'monster' | 'family';
  value: string;
}

export interface DerivationWitness {
  resultId: string;
  parent1: DerivationParent;
  parent2: DerivationParent;
}

export interface DerivationStep {
  parent1: DerivationParent;
  parent2: DerivationParent;
  resultId: string;
}

export const calculateReachableMonsters = (selectedMonsterIds: string[]): ReachabilityResult => {
  const selectedSet = new Set(selectedMonsterIds);
  const reachable = new Set(selectedMonsterIds);
  const derivations: Record<string, DerivationWitness> = {};

  const sourceFamilies = new Set<string>();
  selectedMonsterIds.forEach((id) => {
    const monster = MONSTERS.find((m) => m.id === id);
    if (monster) {
      sourceFamilies.add(monster.family);
    }
  });

  const canUseParent = (token: string): boolean => {
    const family = parseAnyFamily(token);
    if (family) {
      return sourceFamilies.has(family);
    }

    return reachable.has(normalizeId(token));
  };

  const toParent = (token: string): DerivationParent => {
    const family = parseAnyFamily(token);
    if (family) {
      return { kind: 'family', value: family };
    }
    return { kind: 'monster', value: normalizeId(token) };
  };

  let changed = true;
  while (changed) {
    changed = false;

    for (const pair of RAW_BREEDING_PAIRS) {
      if (!canUseParent(pair.parent1) || !canUseParent(pair.parent2)) {
        continue;
      }

      const resultId = normalizeId(pair.result);
      if (!reachable.has(resultId)) {
        reachable.add(resultId);
        derivations[resultId] = {
          resultId,
          parent1: toParent(pair.parent1),
          parent2: toParent(pair.parent2)
        };
        changed = true;
      }
    }
  }

  const reachableMonsterIds = Array.from(reachable).sort();
  const breedableMonsterIds = reachableMonsterIds.filter((id) => !selectedSet.has(id));

  return {
    breedableMonsterIds,
    reachableMonsterIds,
    sourceFamilies: Array.from(sourceFamilies).sort(),
    derivations
  };
};

export const getDerivationSteps = (
  targetMonsterId: string,
  selectedMonsterIds: string[],
  derivations: Record<string, DerivationWitness>
): DerivationStep[] => {
  const selectedSet = new Set(selectedMonsterIds);
  const visited = new Set<string>();
  const steps: DerivationStep[] = [];

  const walk = (monsterId: string): void => {
    if (selectedSet.has(monsterId) || visited.has(monsterId)) {
      return;
    }

    const witness = derivations[monsterId];
    if (!witness) {
      return;
    }

    visited.add(monsterId);

    if (witness.parent1.kind === 'monster') {
      walk(witness.parent1.value);
    }
    if (witness.parent2.kind === 'monster') {
      walk(witness.parent2.value);
    }

    steps.push({
      parent1: witness.parent1,
      parent2: witness.parent2,
      resultId: witness.resultId
    });
  };

  walk(targetMonsterId);
  return steps;
};
