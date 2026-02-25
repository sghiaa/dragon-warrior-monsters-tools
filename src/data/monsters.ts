import { Monster, BreedingPair, RawBreedingPair } from '../types/monster';
import { loadMonstersFromCSV, loadBreedingPairsFromCSV, loadRawBreedingPairsFromCSV } from '../utils/csvLoader';

// Dynamic data loading
export let MONSTERS: Monster[] = [];
export let BREEDING_PAIRS: BreedingPair[] = [];
export let RAW_BREEDING_PAIRS: RawBreedingPair[] = [];

// Initialize data
export const initializeData = async () => {
  try {
    MONSTERS = await loadMonstersFromCSV();
    BREEDING_PAIRS = await loadBreedingPairsFromCSV();
    RAW_BREEDING_PAIRS = await loadRawBreedingPairsFromCSV();
    console.log(`Loaded ${MONSTERS.length} monsters, ${BREEDING_PAIRS.length} expanded breeding pairs, and ${RAW_BREEDING_PAIRS.length} raw breeding pairs`);
  } catch (error) {
    console.error('Failed to initialize data:', error);
  }
};


export const FAMILIES = [
  'Slime',
  'Dragon', 
  'Beast',
  'Bird',
  'Plant',
  'Bug',
  'Demon',
  'Undead',
  'Material',
  'Water',
  'Boss',
];

const normalizeId = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

const ID_ALIASES: Record<string, string> = {
  roboster1: 'roboster',
  roboster: 'roboster'
};

export const canonicalMonsterId = (value: string): string => {
  const normalized = normalizeId(value);
  return ID_ALIASES[normalized] || normalized;
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
  boss: 'Boss',
  '????': 'Boss'
};

const parseAnyFamily = (token: string): string | null => {
  const match = token.trim().match(/^Any\s+(.+)$/i);
  if (!match) {
    return null;
  }
  const raw = match[1].trim().toLowerCase();
  return FAMILY_ALIASES[raw] || `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
};

const tokenMatchesMonster = (token: string, monsterId: string): boolean => {
  const family = parseAnyFamily(token);
  if (family) {
    const monster = getMonsterById(monsterId);
    return !!monster && monster.family === family;
  }

  return canonicalMonsterId(token) === canonicalMonsterId(monsterId);
};

const tokenSpecificity = (token: string): number => (parseAnyFamily(token) ? 0 : 1);

export const getMonsterById = (id: string): Monster | undefined => {
  const canonicalId = canonicalMonsterId(id);
  return MONSTERS.find(monster => monster.id === canonicalId);
};

export const getMonstersByFamily = (family: string): Monster[] => {
  return MONSTERS.filter(monster => monster.family === family);
};

export const getBreedingResult = (parent1: string, parent2: string): BreedingPair | undefined => {
  const parent1Id = canonicalMonsterId(parent1);
  const parent2Id = canonicalMonsterId(parent2);

  // Resolve deterministically from raw recipes:
  // 1) more specific parent tokens win (monster token > Any Family)
  // 2) ties break by original RAW_BREEDING_PAIRS order
  let best: { pair: RawBreedingPair; specificity: number; index: number } | null = null;
  for (let index = 0; index < RAW_BREEDING_PAIRS.length; index++) {
    const rawPair = RAW_BREEDING_PAIRS[index];
    const direct = tokenMatchesMonster(rawPair.parent1, parent1Id) && tokenMatchesMonster(rawPair.parent2, parent2Id);
    const swapped = tokenMatchesMonster(rawPair.parent1, parent2Id) && tokenMatchesMonster(rawPair.parent2, parent1Id);
    if (!direct && !swapped) {
      continue;
    }

    const specificity = tokenSpecificity(rawPair.parent1) + tokenSpecificity(rawPair.parent2);
    if (
      !best ||
      specificity > best.specificity ||
      (specificity === best.specificity && index < best.index)
    ) {
      best = { pair: rawPair, specificity, index };
    }
  }

  if (!best) {
    return undefined;
  }

  return {
    parent1: parent1Id,
    parent2: parent2Id,
    result: canonicalMonsterId(best.pair.result)
  };
};

export const getPossibleParents = (result: string): BreedingPair[] => {
  const resultId = canonicalMonsterId(result);
  return BREEDING_PAIRS.filter(pair => pair.result === resultId);
};
