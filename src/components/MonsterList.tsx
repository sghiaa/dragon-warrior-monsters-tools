import React, { useState } from 'react';
import { UserMonster, Gender } from '../types/monster';
import { MONSTERS, FAMILIES } from '../data/monsters';
import { Plus, Minus, User, Users } from 'lucide-react';

interface MonsterListProps {
  userMonsters: UserMonster[];
  onMonsterUpdate: (monsterId: string, count: number, maleCount: number, femaleCount: number) => void;
}

export const MonsterList: React.FC<MonsterListProps> = ({ userMonsters, onMonsterUpdate }) => {
  const [selectedFamily, setSelectedFamily] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const getUserMonster = (monsterId: string): UserMonster | undefined => {
    return userMonsters.find(um => um.monsterId === monsterId);
  };

  const handleCountChange = (monsterId: string, delta: number) => {
    const current = getUserMonster(monsterId) || { monsterId, count: 0, maleCount: 0, femaleCount: 0 };
    const newCount = Math.max(0, current.count + delta);
    const newMaleCount = Math.min(current.maleCount, newCount);
    const newFemaleCount = Math.min(current.femaleCount, newCount - newMaleCount);
    onMonsterUpdate(monsterId, newCount, newMaleCount, newFemaleCount);
  };

  const handleGenderChange = (monsterId: string, gender: Gender, delta: number) => {
    const current = getUserMonster(monsterId) || { monsterId, count: 0, maleCount: 0, femaleCount: 0 };
    let newMaleCount = current.maleCount;
    let newFemaleCount = current.femaleCount;

    if (gender === 'male') {
      newMaleCount = Math.max(0, Math.min(current.count, newMaleCount + delta));
    } else {
      newFemaleCount = Math.max(0, Math.min(current.count - newMaleCount, newFemaleCount + delta));
    }

    onMonsterUpdate(monsterId, current.count, newMaleCount, newFemaleCount);
  };

  const filteredMonsters = MONSTERS.filter(monster => {
    const matchesFamily = selectedFamily === 'All' || monster.family === selectedFamily;
    const matchesSearch = monster.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFamily && matchesSearch;
  });

  return (
    <div className="monster-list">
      <div className="filters">
        <input
          type="text"
          placeholder="Search monsters..."
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
          {FAMILIES.map(family => (
            <option key={family} value={family}>{family}</option>
          ))}
        </select>
      </div>

      <div className="monster-grid">
        {filteredMonsters.map(monster => {
          const userMonster = getUserMonster(monster.id);
          return (
            <div key={monster.id} className="monster-card">
              <div className="monster-info">
                <h3>{monster.name}</h3>
                <span className="family">{monster.family}</span>
                <span className="rank">Rank {monster.rank}</span>
              </div>
              
              <div className="monster-controls">
                <div className="count-control">
                  <span>Count: {userMonster?.count || 0}</span>
                  <div className="count-buttons">
                    <button
                      onClick={() => handleCountChange(monster.id, -1)}
                      disabled={!userMonster || userMonster.count === 0}
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      onClick={() => handleCountChange(monster.id, 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {(userMonster?.count || 0) > 0 && (
                  <div className="gender-controls">
                    <div className="gender-control">
                      <User size={16} />
                      <span>♂ {userMonster?.maleCount || 0}</span>
                      <div className="gender-buttons">
                        <button
                          onClick={() => handleGenderChange(monster.id, 'male', -1)}
                          disabled={!userMonster || userMonster.maleCount === 0}
                        >
                          <Minus size={12} />
                        </button>
                        <button
                          onClick={() => handleGenderChange(monster.id, 'male', 1)}
                          disabled={!userMonster || userMonster.maleCount >= userMonster.count}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="gender-control">
                      <Users size={16} />
                      <span>♀ {userMonster?.femaleCount || 0}</span>
                      <div className="gender-buttons">
                        <button
                          onClick={() => handleGenderChange(monster.id, 'female', -1)}
                          disabled={!userMonster || userMonster.femaleCount === 0}
                        >
                          <Minus size={12} />
                        </button>
                        <button
                          onClick={() => handleGenderChange(monster.id, 'female', 1)}
                          disabled={!userMonster || userMonster.femaleCount >= (userMonster.count - userMonster.maleCount)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="stats">
                  <div className="stat">
                    <span>HP:</span>
                    <span>{monster.hpGrowth}</span>
                  </div>
                  <div className="stat">
                    <span>ATK:</span>
                    <span>{monster.attackGrowth}</span>
                  </div>
                  <div className="stat">
                    <span>DEF:</span>
                    <span>{monster.defenseGrowth}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
