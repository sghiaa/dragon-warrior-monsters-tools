import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { getMonsterById } from '../data/monsters';

interface MonsterDetailProps {
  monsterId: string;
  onBack: () => void;
}

export const MonsterDetail: React.FC<MonsterDetailProps> = ({ monsterId, onBack }) => {
  const monster = getMonsterById(monsterId);

  if (!monster) {
    return (
      <div className="stable-add-panel">
        <button type="button" className="pin-to-planner" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
        <h2>Monster Not Found</h2>
        <p>No monster exists for id: <code>{monsterId}</code></p>
      </div>
    );
  }

  return (
    <div className="stable-add-panel monster-detail-page">
      <button type="button" className="pin-to-planner" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>

      <h2>{monster.name}</h2>
      <p className="tree-help">
        Family: <strong>{monster.family}</strong> | Rank: <strong>{monster.rank}</strong>
        {typeof monster.inStory === 'boolean' && (
          <>
            {' '}| In Story: <strong>{monster.inStory ? 'Yes' : 'No'}</strong>
          </>
        )}
      </p>

      <div className="monster-detail-grid">
        <section className="monster-detail-card">
          <h3>Growth Data</h3>
          <table>
            <tbody>
              <tr><th>Max Level</th><td>{monster.maxLevel ?? '-'}</td></tr>
              <tr><th>Exp Growth</th><td>{monster.expGrowth ?? '-'}</td></tr>
              <tr><th>HP Growth</th><td>{monster.hpGrowth}</td></tr>
              <tr><th>MP Growth</th><td>{monster.mpGrowth}</td></tr>
              <tr><th>Attack Growth</th><td>{monster.attackGrowth}</td></tr>
              <tr><th>Defense Growth</th><td>{monster.defenseGrowth}</td></tr>
              <tr><th>Agility Growth</th><td>{monster.agilityGrowth}</td></tr>
              <tr><th>Intelligence Growth</th><td>{monster.intelligenceGrowth}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="monster-detail-card">
          <h3>Skills</h3>
          {monster.skills && monster.skills.length > 0 ? (
            <ul>
              {monster.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p className="tree-help">No skills listed.</p>
          )}
        </section>

        <section className="monster-detail-card">
          <h3>Spawn Locations</h3>
          {monster.spawnLocations && monster.spawnLocations.length > 0 ? (
            <ul>
              {monster.spawnLocations.map((location, index) => (
                <li key={`${location.map}-${index}`}>
                  <strong>{location.map}</strong>
                  {location.description && <>: {location.description}</>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="tree-help">No spawn locations listed.</p>
          )}
        </section>
      </div>
    </div>
  );
};
