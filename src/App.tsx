import React, { useMemo, useState, useEffect } from 'react';
import { MonsterList } from './components/MonsterList';
import { BreedingPossibilities } from './components/BreedingPossibilities';
import { GoalSelector } from './components/GoalSelector';
import { BreedingPlan } from './components/BreedingPlan';
import { UnlimitedBreeding } from './components/UnlimitedBreeding';
import { MonsterDetail } from './components/MonsterDetail';
import { MovePlanner } from './components/MovePlanner';
import { FamilyIndex } from './components/FamilyIndex';
import { loadFromStorage, loadUiState, saveToStorage, saveUiState } from './utils/storage';
import { BreedingPlan as BreedingPlanType, OwnedKey, OwnedMonster, PlannerPairBreedRequest } from './types/monster';
import { canonicalMonsterId, initializeData, MONSTERS } from './data/monsters';
import { BreedingPathfinder } from './utils/breedingPathfinder';
import { computeAutoAssignments, deriveUserMonstersFromOwned } from './utils/plannerAllocation';
import { exportShareState, importShareState } from './utils/shareState';
import { applyPlannerPairBreed } from './utils/plannerBreed';
import './App.css';

function App() {
  const [ownedMonsters, setOwnedMonsters] = useState<OwnedMonster[]>([]);
  const [ownedKeys, setOwnedKeys] = useState<OwnedKey[]>([]);
  const [ownedStoryKeyWorlds, setOwnedStoryKeyWorlds] = useState<string[]>([]);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [activeTab, setActiveTab] = useState<'collection' | 'possibilities' | 'families' | 'planner' | 'unlimited' | 'moves'>('collection');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [breedingPlans, setBreedingPlans] = useState<Record<string, BreedingPlanType>>({});
  const [plannerSeedMonsterIds, setPlannerSeedMonsterIds] = useState<string[] | null>(null);
  const [goalStepCounts, setGoalStepCounts] = useState<Record<string, number>>({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [monsterDetailId, setMonsterDetailId] = useState<string | null>(null);
  const [shareText, setShareText] = useState<string>('');
  const [shareError, setShareError] = useState<string | null>(null);
  const plannerSeedKey = (plannerSeedMonsterIds || []).slice().sort().join(',');
  const isPlannerTabActive = activeTab === 'planner';
  const userMonsters = useMemo(() => deriveUserMonstersFromOwned(ownedMonsters), [ownedMonsters]);
  const stableStepCounts = useMemo(() => {
    if (!dataLoaded) {
      return {};
    }

    const pathfinder = new BreedingPathfinder(userMonsters);
    const counts: Record<string, number> = {};
    MONSTERS.forEach((monster) => {
      const plan = pathfinder.findBreedingPath(monster.id);
      counts[monster.id] = plan.isPossible ? plan.steps.length : -1;
    });

    return counts;
  }, [dataLoaded, userMonsters]);
  const autoAssignmentsByGoal = useMemo(() => {
    if (!isPlannerTabActive) {
      return {};
    }
    return computeAutoAssignments(selectedGoals, breedingPlans, ownedMonsters);
  }, [selectedGoals, breedingPlans, ownedMonsters, isPlannerTabActive]);

  // Initialize data on mount
  useEffect(() => {
    initializeData().then(() => {
      setDataLoaded(true);
    });
  }, []);

  useEffect(() => {
    const readMonsterHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash.startsWith('monster/')) {
        const id = decodeURIComponent(hash.slice('monster/'.length));
        setMonsterDetailId(id || null);
      } else {
        setMonsterDetailId(null);
      }
    };

    readMonsterHash();
    window.addEventListener('hashchange', readMonsterHash);
    return () => window.removeEventListener('hashchange', readMonsterHash);
  }, []);

  useEffect(() => {
    const storedData = loadFromStorage();
    const normalizedOwnedMonsters = (storedData.ownedMonsters || []).map((owned) => ({
      ...owned,
      monsterId: canonicalMonsterId(owned.monsterId)
    }));
    if (storedData.ownedMonsters.length > 0) {
      setOwnedMonsters(normalizedOwnedMonsters);
    } else {
      // Backward compatibility: synthesize stable entries from old aggregated collection.
      const migratedOwned: OwnedMonster[] = [];
      storedData.userMonsters.forEach((um) => {
        for (let i = 0; i < um.maleCount; i++) {
          migratedOwned.push({
            id: `${um.monsterId}-m-${i}-${Date.now()}`,
            monsterId: um.monsterId,
            gender: 'male',
            nickname: ''
          });
        }
        for (let i = 0; i < um.femaleCount; i++) {
          migratedOwned.push({
            id: `${um.monsterId}-f-${i}-${Date.now()}`,
            monsterId: um.monsterId,
            gender: 'female',
            nickname: ''
          });
        }
      });
      setOwnedMonsters(migratedOwned);
    }
    setOwnedKeys(storedData.ownedKeys || []);
    setOwnedStoryKeyWorlds(storedData.ownedStoryKeyWorlds || []);
    const uiState = loadUiState();
    if (uiState.activeTab) {
      setActiveTab(uiState.activeTab);
    }
    if (Array.isArray(uiState.selectedGoals)) {
      setSelectedGoals(uiState.selectedGoals.map((goalId) => canonicalMonsterId(goalId)));
    } else if (typeof uiState.selectedGoal !== 'undefined') {
      setSelectedGoals(uiState.selectedGoal ? [canonicalMonsterId(uiState.selectedGoal)] : []);
    }
    if (typeof uiState.plannerSeedMonsterIds !== 'undefined') {
      setPlannerSeedMonsterIds(
        uiState.plannerSeedMonsterIds
          ? uiState.plannerSeedMonsterIds.map((monsterId) => canonicalMonsterId(monsterId))
          : null
      );
    }
    setHasHydratedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }
    saveToStorage(userMonsters, ownedMonsters, ownedKeys, ownedStoryKeyWorlds);
  }, [hasHydratedStorage, userMonsters, ownedMonsters, ownedKeys, ownedStoryKeyWorlds]);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }
    saveUiState({
      activeTab,
      selectedGoals,
      plannerSeedMonsterIds
    });
  }, [hasHydratedStorage, activeTab, selectedGoals, plannerSeedMonsterIds]);

  useEffect(() => {
    if (!dataLoaded || !isPlannerTabActive) {
      setGoalStepCounts({});
      return;
    }

    const pathfinder = new BreedingPathfinder(userMonsters, {
      seedMonsterIds: plannerSeedMonsterIds || undefined
    });
    const monsterIds = MONSTERS.map((monster) => monster.id);
    const BATCH_SIZE = 24;
    let cancelled = false;
    let index = 0;
    setGoalStepCounts({});

    const runBatch = () => {
      if (cancelled) {
        return;
      }

      const next: Record<string, number> = {};
      const end = Math.min(index + BATCH_SIZE, monsterIds.length);
      for (; index < end; index++) {
        const monsterId = monsterIds[index];
        const plan = pathfinder.findBreedingPath(monsterId);
        next[monsterId] = plan.isPossible ? plan.steps.length : -1;
      }

      setGoalStepCounts((prev) => ({ ...prev, ...next }));
      if (index < monsterIds.length) {
        setTimeout(runBatch, 0);
      }
    };

    setTimeout(runBatch, 0);
    return () => {
      cancelled = true;
    };
  }, [dataLoaded, isPlannerTabActive, userMonsters, plannerSeedMonsterIds]);

  useEffect(() => {
    if (!isPlannerTabActive) {
      return;
    }

    if (selectedGoals.length === 0) {
      setBreedingPlans({});
      return;
    }

    const pathfinder = new BreedingPathfinder(userMonsters, {
      seedMonsterIds: plannerSeedMonsterIds || undefined
    });
    const nextPlans: Record<string, BreedingPlanType> = {};
    selectedGoals.forEach((goalId) => {
      nextPlans[goalId] = pathfinder.findBreedingPath(goalId);
    });
    setBreedingPlans(nextPlans);
  }, [selectedGoals, userMonsters, plannerSeedMonsterIds, isPlannerTabActive]);

  const handleOwnedMonsterAdd = (
    monsterId: string,
    gender: 'male' | 'female',
    nickname: string,
    isEgg = false
  ) => {
    setOwnedMonsters((prev) => [
      ...prev,
      {
        id: `${monsterId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        monsterId,
        gender,
        nickname: isEgg ? 'Egg' : nickname.trim(),
        isEgg
      }
    ]);
  };

  const handleOwnedMonsterRemove = (ownedMonsterId: string) => {
    setOwnedMonsters((prev) => prev.filter((owned) => owned.id !== ownedMonsterId));
  };

  const handleOwnedMonsterGenderChange = (ownedMonsterId: string, gender: 'male' | 'female') => {
    setOwnedMonsters((prev) =>
      prev.map((owned) => (
        owned.id === ownedMonsterId
          ? { ...owned, gender }
          : owned
      ))
    );
  };

  const handleOwnedMonsterHatch = (ownedMonsterId: string, gender: 'male' | 'female', nickname?: string) => {
    setOwnedMonsters((prev) =>
      prev.map((owned) => (
        owned.id === ownedMonsterId
          ? { ...owned, isEgg: false, gender, nickname: (nickname || '').trim() || owned.nickname.trim() || '' }
          : owned
      ))
    );
  };

  const handlePlannerPairBreed = (request: PlannerPairBreedRequest) => {
    setOwnedMonsters((prev) => applyPlannerPairBreed(prev, request) || prev);
  };

  const handleOwnedKeyAdd = (descriptor: string, family: string) => {
    setOwnedKeys((prev) => [
      ...prev,
      {
        id: `${descriptor}-${family}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        descriptor,
        family
      }
    ]);
  };

  const handleOwnedKeyRemove = (ownedKeyId: string) => {
    setOwnedKeys((prev) => prev.filter((key) => key.id !== ownedKeyId));
  };

  const handleToggleOwnedStoryKeyWorld = (worldName: string) => {
    setOwnedStoryKeyWorlds((prev) => (
      prev.includes(worldName)
        ? prev.filter((name) => name !== worldName)
        : [...prev, worldName]
    ));
  };

  const handleGoalChange = (monsterIds: string[]) => {
    if (monsterIds.length === 0) {
      setSelectedGoals([]);
      setBreedingPlans({});
      setPlannerSeedMonsterIds(null);
      return;
    }

    setPlannerSeedMonsterIds(null);
    setSelectedGoals(monsterIds);
  };

  const handleAddGoalMonster = (monsterId: string) => {
    if (selectedGoals.includes(monsterId)) {
      return;
    }
    handleGoalChange([...selectedGoals, monsterId]);
  };

  const handlePinToPlanner = (monsterId: string, seedMonsterIds: string[]) => {
    setPlannerSeedMonsterIds(seedMonsterIds);
    setSelectedGoals([monsterId]);
    setActiveTab('planner');
  };

  const handleExportShare = () => {
    const encoded = exportShareState({
      ownedMonsters,
      selectedGoals,
      plannerSeedMonsterIds
    });
    setShareText(encoded);
    setShareError(null);
  };

  const handleImportShare = () => {
    const imported = importShareState(shareText);
    if (!imported.ok || !imported.value) {
      setShareError(imported.error || 'Invalid share string.');
      return;
    }

    setOwnedMonsters(
      imported.value.ownedMonsters.map((owned) => ({
        ...owned,
        monsterId: canonicalMonsterId(owned.monsterId),
        nickname: owned.isEgg ? 'Egg' : owned.nickname
      }))
    );
    setSelectedGoals(imported.value.selectedGoals.map((goalId) => canonicalMonsterId(goalId)));
    setPlannerSeedMonsterIds(
      imported.value.plannerSeedMonsterIds
        ? imported.value.plannerSeedMonsterIds.map((monsterId) => canonicalMonsterId(monsterId))
        : null
    );
    setShareError(null);
  };

  const handleTabChange = (nextTab: 'collection' | 'possibilities' | 'families' | 'planner' | 'unlimited' | 'moves') => {
    if (window.location.hash.startsWith('#monster/')) {
      window.location.hash = '';
      setMonsterDetailId(null);
    }
    setActiveTab(nextTab);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Dragon Warrior Monsters 2 Breeding Planner</h1>
        <p>Plan your monster breeding journey and track your collection</p>
      </header>

      {!dataLoaded ? (
        <div className="loading">
          <h2>Loading monster data...</h2>
          <p>Please wait while we load the monster database from CSV files.</p>
        </div>
      ) : (
        <>
          <div className="app-tabs">
            <button
              className={`tab ${activeTab === 'collection' ? 'active' : ''}`}
              onClick={() => handleTabChange('collection')}
            >
              My Collection
            </button>
            <button
              className={`tab ${activeTab === 'possibilities' ? 'active' : ''}`}
              onClick={() => handleTabChange('possibilities')}
            >
              Breeding Possibilities
            </button>
            <button
              className={`tab ${activeTab === 'families' ? 'active' : ''}`}
              onClick={() => handleTabChange('families')}
            >
              Family Index
            </button>
            <button
              className={`tab ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => handleTabChange('planner')}
            >
              Goal Planner
            </button>
            <button
              className={`tab ${activeTab === 'unlimited' ? 'active' : ''}`}
              onClick={() => handleTabChange('unlimited')}
            >
              Unlimited Breeding
            </button>
            <button
              className={`tab ${activeTab === 'moves' ? 'active' : ''}`}
              onClick={() => handleTabChange('moves')}
            >
              Move Planner
            </button>
          </div>

          <main className="app-main">
            {monsterDetailId ? (
              <MonsterDetail
                monsterId={monsterDetailId}
                onBack={() => {
                  window.location.hash = '';
                }}
              />
            ) : (
              <>
                {activeTab === 'collection' && (
                  <>
                    <div className="stable-add-panel">
                      <h3>Share Stable + Goals</h3>
                      <p className="tree-help">
                        Export your stable and goal selection as a string, then import it on another instance.
                      </p>
                      <div className="add-form-grid">
                        <textarea
                          className="search-input"
                          value={shareText}
                          onChange={(e) => setShareText(e.target.value)}
                          placeholder="Share string..."
                          rows={3}
                        />
                        <button
                          type="button"
                          className="add-stable-btn"
                          onClick={handleExportShare}
                        >
                          Export Share
                        </button>
                        <button
                          type="button"
                          className="add-stable-btn"
                          onClick={handleImportShare}
                        >
                          Import Share
                        </button>
                      </div>
                      {shareError && (
                        <p className="tree-help" role="alert">{shareError}</p>
                      )}
                    </div>
                    <MonsterList
                      ownedMonsters={ownedMonsters}
                      ownedKeys={ownedKeys}
                      ownedStoryKeyWorlds={ownedStoryKeyWorlds}
                      selectedGoals={selectedGoals}
                      breedingPlans={breedingPlans}
                      plannerSeedMonsterIds={plannerSeedMonsterIds}
                      monsterStepCounts={stableStepCounts}
                      onOwnedMonsterAdd={handleOwnedMonsterAdd}
                      onOwnedMonsterRemove={handleOwnedMonsterRemove}
                      onOwnedMonsterGenderChange={handleOwnedMonsterGenderChange}
                      onOwnedMonsterHatch={handleOwnedMonsterHatch}
                      onOwnedKeyAdd={handleOwnedKeyAdd}
                      onOwnedKeyRemove={handleOwnedKeyRemove}
                      onToggleOwnedStoryKeyWorld={handleToggleOwnedStoryKeyWorld}
                    />
                  </>
                )}

                {activeTab === 'possibilities' && (
                  <BreedingPossibilities userMonsters={userMonsters} />
                )}

                {activeTab === 'families' && (
                  <FamilyIndex
                    selectedGoals={selectedGoals}
                    onAddGoal={handleAddGoalMonster}
                  />
                )}

                {activeTab === 'planner' && (
                  <>
                    <GoalSelector
                      onGoalChange={handleGoalChange}
                      selectedGoals={selectedGoals}
                      goalStepCounts={goalStepCounts}
                    />

                    <div className="planner-output">
                      {selectedGoals.length === 0 && (
                        <div className="no-goal">
                          <h2>Select one or more goal monsters to build breeding plans</h2>
                          <p>
                            Pick targets above, then this planner will generate step-by-step paths
                            using your current monster inventory and available genders.
                          </p>
                        </div>
                      )}

                      {selectedGoals.map((goalId) => {
                        const plan = breedingPlans[goalId];
                        if (!plan) {
                          return null;
                        }
                        const plannerGoalStateKey = `${goalId}::${plannerSeedKey}`;
                        return (
                          <BreedingPlan
                            key={plannerGoalStateKey}
                            plan={plan}
                            goalStateKey={plannerGoalStateKey}
                            autoAssignment={autoAssignmentsByGoal[goalId]}
                            onBreedPair={handlePlannerPairBreed}
                          />
                        );
                      })}
                    </div>
                  </>
                )}

                {activeTab === 'unlimited' && (
                  <UnlimitedBreeding onPinToPlanner={handlePinToPlanner} />
                )}

                {activeTab === 'moves' && (
                  <MovePlanner
                    userMonsters={userMonsters}
                    stableStepCounts={stableStepCounts}
                  />
                )}
              </>
            )}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
