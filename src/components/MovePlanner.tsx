import React, { useEffect, useMemo, useState } from 'react';
import { MONSTERS } from '../data/monsters';
import { UserMonster } from '../types/monster';
import { BreedingPathfinder } from '../utils/breedingPathfinder';
import { loadSkillRecipesFromXml, SkillRecipe } from '../utils/skillData';
import {
  getCombinableSkills,
  getMonstersWithMove,
  getMoveUsageInfo,
  planMoveAcquisitionForTargets
} from '../utils/movePlanner';
import { BreedingPlan } from './BreedingPlan';

interface MovePlannerProps {
  userMonsters: UserMonster[];
  stableStepCounts: Record<string, number>;
}

export const MovePlanner: React.FC<MovePlannerProps> = ({ userMonsters, stableStepCounts }) => {
  const [recipes, setRecipes] = useState<SkillRecipe[]>([]);
  const [selectedMoves, setSelectedMoves] = useState<string[]>([]);
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

  const selectedMoveSet = useMemo(() => new Set(selectedMoves), [selectedMoves]);

  const addMove = (moveName: string) => {
    if (!moveName) {
      return;
    }
    setSelectedMoves((prev) => (prev.includes(moveName) ? prev : [...prev, moveName]));
    setQuery('');
  };

  const removeMove = (moveName: string) => {
    setSelectedMoves((prev) => prev.filter((entry) => entry !== moveName));
  };

  const movePlan = useMemo(() => {
    if (selectedMoves.length === 0) {
      return null;
    }
    return planMoveAcquisitionForTargets(selectedMoves, recipes, MONSTERS, stableStepCounts);
  }, [selectedMoves, recipes, stableStepCounts]);
  const selectedRecipes = useMemo(
    () => selectedMoves.map((name) => recipes.find((recipe) => recipe.name === name)).filter(Boolean) as SkillRecipe[],
    [recipes, selectedMoves]
  );
  const selectedDirectMoves = useMemo(
    () => selectedRecipes
      .filter((recipe) => recipe.combineFrom.length === 0 && !recipe.precursor)
      .map((recipe) => recipe.name),
    [selectedRecipes]
  );
  const isDirectOnlySelection =
    selectedMoves.length > 0 &&
    selectedRecipes.length === selectedMoves.length &&
    selectedDirectMoves.length === selectedMoves.length;
  const moveUsageInfo = useMemo(
    () => (selectedMoves.length === 1 ? getMoveUsageInfo(selectedMoves[0], recipes) : null),
    [selectedMoves, recipes]
  );
  const directMoveLearners = useMemo(() => {
    if (!isDirectOnlySelection || selectedDirectMoves.length === 0) {
      return [];
    }
    const byId = new Map<string, { monsterId: string; monsterName: string; stepCount: number }>();
    selectedDirectMoves.forEach((moveName) => {
      getMonstersWithMove(moveName, MONSTERS, stableStepCounts).forEach((entry) => {
        const existing = byId.get(entry.monsterId);
        if (!existing || (entry.stepCount >= 0 && (existing.stepCount < 0 || entry.stepCount < existing.stepCount))) {
          byId.set(entry.monsterId, entry);
        }
      });
    });
    return Array.from(byId.values()).sort((a, b) => {
      const stepA = a.stepCount < 0 ? Number.MAX_SAFE_INTEGER : a.stepCount;
      const stepB = b.stepCount < 0 ? Number.MAX_SAFE_INTEGER : b.stepCount;
      if (stepA !== stepB) {
        return stepA - stepB;
      }
      return a.monsterName.localeCompare(b.monsterName);
    });
  }, [isDirectOnlySelection, selectedDirectMoves, stableStepCounts]);
  const nativeLearnersByMove = useMemo(
    () =>
      selectedMoves.map((moveName) => ({
        moveName,
        learners: getMonstersWithMove(moveName, MONSTERS, stableStepCounts)
      })),
    [selectedMoves, stableStepCounts]
  );

  const selectedRequirementParts = useMemo(
    () =>
      selectedRecipes.map((recipe) => {
        const req = recipe.requirements;
        if (!req) {
          return { move: recipe.name, text: null as string | null };
        }
        return {
          move: recipe.name,
          text: `Lvl ${req.level}, HP ${req.hp}, MP ${req.mp}, ATK ${req.attack}, DEF ${req.defense}, AGL ${req.agility}, INT ${req.intelligence}`
        };
      }),
    [selectedRecipes]
  );

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
        Pick one or more moves, and this planner suggests monsters to breed that can cover the
        prerequisite moves with minimum total breeding steps.
      </p>

      {selectedMoves.length > 0 && (
        <div className="goal-selector-panel move-selected-panel">
          <h3 className="move-selected-title">Selected Moves</h3>
          <div className="goal-selected-chips">
            {selectedMoves.map((move) => (
              <span key={`selected-move-${move}`} className="goal-chip">
                {move}
                <button
                  type="button"
                  className="goal-chip-remove"
                  onClick={() => removeMove(move)}
                  aria-label={`Remove ${move}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

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
            }}
          />
          {isMenuOpen && filteredSkills.length > 0 && (
            <div className="combobox-menu goal-combobox-menu">
              {filteredSkills.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  className={`combobox-option ${selectedMoveSet.has(skill.name) ? 'active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    addMove(skill.name);
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

      {selectedMoves.length > 0 && isDirectOnlySelection && (
        <div className="stable-add-panel">
          <h3>Monsters That Learn Selected Moves</h3>
          <div className="move-requirements-list">
            {selectedRequirementParts.map((entry) =>
              entry.text ? (
                <div key={`req-${entry.move}`} className="move-requirement-item">
                  <strong>{entry.move}</strong>
                  <span>{entry.text}</span>
                </div>
              ) : null
            )}
          </div>
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

      {selectedMoves.length > 0 && (
        <div className="stable-add-panel">
          <h3>Monsters That Natively Learn Selected Moves</h3>
          {nativeLearnersByMove.every((entry) => entry.learners.length === 0) ? (
            <p className="tree-help">No monsters in the loaded dataset have the selected move(s) listed.</p>
          ) : (
            <div className="move-native-groups">
              {nativeLearnersByMove.map((entry) => (
                <div key={`native-${entry.moveName}`} className="move-native-group" data-testid={`native-move-${entry.moveName}`}>
                  <h4>{entry.moveName}</h4>
                  {entry.learners.length === 0 ? (
                    <p className="tree-help">No monsters have this move listed natively.</p>
                  ) : (
                    <div className="keys-grid">
                      {entry.learners.map((learner) => (
                        <div key={`native-learner-${entry.moveName}-${learner.monsterId}`} className="key-card suggestion-card">
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
              ))}
            </div>
          )}
        </div>
      )}

      {selectedMoves.length > 0 && movePlan && !isDirectOnlySelection && (
        <div className="stable-add-panel">
          <h3>Suggested Path for Selected Moves</h3>
          <div className="move-requirements-list">
            {selectedRequirementParts.map((entry) =>
              entry.text ? (
                <div key={`req-${entry.move}`} className="move-requirement-item">
                  <strong>{entry.move}</strong>
                  <span>{entry.text}</span>
                </div>
              ) : null
            )}
          </div>
          <div className="move-summary-grid">
            <div className="move-summary-row">
              <strong>Selected moves</strong>
              <div className="move-pill-row">
                {selectedMoves.map((move) => (
                  <span key={`selected-summary-${move}`} className="stable-family-pill family-water">
                    {move}
                  </span>
                ))}
              </div>
            </div>
            <div className="move-summary-row">
              <strong>Required moves</strong>
              <div className="move-pill-row">
                {movePlan.requiredSkills.length > 0 ? (
                  movePlan.requiredSkills.map((move) => (
                    <span key={`required-summary-${move}`} className="stable-family-pill family-material">
                      {move}
                    </span>
                  ))
                ) : (
                  <span className="combobox-meta">None</span>
                )}
              </div>
            </div>
            <div className="move-summary-row">
              <strong>Selected monsters</strong>
              <span>{movePlan.selectedMonsters.length > 0 ? movePlan.selectedMonsters.length : 'None'}</span>
            </div>
          </div>
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

      {selectedMoves.length === 1 && moveUsageInfo && (
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

      {selectedMoves.length > 0 && !isDirectOnlySelection && monsterPlans.length > 0 && (
        <div className="planner-output">
          {monsterPlans.map(({ candidate, plan }) => (
            <BreedingPlan
              key={`move-plan-${selectedMoves.join('|')}-${candidate.monsterId}`}
              plan={plan}
              goalStateKey={`move-plan::${selectedMoves.join('|')}::${candidate.monsterId}`}
              showNativeMoves
            />
          ))}
        </div>
      )}
    </div>
  );
};
