import { Gender, OwnedMonster, UserMonster } from '../types/monster';

const STORAGE_KEY = 'dwm2-breeding-planner-data';

export interface StorageData {
  userMonsters: UserMonster[];
  ownedMonsters: OwnedMonster[];
  plannerProgressByGoal: Record<string, PlannerProgressState>;
  uiState?: UiState;
  lastUpdated: string;
}

export interface PlannerProgressState {
  checkedNodes: string[];
  checkedNodeGenders: Record<string, Gender>;
  checkedNodeNames: Record<string, string>;
  lastUpdated: string;
}

export interface UiState {
  activeTab?: 'collection' | 'possibilities' | 'planner' | 'unlimited';
  selectedGoal?: string | null;
  selectedGoals?: string[];
  plannerSeedMonsterIds?: string[] | null;
}

const loadStorageData = (): StorageData | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored);
    return {
      userMonsters: data.userMonsters || [],
      ownedMonsters: data.ownedMonsters || [],
      plannerProgressByGoal: data.plannerProgressByGoal || {},
      uiState: data.uiState || {},
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
};

export const loadFromStorage = (): StorageData => {
  const data = loadStorageData();
  if (data) {
    return data;
  }
  
  return {
    userMonsters: [],
    ownedMonsters: [],
    plannerProgressByGoal: {},
    lastUpdated: new Date().toISOString()
  };
};

export const saveToStorage = (userMonsters: UserMonster[], ownedMonsters: OwnedMonster[]): void => {
  try {
    const existing = loadStorageData();
    const data: StorageData = {
      userMonsters,
      ownedMonsters,
      plannerProgressByGoal: existing?.plannerProgressByGoal || {},
      uiState: existing?.uiState || {},
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const loadPlannerProgress = (goalKey: string): PlannerProgressState | null => {
  if (!goalKey) {
    return null;
  }

  const data = loadStorageData();
  if (!data) {
    return null;
  }

  return data.plannerProgressByGoal[goalKey] || null;
};

export const savePlannerProgress = (goalKey: string, progress: PlannerProgressState): void => {
  if (!goalKey) {
    return;
  }

  try {
    const data = loadFromStorage();
    const next: StorageData = {
      ...data,
      plannerProgressByGoal: {
        ...data.plannerProgressByGoal,
        [goalKey]: {
          ...progress,
          lastUpdated: new Date().toISOString()
        }
      },
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Error saving planner progress to localStorage:', error);
  }
};

export const loadUiState = (): UiState => {
  const data = loadStorageData();
  return data?.uiState || {};
};

export const saveUiState = (uiState: UiState): void => {
  try {
    const data = loadFromStorage();
    const next: StorageData = {
      ...data,
      uiState,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Error saving UI state to localStorage:', error);
  }
};

export const clearStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
};
