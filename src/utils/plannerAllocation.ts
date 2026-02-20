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
    ensureGoalSet(goalId).add(path);
  };

  const isSlotAvailable = (goalId: string, path: string) => {
    const set = ensureGoalSet(goalId);
    return !set.has(path) && !isBlocked(path, set);
  };

  const ownedPool = [...ownedMonsters];
  for (const owned of ownedPool) {
    const exactCandidates = monsterSlots
      .filter((slot) => slot.speciesId === owned.monsterId && isSlotAvailable(slot.goalId, slot.path))
      .sort((a, b) => {
        if (a.subtreeSize !== b.subtreeSize) {
          return b.subtreeSize - a.subtreeSize;
        }
        if (a.depth !== b.depth) {
          return a.depth - b.depth;
        }
        return (goalOrder.get(a.goalId) || 0) - (goalOrder.get(b.goalId) || 0);
      });

    if (exactCandidates.length > 0) {
      const picked = exactCandidates[0];
      assign(picked.goalId, picked.path, owned);
      continue;
    }

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
        const immediateBreed = siblingAssignedGender
          ? siblingAssignedGender !== owned.gender
            ? 2
            : 0
          : 1;
        return { ...slot, immediateBreed };
      })
      .sort((a, b) => {
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
