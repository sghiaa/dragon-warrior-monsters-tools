import React, { useEffect, useMemo, useState } from 'react';
import { MONSTERS } from '../data/monsters';
import { UserMonster } from '../types/monster';
import { BreedingPathfinder } from '../utils/breedingPathfinder';
import { loadSkillRecipesFromXml, SkillRecipe } from '../utils/skillData';
import {
  getCombinableSkills,
  getMonstersWithMove,
  getMoveUsageInfo,
  planMoveAcquisition
} from '../utils/movePlanner';
import { BreedingPlan } from './BreedingPlan';

interface MovePlannerProps {
  userMonsters: UserMonster[];
  stableStepCounts: Record<string, number>;
}

export const MovePlanner: React.FC<MovePlannerProps> = ({ userMonsters, stableStepCounts }) => {
  const [recipes, setRecipes] = useState<SkillRecipe[]>([]);
  const [selectedMove, setSelectedMove] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    loadSkillRecipesFromXml().then(setRecipes);
  }, []);

  const combinableSkillNames = useMemo(
    () => new Set(getCombinableSkills(recipes).map((skill) => skill.name)),
    [recipes]
  );
  const allSkills = useMemo(() => recipes.slice().sort((a, b) => a.name.localeCompare(b.name)), [recipes]);
  const filteredSkills = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allSkills
      .filter((skill) => !normalized || skill.name.toLowerCase().includes(normalized))
      .slice(0, 100);
  }, [allSkills, query]);

  const movePlan = useMemo(() => {
    if (!selectedMove) {
      return null;
    }
    return planMoveAcquisition(selectedMove, recipes, MONSTERS, stableStepCounts);
  }, [selectedMove, recipes, stableStepCounts]);
  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.name === selectedMove),
    [recipes, selectedMove]
  );
  const isDirectMove = !!selectedRecipe && selectedRecipe.combineFrom.length === 0 && !selectedRecipe.precursor;
  const moveUsageInfo = useMemo(
    () => (selectedMove ? getMoveUsageInfo(selectedMove, recipes) : null),
    [selectedMove, recipes]
  );
  const directMoveLearners = useMemo(() => {
    if (!selectedMove || !isDirectMove) {
      return [];
    }
    return getMonstersWithMove(selectedMove, MONSTERS, stableStepCounts);
  }, [selectedMove, isDirectMove, stableStepCounts]);

  const pathfinder = useMemo(() => new BreedingPathfinder(userMonsters), [userMonsters]);
  const monsterPlans = useMemo(() => {
    if (!movePlan) {
      return [];
    }
    return movePlan.selectedMonsters.map((candidate) => ({
      candidate,
      plan: pathfinder.findBreedingPath(candidate.monsterId)
    }));
  }, [movePlan, pathfinder]);

  return (
    <div className="move-planner">
      <h2>Move Combination Planner</h2>
      <p className="tree-help">
        Pick a move that is learned from combining other moves, and this planner suggests monsters
        to breed that can cover those prerequisite moves with minimum total breeding steps.
      </p>

      <div className="goal-combobox-wrapper">
        <div className="stable-combobox">
          <input
            type="text"
            className="search-input"
            value={query}
            placeholder="Select a combo move..."
            onFocus={() => setIsMenuOpen(true)}
            onBlur={() => setTimeout(() => setIsMenuOpen(false), 120)}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              setIsMenuOpen(true);

              const exact = allSkills.find((skill) => skill.name.toLowerCase() === next.trim().toLowerCase());
              if (exact) {
                setSelectedMove(exact.name);
              }
            }}
          />
          {isMenuOpen && filteredSkills.length > 0 && (
            <div className="combobox-menu goal-combobox-menu">
              {filteredSkills.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  className={`combobox-option ${selectedMove === skill.name ? 'active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSelectedMove(skill.name);
                    setQuery(skill.name);
                    setIsMenuOpen(false);
                  }}
                >
                  <span>{skill.name}</span>
                  <span className="combobox-meta">
                    {combinableSkillNames.has(skill.name)
                      ? `${skill.combineFrom.length || (skill.precursor ? 1 : 0)} requirements`
                      : 'Direct learn'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedMove && isDirectMove && (
        <div className="stable-add-panel">
          <h3>Monsters That Learn {selectedMove}</h3>
          {directMoveLearners.length === 0 ? (
            <p className="tree-help">No monsters in the loaded dataset have this move listed.</p>
          ) : (
            <div className="keys-grid">
              {directMoveLearners.map((learner) => (
                <div key={`move-learner-${learner.monsterId}`} className="key-card suggestion-card">
                  <div className="key-card-main">
                    <strong>
                      <a href={`#monster/${learner.monsterId}`} className="monster-link">
                        {learner.monsterName}
                      </a>
                    </strong>
                    <span className="combobox-meta">
                      {learner.stepCount >= 0 ? `Breeding steps: ${learner.stepCount}` : 'Breeding steps: Unknown'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedMove && movePlan && !isDirectMove && (
        <div className="stable-add-panel">
          <h3>Suggested Path for {selectedMove}</h3>
          <p>
            <strong>Required moves:</strong>{' '}
            {movePlan.requiredSkills.length > 0 ? movePlan.requiredSkills.join(', ') : 'None'}
          </p>
          <p>
            <strong>Selected monsters:</strong>{' '}
            {movePlan.selectedMonsters.length > 0 ? movePlan.selectedMonsters.length : 'None'}
          </p>
          {movePlan.uncoveredSkills.length > 0 && (
            <p className="tree-help">
              Uncovered moves with current reachable monsters: {movePlan.uncoveredSkills.join(', ')}
            </p>
          )}

          {movePlan.selectedMonsters.length > 0 && (
            <div className="keys-grid">
              {movePlan.selectedMonsters.map((monster) => (
                <div key={`move-monster-${monster.monsterId}`} className="key-card suggestion-card">
                  <div className="key-card-main">
                    <strong>
                      <a href={`#monster/${monster.monsterId}`} className="monster-link">
                        {monster.monsterName}
                      </a>
                    </strong>
                    <span className="combobox-meta">Breeding steps: {monster.stepCount}</span>
                    <div className="key-family-pills">
                      {monster.coveredSkills.map((skill) => (
                        <span key={`${monster.monsterId}-${skill}`} className="stable-family-pill family-water">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedMove && moveUsageInfo && (
        <div className="stable-add-panel">
          <h3>Usage In Other Move Unlocks</h3>
          {moveUsageInfo.usedInCombinations.length === 0 &&
          moveUsageInfo.usedAsPrecursorFor.length === 0 &&
          moveUsageInfo.eventualUnlocks.length === 0 ? (
            <p className="tree-help">This move is not used as an ingredient for other moves.</p>
          ) : (
            <>
              {moveUsageInfo.usedInCombinations.length > 0 && (
                <p>
                  <strong>Used in combinations:</strong> {moveUsageInfo.usedInCombinations.join(', ')}
                </p>
              )}
              {moveUsageInfo.usedAsPrecursorFor.length > 0 && (
                <p>
                  <strong>Used as precursor for:</strong> {moveUsageInfo.usedAsPrecursorFor.join(', ')}
                </p>
              )}
              {moveUsageInfo.eventualUnlocks.length > 0 && (
                <p>
                  <strong>Eventually unlocks:</strong> {moveUsageInfo.eventualUnlocks.join(', ')}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {selectedMove && !isDirectMove && monsterPlans.length > 0 && (
        <div className="planner-output">
          {monsterPlans.map(({ candidate, plan }) => (
            <BreedingPlan
              key={`move-plan-${selectedMove}-${candidate.monsterId}`}
              plan={plan}
              goalStateKey={`move-plan::${selectedMove}::${candidate.monsterId}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
