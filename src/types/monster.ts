export interface Monster {
  id: string;
  name: string;
  family: string;
  rank: number;
  hpGrowth: number;
  mpGrowth: number;
  attackGrowth: number;
  defenseGrowth: number;
  agilityGrowth: number;
  intelligenceGrowth: number;
  expGrowth?: number;
  maxLevel?: number;
  inStory?: boolean;
  skills?: string[];
  spawnLocations?: MonsterSpawnLocation[];
}

export interface MonsterSpawnLocation {
  map: string;
  description: string;
}

export interface BreedingPair {
  parent1: string;
  parent2: string;
  result: string;
  plus?: boolean;
}

export interface RawBreedingPair {
  result: string;
  parent1: string;
  parent2: string;
}

export interface UserMonster {
  monsterId: string;
  count: number;
  maleCount: number;
  femaleCount: number;
}

export interface OwnedMonster {
  id: string;
  monsterId: string;
  gender: Gender;
  nickname: string;
  isEgg?: boolean;
}

export interface OwnedKey {
  id: string;
  descriptor: string;
  family: string;
}

export interface BreedingPlan {
  targetMonster: string;
  steps: BreedingStep[];
  isPossible: boolean;
  missingMonsters: string[];
  missingRequirements?: string[];
  baseRequirements?: Record<string, number>;
  remainingRequirements?: Record<string, number>;
  totalBaseRequired?: number;
  totalRemaining?: number;
  tree?: BreedingTreeNode;
}

export interface BreedingTreeNode {
  kind: 'monster' | 'family';
  value: string;
  left?: BreedingTreeNode;
  right?: BreedingTreeNode;
}

export interface PlannerPairBreedNode {
  path: string;
  nodeKind: BreedingTreeNode['kind'];
  nodeValue: string;
  checked: boolean;
  gender?: Gender;
  assignedName?: string;
}

export interface PlannerPairBreedRequest {
  resultMonsterId: string;
  left: PlannerPairBreedNode;
  right: PlannerPairBreedNode;
}

export interface BreedingStep {
  step: number;
  parent1: string;
  parent2: string;
  parent1Gender?: Gender;
  parent2Gender?: Gender;
  result: string;
  needToBreed: boolean;
}

export type Gender = 'male' | 'female';
