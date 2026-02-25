import React, { useMemo, useState } from 'react';
import { MONSTERS } from '../data/monsters';

interface FamilyIndexProps {
  selectedGoals: string[];
  onAddGoal: (monsterId: string) => void;
}

type RankedMonster = {
  id: string;
  name: string;
  family: string;
  hpGrowth: number;
  mpGrowth: number;
  attackGrowth: number;
  defenseGrowth: number;
  agilityGrowth: number;
  intelligenceGrowth: number;
  statTotal: number;
};

export const FamilyIndex: React.FC<FamilyIndexProps> = ({ selectedGoals, onAddGoal }) => {
  const families = useMemo(
    () => Array.from(new Set(MONSTERS.map((monster) => monster.family))).sort((a, b) => a.localeCompare(b)),
    []
  );
  const [selectedFamily, setSelectedFamily] = useState<string>(families[0] || '');

  const rankedMonsters = useMemo(() => {
    return MONSTERS
      .filter((monster) => monster.family === selectedFamily)
      .map((monster) => {
        const statTotal =
          monster.hpGrowth +
          monster.mpGrowth +
          monster.attackGrowth +
          monster.defenseGrowth +
          monster.agilityGrowth +
          monster.intelligenceGrowth;

        return {
          id: monster.id,
          name: monster.name,
          family: monster.family,
          hpGrowth: monster.hpGrowth,
          mpGrowth: monster.mpGrowth,
          attackGrowth: monster.attackGrowth,
          defenseGrowth: monster.defenseGrowth,
          agilityGrowth: monster.agilityGrowth,
          intelligenceGrowth: monster.intelligenceGrowth,
          statTotal
        } as RankedMonster;
      })
      .sort((a, b) => {
        if (a.statTotal !== b.statTotal) {
          return b.statTotal - a.statTotal;
        }
        return a.name.localeCompare(b.name);
      });
  }, [selectedFamily]);

  return (
    <div className="family-index">
      <div className="stable-add-panel">
        <h2>Monster Family Index</h2>
        <p className="tree-help">
          Pick a family to view monsters sorted by growth stat total, then add any monster to your breeding goals.
        </p>

        <div className="family-selector-row">
          {families.map((family) => (
            <button
              key={`family-select-${family}`}
              type="button"
              className={`family-selector-btn ${selectedFamily === family ? 'active' : ''}`}
              onClick={() => setSelectedFamily(family)}
            >
              {family}
            </button>
          ))}
        </div>
      </div>

      <div className="stable-add-panel">
        <h3>{selectedFamily} Monsters</h3>
        {rankedMonsters.length === 0 ? (
          <p className="tree-help">No monsters found for this family.</p>
        ) : (
          <div className="family-ranking-list">
            {rankedMonsters.map((monster, index) => {
              const isGoal = selectedGoals.includes(monster.id);
              return (
                <div key={`ranked-${monster.id}`} className="family-ranking-card">
                  <div className="family-ranking-header">
                    <span className="family-ranking-rank">#{index + 1}</span>
                    <a href={`#monster/${monster.id}`} className="monster-link">
                      {monster.name}
                    </a>
                    <span className="family-ranking-total">Total: {monster.statTotal}</span>
                  </div>
                  <div className="family-stats-row">
                    <span>HP {monster.hpGrowth}</span>
                    <span>MP {monster.mpGrowth}</span>
                    <span>ATK {monster.attackGrowth}</span>
                    <span>DEF {monster.defenseGrowth}</span>
                    <span>AGL {monster.agilityGrowth}</span>
                    <span>INT {monster.intelligenceGrowth}</span>
                  </div>
                  <button
                    type="button"
                    className="pin-to-planner"
                    onClick={() => onAddGoal(monster.id)}
                    disabled={isGoal}
                  >
                    {isGoal ? 'Already in Goals' : 'Add to Goals'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
