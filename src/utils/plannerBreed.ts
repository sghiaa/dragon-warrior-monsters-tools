import { getBreedingResult, getMonsterById } from '../data/monsters';
import { OwnedMonster, PlannerPairBreedNode, PlannerPairBreedRequest } from '../types/monster';

const parseFamily = (value: string): string => value.replace(/^Any\s+/i, '').trim();

const normalizedName = (value: string | undefined): string => (value || '').trim().toLowerCase();

const matchesNode = (owned: OwnedMonster, node: PlannerPairBreedNode): boolean => {
  if (owned.isEgg) {
    return false;
  }
  if (!node.gender || owned.gender !== node.gender) {
    return false;
  }
  if (node.nodeKind === 'monster') {
    return owned.monsterId === node.nodeValue;
  }
  const family = parseFamily(node.nodeValue);
  const monster = getMonsterById(owned.monsterId);
  return !!monster && monster.family === family;
};

const sortCandidates = (a: OwnedMonster, b: OwnedMonster): number => {
  if (a.monsterId !== b.monsterId) {
    return a.monsterId.localeCompare(b.monsterId);
  }
  return a.id.localeCompare(b.id);
};

const selectOwnedForNode = (
  ownedMonsters: OwnedMonster[],
  node: PlannerPairBreedNode,
  excludedOwnedId?: string
): OwnedMonster | null => {
  const candidates = ownedMonsters
    .filter((owned) => owned.id !== excludedOwnedId)
    .filter((owned) => matchesNode(owned, node));
  if (candidates.length === 0) {
    return null;
  }

  const assignedName = normalizedName(node.assignedName);
  if (assignedName) {
    const nicknameMatches = candidates
      .filter((owned) => normalizedName(owned.nickname) === assignedName)
      .sort(sortCandidates);
    if (nicknameMatches.length > 0) {
      return nicknameMatches[0];
    }
  }

  return candidates.sort(sortCandidates)[0];
};

const createEggOwned = (monsterId: string, idFactory?: () => string): OwnedMonster => ({
  id: idFactory ? idFactory() : `${monsterId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  monsterId,
  gender: 'male',
  nickname: 'Egg',
  isEgg: true
});

export const applyPlannerPairBreed = (
  ownedMonsters: OwnedMonster[],
  request: PlannerPairBreedRequest,
  idFactory?: () => string
): OwnedMonster[] | null => {
  if (!request.left.checked || !request.right.checked) {
    return null;
  }
  if (!request.left.gender || !request.right.gender || request.left.gender === request.right.gender) {
    return null;
  }

  const leftOwned = selectOwnedForNode(ownedMonsters, request.left);
  if (!leftOwned) {
    return null;
  }

  const rightOwned = selectOwnedForNode(ownedMonsters, request.right, leftOwned.id);
  if (!rightOwned) {
    return null;
  }

  const breedResult = getBreedingResult(leftOwned.monsterId, rightOwned.monsterId);
  if (!breedResult || breedResult.result !== request.resultMonsterId) {
    return null;
  }

  const nextOwned = ownedMonsters.filter((owned) => owned.id !== leftOwned.id && owned.id !== rightOwned.id);
  nextOwned.push(createEggOwned(request.resultMonsterId, idFactory));
  return nextOwned;
};
