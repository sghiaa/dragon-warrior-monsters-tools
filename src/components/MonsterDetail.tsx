import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { canonicalMonsterId, getMonsterById, MONSTERS, RAW_BREEDING_PAIRS } from '../data/monsters';

interface MonsterDetailProps {
  monsterId: string;
  onBack: () => void;
}

export const MonsterDetail: React.FC<MonsterDetailProps> = ({ monsterId, onBack }) => {
  const monster = getMonsterById(monsterId);
  const normalizeId = (value: string): string => canonicalMonsterId(value);

  const breedingPairs = useMemo(() => {
    const target = normalizeId(monsterId);
    const seen = new Set<string>();

    return RAW_BREEDING_PAIRS
      .filter((pair) => normalizeId(pair.result) === target)
      .filter((pair) => {
        const key = `${pair.parent1}::${pair.parent2}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }, [monsterId]);

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

  const stats = [
    { label: 'HP', value: monster.hpGrowth },
    { label: 'MP', value: monster.mpGrowth },
    { label: 'ATK', value: monster.attackGrowth },
    { label: 'DEF', value: monster.defenseGrowth },
    { label: 'AGL', value: monster.agilityGrowth },
    { label: 'INT', value: monster.intelligenceGrowth }
  ];

  const globalMaxGrowth = Math.max(
    1,
    ...MONSTERS.flatMap((entry) => [
      entry.hpGrowth,
      entry.mpGrowth,
      entry.attackGrowth,
      entry.defenseGrowth,
      entry.agilityGrowth,
      entry.intelligenceGrowth
    ])
  );

  const size = 300;
  const center = size / 2;
  const radius = 110;
  const levels = 5;
  const angleStep = (Math.PI * 2) / stats.length;
  const startAngle = -Math.PI / 2;
  const toPoint = (index: number, ratio: number) => {
    const angle = startAngle + (index * angleStep);
    const x = center + Math.cos(angle) * radius * ratio;
    const y = center + Math.sin(angle) * radius * ratio;
    return { x, y };
  };

  const polygonPoints = stats
    .map((stat, index) => {
      const ratio = stat.value / globalMaxGrowth;
      const point = toPoint(index, ratio);
      return `${point.x},${point.y}`;
    })
    .join(' ');

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
          <div className="monster-growth-chart">
            <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${monster.name} growth radar chart`}>
              {Array.from({ length: levels }).map((_, levelIndex) => {
                const ratio = (levelIndex + 1) / levels;
                const ringPoints = stats
                  .map((_, axisIndex) => {
                    const point = toPoint(axisIndex, ratio);
                    return `${point.x},${point.y}`;
                  })
                  .join(' ');
                return (
                  <polygon
                    key={`ring-${levelIndex}`}
                    points={ringPoints}
                    className="growth-ring"
                  />
                );
              })}

              {stats.map((_, axisIndex) => {
                const outer = toPoint(axisIndex, 1);
                return (
                  <line
                    key={`axis-${axisIndex}`}
                    x1={center}
                    y1={center}
                    x2={outer.x}
                    y2={outer.y}
                    className="growth-axis"
                  />
                );
              })}

              <polygon points={polygonPoints} className="growth-shape" />

              {stats.map((stat, axisIndex) => {
                const labelPoint = toPoint(axisIndex, 1.12);
                return (
                  <text
                    key={`label-${stat.label}`}
                    x={labelPoint.x}
                    y={labelPoint.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="growth-label"
                  >
                    {stat.label}
                  </text>
                );
              })}
            </svg>
            <p className="tree-help">
              Scale max: <strong>{globalMaxGrowth}</strong> (highest base growth across all monsters and stats)
            </p>
          </div>
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

        <section className="monster-detail-card">
          <h3>Breeding Pairs</h3>
          {breedingPairs.length > 0 ? (
            <div className="monster-breeding-pairs">
              {breedingPairs.map((pair, index) => {
                const parent1Id = normalizeId(pair.parent1);
                const parent2Id = normalizeId(pair.parent2);
                const parent1Monster = getMonsterById(parent1Id);
                const parent2Monster = getMonsterById(parent2Id);
                const isParent1Family = /^Any\s+/i.test(pair.parent1);
                const isParent2Family = /^Any\s+/i.test(pair.parent2);

                return (
                  <div className="monster-breeding-pair-row" key={`pair-${pair.parent1}-${pair.parent2}-${index}`}>
                    <span className="monster-breeding-parent">
                      {parent1Monster && !isParent1Family ? (
                        <a href={`#monster/${parent1Monster.id}`} className="monster-link">
                          {pair.parent1}
                        </a>
                      ) : (
                        pair.parent1
                      )}
                    </span>
                    <span className="monster-breeding-plus">+</span>
                    <span className="monster-breeding-parent">
                      {parent2Monster && !isParent2Family ? (
                        <a href={`#monster/${parent2Monster.id}`} className="monster-link">
                          {pair.parent2}
                        </a>
                      ) : (
                        pair.parent2
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="tree-help">No breeding pairs listed for this monster.</p>
          )}
        </section>
      </div>
    </div>
  );
};
