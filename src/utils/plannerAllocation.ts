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

const isBlocked = (path: string, takenPaths: Set<string>) => {
  const parts = path.split('.');
  for (let i = 1; i <= parts.length; i++) {
    const ancestor = parts.slice(0, i).join('.');
    if (ancestor !== path && takenPaths.has(ancestor)) {
      return true;
    }
  }
  return false;
};

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
  const ensureGoalSet = (goalId: string) => {
    if (!takenByGoal.has(goalId)) {
      takenByGoal.set(goalId, new Set<string>());
    }
    return takenByGoal.get(goalId)!;
  };

  const assign = (goalId: string, path: string, owned: OwnedMonster) => {
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
  };

  const isSlotAvailable = (goalId: string, path: string) => {
    const set = ensureGoalSet(goalId);
    return !set.has(path) && !isBlocked(path, set);
  };

  // Pass 1: assign all exact species matches first.
  const remainingOwned: OwnedMonster[] = [];
  for (const owned of ownedMonsters) {
    const exactCandidates = monsterSlots
      .filter((slot) => slot.speciesId === owned.monsterId && isSlotAvailable(slot.goalId, slot.path))
      .map((slot) => {
        const siblingPath = getSiblingPath(slot.path);
        const siblingAssignedGender = siblingPath
          ? result[slot.goalId].checkedNodeGenders[siblingPath]
          : undefined;
        const siblingIsChecked = siblingPath
          ? result[slot.goalId].checkedNodes.includes(siblingPath)
          : false;
        const immediateBreed = siblingAssignedGender
          ? siblingAssignedGender !== owned.gender
            ? 2
            : 0
          : 1;
        return { ...slot, siblingIsChecked, immediateBreed };
      })
      .sort((a, b) => {
        // Prefer branch completion over broad coverage:
        // 1) sibling already checked
        // 2) immediate opposite-gender pairing
        // 3) deeper nodes
        // 4) smaller subtree
        if (a.siblingIsChecked !== b.siblingIsChecked) {
          return a.siblingIsChecked ? -1 : 1;
        }
        if (a.immediateBreed !== b.immediateBreed) {
          return b.immediateBreed - a.immediateBreed;
        }
        if (a.depth !== b.depth) {
          return b.depth - a.depth;
        }
        if (a.subtreeSize !== b.subtreeSize) {
          return a.subtreeSize - b.subtreeSize;
        }
        return (goalOrder.get(a.goalId) || 0) - (goalOrder.get(b.goalId) || 0);
      });

    if (exactCandidates.length > 0) {
      const picked = exactCandidates[0];
      assign(picked.goalId, picked.path, owned);
      continue;
    }
    remainingOwned.push(owned);
  }

  // Pass 2: greedily place remaining monsters into family slots.
  for (const owned of remainingOwned) {
    const monster = getMonsterById(owned.monsterId);
    const family = monster?.family;
    if (!family) {
      continue;
    }

    const familyCandidates = familySlots
      .filter((slot) => slot.family === family && isSlotAvailable(slot.goalId, slot.path))
      .map((slot) => {
        const siblingAssignedGender = slot.siblingPath
          ? result[slot.goalId].checkedNodeGenders[slot.siblingPath]
          : undefined;
        const siblingIsChecked = slot.siblingPath
          ? result[slot.goalId].checkedNodes.includes(slot.siblingPath)
          : false;
        const immediateBreed = siblingAssignedGender
          ? siblingAssignedGender !== owned.gender
            ? 2
            : 0
          : 1;
        return { ...slot, immediateBreed, siblingIsChecked };
      })
      .sort((a, b) => {
        if (a.siblingIsChecked !== b.siblingIsChecked) {
          return a.siblingIsChecked ? -1 : 1;
        }
        if (a.immediateBreed !== b.immediateBreed) {
          return b.immediateBreed - a.immediateBreed;
        }
        if (a.depth !== b.depth) {
          return b.depth - a.depth;
        }
        return (goalOrder.get(a.goalId) || 0) - (goalOrder.get(b.goalId) || 0);
      });

    if (familyCandidates.length > 0) {
      const picked = familyCandidates[0];
      assign(picked.goalId, picked.path, owned);
    }
  }

  return result;
};
