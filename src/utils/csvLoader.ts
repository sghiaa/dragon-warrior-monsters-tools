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
  intelligenceGrowth: 5
};

// Cache for family data to avoid repeated network requests
const familyCache: Record<string, string[]> = {};

export const loadMonstersFromCSV = async (): Promise<Monster[]> => {
  const monsters: Monster[] = [];
  
  // Get all family CSV files
  const familyFiles = Object.keys(FAMILY_MAPPING);
  
  for (const file of familyFiles) {
    try {
      const response = await fetch(`/data/${file}.csv`);
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
          const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          
          // Assign rank based on position in file (1-8 scale)
          const rank = Math.max(1, Math.min(8, Math.ceil((index + 1) / (monsterNames.length / 8))));
          
          monsters.push({
            id,
            name,
            family,
            rank,
            ...DEFAULT_STATS
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
    const response = await fetch('/data/breeding_pairs.csv');
    const csvText = await response.text();
    
    // Parse CSV lines
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        // Parse CSV line (handle commas in names)
        const parts = line.split(',').map(part => part.trim());
        
        if (parts.length >= 3) {
          const result = parts[0];
          const parent1 = parts[1];
          const parent2 = parts[2];
          
          // Convert names to IDs
          const resultId = result.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          
          // Handle "Any Family" placeholders
          const parent1Combinations = await expandFamilyPlaceholder(parent1);
          const parent2Combinations = await expandFamilyPlaceholder(parent2);
          
          console.log(`Expanding ${parent1} -> ${parent1Combinations.length} options`);
          console.log(`Expanding ${parent2} -> ${parent2Combinations.length} options`);
          
          // Create combinations for all expanded parents
          for (const p1 of parent1Combinations) {
            for (const p2 of parent2Combinations) {
              const parent1Id = p1.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
              const parent2Id = p2.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
              
              breedingPairs.push({
                parent1: parent1Id,
                parent2: parent2Id,
                result: resultId
              });
            }
          }
        }
      }
    }
    
    console.log(`Total breeding pairs generated: ${breedingPairs.length}`);
  } catch (error) {
    console.error('Error loading breeding_pairs.csv:', error);
  }
  
  return breedingPairs;
};

export const loadRawBreedingPairsFromCSV = async (): Promise<RawBreedingPair[]> => {
  const rawPairs: RawBreedingPair[] = [];

  try {
    const response = await fetch('/data/breeding_pairs.csv');
    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim() !== '');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }

      const parts = line.split(',').map(part => part.trim());
      if (parts.length < 3) {
        continue;
      }

      const result = parts[0];
      const parent1 = parts[1];
      const parent2 = parts[2];
      if (!result || !parent1 || !parent2) {
        continue;
      }

      rawPairs.push({ result, parent1, parent2 });
    }
  } catch (error) {
    console.error('Error loading raw breeding_pairs.csv:', error);
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
      const response = await fetch(`/data/${filename}.csv`);
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
