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

export const getMonsterById = (id: string): Monster | undefined => {
  return MONSTERS.find(monster => monster.id === id);
};

export const getMonstersByFamily = (family: string): Monster[] => {
  return MONSTERS.filter(monster => monster.family === family);
};

export const getBreedingResult = (parent1: string, parent2: string): BreedingPair | undefined => {
  return BREEDING_PAIRS.find(pair => 
    (pair.parent1 === parent1 && pair.parent2 === parent2) ||
    (pair.parent1 === parent2 && pair.parent2 === parent1)
  );
};

export const getPossibleParents = (result: string): BreedingPair[] => {
  return BREEDING_PAIRS.filter(pair => pair.result === result);
};
