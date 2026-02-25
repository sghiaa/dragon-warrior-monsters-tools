import { Monster, BreedingPair, RawBreedingPair } from '../types/monster';

// Family mapping from CSV filename to family name
const FAMILY_MAPPING: Record<string, string> = {
  'beast': 'Beast',
  'bird': 'Bird',
  'boss': 'Boss',
  'bug': 'Bug',
  'devil': 'Devil',
  'dragon': 'Dragon',
  'material': 'Material',
  'plant': 'Plant',
  'slime': 'Slime',
  'water': 'Water',
  'zombie': 'Undead'
};

// Default stats for monsters (since CSV only contains names)
const DEFAULT_STATS = {
  hpGrowth: 10,
  mpGrowth: 5,
  attackGrowth: 6,
  defenseGrowth: 6,
  agilityGrowth: 5,
  intelligenceGrowth: 5,
  expGrowth: 10,
  maxLevel: 40
};

// Cache for family data to avoid repeated network requests
const familyCache: Record<string, string[]> = {};
const monsterMetaByIdCache = new Map<string, Partial<Monster>>();
let rawBreedingPairsCache: RawBreedingPair[] | null = null;

const getDataUrl = (filename: string): string => {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/data/${filename}`;
};

const normalizeId = (value: string): string =>
  (() => {
    const normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (normalized === 'roboster1') {
      return 'roboster';
    }
    return normalized;
  })();

const normalizeFamilyName = (rawFamily: string): string => {
  const key = rawFamily.trim().toLowerCase();
  const aliases: Record<string, string> = {
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
  return aliases[key] || `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
};

const readNumberAttribute = (element: Element, name: string, fallback = 0): number => {
  const raw = element.getAttribute(name);
  if (raw == null) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const loadMonsterMetaFromXml = async (): Promise<Map<string, Partial<Monster>>> => {
  if (monsterMetaByIdCache.size > 0) {
    return monsterMetaByIdCache;
  }

  try {
    const response = await fetch(getDataUrl('monster-data.xml'));
    if (!response.ok) {
      return monsterMetaByIdCache;
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    if (xmlDoc.querySelector('parsererror')) {
      console.error('Failed parsing monster-data.xml');
      return monsterMetaByIdCache;
    }

    const monsterElements = Array.from(xmlDoc.getElementsByTagName('monster'));
    monsterElements.forEach((monsterElement) => {
      const monsterName = monsterElement.getAttribute('name') || '';
      const id = normalizeId(monsterName);
      if (!id) {
        return;
      }

      const growth = monsterElement.getElementsByTagName('growth')[0];
      const spawnLocationEls = Array.from(monsterElement.getElementsByTagName('location'));
      const skills = Array.from(monsterElement.getElementsByTagName('skill'))
        .map((skillEl) => (skillEl.textContent || '').trim())
        .filter((skill) => skill.length > 0);

      monsterMetaByIdCache.set(id, {
        inStory: monsterElement.getAttribute('in_story') === 'true',
        skills,
        spawnLocations: spawnLocationEls.map((locationEl) => ({
          map: (locationEl.getElementsByTagName('map')[0]?.textContent || '').trim(),
          description: (locationEl.getElementsByTagName('description')[0]?.textContent || '').trim()
        })),
        ...(growth ? {
          hpGrowth: readNumberAttribute(growth, 'hp', DEFAULT_STATS.hpGrowth),
          mpGrowth: readNumberAttribute(growth, 'mp', DEFAULT_STATS.mpGrowth),
          attackGrowth: readNumberAttribute(growth, 'atk', DEFAULT_STATS.attackGrowth),
          defenseGrowth: readNumberAttribute(growth, 'def', DEFAULT_STATS.defenseGrowth),
          agilityGrowth: readNumberAttribute(growth, 'agl', DEFAULT_STATS.agilityGrowth),
          intelligenceGrowth: readNumberAttribute(growth, 'int', DEFAULT_STATS.intelligenceGrowth),
          expGrowth: readNumberAttribute(growth, 'exp', DEFAULT_STATS.expGrowth),
          maxLevel: readNumberAttribute(growth, 'maxlvl', DEFAULT_STATS.maxLevel)
        } : {})
      });
    });
  } catch (error) {
    console.error('Error loading monster-data.xml:', error);
  }

  return monsterMetaByIdCache;
};

export const loadMonstersFromCSV = async (): Promise<Monster[]> => {
  const monsters: Monster[] = [];
  const monsterMetaById = await loadMonsterMetaFromXml();
  
  // Get all family CSV files
  const familyFiles = Object.keys(FAMILY_MAPPING);
  
  for (const file of familyFiles) {
    try {
      const csvUrl = getDataUrl(`${file}.csv`);
      const response = await fetch(csvUrl);
      const csvText = await response.text();
      const family = FAMILY_MAPPING[file];
      
      // Parse CSV lines
      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      const monsterNames = lines.map(line => line.trim()).filter(name => name);
      
      // Cache the family data for breeding pair expansion
      familyCache[file] = monsterNames;
      
      monsterNames.forEach((name, index) => {
        if (name) {
          // Generate ID from name (lowercase, replace spaces with underscores)
          const id = normalizeId(name);
          
          // Assign rank based on position in file (1-8 scale)
          const rank = Math.max(1, Math.min(8, Math.ceil((index + 1) / (monsterNames.length / 8))));
          
          monsters.push({
            id,
            name,
            family,
            rank,
            ...DEFAULT_STATS,
            ...(monsterMetaById.get(id) || {})
          });
        }
      });
    } catch (error) {
      console.error(`Error loading ${file}.csv:`, error);
    }
  }
  
  return monsters;
};

export const loadBreedingPairsFromCSV = async (): Promise<BreedingPair[]> => {
  const breedingPairs: BreedingPair[] = [];

  try {
    const rawPairs = await loadRawBreedingPairsFromCSV();
    for (const pair of rawPairs) {
      const resultId = normalizeId(pair.result);
      const parent1Combinations = await expandFamilyPlaceholder(pair.parent1);
      const parent2Combinations = await expandFamilyPlaceholder(pair.parent2);

      for (const p1 of parent1Combinations) {
        for (const p2 of parent2Combinations) {
          breedingPairs.push({
            parent1: normalizeId(p1),
            parent2: normalizeId(p2),
            result: resultId
          });
        }
      }
    }
  } catch (error) {
    console.error('Error generating breeding pairs from XML:', error);
  }

  return breedingPairs;
};

export const loadRawBreedingPairsFromCSV = async (): Promise<RawBreedingPair[]> => {
  if (rawBreedingPairsCache) {
    return rawBreedingPairsCache;
  }

  const rawPairs: RawBreedingPair[] = [];

  try {
    const response = await fetch(getDataUrl('monster-data.xml'));
    if (!response.ok) {
      rawBreedingPairsCache = [];
      return rawPairs;
    }
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    if (xmlDoc.querySelector('parsererror')) {
      console.error('Failed parsing monster-data.xml for breeding pairs');
      rawBreedingPairsCache = [];
      return rawPairs;
    }

    const breedNodes = Array.from(xmlDoc.getElementsByTagName('breed'));
    breedNodes.forEach((breedNode) => {
      const result = (breedNode.getAttribute('target') || '').trim();
      if (!result) {
        return;
      }

      const readRequirements = (containerTag: 'base' | 'mate'): string[] => {
        const container = breedNode.getElementsByTagName(containerTag)[0];
        if (!container) {
          return [];
        }

        return Array.from(container.getElementsByTagName('breed-requirement'))
          .map((reqNode) => {
            const monster = (reqNode.getAttribute('monster') || '').trim();
            if (monster) {
              return monster;
            }
            const family = (reqNode.getAttribute('family') || '').trim();
            if (family) {
              return `Any ${normalizeFamilyName(family)}`;
            }
            return '';
          })
          .filter(Boolean);
      };

      const bases = readRequirements('base');
      const mates = readRequirements('mate');

      bases.forEach((parent1) => {
        mates.forEach((parent2) => {
          rawPairs.push({ result, parent1, parent2 });
        });
      });
    });

    rawBreedingPairsCache = rawPairs;
  } catch (error) {
    console.error('Error loading raw breeding pairs from monster-data.xml:', error);
  }

  return rawPairs;
};

// Helper function to expand "Any Family" placeholders to actual monster names
const expandFamilyPlaceholder = async (placeholder: string): Promise<string[]> => {
  if (placeholder.startsWith('Any ')) {
    const family = placeholder.substring(4); // Remove "Any "
    
    // Map family names to CSV filenames
    const familyToFile: Record<string, string> = {
      'Slime': 'slime',
      'Dragon': 'dragon',
      'Beast': 'beast',
      'Bird': 'bird',
      'Plant': 'plant',
      'Bug': 'bug',
      'Devil': 'devil',
      'Undead': 'zombie',
      'Material': 'material',
      'Water': 'water',
      'Boss': 'boss'
    };
    
    const filename = familyToFile[family];
    if (!filename) {
      console.warn(`Unknown family: ${family}`);
      return [placeholder]; // Return original if family not found
    }
    
    // Check cache first
    if (familyCache[filename]) {
      return familyCache[filename];
    }
    
    try {
      const response = await fetch(getDataUrl(`${filename}.csv`));
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim() !== '');
      const monsters = lines.map(line => line.trim()).filter(name => name);
      
      // Cache the result
      familyCache[filename] = monsters;
      return monsters;
    } catch (error) {
      console.error(`Error loading ${filename}.csv for family ${family}:`, error);
      return [placeholder];
    }
  }
  
  return [placeholder]; // Return original if not a "Any Family" placeholder
};
