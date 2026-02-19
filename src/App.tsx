import React, { useMemo, useState, useEffect } from 'react';
import { MonsterList } from './components/MonsterList';
import { BreedingPossibilities } from './components/BreedingPossibilities';
import { GoalSelector } from './components/GoalSelector';
import { BreedingPlan } from './components/BreedingPlan';
import { UnlimitedBreeding } from './components/UnlimitedBreeding';
import { loadFromStorage, loadUiState, saveToStorage, saveUiState } from './utils/storage';
import { BreedingPlan as BreedingPlanType, UserMonster } from './types/monster';
import { initializeData, MONSTERS } from './data/monsters';
import { BreedingPathfinder } from './utils/breedingPathfinder';
import './App.css';

function App() {
  const [userMonsters, setUserMonsters] = useState<UserMonster[]>([]);
  const [activeTab, setActiveTab] = useState<'collection' | 'possibilities' | 'planner' | 'unlimited'>('collection');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [breedingPlans, setBreedingPlans] = useState<Record<string, BreedingPlanType>>({});
  const [plannerSeedMonsterIds, setPlannerSeedMonsterIds] = useState<string[] | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const plannerSeedKey = (plannerSeedMonsterIds || []).slice().sort().join(',');
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

  // Initialize data on mount
  useEffect(() => {
    initializeData().then(() => {
      setDataLoaded(true);
    });
  }, []);

  useEffect(() => {
    const storedData = loadFromStorage();
    setUserMonsters(storedData.userMonsters);
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
  }, []);

  useEffect(() => {
    saveToStorage(userMonsters);
  }, [userMonsters]);

  useEffect(() => {
    saveUiState({
      activeTab,
      selectedGoals,
      plannerSeedMonsterIds
    });
  }, [activeTab, selectedGoals, plannerSeedMonsterIds]);

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

  const handleMonsterUpdate = (monsterId: string, count: number, maleCount: number, femaleCount: number) => {
    setUserMonsters(prevMonsters => {
      const existingIndex = prevMonsters.findIndex(um => um.monsterId === monsterId);
      
      if (count === 0) {
        return prevMonsters.filter(um => um.monsterId !== monsterId);
      }
      
      const updatedMonster: UserMonster = {
        monsterId,
        count,
        maleCount,
        femaleCount
      };
      
      if (existingIndex >= 0) {
        const newMonsters = [...prevMonsters];
        newMonsters[existingIndex] = updatedMonster;
        return newMonsters;
      } else {
        return [...prevMonsters, updatedMonster];
      }
    });
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
                userMonsters={userMonsters}
                onMonsterUpdate={handleMonsterUpdate}
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
