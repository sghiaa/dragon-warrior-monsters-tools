import React, { useMemo, useState } from 'react';
import { Gender, OwnedMonster } from '../types/monster';
import { MONSTERS, FAMILIES, getMonsterById } from '../data/monsters';
import { Plus, Trash2 } from 'lucide-react';

interface MonsterListProps {
  ownedMonsters: OwnedMonster[];
  onOwnedMonsterAdd: (monsterId: string, gender: Gender, nickname: string) => void;
  onOwnedMonsterRemove: (ownedMonsterId: string) => void;
}

export const MonsterList: React.FC<MonsterListProps> = ({
  ownedMonsters,
  onOwnedMonsterAdd,
  onOwnedMonsterRemove
}) => {
  const [selectedFamily, setSelectedFamily] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<Gender>('male');
  const [nickname, setNickname] = useState<string>('');

  const filteredMonsters = useMemo(() => {
    return MONSTERS.filter((monster) => {
      const matchesFamily = selectedFamily === 'All' || monster.family === selectedFamily;
      const matchesSearch = monster.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFamily && matchesSearch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedFamily, searchTerm]);

  const handleAdd = () => {
    if (!selectedSpecies) {
      return;
    }

    onOwnedMonsterAdd(selectedSpecies, selectedGender, nickname);
    setNickname('');
  };

  return (
    <div className="monster-list">
      <div className="stable-panel">
        <h2>My Stable ({ownedMonsters.length})</h2>
        {ownedMonsters.length === 0 ? (
          <p className="tree-help">No monsters in stable yet.</p>
        ) : (
          <div className="stable-grid">
            {ownedMonsters.map((owned) => {
              const monster = getMonsterById(owned.monsterId);
              const displayName = monster ? monster.name : owned.monsterId;
              return (
                <div key={owned.id} className={`tree-node monster state-${owned.gender}`}>
                  <div className="tree-check">
                    <span>{displayName}</span>
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
            })}
          </div>
        )}
      </div>

      <div className="stable-add-panel">
        <h3>Add Monster to Stable</h3>
        <div className="filters">
          <input
            type="text"
            placeholder="Search species..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={selectedFamily}
            onChange={(e) => setSelectedFamily(e.target.value)}
            className="family-filter"
          >
            <option value="All">All Families</option>
            {FAMILIES.map((family) => (
              <option key={family} value={family}>{family}</option>
            ))}
          </select>
        </div>

        <div className="add-form-grid">
          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="family-filter"
          >
            <option value="">Select species</option>
            {filteredMonsters.map((monster) => (
              <option key={monster.id} value={monster.id}>{monster.name} ({monster.family})</option>
            ))}
          </select>

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
