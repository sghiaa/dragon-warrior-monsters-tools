import React, { useCallback, useMemo, useState } from 'react';
import { Gender, OwnedKey, OwnedMonster } from '../types/monster';
import { MONSTERS, getMonsterById } from '../data/monsters';
import { KEY_DESCRIPTORS, KEY_FAMILY_BY_CODE, KEY_FAMILY_OPTIONS } from '../data/keys';
import { Plus, Trash2 } from 'lucide-react';

interface MonsterListProps {
  ownedMonsters: OwnedMonster[];
  ownedKeys: OwnedKey[];
  ownedStoryKeyWorlds: string[];
  monsterStepCounts: Record<string, number>;
  onOwnedMonsterAdd: (monsterId: string, gender: Gender, nickname: string) => void;
  onOwnedMonsterRemove: (ownedMonsterId: string) => void;
  onOwnedKeyAdd: (descriptor: string, family: string) => void;
  onOwnedKeyRemove: (ownedKeyId: string) => void;
  onToggleOwnedStoryKeyWorld: (worldName: string) => void;
}

export const MonsterList: React.FC<MonsterListProps> = ({
  ownedMonsters,
  ownedKeys,
  ownedStoryKeyWorlds,
  monsterStepCounts,
  onOwnedMonsterAdd,
  onOwnedMonsterRemove,
  onOwnedKeyAdd,
  onOwnedKeyRemove,
  onToggleOwnedStoryKeyWorld
}) => {
  const [speciesQuery, setSpeciesQuery] = useState<string>('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [isSpeciesMenuOpen, setIsSpeciesMenuOpen] = useState<boolean>(false);
  const [selectedGender, setSelectedGender] = useState<Gender>('male');
  const [nickname, setNickname] = useState<string>('');
  const [selectedKeyDescriptor, setSelectedKeyDescriptor] = useState<string>(KEY_DESCRIPTORS[0]);
  const [selectedKeyFamily, setSelectedKeyFamily] = useState<string>(KEY_FAMILY_OPTIONS[0].code);

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
          <a href={`#monster/${owned.monsterId}`} className="monster-link">
            {displayName}
          </a>
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
        </div>

        {ownedKeys.length > 0 && (
          <div className="keys-grid">
            {ownedKeys.map((ownedKey) => {
              const option = KEY_FAMILY_BY_CODE.get(ownedKey.family);
              const keyFamilies = option?.availableFamilies || [];
              return (
                <div key={ownedKey.id} className="key-card">
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
