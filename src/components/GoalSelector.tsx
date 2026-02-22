import React, { useMemo, useState } from 'react';
import { MONSTERS } from '../data/monsters';
import { Target } from 'lucide-react';

interface GoalSelectorProps {
  onGoalChange: (monsterIds: string[]) => void;
  selectedGoals: string[];
  goalStepCounts: Record<string, number>;
}

export const GoalSelector: React.FC<GoalSelectorProps> = ({ onGoalChange, selectedGoals, goalStepCounts }) => {
  const [query, setQuery] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const filteredMonsters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return MONSTERS
      .filter((monster) => {
        const matchesSearch = !normalizedQuery || monster.name.toLowerCase().includes(normalizedQuery);
        return matchesSearch && !selectedGoals.includes(monster.id);
      })
      .sort((a, b) => {
        const aSteps = goalStepCounts[a.id] ?? -1;
        const bSteps = goalStepCounts[b.id] ?? -1;
        const aSortable = aSteps < 0 ? Number.NEGATIVE_INFINITY : aSteps;
        const bSortable = bSteps < 0 ? Number.NEGATIVE_INFINITY : bSteps;

        if (aSortable !== bSortable) {
          return bSortable - aSortable;
        }

        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);
  }, [query, goalStepCounts, selectedGoals]);

  const getMonsterName = (monsterId: string): string => {
    const monster = MONSTERS.find(m => m.id === monsterId);
    return monster ? monster.name : monsterId;
  };

  const addGoal = (monsterId: string) => {
    if (selectedGoals.includes(monsterId)) {
      return;
    }
    onGoalChange([...selectedGoals, monsterId]);
    setQuery('');
    setMenuOpen(false);
  };

  const removeGoal = (monsterId: string) => {
    onGoalChange(selectedGoals.filter((id) => id !== monsterId));
  };

  return (
    <div className="goal-selector">
      <div className="goal-header">
        <Target size={24} />
        <h2>Select Goal Monsters</h2>
      </div>

      {selectedGoals.length > 0 && (
        <div className="current-goal">
          <span className="goal-label">Current Goals:</span>
          <div className="goal-list">
            {selectedGoals.map((goalId) => (
              <div key={goalId} className="goal-name removable">
                <a href={`#monster/${goalId}`} className="monster-link">
                  {getMonsterName(goalId)}
                </a>
                <button
                  type="button"
                  className="goal-remove-btn"
                  onClick={() => removeGoal(goalId)}
                  title="Remove goal"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button 
            className="clear-goal"
            onClick={() => onGoalChange([])}
          >
            Clear All
          </button>
        </div>
      )}

      <div className="goal-combobox-wrapper">
        <div className="stable-combobox">
          <input
            type="text"
            className="search-input"
            placeholder="Search goals by monster name..."
            value={query}
            onFocus={() => setMenuOpen(true)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
            onChange={(e) => {
              setQuery(e.target.value);
              setMenuOpen(true);
            }}
          />
          {menuOpen && filteredMonsters.length > 0 && (
            <div className="combobox-menu">
              {filteredMonsters.map((monster) => (
                <button
                  type="button"
                  key={monster.id}
                  className="combobox-option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addGoal(monster.id)}
                >
                  <span>
                    {monster.name}{' '}
                    <a
                      href={`#monster/${monster.id}`}
                      className="monster-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      (view)
                    </a>
                  </span>
                  <span className="combobox-meta">
                    {goalStepCounts[monster.id] >= 0 ? `${goalStepCounts[monster.id]} steps` : 'No route'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
