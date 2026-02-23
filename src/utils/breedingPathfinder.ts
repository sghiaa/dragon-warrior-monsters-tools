import { MONSTERS, RAW_BREEDING_PAIRS, getMonsterById } from '../data/monsters';
import { BreedingPlan, BreedingStep, BreedingTreeNode, UserMonster } from '../types/monster';

type ParentToken =
  | { type: 'monster'; id: string }
  | { type: 'family'; family: string };

interface Recipe {
  result: string;
  parent1: ParentToken;
  parent2: ParentToken;
}

type PlanNode =
  | { type: 'family'; family: string }
  | { type: 'monster'; id: string; parent1?: PlanNode; parent2?: PlanNode; seeded?: boolean };

interface PlanWithCost {
  node: PlanNode;
  cost: number;
  remainingCost: number;
  ownedPreference: number;
}

interface BreedingPathfinderOptions {
  seedMonsterIds?: string[];
}

const BOSS_BASE_MONSTER = 'dracolord1';
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

const normalizeId = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

const parseAnyFamily = (token: string): string | null => {
  const match = token.trim().match(/^Any\s+(.+)$/i);
  if (!match) {
    return null;
  }
  const familyRaw = match[1].trim().toLowerCase();
  return FAMILY_ALIASES[familyRaw] || `${familyRaw.charAt(0).toUpperCase()}${familyRaw.slice(1)}`;
};

export class BreedingPathfinder {
  private recipesByResult: Map<string, Recipe[]> = new Map();
  private monsterFamilyById: Map<string, string> = new Map();
  private ownedByMonster: Map<string, number> = new Map();
  private ownedByFamily: Map<string, number> = new Map();
  private seedMonsterIds: Set<string> = new Set();
  private seedFamilies: Set<string> = new Set();
  private hasSeedConstraints: boolean = false;

  constructor(userMonsters: UserMonster[], options?: BreedingPathfinderOptions) {
    MONSTERS.forEach((monster) => {
      this.monsterFamilyById.set(monster.id, monster.family);
    });

    RAW_BREEDING_PAIRS.forEach((pair) => {
      const resultId = normalizeId(pair.result);
      const recipe: Recipe = {
        result: resultId,
        parent1: this.parseParentToken(pair.parent1),
        parent2: this.parseParentToken(pair.parent2)
      };

      const existing = this.recipesByResult.get(resultId) || [];
      existing.push(recipe);
      this.recipesByResult.set(resultId, existing);
    });

    userMonsters.forEach((um) => {
      if (um.count > 0) {
        this.ownedByMonster.set(um.monsterId, um.count);
        const family = this.monsterFamilyById.get(um.monsterId);
        if (family) {
          this.ownedByFamily.set(family, (this.ownedByFamily.get(family) || 0) + um.count);
        }
      }
    });

    (options?.seedMonsterIds || []).forEach((monsterId) => {
      this.seedMonsterIds.add(monsterId);
      const family = this.monsterFamilyById.get(monsterId);
      if (family) {
        this.seedFamilies.add(family);
      }
    });
    this.hasSeedConstraints = this.seedMonsterIds.size > 0;
  }

  public findBreedingPath(targetMonsterId: string): BreedingPlan {
    const targetMonster = getMonsterById(targetMonsterId);
    if (!targetMonster) {
      return {
        targetMonster: targetMonsterId,
        steps: [],
        isPossible: false,
        missingMonsters: [targetMonsterId],
        missingRequirements: ['Goal monster does not exist in loaded data.']
      };
    }

    if ((this.ownedByMonster.get(targetMonsterId) || 0) > 0 || this.seedMonsterIds.has(targetMonsterId)) {
      return {
        targetMonster: targetMonsterId,
        steps: [],
        isPossible: true,
        missingMonsters: [],
        baseRequirements: {},
        remainingRequirements: {},
        totalBaseRequired: 0,
        totalRemaining: 0
      };
    }

    const memo = new Map<string, PlanWithCost>();
    const bestPlan = this.buildMonsterPlan(targetMonsterId, new Set<string>(), memo);

    if (!bestPlan) {
      return {
        targetMonster: targetMonsterId,
        steps: [],
        isPossible: false,
        missingMonsters: [targetMonsterId],
        missingRequirements: [
          'No valid breeding route could be reduced to generic family requirements.'
        ]
      };
    }

    const steps: BreedingStep[] = [];
    this.collectSteps(bestPlan.node, steps);

    const baseRequirements = this.collectBaseRequirements(bestPlan.node);
    const remainingRequirements = this.collectRemainingRequirements(bestPlan.node);

    return {
      targetMonster: targetMonsterId,
      steps: steps.map((step, index) => ({ ...step, step: index + 1 })),
      isPossible: true,
      missingMonsters: [],
      baseRequirements,
      remainingRequirements,
      totalBaseRequired: this.sumRequirements(baseRequirements),
      totalRemaining: this.sumRequirements(remainingRequirements),
      tree: this.toBreedingTreeNode(bestPlan.node)
    };
  }

  private parseParentToken(rawToken: string): ParentToken {
    const family = parseAnyFamily(rawToken);
    if (family) {
      return { type: 'family', family };
    }

    return { type: 'monster', id: normalizeId(rawToken) };
  }

  private buildMonsterPlan(
    monsterId: string,
    stack: Set<string>,
    memo: Map<string, PlanWithCost>
  ): PlanWithCost | null {
    if (memo.has(monsterId)) {
      return memo.get(monsterId)!;
    }

    if (stack.has(monsterId)) {
      return null;
    }

    const nextStack = new Set(stack);
    nextStack.add(monsterId);

    let best: PlanWithCost | null = null;
    if (this.seedMonsterIds.has(monsterId)) {
      best = {
        node: { type: 'monster', id: monsterId, seeded: true },
        cost: 0,
        remainingCost: 0,
        ownedPreference: 1000
      };
    }

    const options = this.recipesByResult.get(monsterId) || [];
    if (options.length === 0) {
      if (best) {
        memo.set(monsterId, best);
      }
      return best;
    }

    for (const option of options) {
      const left = this.buildParentPlan(option.parent1, nextStack, memo);
      if (!left) {
        continue;
      }

      const right = this.buildParentPlan(option.parent2, nextStack, memo);
      if (!right) {
        continue;
      }

      const current: PlanWithCost = {
        node: {
          type: 'monster',
          id: monsterId,
          parent1: left.node,
          parent2: right.node
        },
        cost: left.cost + right.cost + 1,
        remainingCost: 0,
        ownedPreference:
          left.ownedPreference +
          right.ownedPreference +
          ((this.ownedByMonster.get(monsterId) || 0) > 0 ? 10 : 0)
      };
      current.remainingCost = this.sumRequirements(this.collectRemainingRequirements(current.node));

      if (
        !best ||
        current.cost < best.cost ||
        (current.cost === best.cost && current.remainingCost < best.remainingCost) ||
        (
          current.cost === best.cost &&
          current.remainingCost === best.remainingCost &&
          current.ownedPreference > best.ownedPreference
        )
      ) {
        best = current;
      }
    }

    if (best) {
      memo.set(monsterId, best);
    }

    return best;
  }

  private buildParentPlan(
    parent: ParentToken,
    stack: Set<string>,
    memo: Map<string, PlanWithCost>
  ): PlanWithCost | null {
    if (parent.type === 'monster') {
      return this.buildMonsterPlan(parent.id, stack, memo);
    }

    if (parent.family === 'Boss') {
      return this.buildMonsterPlan(BOSS_BASE_MONSTER, stack, memo);
    }

    if (this.hasSeedConstraints && !this.seedFamilies.has(parent.family)) {
      return null;
    }

    return {
      node: { type: 'family', family: parent.family },
      cost: 0,
      remainingCost: 1,
      ownedPreference: (this.ownedByFamily.get(parent.family) || 0) > 0 ? 1 : 0
    };
  }

  private collectSteps(node: PlanNode, steps: BreedingStep[]): void {
    if (node.type === 'family') {
      return;
    }

    if (!node.parent1 || !node.parent2) {
      return;
    }

    this.collectSteps(node.parent1, steps);
    this.collectSteps(node.parent2, steps);

    steps.push({
      step: 0,
      parent1: this.getNodeDisplayId(node.parent1),
      parent2: this.getNodeDisplayId(node.parent2),
      result: node.id,
      needToBreed: true
    });
  }

  private getNodeDisplayId(node: PlanNode): string {
    if (node.type === 'family') {
      return `Any ${node.family}`;
    }

    return node.id;
  }

  private collectBaseRequirements(node: PlanNode): Record<string, number> {
    const counts = new Map<string, number>();

    const walk = (current: PlanNode): void => {
      if (current.type === 'family') {
        counts.set(current.family, (counts.get(current.family) || 0) + 1);
        return;
      }

      if (!current.parent1 || !current.parent2) {
        return;
      }

      walk(current.parent1);
      walk(current.parent2);
    };

    walk(node);
    return this.mapToObject(counts);
  }

  private collectRemainingRequirements(node: PlanNode): Record<string, number> {
    const owned = new Map<string, number>(this.ownedByMonster);
    const remainingExactNodes = new Map<string, number>();
    const remainingFamilies = new Map<string, number>();

    const collectExactCounts = (current: PlanNode): void => {
      if (current.type === 'family') {
        return;
      }

      if (!current.seeded) {
        remainingExactNodes.set(current.id, (remainingExactNodes.get(current.id) || 0) + 1);
      }
      if (current.parent1 && current.parent2) {
        collectExactCounts(current.parent1);
        collectExactCounts(current.parent2);
      }
    };

    const consumeFamily = (family: string): boolean => {
      for (const [monsterId, count] of Array.from(owned.entries())) {
        if (count <= 0) {
          continue;
        }

        if (this.monsterFamilyById.get(monsterId) !== family) {
          continue;
        }

        const reservedForExact = remainingExactNodes.get(monsterId) || 0;
        if (count <= reservedForExact) {
          continue;
        }

        owned.set(monsterId, count - 1);
        return true;
      }

      return false;
    };

    const consume = (current: PlanNode): void => {
      if (current.type === 'family') {
        const usedOwned = consumeFamily(current.family);
        if (!usedOwned) {
          remainingFamilies.set(
            current.family,
            (remainingFamilies.get(current.family) || 0) + 1
          );
        }
        return;
      }

      const currentCount = owned.get(current.id) || 0;
      const currentReserved = remainingExactNodes.get(current.id) || 0;

      if (current.seeded) {
        return;
      }

      if (currentCount > 0) {
        owned.set(current.id, currentCount - 1);
        remainingExactNodes.set(current.id, Math.max(0, currentReserved - 1));
        return;
      }

      remainingExactNodes.set(current.id, Math.max(0, currentReserved - 1));
      if (current.parent1 && current.parent2) {
        consume(current.parent1);
        consume(current.parent2);
      }
    };

    collectExactCounts(node);
    consume(node);

    return this.mapToObject(remainingFamilies);
  }

  private mapToObject(map: Map<string, number>): Record<string, number> {
    const sortedEntries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return Object.fromEntries(sortedEntries);
  }

  private sumRequirements(requirements: Record<string, number>): number {
    return Object.values(requirements).reduce((sum, count) => sum + count, 0);
  }

  private toBreedingTreeNode(node: PlanNode): BreedingTreeNode {
    if (node.type === 'family') {
      return {
        kind: 'family',
        value: `Any ${node.family}`
      };
    }

    return {
      kind: 'monster',
      value: node.id,
      ...(node.parent1 && node.parent2
        ? {
            left: this.toBreedingTreeNode(node.parent1),
            right: this.toBreedingTreeNode(node.parent2)
          }
        : {})
    };
  }
}
