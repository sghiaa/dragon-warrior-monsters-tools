import { Monster } from '../types/monster';
import { SkillRecipe } from './skillData';

export interface MoveCandidateMonster {
  monsterId: string;
  monsterName: string;
  stepCount: number;
  coveredSkills: string[];
}

export interface MovePlanResult {
  requiredSkills: string[];
  selectedMonsters: MoveCandidateMonster[];
  uncoveredSkills: string[];
}

export interface MoveLearner {
  monsterId: string;
  monsterName: string;
  stepCount: number;
}

const sortSkills = (skills: string[]): string[] => skills.slice().sort((a, b) => a.localeCompare(b));

const comparePlan = (
  a: { totalSteps: number; monsterCount: number },
  b: { totalSteps: number; monsterCount: number }
) => {
  if (a.totalSteps !== b.totalSteps) {
    return a.totalSteps - b.totalSteps;
  }
  return a.monsterCount - b.monsterCount;
};

const bitCount = (mask: number): number => {
  let value = mask;
  let count = 0;
  while (value > 0) {
    count += value & 1;
    value >>= 1;
  }
  return count;
};

export const getCombinableSkills = (recipes: SkillRecipe[]): SkillRecipe[] =>
  recipes
    .filter((recipe) => recipe.combineFrom.length > 0 || !!recipe.precursor)
    .sort((a, b) => a.name.localeCompare(b.name));

export const planMoveAcquisition = (
  targetSkill: string,
  recipes: SkillRecipe[],
  monsters: Monster[],
  stepCounts: Record<string, number>
): MovePlanResult => {
  const recipesByName = new Map(recipes.map((entry) => [entry.name, entry]));

  const getLineageToRoot = (skill: string): string[] => {
    const lineage: string[] = [];
    const visited = new Set<string>();
    let current: string | undefined = skill;

    while (current && !visited.has(current)) {
      visited.add(current);
      lineage.push(current);
      const recipeForCurrent = recipesByName.get(current);
      current = recipeForCurrent?.precursor;
    }

    return lineage;
  };

  const recipe = recipes.find((r) => r.name === targetSkill);
  if (!recipe || (!recipe.precursor && recipe.combineFrom.length === 0)) {
    return {
      requiredSkills: [],
      selectedMonsters: [],
      uncoveredSkills: []
    };
  }

  const ingredientSkills = recipe.combineFrom.length > 0
    ? recipe.combineFrom
    : recipe.precursor
      ? [recipe.precursor]
      : [];

  if (ingredientSkills.length === 0) {
    return {
      requiredSkills: [],
      selectedMonsters: [],
      uncoveredSkills: []
    };
  }

  const requirementsByRoot = new Map<string, Set<string>>();
  ingredientSkills.forEach((ingredient) => {
    const lineage = getLineageToRoot(ingredient);
    if (lineage.length === 0) {
      return;
    }

    const root = lineage[lineage.length - 1];
    const existing = requirementsByRoot.get(root) || new Set<string>();
    lineage.forEach((skill) => existing.add(skill));
    requirementsByRoot.set(root, existing);
  });

  const requiredSkills = sortSkills(Array.from(requirementsByRoot.keys()));
  const skillIndex = new Map(requiredSkills.map((skill, i) => [skill, i]));
  const goalMask = (1 << requiredSkills.length) - 1;
  const requiredAcceptableSets = requiredSkills.map((skill) => requirementsByRoot.get(skill) || new Set([skill]));

  const candidates: MoveCandidateMonster[] = monsters
    .map((monster) => {
      const monsterSkillSet = new Set(monster.skills || []);
      const coveredSkills = requiredSkills
        .filter((_required, index) => {
          const acceptable = requiredAcceptableSets[index];
          return Array.from(acceptable).some((skill) => monsterSkillSet.has(skill));
        })
        .sort((a, b) => a.localeCompare(b));
      if (coveredSkills.length === 0) {
        return null;
      }

      const steps = stepCounts[monster.id];
      if (typeof steps !== 'number' || steps < 0) {
        return null;
      }

      return {
        monsterId: monster.id,
        monsterName: monster.name,
        stepCount: steps,
        coveredSkills
      };
    })
    .filter(Boolean) as MoveCandidateMonster[];

  if (candidates.length === 0) {
    return {
      requiredSkills,
      selectedMonsters: [],
      uncoveredSkills: requiredSkills
    };
  }

  const candidateMasks = candidates.map((candidate) =>
    candidate.coveredSkills.reduce((mask, skill) => mask | (1 << (skillIndex.get(skill) || 0)), 0)
  );

  interface DpState {
    totalSteps: number;
    monsterCount: number;
    pickedIndexes: number[];
  }

  const dp: Array<DpState | null> = new Array(1 << requiredSkills.length).fill(null);
  dp[0] = { totalSteps: 0, monsterCount: 0, pickedIndexes: [] };

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateMask = candidateMasks[i];
    const next = dp.slice();

    for (let mask = 0; mask <= goalMask; mask++) {
      const state = dp[mask];
      if (!state) {
        continue;
      }

      const merged = mask | candidateMask;
      const proposal: DpState = {
        totalSteps: state.totalSteps + candidate.stepCount,
        monsterCount: state.monsterCount + 1,
        pickedIndexes: [...state.pickedIndexes, i]
      };
      const existing = next[merged];
      if (!existing || comparePlan(proposal, existing) < 0) {
        next[merged] = proposal;
      }
    }

    for (let mask = 0; mask <= goalMask; mask++) {
      dp[mask] = next[mask];
    }
  }

  let bestMask = goalMask;
  let bestState = dp[goalMask];
  if (!bestState) {
    let bestCoverage = -1;
    for (let mask = 0; mask <= goalMask; mask++) {
      const state = dp[mask];
      if (!state) {
        continue;
      }

      const coverage = bitCount(mask);
      if (
        coverage > bestCoverage ||
        (coverage === bestCoverage && (!bestState || comparePlan(state, bestState) < 0))
      ) {
        bestMask = mask;
        bestState = state;
        bestCoverage = coverage;
      }
    }
  }

  if (!bestState) {
    return {
      requiredSkills,
      selectedMonsters: [],
      uncoveredSkills: requiredSkills
    };
  }

  const selectedMonsters = bestState.pickedIndexes
    .map((index) => candidates[index])
    .sort((a, b) => {
      if (a.stepCount !== b.stepCount) {
        return a.stepCount - b.stepCount;
      }
      return a.monsterName.localeCompare(b.monsterName);
    });

  const uncoveredSkills = requiredSkills.filter((skill, index) => (bestMask & (1 << index)) === 0);

  return {
    requiredSkills,
    selectedMonsters,
    uncoveredSkills
  };
};

export const getMonstersWithMove = (
  moveName: string,
  monsters: Monster[],
  stepCounts: Record<string, number>
): MoveLearner[] =>
  monsters
    .filter((monster) => (monster.skills || []).includes(moveName))
    .map((monster) => ({
      monsterId: monster.id,
      monsterName: monster.name,
      stepCount: typeof stepCounts[monster.id] === 'number' ? stepCounts[monster.id] : -1
    }))
    .sort((a, b) => {
      const stepA = a.stepCount < 0 ? Number.MAX_SAFE_INTEGER : a.stepCount;
      const stepB = b.stepCount < 0 ? Number.MAX_SAFE_INTEGER : b.stepCount;
      if (stepA !== stepB) {
        return stepA - stepB;
      }
      return a.monsterName.localeCompare(b.monsterName);
    });

export interface MoveUsageInfo {
  usedInCombinations: string[];
  usedAsPrecursorFor: string[];
  eventualUnlocks: string[];
}

export const getMoveUsageInfo = (moveName: string, recipes: SkillRecipe[]): MoveUsageInfo => {
  const usedInCombinations = recipes
    .filter((recipe) => recipe.combineFrom.includes(moveName))
    .map((recipe) => recipe.name)
    .sort((a, b) => a.localeCompare(b));

  const usedAsPrecursorFor = recipes
    .filter((recipe) => recipe.precursor === moveName)
    .map((recipe) => recipe.name)
    .sort((a, b) => a.localeCompare(b));

  const edges = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => {
    const set = edges.get(from) || new Set<string>();
    set.add(to);
    edges.set(from, set);
  };

  recipes.forEach((recipe) => {
    recipe.combineFrom.forEach((ingredient) => addEdge(ingredient, recipe.name));
    if (recipe.precursor) {
      addEdge(recipe.precursor, recipe.name);
    }
  });

  const visited = new Set<string>();
  const queue: string[] = [moveName];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const next = edges.get(current);
    if (!next) {
      continue;
    }
    next.forEach((to) => {
      if (to === moveName || visited.has(to)) {
        return;
      }
      visited.add(to);
      queue.push(to);
    });
  }

  const eventualUnlocks = Array.from(visited).sort((a, b) => a.localeCompare(b));

  return { usedInCombinations, usedAsPrecursorFor, eventualUnlocks };
};
