import React from 'react';
import { UserMonster } from '../types/monster';
import { BreedingCalculator } from '../utils/breedingCalculator';
import { Heart, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';

interface BreedingPossibilitiesProps {
  userMonsters: UserMonster[];
}

export const BreedingPossibilities: React.FC<BreedingPossibilitiesProps> = ({ userMonsters }) => {
  const calculator = new BreedingCalculator(userMonsters);
  const possibilities = calculator.getAllPossibilities();

  if (userMonsters.length === 0) {
    return (
      <div className="breeding-possibilities empty">
        <div className="empty-state possibilities-empty-state">
          <AlertCircle size={48} />
          <h2>No Monsters in Collection</h2>
          <p>Add some monsters to your collection to see breeding possibilities!</p>
        </div>
      </div>
    );
  }

  if (possibilities.length === 0) {
    return (
      <div className="breeding-possibilities empty">
        <div className="empty-state possibilities-empty-state">
          <AlertCircle size={48} />
          <h2>No Breeding Possibilities</h2>
          <p>None of your current monsters can breed together. Try adding more monsters to your collection!</p>
        </div>
      </div>
    );
  }

  const validPossibilities = possibilities.filter(p => p.hasValidGenders);
  const invalidPossibilities = possibilities.filter(p => !p.hasValidGenders);

  return (
    <div className="breeding-possibilities">
      <div className="possibilities-header">
        <div className="possibilities-title">
          <Heart size={24} />
          <h2>Breeding Possibilities</h2>
        </div>
        <p>All outcomes available from your current stable.</p>
        <div className="possibility-stats">
          <div className="possibility-stat">
            <Sparkles size={16} />
            <span>{possibilities.length} total</span>
          </div>
          <div className="possibility-stat ready">
            <CheckCircle size={16} />
            <span>{validPossibilities.length} ready now</span>
          </div>
          <div className="possibility-stat blocked">
            <AlertCircle size={16} />
            <span>{invalidPossibilities.length} need genders</span>
          </div>
        </div>
      </div>

      {validPossibilities.length > 0 && (
        <div className="possibilities-section">
          <h3>
            <CheckCircle size={20} />
            Ready to Breed ({validPossibilities.length})
          </h3>
          <div className="possibilities-grid">
            {validPossibilities.map((possibility, index) => (
              <div key={index} className="possibility-card valid">
                <div className="breeding-combination possibility-formula">
                  <div className="parent">
                    <span className="monster-name">{possibility.parent1Name}</span>
                  </div>
                  <div className="breeding-symbol">+</div>
                  <div className="parent">
                    <span className="monster-name">{possibility.parent2Name}</span>
                  </div>
                  <div className="breeding-symbol">=</div>
                  <div className="result">
                    <span className="monster-name result-name">{possibility.resultName}</span>
                  </div>
                </div>
                <div className="possibility-status">
                  <CheckCircle size={16} className="status-icon valid" />
                  <span>Can breed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {invalidPossibilities.length > 0 && (
        <div className="possibilities-section">
          <h3>
            <AlertCircle size={20} />
            Need Male & Female ({invalidPossibilities.length})
          </h3>
          <div className="possibilities-grid">
            {invalidPossibilities.map((possibility, index) => (
              <div key={index} className="possibility-card invalid">
                <div className="breeding-combination possibility-formula">
                  <div className="parent">
                    <span className="monster-name">{possibility.parent1Name}</span>
                  </div>
                  <div className="breeding-symbol">+</div>
                  <div className="parent">
                    <span className="monster-name">{possibility.parent2Name}</span>
                  </div>
                  <div className="breeding-symbol">=</div>
                  <div className="result">
                    <span className="monster-name result-name">{possibility.resultName}</span>
                  </div>
                </div>
                <div className="possibility-status">
                  <AlertCircle size={16} className="status-icon invalid" />
                  <span>Need male & female</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="possibilities-summary">
        <p>
          <strong>Summary:</strong> {validPossibilities.length} can be bred immediately, and {invalidPossibilities.length} are one gender assignment away.
        </p>
      </div>
    </div>
  );
};
