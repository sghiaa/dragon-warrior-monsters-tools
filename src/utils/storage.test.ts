import {
  clearStorage,
  loadFromStorage,
  loadPlannerProgress,
  loadUiState,
  savePlannerProgress,
  saveToStorage,
  saveUiState
} from './storage';
import { OwnedKey, OwnedMonster, UserMonster } from '../types/monster';

describe('storage persistence contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('returns safe defaults when storage is empty', () => {
    const data = loadFromStorage();
    expect(data.userMonsters).toEqual([]);
    expect(data.ownedMonsters).toEqual([]);
    expect(data.ownedKeys).toEqual([]);
    expect(data.ownedStoryKeyWorlds).toEqual([]);
    expect(data.plannerProgressByGoal).toEqual({});
  });

  it('persists owned monsters, keys, and story worlds without dropping planner progress', () => {
    const userMonsters: UserMonster[] = [
      { monsterId: 'pizzaro', count: 1, maleCount: 1, femaleCount: 0 }
    ];
    const ownedMonsters: OwnedMonster[] = [
      { id: 'o1', monsterId: 'pizzaro', gender: 'male', nickname: 'Pizza' }
    ];
    const ownedKeys: OwnedKey[] = [{ id: 'k1', descriptor: 'Plain', family: 'Beast' }];
    const worlds = ['Oasis', 'Sky'];

    savePlannerProgress('darkdrium::seed', {
      checkedNodes: ['root.L'],
      autoCheckedNodes: ['root.L'],
      checkedNodeGenders: { 'root.L': 'male' },
      checkedNodeNames: { 'root.L': 'Pizza' },
      lastUpdated: new Date().toISOString()
    });
    saveToStorage(userMonsters, ownedMonsters, ownedKeys, worlds);

    const data = loadFromStorage();
    expect(data.userMonsters).toEqual(userMonsters);
    expect(data.ownedMonsters).toEqual(ownedMonsters);
    expect(data.ownedKeys).toEqual(ownedKeys);
    expect(data.ownedStoryKeyWorlds).toEqual(worlds);
    expect(data.plannerProgressByGoal['darkdrium::seed']).toBeTruthy();
  });

  it('persists planner progress and ui state by goal key', () => {
    savePlannerProgress('goal_a::none', {
      checkedNodes: ['root.L', 'root.R'],
      autoCheckedNodes: ['root.L'],
      checkedNodeGenders: { 'root.L': 'male', 'root.R': 'female' },
      checkedNodeNames: { 'root.L': 'Bull' },
      lastUpdated: new Date().toISOString()
    });
    saveUiState({
      activeTab: 'planner',
      selectedGoals: ['darkdrium'],
      plannerSeedMonsterIds: ['spotslime', 'fairydrak']
    });

    expect(loadPlannerProgress('goal_a::none')).toMatchObject({
      checkedNodes: ['root.L', 'root.R'],
      checkedNodeGenders: { 'root.L': 'male', 'root.R': 'female' },
      checkedNodeNames: { 'root.L': 'Bull' }
    });
    expect(loadUiState()).toEqual({
      activeTab: 'planner',
      selectedGoals: ['darkdrium'],
      plannerSeedMonsterIds: ['spotslime', 'fairydrak']
    });
  });

  it('handles invalid storage payloads gracefully', () => {
    localStorage.setItem('dwm2-breeding-planner-data', '{ this is invalid json');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const data = loadFromStorage();
    expect(data.ownedMonsters).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('clears all persisted data', () => {
    saveUiState({ activeTab: 'unlimited' });
    expect(loadUiState().activeTab).toBe('unlimited');
    clearStorage();
    expect(loadUiState()).toEqual({});
  });
});
