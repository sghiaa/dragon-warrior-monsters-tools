import React, { useMemo, useState, useEffect } from 'react';
import { MonsterList } from './components/MonsterList';
import { BreedingPossibilities } from './components/BreedingPossibilities';
import { GoalSelector } from './components/GoalSelector';
import { BreedingPlan } from './components/BreedingPlan';
import { UnlimitedBreeding } from './components/UnlimitedBreeding';
import { loadFromStorage, loadUiState, saveToStorage, saveUiState } from './utils/storage';
import { BreedingPlan as BreedingPlanType, OwnedMonster } from './types/monster';
import { initializeData, MONSTERS } from './data/monsters';
import { BreedingPathfinder } from './utils/breedingPathfinder';
import { computeAutoAssignments, deriveUserMonstersFromOwned } from './utils/plannerAllocation';
import './App.css';

function App() {
  const [ownedMonsters, setOwnedMonsters] = useState<OwnedMonster[]>([]);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [activeTab, setActiveTab] = useState<'collection' | 'possibilities' | 'planner' | 'unlimited'>('collection');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [breedingPlans, setBreedingPlans] = useState<Record<string, BreedingPlanType>>({});
  const [plannerSeedMonsterIds, setPlannerSeedMonsterIds] = useState<string[] | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const plannerSeedKey = (plannerSeedMonsterIds || []).slice().sort().join(',');
  const userMonsters = useMemo(() => deriveUserMonstersFromOwned(ownedMonsters), [ownedMonsters]);
  const goalStepCounts = useMemo(() => {
    if (!dataLoaded) {
      return {};
    }

    const pathfinder = new BreedingPathfinder(userMonsters, {
      seedMonsterIds: plannerSeedMonsterIds || undefined
    });

    const counts: Record<string, number> = {};
    MONSTERS.forEach((monster) => {
      const plan = pathfinder.findBreedingPath(monster.id);
      counts[monster.id] = plan.isPossible ? plan.steps.length : -1;
    });

    return counts;
  }, [dataLoaded, userMonsters, plannerSeedMonsterIds]);
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
    return computeAutoAssignments(selectedGoals, breedingPlans, ownedMonsters);
  }, [selectedGoals, breedingPlans, ownedMonsters]);

  // Initialize data on mount
  useEffect(() => {
    initializeData().then(() => {
      setDataLoaded(true);
    });
  }, []);

  useEffect(() => {
    const storedData = loadFromStorage();
    if (storedData.ownedMonsters.length > 0) {
      setOwnedMonsters(storedData.ownedMonsters);
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
    const uiState = loadUiState();
    if (uiState.activeTab) {
      setActiveTab(uiState.activeTab);
    }
    if (Array.isArray(uiState.selectedGoals)) {
      setSelectedGoals(uiState.selectedGoals);
    } else if (typeof uiState.selectedGoal !== 'undefined') {
      setSelectedGoals(uiState.selectedGoal ? [uiState.selectedGoal] : []);
    }
    if (typeof uiState.plannerSeedMonsterIds !== 'undefined') {
      setPlannerSeedMonsterIds(uiState.plannerSeedMonsterIds || null);
    }
    setHasHydratedStorage(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }
    saveToStorage(userMonsters, ownedMonsters);
  }, [hasHydratedStorage, userMonsters, ownedMonsters]);

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
  }, [selectedGoals, userMonsters, plannerSeedMonsterIds]);

  const handleOwnedMonsterAdd = (monsterId: string, gender: 'male' | 'female', nickname: string) => {
    setOwnedMonsters((prev) => [
      ...prev,
      {
        id: `${monsterId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        monsterId,
        gender,
        nickname: nickname.trim()
      }
    ]);
  };

  const handleOwnedMonsterRemove = (ownedMonsterId: string) => {
    setOwnedMonsters((prev) => prev.filter((owned) => owned.id !== ownedMonsterId));
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

  const handlePinToPlanner = (monsterId: string, seedMonsterIds: string[]) => {
    setPlannerSeedMonsterIds(seedMonsterIds);
    setSelectedGoals([monsterId]);
    setActiveTab('planner');
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
              onClick={() => setActiveTab('collection')}
            >
              My Collection
            </button>
            <button
              className={`tab ${activeTab === 'possibilities' ? 'active' : ''}`}
              onClick={() => setActiveTab('possibilities')}
            >
              Breeding Possibilities
            </button>
            <button
              className={`tab ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveTab('planner')}
            >
              Goal Planner
            </button>
            <button
              className={`tab ${activeTab === 'unlimited' ? 'active' : ''}`}
              onClick={() => setActiveTab('unlimited')}
            >
              Unlimited Breeding
            </button>
          </div>

          <main className="app-main">
            {activeTab === 'collection' && (
              <MonsterList
                ownedMonsters={ownedMonsters}
                monsterStepCounts={stableStepCounts}
                onOwnedMonsterAdd={handleOwnedMonsterAdd}
                onOwnedMonsterRemove={handleOwnedMonsterRemove}
              />
            )}

            {activeTab === 'possibilities' && (
              <BreedingPossibilities userMonsters={userMonsters} />
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
                      />
                    );
                  })}
                </div>
              </>
            )}

            {activeTab === 'unlimited' && (
              <UnlimitedBreeding onPinToPlanner={handlePinToPlanner} />
            )}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
