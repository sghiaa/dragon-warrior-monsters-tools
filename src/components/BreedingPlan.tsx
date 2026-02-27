import React, { useEffect, useMemo, useState } from 'react';
import {
  BreedingPlan as BreedingPlanType,
  BreedingTreeNode,
  Gender,
  PlannerPairBreedRequest
} from '../types/monster';
import { getMonsterById } from '../data/monsters';
import { loadPlannerProgress, savePlannerProgress } from '../utils/storage';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  collectCheckedCoverage,
  collectRemainingMoves,
  collectSubtreePaths,
  combineRemainingByFamilyGender,
  computeAdjustedRemaining,
  computeRemainingGenderRequirements,
  renderFamilyGenderRequirements,
  sumRequirements
} from '../utils/breedingPlanTree';
import { mergePlannerProgress } from '../utils/breedingPlanProgress';

interface BreedingPlanProps {
  plan: BreedingPlanType;
  goalStateKey: string;
  showNativeMoves?: boolean;
  onBreedPair?: (request: PlannerPairBreedRequest) => void;
  autoAssignment?: {
    checkedNodes: string[];
    checkedNodeGenders: Record<string, Gender>;
    checkedNodeNames: Record<string, string>;
  };
}

export const BreedingPlan: React.FC<BreedingPlanProps> = ({
  plan,
  goalStateKey,
  showNativeMoves = false,
  onBreedPair,
  autoAssignment
}) => {
  const [checkedNodes, setCheckedNodes] = useState<Set<string>>(new Set());
  const [checkedNodeGenders, setCheckedNodeGenders] = useState<Record<string, Gender>>({});
  const [checkedNodeNames, setCheckedNodeNames] = useState<Record<string, string>>({});
  const prefill = useMemo(() => autoAssignment || {
    checkedNodes: [] as string[],
    checkedNodeGenders: {} as Record<string, Gender>,
    checkedNodeNames: {} as Record<string, string>
  }, [autoAssignment]);
  const getMonsterName = (monsterId: string): string => {
    const monster = getMonsterById(monsterId);
    return monster ? monster.name : monsterId;
  };

  const renderMonsterLink = (monsterId: string) => (
    <a href={`#monster/${monsterId}`} className="monster-link">
      {getMonsterName(monsterId)}
    </a>
  );

  const renderNativeMovePills = (monsterId: string): React.ReactNode => {
    if (!showNativeMoves) {
      return null;
    }

    const monster = getMonsterById(monsterId);
    const moves = (monster?.skills || []).filter(Boolean);
    if (!monster || moves.length === 0) {
      return null;
    }

    const familyClass = `family-${monster.family.toLowerCase()}`;
    return (
      <div className="key-family-pills">
        {moves.map((move) => (
          <span key={`${monsterId}-${move}`} className={`stable-family-pill ${familyClass}`}>
            {move}
          </span>
        ))}
      </div>
    );
  };

  const checkedCoverage = useMemo(() => {
    return collectCheckedCoverage(plan.tree, checkedNodes);
  }, [plan.tree, checkedNodes]);

  const adjustedRemaining = useMemo(() => {
    return computeAdjustedRemaining(plan.baseRequirements, plan.remainingRequirements, checkedCoverage);
  }, [plan.baseRequirements, plan.remainingRequirements, checkedCoverage]);

  const adjustedRemainingTotal = useMemo(() => sumRequirements(adjustedRemaining), [adjustedRemaining]);

  const remainingGenderRequirementsByFamily = useMemo(() => {
    return computeRemainingGenderRequirements(plan.tree, checkedNodes, checkedNodeGenders);
  }, [plan.tree, checkedNodes, checkedNodeGenders]);

  const combinedRemainingByFamilyGender = useMemo(() => {
    return combineRemainingByFamilyGender(remainingGenderRequirementsByFamily, adjustedRemaining);
  }, [remainingGenderRequirementsByFamily, adjustedRemaining]);

  const remainingMoves = useMemo(() => {
    if (!showNativeMoves) {
      return [] as string[];
    }
    return collectRemainingMoves(
      plan.tree,
      checkedNodes,
      (monsterId) => getMonsterById(monsterId)?.skills || []
    );
  }, [showNativeMoves, plan.tree, checkedNodes]);

  useEffect(() => {
    const saved = loadPlannerProgress(goalStateKey);
    const merged = mergePlannerProgress(saved, prefill);
    setCheckedNodes(merged.checkedNodes);
    setCheckedNodeGenders(merged.checkedNodeGenders);
    setCheckedNodeNames(merged.checkedNodeNames);
  }, [goalStateKey, prefill]);

  useEffect(() => {
    if (!goalStateKey) {
      return;
    }

    savePlannerProgress(goalStateKey, {
      checkedNodes: Array.from(checkedNodes),
      autoCheckedNodes: prefill.checkedNodes,
      checkedNodeGenders,
      checkedNodeNames,
      lastUpdated: new Date().toISOString()
    });
  }, [
    goalStateKey,
    checkedNodes,
    checkedNodeGenders,
    checkedNodeNames,
    prefill.checkedNodes
  ]);

  if (plan.isPossible && plan.steps.length === 0) {
    return (
      <div className="breeding-plan success">
        <div className="plan-header">
          <CheckCircle size={24} />
          <h2>You already have {renderMonsterLink(plan.targetMonster)}!</h2>
        </div>
        <p>No breeding needed - this monster is already in your collection.</p>
      </div>
    );
  }

  const renderRequirements = (requirements?: Record<string, number>) => {
    if (!requirements || Object.keys(requirements).length === 0) {
      return 'None';
    }

    return Object.entries(requirements)
      .map(([family, count]) => `${count} ${family}`)
      .join(', ');
  };

  const toggleChecked = (path: string, node: BreedingTreeNode) => {
    const subtreePaths = collectSubtreePaths(node, path);
    const wasChecked = checkedNodes.has(path);

    setCheckedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        subtreePaths.forEach((subtreePath) => next.delete(subtreePath));
      } else {
        subtreePaths.forEach((subtreePath) => next.add(subtreePath));
      }
      return next;
    });

    setCheckedNodeGenders((prev) => {
      if (!wasChecked) {
        return prev;
      }
      const next: Record<string, Gender> = { ...prev };
      subtreePaths.forEach((subtreePath) => {
        delete next[subtreePath];
      });
      return next;
    });

    setCheckedNodeNames((prev) => {
      if (!wasChecked) {
        return prev;
      }
      const next: Record<string, string> = { ...prev };
      subtreePaths.forEach((subtreePath) => {
        delete next[subtreePath];
      });
      return next;
    });
  };

  const setCheckedNodeGender = (path: string, gender: Gender) => {
    const siblingPath = path.endsWith('.L')
      ? `${path.slice(0, -2)}.R`
      : path.endsWith('.R')
        ? `${path.slice(0, -2)}.L`
        : null;
    const oppositeGender: Gender = gender === 'male' ? 'female' : 'male';

    setCheckedNodeGenders((prev) => {
      const next: Record<string, Gender> = {
        ...prev,
        [path]: gender
      };

      // Keep pair hinting for an unchecked sibling, but never override a checked node
      // that may have been prefilled from the stable with a real gender.
      if (siblingPath && !checkedNodes.has(siblingPath)) {
        next[siblingPath] = oppositeGender;
      }

      return next;
    });
  };

  const setCheckedNodeName = (path: string, name: string) => {
    setCheckedNodeNames((prev) => ({
      ...prev,
      [path]: name
    }));
  };

  const renderTreeNode = (node: BreedingTreeNode, path: string): React.ReactNode => {
    const hasChildren = !!node.left && !!node.right;
    const depth = path === 'root' ? 0 : path.split('.').length - 1;
    const nodeClass = node.kind === 'family' ? 'tree-node family' : 'tree-node monster';
    const isChecked = checkedNodes.has(path);
    const selectedGender = checkedNodeGenders[path];
    const customName = checkedNodeNames[path];
    const siblingPath = path.endsWith('.L')
      ? `${path.slice(0, -2)}.R`
      : path.endsWith('.R')
        ? `${path.slice(0, -2)}.L`
        : null;
    const isSiblingChecked = siblingPath ? checkedNodes.has(siblingPath) : false;
    const leftPath = `${path}.L`;
    const rightPath = `${path}.R`;
    const leftChecked = hasChildren ? checkedNodes.has(leftPath) : false;
    const rightChecked = hasChildren ? checkedNodes.has(rightPath) : false;
    const leftGender = hasChildren ? checkedNodeGenders[leftPath] : undefined;
    const rightGender = hasChildren ? checkedNodeGenders[rightPath] : undefined;
    const readyParentCount = (leftChecked && leftGender ? 1 : 0) + (rightChecked && rightGender ? 1 : 0);
    const isParentPairReady = Boolean(
      node.kind === 'monster' &&
      hasChildren &&
      leftChecked &&
      rightChecked &&
      leftGender &&
      rightGender &&
      leftGender !== rightGender
    );
    const stateClass = (isChecked && isSiblingChecked)
      ? 'state-paired'
      : selectedGender
        ? `state-${selectedGender}`
        : (node.kind === 'monster' && readyParentCount === 1)
          ? 'state-parent-partial'
          : isParentPairReady
            ? 'state-parent-ready'
            : 'state-baseline';
    const canBreedPair = Boolean(
      hasChildren &&
      node.kind === 'monster' &&
      isParentPairReady &&
      onBreedPair
    );

    return (
      <li className="tree-item">
        <div className={`${nodeClass} ${isChecked ? 'checked' : ''} ${stateClass}`}>
          <div className="tree-check">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleChecked(path, node)}
            />
            <span>{node.kind === 'monster' ? renderMonsterLink(node.value) : node.value}</span>
            {customName?.trim() && (
              <span className="tree-assigned-name">[{customName.trim()}]</span>
            )}
            {node.kind === 'monster' && hasChildren && (
              <span className="tree-depth-indicator">Depth: {depth}</span>
            )}
          </div>
          {node.kind === 'monster' && renderNativeMovePills(node.value)}
          {isChecked && (
            <div className="tree-gender-toggle">
              <button
                type="button"
                className={selectedGender === 'male' ? 'active male' : 'male'}
                onClick={() => setCheckedNodeGender(path, 'male')}
              >
                Male
              </button>
              <button
                type="button"
                className={selectedGender === 'female' ? 'active female' : 'female'}
                onClick={() => setCheckedNodeGender(path, 'female')}
              >
                Female
              </button>
            </div>
          )}
          {isChecked && (
            <div className="tree-name-editor">
              <input
                type="text"
                value={customName || ''}
                onChange={(e) => setCheckedNodeName(path, e.target.value)}
                placeholder={node.kind === 'monster' ? 'Nickname' : 'Custom label'}
              />
            </div>
          )}
          {hasChildren && node.kind === 'monster' && onBreedPair && (
            <div className="tree-gender-toggle">
              <button
                type="button"
                data-testid={`breed-pair-${path.replace(/\./g, '-')}`}
                disabled={!canBreedPair}
                onClick={() => {
                  if (!node.left || !node.right) {
                    return;
                  }
                  onBreedPair({
                    resultMonsterId: node.value,
                    left: {
                      path: leftPath,
                      nodeKind: node.left.kind,
                      nodeValue: node.left.value,
                      checked: leftChecked,
                      gender: leftGender,
                      assignedName: checkedNodeNames[leftPath]
                    },
                    right: {
                      path: rightPath,
                      nodeKind: node.right.kind,
                      nodeValue: node.right.value,
                      checked: rightChecked,
                      gender: rightGender,
                      assignedName: checkedNodeNames[rightPath]
                    }
                  });
                }}
              >
                Breed Pair
              </button>
            </div>
          )}
        </div>
        {hasChildren && !isChecked && node.left && node.right && (
          <ul className="tree-children">
            {renderTreeNode(node.left, `${path}.L`)}
            {renderTreeNode(node.right, `${path}.R`)}
          </ul>
        )}
      </li>
    );
  };

  if (!plan.isPossible) {
    return (
      <div className="breeding-plan impossible">
        <div className="plan-header">
          <XCircle size={24} />
          <h2>Cannot breed {renderMonsterLink(plan.targetMonster)}</h2>
        </div>
        <p>Based on your current monster collection, there's no direct path to breed this monster.</p>

        {plan.missingRequirements && plan.missingRequirements.length > 0 && (
          <div className="suggestions">
            <h3>
              <AlertCircle size={20} />
              Requirements to unlock a route:
            </h3>
            <ul>
              {plan.missingRequirements.map((requirement, index) => (
                <li key={index}>{requirement}</li>
              ))}
            </ul>
          </div>
        )}
        
        {plan.missingMonsters.length > 0 && (
          <div className="suggestions">
            <h3>
              <AlertCircle size={20} />
              You need these monsters to breed {renderMonsterLink(plan.targetMonster)}:
            </h3>
            <ul>
              {plan.missingMonsters.map(monsterId => (
                <li key={monsterId}>
                  <strong>{renderMonsterLink(monsterId)}</strong>
                </li>
              ))}
            </ul>
            <p className="suggestion-note">
              Try to acquire these monsters first, then check for a breeding plan again.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="breeding-plan possible">
      <div className="plan-header">
        <CheckCircle size={24} />
        <h2>Breeding Plan for {renderMonsterLink(plan.targetMonster)}</h2>
      </div>
      
      {plan.tree && (
        <div className="plan-tree">
          <h3>Breeding Tree</h3>
          <p className="tree-help">Check nodes you already own to reduce remaining counts.</p>
          <ul className="tree-root">
            {renderTreeNode(plan.tree, 'root')}
          </ul>
        </div>
      )}
      
      <div className="plan-summary">
        <p>
          <strong>Total steps:</strong> {plan.steps.length}
        </p>
        <p>
          <strong>Total base family monsters:</strong> {plan.totalBaseRequired ?? 0}
        </p>
        <p>
          <strong>Base requirements:</strong> {renderRequirements(plan.baseRequirements)}
        </p>
        <p>
          <strong>Remaining after owned + checked nodes:</strong>{' '}
          {adjustedRemainingTotal} ({renderFamilyGenderRequirements(combinedRemainingByFamilyGender)})
        </p>
        {showNativeMoves && (
          <p>
            <strong>Remaining moves to learn:</strong>{' '}
            {remainingMoves.length} ({remainingMoves.length > 0 ? remainingMoves.join(', ') : 'None'})
          </p>
        )}
        <p>
          <strong>Boss rule:</strong> Any generic Boss requirement is expanded as Dracolord1.
        </p>
      </div>
    </div>
  );
};
