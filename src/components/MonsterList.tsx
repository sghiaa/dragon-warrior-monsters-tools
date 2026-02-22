import React, { useCallback, useMemo, useState } from 'react';
import { Gender, OwnedMonster } from '../types/monster';
import { MONSTERS, getMonsterById } from '../data/monsters';
import { Plus, Trash2 } from 'lucide-react';

interface MonsterListProps {
  ownedMonsters: OwnedMonster[];
  monsterStepCounts: Record<string, number>;
  onOwnedMonsterAdd: (monsterId: string, gender: Gender, nickname: string) => void;
  onOwnedMonsterRemove: (ownedMonsterId: string) => void;
}

export const MonsterList: React.FC<MonsterListProps> = ({
  ownedMonsters,
  monsterStepCounts,
  onOwnedMonsterAdd,
  onOwnedMonsterRemove
}) => {
  const [speciesQuery, setSpeciesQuery] = useState<string>('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [isSpeciesMenuOpen, setIsSpeciesMenuOpen] = useState<boolean>(false);
  const [selectedGender, setSelectedGender] = useState<Gender>('male');
  const [nickname, setNickname] = useState<string>('');

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

    onOwnedMonsterAdd(selectedSpecies, selectedGender, nickname);
    setNickname('');
    setSpeciesQuery('');
    setSelectedSpecies('');
    setIsSpeciesMenuOpen(false);
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

  const maleOwned = useMemo(
    () => ownedMonsters.filter((owned) => owned.gender === 'male').sort(sortOwned),
    [ownedMonsters, sortOwned]
  );
  const femaleOwned = useMemo(
    () => ownedMonsters.filter((owned) => owned.gender === 'female').sort(sortOwned),
    [ownedMonsters, sortOwned]
  );

  const renderStableCard = (owned: OwnedMonster) => {
    const monster = getMonsterById(owned.monsterId);
    const displayName = monster ? monster.name : owned.monsterId;
    const familyName = monster?.family || 'Unknown';
    const familyClass = `family-${familyName.toLowerCase()}`;
    return (
      <div key={owned.id} className={`tree-node monster state-${owned.gender}`}>
        <div className="tree-check">
          <span>{displayName}</span>
          <span className={`stable-family-pill ${familyClass}`}>{familyName}</span>
          {owned.nickname.trim() && (
            <span className="tree-assigned-name">[{owned.nickname.trim()}]</span>
          )}
        </div>
        <div className="tree-gender-toggle">
          <span className="stable-gender-pill">{owned.gender === 'male' ? 'Male' : 'Female'}</span>
          <button
            type="button"
            className="stable-remove"
            onClick={() => onOwnedMonsterRemove(owned.id)}
            title="Remove from stable"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="monster-list">
      <div className="stable-panel">
        <h2>My Stable ({ownedMonsters.length})</h2>
        {ownedMonsters.length === 0 ? (
          <p className="tree-help">No monsters in stable yet.</p>
        ) : (
          <div className="stable-gender-sections">
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
                    <span>{monster.name}</span>
                    <span className="combobox-meta">{monster.family}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value as Gender)}
            className="family-filter"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <input
            type="text"
            placeholder="Nickname (optional)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="search-input"
          />

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
    </div>
  );
};
