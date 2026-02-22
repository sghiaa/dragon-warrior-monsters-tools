import React, { useMemo, useState } from 'react';
import { MONSTERS } from '../data/monsters';
import { calculateReachableMonsters, getDerivationSteps, DerivationParent } from '../utils/breedingReachability';
import { Search, Sparkles } from 'lucide-react';

const getWorldPresetMonsterIds = (worldName: string): string[] => {
  const target = `${worldName.toLowerCase()} key world`;
  return MONSTERS.filter((monster) =>
    (monster.spawnLocations || []).some((location) =>
      location.map.toLowerCase().includes(target)
    )
  ).map((monster) => monster.id);
};

const getMonsterName = (monsterId: string): string => {
  const monster = MONSTERS.find((m) => m.id === monsterId);
  return monster ? monster.name : monsterId;
};

interface UnlimitedBreedingProps {
  onPinToPlanner: (monsterId: string, selectedMonsterIds: string[]) => void;
}

export const UnlimitedBreeding: React.FC<UnlimitedBreedingProps> = ({ onPinToPlanner }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('All');
  const [selectedMonsterIds, setSelectedMonsterIds] = useState<Set<string>>(new Set());
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  const families = useMemo(() => {
    return Array.from(new Set(MONSTERS.map((m) => m.family))).sort();
  }, []);

  const oasisMonsterIds = useMemo(() => {
    return getWorldPresetMonsterIds('oasis');
  }, []);

  const pirateMonsterIds = useMemo(() => {
    return getWorldPresetMonsterIds('pirate');
  }, []);

  const iceMonsterIds = useMemo(() => {
    return getWorldPresetMonsterIds('ice');
  }, []);

  const skyMonsterIds = useMemo(() => {
    return getWorldPresetMonsterIds('sky');
  }, []);

  const limboMonsterIds = useMemo(() => {
    return getWorldPresetMonsterIds('limbo');
  }, []);

  const isOasisSelected = useMemo(() => {
    if (oasisMonsterIds.length === 0) {
      return false;
    }
    return oasisMonsterIds.every((id) => selectedMonsterIds.has(id));
  }, [oasisMonsterIds, selectedMonsterIds]);

  const isPirateSelected = useMemo(() => {
    if (pirateMonsterIds.length === 0) {
      return false;
    }
    return pirateMonsterIds.every((id) => selectedMonsterIds.has(id));
  }, [pirateMonsterIds, selectedMonsterIds]);

  const isIceSelected = useMemo(() => {
    if (iceMonsterIds.length === 0) {
      return false;
    }
    return iceMonsterIds.every((id) => selectedMonsterIds.has(id));
  }, [iceMonsterIds, selectedMonsterIds]);

  const isSkySelected = useMemo(() => {
    if (skyMonsterIds.length === 0) {
      return false;
    }
    return skyMonsterIds.every((id) => selectedMonsterIds.has(id));
  }, [skyMonsterIds, selectedMonsterIds]);

  const isLimboSelected = useMemo(() => {
    if (limboMonsterIds.length === 0) {
      return false;
    }
    return limboMonsterIds.every((id) => selectedMonsterIds.has(id));
  }, [limboMonsterIds, selectedMonsterIds]);

  const filteredMonsters = useMemo(() => {
    return MONSTERS.filter((monster) => {
      const matchesFamily = selectedFamily === 'All' || monster.family === selectedFamily;
      const matchesSearch = monster.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFamily && matchesSearch;
    });
  }, [searchTerm, selectedFamily]);

  const reachability = useMemo(() => {
    return calculateReachableMonsters(Array.from(selectedMonsterIds));
  }, [selectedMonsterIds]);

  const derivationSteps = useMemo(() => {
    if (!selectedResultId) {
      return [];
    }
    return getDerivationSteps(
      selectedResultId,
      Array.from(selectedMonsterIds),
      reachability.derivations
    );
  }, [selectedResultId, selectedMonsterIds, reachability.derivations]);

  const toggleMonster = (monsterId: string) => {
    setSelectedMonsterIds((prev) => {
      const next = new Set(prev);
      if (next.has(monsterId)) {
        next.delete(monsterId);
      } else {
        next.add(monsterId);
      }
      return next;
    });
  };

  const toggleOasisPreset = () => {
    setSelectedMonsterIds((prev) => {
      const next = new Set(prev);
      if (isOasisSelected) {
        oasisMonsterIds.forEach((id) => next.delete(id));
      } else {
        oasisMonsterIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const togglePiratePreset = () => {
    setSelectedMonsterIds((prev) => {
      const next = new Set(prev);
      if (isPirateSelected) {
        pirateMonsterIds.forEach((id) => next.delete(id));
      } else {
        pirateMonsterIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleIcePreset = () => {
    setSelectedMonsterIds((prev) => {
      const next = new Set(prev);
      if (isIceSelected) {
        iceMonsterIds.forEach((id) => next.delete(id));
      } else {
        iceMonsterIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSkyPreset = () => {
    setSelectedMonsterIds((prev) => {
      const next = new Set(prev);
      if (isSkySelected) {
        skyMonsterIds.forEach((id) => next.delete(id));
      } else {
        skyMonsterIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleLimboPreset = () => {
    setSelectedMonsterIds((prev) => {
      const next = new Set(prev);
      if (isLimboSelected) {
        limboMonsterIds.forEach((id) => next.delete(id));
      } else {
        limboMonsterIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const formatParent = (parent: DerivationParent): React.ReactNode => {
    if (parent.kind === 'family') {
      return `Any ${parent.value}`;
    }
    return (
      <a href={`#monster/${parent.value}`} className="monster-link">
        {getMonsterName(parent.value)}
      </a>
    );
  };

  return (
    <div className="unlimited-breeding">
      <div className="goal-header">
        <Sparkles size={24} />
        <h2>Unlimited Breeding Explorer</h2>
      </div>

      <p className="tree-help">
        Select any starting monsters. Results assume unlimited copies of selected monsters,
        unlimited descendants, and unlimited generic monsters from selected families.
      </p>

      <div className="preset-bar">
        <button
          className={`preset-toggle ${isOasisSelected ? 'active' : ''}`}
          onClick={toggleOasisPreset}
        >
          Oasis
        </button>
        <button
          className={`preset-toggle ${isPirateSelected ? 'active' : ''}`}
          onClick={togglePiratePreset}
        >
          Pirate
        </button>
        <button
          className={`preset-toggle ${isIceSelected ? 'active' : ''}`}
          onClick={toggleIcePreset}
        >
          Ice
        </button>
        <button
          className={`preset-toggle ${isSkySelected ? 'active' : ''}`}
          onClick={toggleSkyPreset}
        >
          Sky
        </button>
        <button
          className={`preset-toggle ${isLimboSelected ? 'active' : ''}`}
          onClick={toggleLimboPreset}
        >
          Limbo
        </button>
      </div>

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
          {families.map((family) => (
            <option key={family} value={family}>{family}</option>
          ))}
        </select>
      </div>

      <div className="unlimited-layout">
        <section className="unlimited-panel">
          <h3>Starting Monsters ({selectedMonsterIds.size})</h3>
          <div className="monster-selection-grid">
            {filteredMonsters.map((monster) => {
              const checked = selectedMonsterIds.has(monster.id);
              return (
                <label key={monster.id} className={`monster-option selectable ${checked ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMonster(monster.id)}
                    className="monster-checkbox"
                  />
                  <div className="monster-option-content">
                    <h3>
                      <a
                        href={`#monster/${monster.id}`}
                        className="monster-link"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {monster.name}
                      </a>
                    </h3>
                    <div className="monster-meta">
                      <span className={`stable-family-pill family-${monster.family.toLowerCase()}`}>
                        {monster.family}
                      </span>
                      <span className="rank">Rank {monster.rank}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        <section className="unlimited-panel">
          <h3>Breedable Monsters ({reachability.breedableMonsterIds.length})</h3>
          {selectedMonsterIds.size === 0 ? (
            <div className="empty-state compact">
              <p>Select one or more starting monsters to compute reachability.</p>
            </div>
          ) : (
            <>
              <p className="result-meta">
                Source families: {reachability.sourceFamilies.length > 0 ? reachability.sourceFamilies.join(', ') : 'None'}
              </p>
              <div className="reachable-list">
                {reachability.breedableMonsterIds.map((monsterId) => (
                  <button
                    key={monsterId}
                    className={`reachable-item ${selectedResultId === monsterId ? 'active' : ''}`}
                    onClick={() => setSelectedResultId(monsterId)}
                  >
                    <a
                      href={`#monster/${monsterId}`}
                      className="monster-link"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {getMonsterName(monsterId)}
                    </a>
                  </button>
                ))}
              </div>

              {selectedResultId && (
                <div className="derivation-panel">
                  <h4>
                    Sample chain to{' '}
                    <a href={`#monster/${selectedResultId}`} className="monster-link">
                      {getMonsterName(selectedResultId)}
                    </a>
                  </h4>
                  <button
                    className="pin-to-planner"
                    onClick={() => onPinToPlanner(selectedResultId, Array.from(selectedMonsterIds))}
                  >
                    Pin to Goal Planner
                  </button>
                  {derivationSteps.length === 0 ? (
                    <p className="result-meta">This monster is directly in your selected starting set.</p>
                  ) : (
                    <ol className="derivation-list">
                      {derivationSteps.map((step, index) => (
                        <li key={`${step.resultId}-${index}`}>
                          {formatParent(step.parent1)} + {formatParent(step.parent2)} ={' '}
                          <a href={`#monster/${step.resultId}`} className="monster-link">
                            {getMonsterName(step.resultId)}
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
