import { OwnedMonster } from '../types/monster';

export interface ShareState {
  ownedMonsters: OwnedMonster[];
  selectedGoals: string[];
  plannerSeedMonsterIds: string[] | null;
}

export interface ShareStateImportResult {
  ok: boolean;
  value?: ShareState;
  error?: string;
}

interface ShareStatePayloadV1 {
  v: 1;
  ownedMonsters: OwnedMonster[];
  selectedGoals: string[];
  plannerSeedMonsterIds?: string[] | null;
}

const isValidOwnedMonster = (value: unknown): value is OwnedMonster => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.monsterId === 'string' &&
    (candidate.gender === 'male' || candidate.gender === 'female') &&
    typeof candidate.nickname === 'string' &&
    (typeof candidate.isEgg === 'undefined' || typeof candidate.isEgg === 'boolean')
  );
};

const sanitizeState = (state: Partial<ShareState>): ShareState => ({
  ownedMonsters: Array.isArray(state.ownedMonsters) ? state.ownedMonsters.filter(isValidOwnedMonster) : [],
  selectedGoals: Array.isArray(state.selectedGoals)
    ? state.selectedGoals.filter((goal): goal is string => typeof goal === 'string')
    : [],
  plannerSeedMonsterIds: Array.isArray(state.plannerSeedMonsterIds)
    ? state.plannerSeedMonsterIds.filter((id): id is string => typeof id === 'string')
    : null
});

export const exportShareState = (state: ShareState): string => {
  const sanitized = sanitizeState(state);
  const payload: ShareStatePayloadV1 = {
    v: 1,
    ownedMonsters: sanitized.ownedMonsters,
    selectedGoals: sanitized.selectedGoals,
    plannerSeedMonsterIds: sanitized.plannerSeedMonsterIds
  };
  return btoa(JSON.stringify(payload));
};

export const importShareState = (encoded: string): ShareStateImportResult => {
  try {
    if (!encoded || typeof encoded !== 'string') {
      return { ok: false, error: 'Share string is empty.' };
    }

    const decoded = atob(encoded.trim());
    const parsed = JSON.parse(decoded) as Partial<ShareStatePayloadV1 & ShareState>;
    const normalized = sanitizeState({
      ownedMonsters: parsed.ownedMonsters,
      selectedGoals: parsed.selectedGoals,
      plannerSeedMonsterIds: parsed.plannerSeedMonsterIds
    });
    return { ok: true, value: normalized };
  } catch (_error) {
    return { ok: false, error: 'Invalid share string.' };
  }
};
