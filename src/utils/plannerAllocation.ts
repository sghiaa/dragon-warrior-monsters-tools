import { getBreedingResult, getMonsterById } from '../data/monsters';
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
  parentPath: string | null;
  depth: number;
  family: string;
  siblingPath: string | null;
  siblingSpeciesId: string | null;
  parentResultSpeciesId: string | null;
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
  familySlots: FamilySlot[],
  parentNode?: BreedingTreeNode
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
    const parentPath = path.endsWith('.L') || path.endsWith('.R')
      ? path.slice(0, -2)
      : null;
    const siblingNode = path.endsWith('.L') ? parentNode?.right : path.endsWith('.R') ? parentNode?.left : undefined;
    familySlots.push({
      goalId,
      path,
      parentPath,
      depth,
      family,
      siblingPath,
      siblingSpeciesId: siblingNode?.kind === 'monster' ? siblingNode.value : null,
      parentResultSpeciesId: parentNode?.kind === 'monster' ? parentNode.value : null
    });
  }

  if (node.left) {
    collectSlots(goalId, node.left, `${path}.L`, depth + 1, monsterSlots, familySlots, node);
  }
  if (node.right) {
    collectSlots(goalId, node.right, `${path}.R`, depth + 1, monsterSlots, familySlots, node);
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

  const isCandidateSafeForFamilySlot = (slot: FamilySlot, owned: OwnedMonster) => {
    // If this family slot doesn't have a concrete sibling species and target result species,
    // we cannot validate a concrete pair override; allow assignment.
    if (!slot.siblingSpeciesId || !slot.parentResultSpeciesId) {
      return true;
    }

    const pairResult = getBreedingResult(owned.monsterId, slot.siblingSpeciesId);
    return !!pairResult && pairResult.result === slot.parentResultSpeciesId;
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

  const slotByPath = new Map(sortedFamilySlots.map((slot) => [slot.path, slot]));
  const processedPairParents = new Set<string>();

  // Pass 2a: for sibling family slots under a concrete monster result, assign both slots together
  // only if the chosen pair actually breeds to that immediate parent result.
  for (const slot of sortedFamilySlots) {
    if (!slot.parentPath || !slot.siblingPath || processedPairParents.has(slot.parentPath)) {
      continue;
    }

    const siblingSlot = slotByPath.get(slot.siblingPath);
    if (!siblingSlot || siblingSlot.parentPath !== slot.parentPath) {
      continue;
    }
    if (!slot.parentResultSpeciesId || slot.parentResultSpeciesId !== siblingSlot.parentResultSpeciesId) {
      continue;
    }

    if (!isSlotAvailable(slot.goalId, slot.path) || !isSlotAvailable(siblingSlot.goalId, siblingSlot.path)) {
      processedPairParents.add(slot.parentPath);
      continue;
    }

    const candidatesFor = (candidateSlot: FamilySlot) =>
      ownedMonsters
        .filter((owned) => {
          if (usedOwnedIds.has(owned.id)) {
            return false;
          }
          const monster = getMonsterById(owned.monsterId);
          return !!monster && monster.family === candidateSlot.family;
        })
        .sort((a, b) => {
          const rankA = getMonsterById(a.monsterId)?.rank || 0;
          const rankB = getMonsterById(b.monsterId)?.rank || 0;
          if (rankA !== rankB) {
            return rankB - rankA;
          }
          return a.monsterId.localeCompare(b.monsterId);
        });

    const slotCandidates = candidatesFor(slot);
    const siblingCandidates = candidatesFor(siblingSlot);
    let best:
      | {
          left: OwnedMonster;
          right: OwnedMonster;
          score: number;
        }
      | null = null;

    for (const left of slotCandidates) {
      for (const right of siblingCandidates) {
        if (left.id === right.id) {
          continue;
        }
        if (left.gender === right.gender) {
          continue;
        }
        const pairResult = getBreedingResult(left.monsterId, right.monsterId);
        if (!pairResult || pairResult.result !== slot.parentResultSpeciesId) {
          continue;
        }
        const score = (getMonsterById(left.monsterId)?.rank || 0) + (getMonsterById(right.monsterId)?.rank || 0);
        if (!best || score > best.score) {
          best = { left, right, score };
        }
      }
    }

    if (best) {
      assign(slot.goalId, slot.path, best.left, 'family');
      assign(siblingSlot.goalId, siblingSlot.path, best.right, 'family');
    }

    processedPairParents.add(slot.parentPath);
  }

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
          isGenderCompatible(slot.goalId, slot.path, owned) &&
          isCandidateSafeForFamilySlot(slot, owned);
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
