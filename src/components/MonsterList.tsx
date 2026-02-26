import React, { useCallback, useMemo, useState } from 'react';
import { BreedingPlan, BreedingTreeNode, Gender, OwnedKey, OwnedMonster } from '../types/monster';
import { MONSTERS, getBreedingResult, getMonsterById } from '../data/monsters';
import { KEY_DESCRIPTORS, KEY_FAMILY_BY_CODE, KEY_FAMILY_OPTIONS } from '../data/keys';
import { loadPlannerProgress } from '../utils/storage';
import { Plus, Trash2 } from 'lucide-react';

interface MonsterListProps {
  ownedMonsters: OwnedMonster[];
  ownedKeys: OwnedKey[];
  ownedStoryKeyWorlds: string[];
  selectedGoals: string[];
  breedingPlans: Record<string, BreedingPlan>;
  plannerSeedMonsterIds: string[] | null;
  monsterStepCounts: Record<string, number>;
  onOwnedMonsterAdd: (monsterId: string, gender: Gender, nickname: string, isEgg?: boolean) => void;
  onOwnedMonsterRemove: (ownedMonsterId: string) => void;
  onOwnedMonsterGenderChange: (ownedMonsterId: string, gender: Gender) => void;
  onOwnedMonsterHatch: (ownedMonsterId: string, gender: Gender) => void;
  onOwnedKeyAdd: (descriptor: string, family: string) => void;
  onOwnedKeyRemove: (ownedKeyId: string) => void;
  onToggleOwnedStoryKeyWorld: (worldName: string) => void;
}

export const MonsterList: React.FC<MonsterListProps> = ({
  ownedMonsters,
  ownedKeys,
  ownedStoryKeyWorlds,
  selectedGoals,
  breedingPlans,
  plannerSeedMonsterIds,
  monsterStepCounts,
  onOwnedMonsterAdd,
  onOwnedMonsterRemove,
  onOwnedMonsterGenderChange,
  onOwnedMonsterHatch,
  onOwnedKeyAdd,
  onOwnedKeyRemove,
  onToggleOwnedStoryKeyWorld
}) => {
  const [speciesQuery, setSpeciesQuery] = useState<string>('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [isSpeciesMenuOpen, setIsSpeciesMenuOpen] = useState<boolean>(false);
  const [selectedGender, setSelectedGender] = useState<Gender>('male');
  const [addAsEgg, setAddAsEgg] = useState<boolean>(false);
  const [nickname, setNickname] = useState<string>('');
  const [selectedKeyDescriptor, setSelectedKeyDescriptor] = useState<string>(KEY_DESCRIPTORS[0]);
  const [selectedKeyFamily, setSelectedKeyFamily] = useState<string>(KEY_FAMILY_OPTIONS[0].code);
  const [selectedKeyFamilyHighlight, setSelectedKeyFamilyHighlight] = useState<string | null>(null);
  const [isBreedOpen, setIsBreedOpen] = useState<boolean>(false);
  const [pedigreeQuery, setPedigreeQuery] = useState<string>('');
  const [mateQuery, setMateQuery] = useState<string>('');
  const [selectedPedigreeId, setSelectedPedigreeId] = useState<string>('');
  const [selectedMateId, setSelectedMateId] = useState<string>('');

  const filteredMonsters = useMemo(() => {
    const normalized = speciesQuery.trim().toLowerCase();
    return MONSTERS.filter((monster) => {
      if (!normalized) {
        return true;
      }
      return monster.name.toLowerCase().includes(normalized);
    })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [speciesQuery]);

  const handleSpeciesSelect = (monsterId: string) => {
    const selectedMonster = getMonsterById(monsterId);
    if (!selectedMonster) {
      return;
    }
    setSelectedSpecies(monsterId);
    setSpeciesQuery(selectedMonster.name);
    setIsSpeciesMenuOpen(false);
  };

  const handleAdd = () => {
    if (!selectedSpecies) {
      return;
    }

    const effectiveNickname = addAsEgg ? 'Egg' : nickname;
    onOwnedMonsterAdd(selectedSpecies, selectedGender, effectiveNickname, addAsEgg);
    setNickname('');
    setSpeciesQuery('');
    setSelectedSpecies('');
    setIsSpeciesMenuOpen(false);
    setAddAsEgg(false);
  };

  const handleAddKey = () => {
    if (!selectedKeyDescriptor || !selectedKeyFamily) {
      return;
    }
    onOwnedKeyAdd(selectedKeyDescriptor, selectedKeyFamily);
  };

  const sortOwned = useCallback((a: OwnedMonster, b: OwnedMonster) => {
    const monsterA = getMonsterById(a.monsterId);
    const monsterB = getMonsterById(b.monsterId);

    const familyA = monsterA?.family || 'Unknown';
    const familyB = monsterB?.family || 'Unknown';
    if (familyA !== familyB) {
      return familyA.localeCompare(familyB);
    }

    const stepsA = monsterStepCounts[a.monsterId] ?? -1;
    const stepsB = monsterStepCounts[b.monsterId] ?? -1;
    const sortableA = stepsA < 0 ? Number.NEGATIVE_INFINITY : stepsA;
    const sortableB = stepsB < 0 ? Number.NEGATIVE_INFINITY : stepsB;
    if (sortableA !== sortableB) {
      return sortableB - sortableA;
    }

    const nameA = monsterA?.name || a.monsterId;
    const nameB = monsterB?.name || b.monsterId;
    return nameA.localeCompare(nameB);
  }, [monsterStepCounts]);

  const eggOwned = useMemo(
    () => ownedMonsters.filter((owned) => owned.isEgg).sort(sortOwned),
    [ownedMonsters, sortOwned]
  );
  const maleOwned = useMemo(
    () => ownedMonsters.filter((owned) => !owned.isEgg && owned.gender === 'male').sort(sortOwned),
    [ownedMonsters, sortOwned]
  );
  const femaleOwned = useMemo(
    () => ownedMonsters.filter((owned) => !owned.isEgg && owned.gender === 'female').sort(sortOwned),
    [ownedMonsters, sortOwned]
  );

  const renderStableCard = (owned: OwnedMonster) => {
    const monster = getMonsterById(owned.monsterId);
    const displayName = monster ? monster.name : owned.monsterId;
    const familyName = monster?.family || 'Unknown';
    const familyClass = `family-${familyName.toLowerCase()}`;
    const planGoalId = planGoalByOwnedId.get(owned.id);
    const goalColor = planGoalId ? goalColorByGoalId.get(planGoalId) : null;
    const goalName = planGoalId ? (getMonsterById(planGoalId)?.name || planGoalId) : null;
    const displayNickname = owned.isEgg ? 'Egg' : owned.nickname.trim();
    return (
      <div key={owned.id} className={`tree-node monster ${owned.isEgg ? 'state-baseline' : `state-${owned.gender}`}`}>
        <div className="tree-check">
          <a href={`#monster/${owned.monsterId}`} className="monster-link">
            {displayName}
          </a>
          <span className={`stable-family-pill ${familyClass}`}>{familyName}</span>
          {displayNickname && (
            <span className="tree-assigned-name">[{displayNickname}]</span>
          )}
          {goalColor && (
            <span
              className="stable-plan-dot"
              style={{ backgroundColor: goalColor }}
              title={goalName ? `Used for goal: ${goalName}` : 'Used in breeding plan'}
            />
          )}
        </div>
        {owned.isEgg ? (
          <div className="tree-gender-toggle">
            <button
              type="button"
              className="male"
              onClick={() => onOwnedMonsterHatch(owned.id, 'male')}
            >
              Hatch Male
            </button>
            <button
              type="button"
              className="female"
              onClick={() => onOwnedMonsterHatch(owned.id, 'female')}
            >
              Hatch Female
            </button>
            <button
              type="button"
              className="stable-remove"
              onClick={() => onOwnedMonsterRemove(owned.id)}
              title="Remove from stable"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <div className="tree-gender-toggle">
            <button
              type="button"
              className={owned.gender === 'male' ? 'active male' : 'male'}
              onClick={() => onOwnedMonsterGenderChange(owned.id, 'male')}
            >
              Male
            </button>
            <button
              type="button"
              className={owned.gender === 'female' ? 'active female' : 'female'}
              onClick={() => onOwnedMonsterGenderChange(owned.id, 'female')}
            >
              Female
            </button>
            <button
              type="button"
              className="stable-remove"
              onClick={() => onOwnedMonsterRemove(owned.id)}
              title="Remove from stable"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const breedingCandidates = useMemo(
    () => ownedMonsters.filter((owned) => !owned.isEgg),
    [ownedMonsters]
  );

  const selectedPedigree = useMemo(
    () => breedingCandidates.find((owned) => owned.id === selectedPedigreeId) || null,
    [breedingCandidates, selectedPedigreeId]
  );

  const oppositeGender: Gender | null = selectedPedigree
    ? (selectedPedigree.gender === 'male' ? 'female' : 'male')
    : null;

  const filteredPedigreeCandidates = useMemo(() => {
    const normalized = pedigreeQuery.trim().toLowerCase();
    return breedingCandidates.filter((owned) => {
      if (!normalized) {
        return true;
      }
      const monsterName = getMonsterById(owned.monsterId)?.name || owned.monsterId;
      return (
        monsterName.toLowerCase().includes(normalized) ||
        owned.nickname.trim().toLowerCase().includes(normalized)
      );
    });
  }, [breedingCandidates, pedigreeQuery]);

  const filteredMateCandidates = useMemo(() => {
    if (!selectedPedigree) {
      return [];
    }
    const normalized = mateQuery.trim().toLowerCase();
    return breedingCandidates
      .filter((owned) => owned.id !== selectedPedigree.id && owned.gender === oppositeGender)
      .filter((owned) => {
        if (!normalized) {
          return true;
        }
        const monsterName = getMonsterById(owned.monsterId)?.name || owned.monsterId;
        return (
          monsterName.toLowerCase().includes(normalized) ||
          owned.nickname.trim().toLowerCase().includes(normalized)
        );
      });
  }, [breedingCandidates, selectedPedigree, oppositeGender, mateQuery]);

  const selectedMate = useMemo(
    () => filteredMateCandidates.find((owned) => owned.id === selectedMateId) || null,
    [filteredMateCandidates, selectedMateId]
  );

  const breedingPreview = useMemo(() => {
    if (!selectedPedigree || !selectedMate) {
      return null;
    }
    return getBreedingResult(selectedPedigree.monsterId, selectedMate.monsterId) || null;
  }, [selectedPedigree, selectedMate]);

  const formatOwnedOption = useCallback((owned: OwnedMonster) => {
    const monsterName = getMonsterById(owned.monsterId)?.name || owned.monsterId;
    const nicknamePart = owned.nickname.trim() ? ` [${owned.nickname.trim()}]` : '';
    const genderLabel = owned.gender === 'male' ? 'Male' : 'Female';
    return `${monsterName}${nicknamePart} (${genderLabel})`;
  }, []);

  const resetBreedDialog = () => {
    setPedigreeQuery('');
    setMateQuery('');
    setSelectedPedigreeId('');
    setSelectedMateId('');
    setIsBreedOpen(false);
  };

  const handleConfirmBreed = () => {
    if (!selectedPedigree || !selectedMate || !breedingPreview) {
      return;
    }
    onOwnedMonsterRemove(selectedPedigree.id);
    onOwnedMonsterRemove(selectedMate.id);
    onOwnedMonsterAdd(breedingPreview.result, 'male', 'Egg', true);
    resetBreedDialog();
  };

  const storyKeyWorlds = useMemo(() => {
    const storyWorldOrder: Record<string, number> = {
      oasis: 1,
      pirate: 2,
      ice: 3,
      sky: 4,
      limbo: 5,
      elf: 6,
      lonely: 6,
      traveller: 8,
      traveler: 8
    };
    const normalizeWorldKey = (worldName: string) =>
      worldName.toLowerCase().replace(/\s*key world\s*$/i, '').trim();

    const byWorld = new Map<string, Set<string>>();
    MONSTERS.forEach((monster) => {
      (monster.spawnLocations || []).forEach((location) => {
        const map = (location.map || '').trim();
        if (!/key world/i.test(map)) {
          return;
        }
        const set = byWorld.get(map) || new Set<string>();
        set.add(monster.family);
        byWorld.set(map, set);
      });
    });

    return Array.from(byWorld.entries())
      .map(([worldName, familiesSet]) => ({
        worldName,
        families: Array.from(familiesSet).sort((a, b) => a.localeCompare(b))
      }))
      .sort((a, b) => {
        const aOrder = storyWorldOrder[normalizeWorldKey(a.worldName)] ?? Number.MAX_SAFE_INTEGER;
        const bOrder = storyWorldOrder[normalizeWorldKey(b.worldName)] ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return a.worldName.localeCompare(b.worldName);
      });
  }, []);

  const goalColorByGoalId = useMemo(() => {
    const palette = ['#3b82f6', '#f97316', '#10b981', '#eab308', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];
    const map = new Map<string, string>();
    selectedGoals.forEach((goalId, index) => {
      map.set(goalId, palette[index % palette.length]);
    });
    return map;
  }, [selectedGoals]);

  const planGoalByOwnedId = useMemo(() => {
    const plannerSeedKey = (plannerSeedMonsterIds || []).slice().sort().join(',');
    const goalByOwned = new Map<string, string>();
    const usedOwnedIds = new Set<string>();

    const getNodeByPath = (root: BreedingTreeNode | undefined, path: string): BreedingTreeNode | null => {
      if (!root) {
        return null;
      }
      if (path === 'root') {
        return root;
      }
      let node: BreedingTreeNode | undefined = root;
      const steps = path.split('.').slice(1);
      for (const step of steps) {
        node = step === 'L' ? node?.left : node?.right;
        if (!node) {
          return null;
        }
      }
      return node || null;
    };

    const findOwnedForPath = (
      path: string,
      tree: BreedingTreeNode,
      checkedNodeNames: Record<string, string>,
      checkedNodeGenders: Record<string, Gender>
    ): OwnedMonster | null => {
      const nickname = (checkedNodeNames[path] || '').trim();
      const requiredGender = checkedNodeGenders[path];

      if (nickname) {
        const byNickname = ownedMonsters.find((owned) =>
          !usedOwnedIds.has(owned.id) &&
          owned.nickname.trim() === nickname &&
          (!requiredGender || owned.isEgg || owned.gender === requiredGender)
        );
        if (byNickname) {
          return byNickname;
        }
      }

      const node = getNodeByPath(tree, path);
      if (!node) {
        return null;
      }

      if (node.kind === 'monster') {
        return ownedMonsters.find((owned) =>
          !usedOwnedIds.has(owned.id) &&
          owned.monsterId === node.value &&
          (!requiredGender || owned.isEgg || owned.gender === requiredGender)
        ) || null;
      }

      const family = node.value.replace(/^Any\s+/i, '');
      return ownedMonsters.find((owned) => {
        if (usedOwnedIds.has(owned.id)) {
          return false;
        }
        if (requiredGender && !owned.isEgg && owned.gender !== requiredGender) {
          return false;
        }
        const ownedMonster = getMonsterById(owned.monsterId);
        return ownedMonster?.family === family;
      }) || null;
    };

    selectedGoals.forEach((goalId) => {
      const plan = breedingPlans[goalId];
      const tree = plan?.tree;
      if (!tree) {
        return;
      }

      const goalStateKey = `${goalId}::${plannerSeedKey}`;
      const progress = loadPlannerProgress(goalStateKey);
      const autoPaths = progress?.autoCheckedNodes || [];
      const checkedNodeNames = progress?.checkedNodeNames || {};
      const checkedNodeGenders = progress?.checkedNodeGenders || {};
      autoPaths.forEach((path) => {
        const owned = findOwnedForPath(path, tree, checkedNodeNames, checkedNodeGenders);
        if (!owned) {
          return;
        }
        usedOwnedIds.add(owned.id);
        goalByOwned.set(owned.id, goalId);
      });
    });

    return goalByOwned;
  }, [selectedGoals, breedingPlans, plannerSeedMonsterIds, ownedMonsters]);

  const availableFamiliesFromKeys = useMemo(() => {
    const families = new Set<string>();
    ownedKeys.forEach((ownedKey) => {
      const option = KEY_FAMILY_BY_CODE.get(ownedKey.family);
      (option?.availableFamilies || []).forEach((family) => families.add(family));
    });
    storyKeyWorlds
      .filter((world) => ownedStoryKeyWorlds.includes(world.worldName))
      .forEach((world) => world.families.forEach((family) => families.add(family)));
    return Array.from(families).sort((a, b) => a.localeCompare(b));
  }, [ownedKeys, ownedStoryKeyWorlds, storyKeyWorlds]);

  const keySuggestions = useMemo(() => {
    if (selectedGoals.length === 0 || ownedKeys.length === 0) {
      return [];
    }

    const plannerSeedKey = (plannerSeedMonsterIds || []).slice().sort().join(',');
    const neededByFamily: Record<string, number> = {};
    const addCounts = (target: Record<string, number>, source: Record<string, number>) => {
      Object.entries(source).forEach(([family, count]) => {
        target[family] = (target[family] || 0) + count;
      });
    };

    const collectBaseRequirementsFromNode = (node: NonNullable<BreedingPlan['tree']>): Record<string, number> => {
      if (node.kind === 'family') {
        return { [node.value.replace(/^Any\s+/i, '')]: 1 };
      }

      const totals: Record<string, number> = {};
      if (node.left) {
        addCounts(totals, collectBaseRequirementsFromNode(node.left));
      }
      if (node.right) {
        addCounts(totals, collectBaseRequirementsFromNode(node.right));
      }
      return totals;
    };

    const collectCheckedCoverage = (
      node: NonNullable<BreedingPlan['tree']>,
      checkedNodes: Set<string>,
      path: string
    ): Record<string, number> => {
      if (checkedNodes.has(path)) {
        return collectBaseRequirementsFromNode(node);
      }

      if (node.kind === 'family') {
        return {};
      }

      const totals: Record<string, number> = {};
      if (node.left) {
        addCounts(totals, collectCheckedCoverage(node.left, checkedNodes, `${path}.L`));
      }
      if (node.right) {
        addCounts(totals, collectCheckedCoverage(node.right, checkedNodes, `${path}.R`));
      }
      return totals;
    };

    selectedGoals.forEach((goalId) => {
      const plan = breedingPlans[goalId];
      if (!plan) {
        return;
      }

      const baseRemaining = { ...(plan.baseRequirements || plan.remainingRequirements || {}) };
      const goalStateKey = `${goalId}::${plannerSeedKey}`;
      const progress = loadPlannerProgress(goalStateKey);
      const checkedNodes = new Set(progress?.checkedNodes || []);

      if (plan.tree && checkedNodes.size > 0) {
        const checkedCoverage = collectCheckedCoverage(plan.tree, checkedNodes, 'root');
        Object.entries(checkedCoverage).forEach(([family, covered]) => {
          baseRemaining[family] = Math.max(0, (baseRemaining[family] || 0) - covered);
          if (baseRemaining[family] === 0) {
            delete baseRemaining[family];
          }
        });
      }

      const requirements = baseRemaining;
      Object.entries(requirements).forEach(([family, count]) => {
        neededByFamily[family] = (neededByFamily[family] || 0) + count;
      });
    });

    const rarityByDescriptor = new Map(KEY_DESCRIPTORS.map((descriptor, index) => [descriptor, index]));

    return ownedKeys
      .map((ownedKey) => {
        const option = KEY_FAMILY_BY_CODE.get(ownedKey.family);
        const keyFamilies = option?.availableFamilies || [];
        const matchedFamilies = keyFamilies.filter((family) => (neededByFamily[family] || 0) > 0);
        const matchedNeededCount = matchedFamilies.reduce((sum, family) => sum + (neededByFamily[family] || 0), 0);
        const rarityScore = rarityByDescriptor.get(ownedKey.descriptor) ?? -1;
        return {
          ...ownedKey,
          matchedFamilies,
          matchedNeededCount,
          rarityScore
        };
      })
      .filter((suggestion) => suggestion.matchedNeededCount > 0)
      .sort((a, b) => {
        if (a.matchedNeededCount !== b.matchedNeededCount) {
          return b.matchedNeededCount - a.matchedNeededCount;
        }
        if (a.rarityScore !== b.rarityScore) {
          return b.rarityScore - a.rarityScore;
        }
        const aName = `${a.descriptor} ${a.family}`;
        const bName = `${b.descriptor} ${b.family}`;
        return aName.localeCompare(bName);
      });
  }, [selectedGoals, ownedKeys, breedingPlans, plannerSeedMonsterIds]);

  return (
    <div className="monster-list">
      <div className="stable-panel">
        <h2>My Stable ({ownedMonsters.length})</h2>
        <button
          type="button"
          className="add-stable-btn"
          onClick={() => setIsBreedOpen(true)}
          disabled={breedingCandidates.length < 2}
        >
          Breed
        </button>
        {selectedGoals.length > 0 && (
          <div className="stable-plan-legend">
            {selectedGoals.map((goalId) => {
              const color = goalColorByGoalId.get(goalId);
              if (!color) {
                return null;
              }
              const goalName = getMonsterById(goalId)?.name || goalId;
              return (
                <span key={`plan-legend-${goalId}`} className="stable-plan-legend-item">
                  <span className="stable-plan-dot" style={{ backgroundColor: color }} />
                  {goalName}
                </span>
              );
            })}
          </div>
        )}
        {ownedMonsters.length === 0 ? (
          <p className="tree-help">No monsters in stable yet.</p>
        ) : (
          <div className="stable-gender-sections">
            <section className="stable-gender-section">
              <h3 className="stable-gender-heading">Eggs ({eggOwned.length})</h3>
              {eggOwned.length === 0 ? (
                <p className="tree-help">No eggs.</p>
              ) : (
                <div className="stable-grid">
                  {eggOwned.map((owned) => renderStableCard(owned))}
                </div>
              )}
            </section>
            <section className="stable-gender-section">
              <h3 className="stable-gender-heading">Male ({maleOwned.length})</h3>
              {maleOwned.length === 0 ? (
                <p className="tree-help">No male monsters.</p>
              ) : (
                <div className="stable-grid">
                  {maleOwned.map((owned) => renderStableCard(owned))}
                </div>
              )}
            </section>
            <section className="stable-gender-section">
              <h3 className="stable-gender-heading">Female ({femaleOwned.length})</h3>
              {femaleOwned.length === 0 ? (
                <p className="tree-help">No female monsters.</p>
              ) : (
                <div className="stable-grid">
                  {femaleOwned.map((owned) => renderStableCard(owned))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {isBreedOpen && (
        <div className="stable-add-panel">
          <h3>Breed Monsters</h3>
          <div className="add-form-grid">
            <div>
              <label htmlFor="breed-pedigree-select">Pedigree</label>
              <input
                aria-label="Pedigree Filter"
                type="text"
                value={pedigreeQuery}
                onChange={(e) => setPedigreeQuery(e.target.value)}
                placeholder="Filter pedigree monsters..."
                className="search-input"
              />
              <select
                id="breed-pedigree-select"
                aria-label="Pedigree"
                value={selectedPedigreeId}
                onChange={(e) => {
                  setSelectedPedigreeId(e.target.value);
                  setSelectedMateId('');
                }}
                className="family-filter"
              >
                <option value="">Select pedigree</option>
                {filteredPedigreeCandidates.map((owned) => (
                  <option key={owned.id} value={owned.id}>
                    {formatOwnedOption(owned)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="breed-mate-select">Mate</label>
              <input
                aria-label="Mate Filter"
                type="text"
                value={mateQuery}
                onChange={(e) => setMateQuery(e.target.value)}
                placeholder="Filter mate monsters..."
                className="search-input"
                disabled={!selectedPedigree}
              />
              <select
                id="breed-mate-select"
                aria-label="Mate"
                value={selectedMateId}
                onChange={(e) => setSelectedMateId(e.target.value)}
                className="family-filter"
                disabled={!selectedPedigree}
              >
                <option value="">
                  {selectedPedigree ? `Select ${oppositeGender || ''} mate` : 'Select pedigree first'}
                </option>
                {filteredMateCandidates.map((owned) => (
                  <option key={owned.id} value={owned.id}>
                    {formatOwnedOption(owned)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPedigree && selectedMate && (
            <div>
              <h4>Result Preview</h4>
              {breedingPreview ? (
                <p>{getMonsterById(breedingPreview.result)?.name || breedingPreview.result}</p>
              ) : (
                <p>No breeding result for this pair.</p>
              )}
            </div>
          )}

          <div className="add-form-grid">
            <button
              type="button"
              className="add-stable-btn"
              onClick={handleConfirmBreed}
              disabled={!breedingPreview}
            >
              Confirm Breed
            </button>
            <button
              type="button"
              className="add-stable-btn"
              onClick={resetBreedDialog}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="stable-add-panel">
        <h3>Add Monster to Stable</h3>
        <div className="add-form-grid">
          <div className="stable-combobox">
            <input
              type="text"
              placeholder="Choose species..."
              value={speciesQuery}
              onChange={(e) => {
                const nextValue = e.target.value;
                setSpeciesQuery(nextValue);
                setIsSpeciesMenuOpen(true);

                const exact = MONSTERS.find((monster) => monster.name.toLowerCase() === nextValue.trim().toLowerCase());
                setSelectedSpecies(exact ? exact.id : '');
              }}
              onFocus={() => setIsSpeciesMenuOpen(true)}
              onBlur={() => {
                setTimeout(() => setIsSpeciesMenuOpen(false), 120);
              }}
              className="search-input"
            />
            {isSpeciesMenuOpen && filteredMonsters.length > 0 && (
              <div className="combobox-menu">
                {filteredMonsters.map((monster) => (
                  <button
                    type="button"
                    key={monster.id}
                    className={`combobox-option ${selectedSpecies === monster.id ? 'active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSpeciesSelect(monster.id)}
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
                    <span className="combobox-meta">{monster.family}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!addAsEgg ? (
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value as Gender)}
              className="family-filter"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          ) : (
            <input
              type="text"
              className="search-input"
              value="Egg (no gender)"
              readOnly
            />
          )}

          <input
            type="text"
            placeholder="Nickname (optional)"
            value={addAsEgg ? 'Egg' : nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="search-input"
            disabled={addAsEgg}
          />

          <label className="tree-help" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={addAsEgg}
              onChange={(e) => setAddAsEgg(e.target.checked)}
            />
            Add as Egg
          </label>

          <button
            type="button"
            className="add-stable-btn"
            onClick={handleAdd}
            disabled={!selectedSpecies}
          >
            <Plus size={16} />
            Add to Stable
          </button>
        </div>
      </div>

      <div className="stable-add-panel">
        <h3>Key Reference</h3>
        <div className="add-form-grid key-form-grid">
          <select
            value={selectedKeyDescriptor}
            onChange={(e) => setSelectedKeyDescriptor(e.target.value)}
            className="family-filter"
          >
            {KEY_DESCRIPTORS.map((descriptor) => (
              <option key={descriptor} value={descriptor}>
                {descriptor}
              </option>
            ))}
          </select>

          <select
            value={selectedKeyFamily}
            onChange={(e) => setSelectedKeyFamily(e.target.value)}
            className="family-filter"
          >
            {KEY_FAMILY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.code} ({option.label})
              </option>
            ))}
          </select>

          <button
            type="button"
            className="add-stable-btn"
            onClick={handleAddKey}
          >
            <Plus size={16} />
            Add Key
          </button>
        </div>

        <div className="keys-summary">
          <p>
            <strong>Families Available By Keys:</strong>{' '}
            {availableFamiliesFromKeys.length > 0 ? availableFamiliesFromKeys.join(', ') : 'None'}
          </p>
          {availableFamiliesFromKeys.length > 0 && (
            <div className="key-family-filter-pills">
              {availableFamiliesFromKeys.map((family) => {
                const isActive = selectedKeyFamilyHighlight === family;
                return (
                  <button
                    key={family}
                    type="button"
                    className={`stable-family-pill family-${family.toLowerCase()} ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedKeyFamilyHighlight((prev) => (prev === family ? null : family))}
                    title={`Highlight keys containing ${family}`}
                  >
                    {family}
                  </button>
                );
              })}
              {selectedKeyFamilyHighlight && (
                <button
                  type="button"
                  className="clear-key-filter-btn"
                  onClick={() => setSelectedKeyFamilyHighlight(null)}
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>

        {selectedGoals.length > 0 && (
          <div className="key-suggestions">
            <h4>Suggested Keys for Current Goal(s)</h4>
            {keySuggestions.length === 0 ? (
              <p className="tree-help">No owned keys currently match remaining required families.</p>
            ) : (
              <div className="keys-grid">
                {keySuggestions.map((suggestion) => (
                  <div
                    key={`suggestion-${suggestion.id}`}
                    className="key-card suggestion-card"
                    data-testid={`key-suggestion-${suggestion.id}`}
                  >
                    <div className="key-card-main">
                      <strong>{suggestion.descriptor} {suggestion.family}</strong>
                      <span className="combobox-meta">
                        Matches {suggestion.matchedNeededCount} needed monster
                        {suggestion.matchedNeededCount === 1 ? '' : 's'}
                      </span>
                      <div className="key-family-pills">
                        {suggestion.matchedFamilies.map((family) => (
                          <span
                            key={`suggested-${suggestion.id}-${family}`}
                            className={`stable-family-pill family-${family.toLowerCase()}`}
                          >
                            {family}
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

        {ownedKeys.length > 0 && (
          <div className="keys-grid">
            {ownedKeys.map((ownedKey) => {
              const option = KEY_FAMILY_BY_CODE.get(ownedKey.family);
              const keyFamilies = option?.availableFamilies || [];
              const isHighlighted = !selectedKeyFamilyHighlight || keyFamilies.includes(selectedKeyFamilyHighlight);
              return (
                <div
                  key={ownedKey.id}
                  className={`key-card ${selectedKeyFamilyHighlight ? (isHighlighted ? 'highlighted' : 'dimmed') : ''}`}
                  data-testid={`owned-key-card-${ownedKey.id}`}
                >
                  <div className="key-card-main">
                    <strong>{ownedKey.descriptor} {ownedKey.family}</strong>
                    {keyFamilies.length > 0 ? (
                      <div className="key-family-pills">
                        {keyFamilies.map((family) => (
                          <span
                            key={`${ownedKey.id}-${family}`}
                            className={`stable-family-pill family-${family.toLowerCase()}`}
                          >
                            {family}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="combobox-meta">Unknown</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="stable-remove"
                    onClick={() => onOwnedKeyRemove(ownedKey.id)}
                    title="Remove key"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="stable-add-panel">
        <h3>Story Keys</h3>
        <p className="tree-help">Select story key worlds you have to include their available families.</p>
        {storyKeyWorlds.length === 0 ? (
          <p className="tree-help">No key world spawn data found.</p>
        ) : (
          <div className="keys-grid">
            {storyKeyWorlds.map((world) => {
              const isOwned = ownedStoryKeyWorlds.includes(world.worldName);
              return (
                <button
                  key={world.worldName}
                  type="button"
                  className={`key-card story-key-card ${isOwned ? 'active' : ''}`}
                  onClick={() => onToggleOwnedStoryKeyWorld(world.worldName)}
                >
                  <div className="key-card-main">
                    <strong>{world.worldName}</strong>
                    {isOwned && (
                      <div className="key-family-pills">
                        {world.families.map((family) => (
                          <span
                            key={`${world.worldName}-${family}`}
                            className={`stable-family-pill family-${family.toLowerCase()}`}
                          >
                            {family}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="stable-gender-pill">{isOwned ? 'Owned' : 'Not Owned'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
