import React, { useState } from 'react';
import { MONSTERS, FAMILIES } from '../data/monsters';
import { Target, Search } from 'lucide-react';

interface GoalSelectorProps {
  onGoalChange: (monsterIds: string[]) => void;
  selectedGoals: string[];
  goalStepCounts: Record<string, number>;
}

export const GoalSelector: React.FC<GoalSelectorProps> = ({ onGoalChange, selectedGoals, goalStepCounts }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFamily, setSelectedFamily] = useState<string>('All');

  const filteredMonsters = MONSTERS
    .filter(monster => {
      const matchesFamily = selectedFamily === 'All' || monster.family === selectedFamily;
      const matchesSearch = monster.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFamily && matchesSearch;
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
    });

  const getMonsterName = (monsterId: string): string => {
    const monster = MONSTERS.find(m => m.id === monsterId);
    return monster ? monster.name : monsterId;
  };

  const toggleGoal = (monsterId: string) => {
    if (selectedGoals.includes(monsterId)) {
      onGoalChange(selectedGoals.filter((id) => id !== monsterId));
      return;
    }
    onGoalChange([...selectedGoals, monsterId]);
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
              <span key={goalId} className="goal-name">{getMonsterName(goalId)}</span>
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

      <div className="filters">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search for a monster..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <select
          value={selectedFamily}
          onChange={(e) => setSelectedFamily(e.target.value)}
          className="family-filter"
        >
          <option value="All">All Families</option>
          {FAMILIES.map(family => (
            <option key={family} value={family}>{family}</option>
          ))}
        </select>
      </div>

      <div className="monster-selection-grid">
        {filteredMonsters.map(monster => (
          <button
            key={monster.id}
            className={`monster-option ${selectedGoals.includes(monster.id) ? 'selected' : ''}`}
            onClick={() => toggleGoal(monster.id)}
          >
            <div className="monster-option-content">
              <h3>{monster.name}</h3>
              <div className="monster-meta">
                <span className="family">{monster.family}</span>
                <span className="rank">Rank {monster.rank}</span>
                <span className="step-count">
                  {goalStepCounts[monster.id] >= 0 ? `${goalStepCounts[monster.id]} steps` : 'No route'}
                </span>
              </div>
              <div className="monster-stats">
                <span>HP: {monster.hpGrowth}</span>
                <span>ATK: {monster.attackGrowth}</span>
                <span>DEF: {monster.defenseGrowth}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
