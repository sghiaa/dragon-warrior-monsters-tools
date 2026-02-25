import { BreedingTreeNode, Gender } from '../types/monster';

export interface FamilyGenderCounts {
  total: number;
  male: number;
  female: number;
  unassigned: number;
}

const addCounts = (target: Record<string, number>, source: Record<string, number>) => {
  Object.entries(source).forEach(([family, count]) => {
    target[family] = (target[family] || 0) + count;
  });
};

export const collectBaseRequirementsFromNode = (node: BreedingTreeNode): Record<string, number> => {
  if (node.kind === 'family') {
    return { [node.value.replace(/^Any\s+/i, '')]: 1 };
  }

  const totals: Record<string, number> = {};
  if (node.left) {
    addCounts(totals, collectBaseRequirementsFromNode(node.left));
  }
  if (node.right) {
    addCounts(totals, collectBaseRequirementsFromNode(node.right));
  }
  return totals;
};

export const collectCheckedCoverage = (
  node: BreedingTreeNode | undefined,
  checkedNodes: Set<string>,
  path = 'root'
): Record<string, number> => {
  if (!node) {
    return {};
  }

  if (checkedNodes.has(path)) {
    return collectBaseRequirementsFromNode(node);
  }

  if (node.kind === 'family') {
    return {};
  }

  const totals: Record<string, number> = {};
  if (node.left) {
    addCounts(totals, collectCheckedCoverage(node.left, checkedNodes, `${path}.L`));
  }
  if (node.right) {
    addCounts(totals, collectCheckedCoverage(node.right, checkedNodes, `${path}.R`));
  }
  return totals;
};

export const computeAdjustedRemaining = (
  baseRequirements: Record<string, number> | undefined,
  remainingRequirements: Record<string, number> | undefined,
  checkedCoverage: Record<string, number>
): Record<string, number> => {
  const baseRemaining = { ...(baseRequirements || remainingRequirements || {}) };
  Object.entries(checkedCoverage).forEach(([family, covered]) => {
    baseRemaining[family] = Math.max(0, (baseRemaining[family] || 0) - covered);
    if (baseRemaining[family] === 0) {
      delete baseRemaining[family];
    }
  });
  return baseRemaining;
};

export const sumRequirements = (requirements: Record<string, number>): number =>
  Object.values(requirements).reduce((sum, count) => sum + count, 0);

export const computeRemainingGenderRequirements = (
  node: BreedingTreeNode | undefined,
  checkedNodes: Set<string>,
  checkedNodeGenders: Record<string, Gender>,
  path = 'root'
): Record<string, FamilyGenderCounts> => {
  if (!node) {
    return {};
  }

  if (checkedNodes.has(path)) {
    return {};
  }

  if (node.kind === 'family') {
    const family = node.value.replace(/^Any\s+/i, '');
    const requiredGender = checkedNodeGenders[path];
    const counts: FamilyGenderCounts = {
      total: 1,
      male: requiredGender === 'male' ? 1 : 0,
      female: requiredGender === 'female' ? 1 : 0,
      unassigned: requiredGender ? 0 : 1
    };
    return { [family]: counts };
  }

  const totals: Record<string, FamilyGenderCounts> = {};
  const merge = (source: Record<string, FamilyGenderCounts>) => {
    Object.entries(source).forEach(([family, counts]) => {
      const existing = totals[family] || { total: 0, male: 0, female: 0, unassigned: 0 };
      totals[family] = {
        total: existing.total + counts.total,
        male: existing.male + counts.male,
        female: existing.female + counts.female,
        unassigned: existing.unassigned + counts.unassigned
      };
    });
  };

  if (node.left) {
    merge(computeRemainingGenderRequirements(node.left, checkedNodes, checkedNodeGenders, `${path}.L`));
  }
  if (node.right) {
    merge(computeRemainingGenderRequirements(node.right, checkedNodes, checkedNodeGenders, `${path}.R`));
  }

  return totals;
};

export const combineRemainingByFamilyGender = (
  remainingGenderRequirementsByFamily: Record<string, FamilyGenderCounts>,
  adjustedRemaining: Record<string, number>
): Record<string, FamilyGenderCounts> => {
  if (Object.keys(remainingGenderRequirementsByFamily).length > 0) {
    return remainingGenderRequirementsByFamily;
  }

  const fallback: Record<string, FamilyGenderCounts> = {};
  Object.entries(adjustedRemaining).forEach(([family, count]) => {
    fallback[family] = { total: count, male: 0, female: 0, unassigned: count };
  });
  return fallback;
};

export const renderFamilyGenderRequirements = (
  byFamily: Record<string, FamilyGenderCounts>
): string => {
  const families = Object.keys(byFamily).sort((a, b) => a.localeCompare(b));
  if (families.length === 0) {
    return 'None';
  }

  return families.map((family) => {
    const counts = byFamily[family];
    const detailParts: string[] = [];
    if (counts.male > 0) {
      detailParts.push(`${counts.male} male`);
    }
    if (counts.female > 0) {
      detailParts.push(`${counts.female} female`);
    }
    if (counts.unassigned > 0) {
      detailParts.push(`${counts.unassigned} unassigned`);
    }
    const details = detailParts.join(', ');
    return `${counts.total} ${family}${details ? ` (${details})` : ''}`;
  }).join(', ');
};

export const collectRemainingMoves = (
  node: BreedingTreeNode | undefined,
  checkedNodes: Set<string>,
  getSkillsByMonsterId: (monsterId: string) => string[],
  path = 'root'
): string[] => {
  if (!node) {
    return [];
  }

  const moves = new Set<string>();
  const walk = (current: BreedingTreeNode, currentPath: string) => {
    if (checkedNodes.has(currentPath)) {
      return;
    }

    if (current.kind === 'monster') {
      getSkillsByMonsterId(current.value).forEach((skill) => {
        const trimmed = (skill || '').trim();
        if (trimmed) {
          moves.add(trimmed);
        }
      });
    }

    if (current.left) {
      walk(current.left, `${currentPath}.L`);
    }
    if (current.right) {
      walk(current.right, `${currentPath}.R`);
    }
  };

  walk(node, path);
  return Array.from(moves).sort((a, b) => a.localeCompare(b));
};

export const collectSubtreePaths = (node: BreedingTreeNode, path: string): string[] => {
  const paths = [path];
  if (node.left) {
    paths.push(...collectSubtreePaths(node.left, `${path}.L`));
  }
  if (node.right) {
    paths.push(...collectSubtreePaths(node.right, `${path}.R`));
  }
  return paths;
};
