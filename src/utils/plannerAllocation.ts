import { getMonsterById } from '../data/monsters';
import { BreedingPlan, BreedingTreeNode, Gender, OwnedMonster, UserMonster } from '../types/monster';

interface MonsterSlot {
  goalId: string;
  path: string;
  depth: number;
  speciesId: string;
  subtreeSize: number;
}

interface FamilySlot {
  goalId: string;
  path: string;
  depth: number;
  family: string;
  siblingPath: string | null;
}

export interface GoalAutoAssignment {
  checkedNodes: string[];
  checkedNodeGenders: Record<string, Gender>;
  checkedNodeNames: Record<string, string>;
}

const isPlannerDebugEnabled = (): boolean => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.REACT_APP_PLANNER_DEBUG === '1';
  }
  return false;
};

export const deriveUserMonstersFromOwned = (ownedMonsters: OwnedMonster[]): UserMonster[] => {
  const grouped = new Map<string, { count: number; maleCount: number; femaleCount: number }>();
  ownedMonsters.forEach((owned) => {
    const existing = grouped.get(owned.monsterId) || { count: 0, maleCount: 0, femaleCount: 0 };
    existing.count += 1;
    if (owned.gender === 'male') {
      existing.maleCount += 1;
    } else {
      existing.femaleCount += 1;
    }
    grouped.set(owned.monsterId, existing);
  });

  return Array.from(grouped.entries()).map(([monsterId, counts]) => ({
    monsterId,
    ...counts
  }));
};

const getSubtreeSize = (node: BreedingTreeNode): number => {
  const left = node.left ? getSubtreeSize(node.left) : 0;
  const right = node.right ? getSubtreeSize(node.right) : 0;
  return 1 + left + right;
};

const collectSlots = (
  goalId: string,
  node: BreedingTreeNode | undefined,
  path: string,
  depth: number,
  monsterSlots: MonsterSlot[],
  familySlots: FamilySlot[]
) => {
  if (!node) {
    return;
  }

  if (node.kind === 'monster') {
    monsterSlots.push({
      goalId,
      path,
      depth,
      speciesId: node.value,
      subtreeSize: getSubtreeSize(node)
    });
  }

  const isLeaf = !node.left && !node.right;
  if (isLeaf && node.kind === 'family') {
    const family = node.value.replace(/^Any\s+/i, '');
    const siblingPath = path.endsWith('.L')
      ? `${path.slice(0, -2)}.R`
      : path.endsWith('.R')
        ? `${path.slice(0, -2)}.L`
        : null;
    familySlots.push({ goalId, path, depth, family, siblingPath });
  }

  if (node.left) {
    collectSlots(goalId, node.left, `${path}.L`, depth + 1, monsterSlots, familySlots);
  }
  if (node.right) {
    collectSlots(goalId, node.right, `${path}.R`, depth + 1, monsterSlots, familySlots);
  }
};

const sharesBranchPath = (a: string, b: string) =>
  a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);

const getSiblingPath = (path: string): string | null => {
  if (path.endsWith('.L')) {
    return `${path.slice(0, -2)}.R`;
  }
  if (path.endsWith('.R')) {
    return `${path.slice(0, -2)}.L`;
  }
  return null;
};

export const computeAutoAssignments = (
  selectedGoals: string[],
  breedingPlans: Record<string, BreedingPlan>,
  ownedMonsters: OwnedMonster[]
): Record<string, GoalAutoAssignment> => {
  const goalOrder = new Map<string, number>();
  selectedGoals.forEach((goalId, index) => {
    goalOrder.set(goalId, index);
  });

  const result: Record<string, GoalAutoAssignment> = {};
  selectedGoals.forEach((goalId) => {
    result[goalId] = {
      checkedNodes: [],
      checkedNodeGenders: {},
      checkedNodeNames: {}
    };
  });

  const monsterSlots: MonsterSlot[] = [];
  const familySlots: FamilySlot[] = [];
  selectedGoals.forEach((goalId) => {
    const tree = breedingPlans[goalId]?.tree;
    if (tree) {
      collectSlots(goalId, tree, 'root', 0, monsterSlots, familySlots);
    }
  });

  const takenByGoal = new Map<string, Set<string>>();
  const usedOwnedIds = new Set<string>();
  const ensureGoalSet = (goalId: string) => {
    if (!takenByGoal.has(goalId)) {
      takenByGoal.set(goalId, new Set<string>());
    }
    return takenByGoal.get(goalId)!;
  };

  const assign = (
    goalId: string,
    path: string,
    owned: OwnedMonster,
    pass: 'exact' | 'family'
  ) => {
    result[goalId].checkedNodes.push(path);
    result[goalId].checkedNodeGenders[path] = owned.gender;
    if (owned.nickname.trim()) {
      result[goalId].checkedNodeNames[path] = owned.nickname.trim();
    }

    // If only one side of a pair is filled, infer the opposite gender on the sibling
    // so the planner UI can still show the intended pair direction.
    const siblingPath = getSiblingPath(path);
    if (
      siblingPath &&
      !result[goalId].checkedNodes.includes(siblingPath) &&
      !result[goalId].checkedNodeGenders[siblingPath]
    ) {
      result[goalId].checkedNodeGenders[siblingPath] = owned.gender === 'male' ? 'female' : 'male';
    }

    ensureGoalSet(goalId).add(path);
    usedOwnedIds.add(owned.id);

    if (isPlannerDebugEnabled()) {
      console.log(
        `[Planner AutoAssign] placed (${pass}) goal=${goalId} path=${path} monster=${owned.monsterId} nickname=${owned.nickname.trim() || '-'} gender=${owned.gender}`
      );
    }
  };

  const isSlotAvailable = (goalId: string, path: string) => {
    const set = ensureGoalSet(goalId);
    return !Array.from(set).some((takenPath) => sharesBranchPath(path, takenPath));
  };

  const isGenderCompatible = (goalId: string, path: string, owned: OwnedMonster) => {
    const siblingPath = getSiblingPath(path);
    if (!siblingPath) {
      return true;
    }

    const siblingIsChecked = result[goalId].checkedNodes.includes(siblingPath);
    if (!siblingIsChecked) {
      return true;
    }

    const siblingGender = result[goalId].checkedNodeGenders[siblingPath];
    if (!siblingGender) {
      return true;
    }

    return siblingGender !== owned.gender;
  };

  const sortedExactSlots = monsterSlots
    .slice()
    .sort((a, b) => {
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      if (a.subtreeSize !== b.subtreeSize) {
        return a.subtreeSize - b.subtreeSize;
      }
      return (goalOrder.get(a.goalId) || 0) - (goalOrder.get(b.goalId) || 0);
    });

  // Pass 1: walk exact slots top-down and fill each with the best available owned match.
  for (const slot of sortedExactSlots) {
    if (!isSlotAvailable(slot.goalId, slot.path)) {
      continue;
    }

    const matchingOwned = ownedMonsters
      .filter((owned) =>
        !usedOwnedIds.has(owned.id) &&
        owned.monsterId === slot.speciesId &&
        isGenderCompatible(slot.goalId, slot.path, owned)
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    if (matchingOwned.length > 0) {
      assign(slot.goalId, slot.path, matchingOwned[0], 'exact');
    }
  }

  const sortedFamilySlots = familySlots
    .slice()
    .sort((a, b) => {
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      return (goalOrder.get(a.goalId) || 0) - (goalOrder.get(b.goalId) || 0);
    });

  // Pass 2: walk family slots top-down and fill each with the highest-rank available family match.
  for (const slot of sortedFamilySlots) {
    if (!isSlotAvailable(slot.goalId, slot.path)) {
      continue;
    }

    const matchingOwned = ownedMonsters
      .filter((owned) => {
        if (usedOwnedIds.has(owned.id)) {
          return false;
        }
        const monster = getMonsterById(owned.monsterId);
        return !!monster &&
          monster.family === slot.family &&
          isGenderCompatible(slot.goalId, slot.path, owned);
      })
      .sort((a, b) => {
        const monsterA = getMonsterById(a.monsterId);
        const monsterB = getMonsterById(b.monsterId);
        const rankA = monsterA?.rank || 0;
        const rankB = monsterB?.rank || 0;
        if (rankA !== rankB) {
          return rankB - rankA;
        }
        return a.monsterId.localeCompare(b.monsterId);
      });

    if (matchingOwned.length > 0) {
      assign(slot.goalId, slot.path, matchingOwned[0], 'family');
    }
  }

  return result;
};
