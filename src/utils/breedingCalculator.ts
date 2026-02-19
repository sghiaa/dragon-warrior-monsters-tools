import { UserMonster } from '../types/monster';
import { BREEDING_PAIRS, getMonsterById } from '../data/monsters';

export interface BreedingPossibility {
  parent1: string;
  parent2: string;
  result: string;
  parent1Name: string;
  parent2Name: string;
  resultName: string;
  hasValidGenders: boolean;
}

export class BreedingCalculator {
  private userMonsters: Map<string, UserMonster> = new Map();

  constructor(userMonsters: UserMonster[]) {
    userMonsters.forEach(um => this.userMonsters.set(um.monsterId, um));
  }

  public getAllPossibilities(): BreedingPossibility[] {
    const possibilities: BreedingPossibility[] = [];
    const userMonsterIds = Array.from(this.userMonsters.keys());

    console.log('User monsters:', userMonsterIds);
    console.log('Total breeding pairs loaded:', BREEDING_PAIRS.length);
    console.log('Sample breeding pairs:', BREEDING_PAIRS.slice(0, 10));

    // Check all possible combinations of user's monsters
    for (let i = 0; i < userMonsterIds.length; i++) {
      for (let j = i; j < userMonsterIds.length; j++) {
        const parent1Id = userMonsterIds[i];
        const parent2Id = userMonsterIds[j];

        console.log(`Checking breeding for: ${parent1Id} + ${parent2Id}`);

        // Find breeding result for this combination
        const result = this.getBreedingResult(parent1Id, parent2Id);
        
        console.log(`Result: ${result}`);
        
        if (result) {
          const hasValidGenders = this.hasRequiredGenders(parent1Id, parent2Id);
          
          possibilities.push({
            parent1: parent1Id,
            parent2: parent2Id,
            result: result,
            parent1Name: this.getMonsterName(parent1Id),
            parent2Name: this.getMonsterName(parent2Id),
            resultName: this.getMonsterName(result),
            hasValidGenders
          });
        }
      }
    }

    console.log('Total possibilities found:', possibilities.length);

    // Remove duplicates (same result from different parent combinations)
    const uniquePossibilities = possibilities.filter((possibility, index, self) =>
      index === self.findIndex((p) => p.result === possibility.result)
    );

    // Sort by result name alphabetically
    return uniquePossibilities.sort((a, b) => a.resultName.localeCompare(b.resultName));
  }

  private getBreedingResult(parent1Id: string, parent2Id: string): string | null {
    const result = BREEDING_PAIRS.find(pair => 
      (pair.parent1 === parent1Id && pair.parent2 === parent2Id) ||
      (pair.parent1 === parent2Id && pair.parent2 === parent1Id)
    );
    return result ? result.result : null;
  }

  private hasRequiredGenders(parent1Id: string, parent2Id: string): boolean {
    const parent1 = this.userMonsters.get(parent1Id);
    const parent2 = this.userMonsters.get(parent2Id);
    
    if (!parent1 || !parent2) return false;
    
    // Need at least one male and one female for breeding
    const hasMale = (parent1.maleCount > 0) || (parent2.maleCount > 0);
    const hasFemale = (parent1.femaleCount > 0) || (parent2.femaleCount > 0);
    
    return hasMale && hasFemale;
  }

  private getMonsterName(monsterId: string): string {
    const monster = getMonsterById(monsterId);
    return monster ? monster.name : monsterId;
  }
}
