import React, { useEffect, useMemo, useState } from 'react';
import { BreedingPlan as BreedingPlanType, BreedingTreeNode, Gender } from '../types/monster';
import { getMonsterById } from '../data/monsters';
import { loadPlannerProgress, savePlannerProgress } from '../utils/storage';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface BreedingPlanProps {
  plan: BreedingPlanType;
  goalStateKey: string;
  autoAssignment?: {
    checkedNodes: string[];
    checkedNodeGenders: Record<string, Gender>;
    checkedNodeNames: Record<string, string>;
  };
}

export const BreedingPlan: React.FC<BreedingPlanProps> = ({ plan, goalStateKey, autoAssignment }) => {
  const [checkedNodes, setCheckedNodes] = useState<Set<string>>(new Set());
  const [checkedNodeGenders, setCheckedNodeGenders] = useState<Record<string, Gender>>({});
  const [checkedNodeNames, setCheckedNodeNames] = useState<Record<string, string>>({});
  const prefill = useMemo(() => autoAssignment || {
    checkedNodes: [] as string[],
    checkedNodeGenders: {} as Record<string, Gender>,
    checkedNodeNames: {} as Record<string, string>
  }, [autoAssignment]);
  const sharesBranchPath = (a: string, b: string) =>
    a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);

  const getMonsterName = (monsterId: string): string => {
    const monster = getMonsterById(monsterId);
    return monster ? monster.name : monsterId;
  };

  const renderMonsterLink = (monsterId: string) => (
    <a href={`#monster/${monsterId}`} className="monster-link">
      {getMonsterName(monsterId)}
    </a>
  );

  const addCounts = (target: Record<string, number>, source: Record<string, number>) => {
    Object.entries(source).forEach(([family, count]) => {
      target[family] = (target[family] || 0) + count;
    });
  };

  const checkedCoverage = useMemo(() => {
    if (!plan.tree) {
      return {};
    }

    const collectBaseRequirementsFromNode = (node: BreedingTreeNode): Record<string, number> => {
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

    const walk = (node: BreedingTreeNode, path: string): Record<string, number> => {
      if (checkedNodes.has(path)) {
        return collectBaseRequirementsFromNode(node);
      }

      if (node.kind === 'family') {
        return {};
      }

      const totals: Record<string, number> = {};
      if (node.left) {
        addCounts(totals, walk(node.left, `${path}.L`));
      }
      if (node.right) {
        addCounts(totals, walk(node.right, `${path}.R`));
      }
      return totals;
    };

    return walk(plan.tree, 'root');
  }, [plan.tree, checkedNodes]);

  const adjustedRemaining = useMemo(() => {
    // Use full base requirements as the baseline so visible unchecked tree
    // requirements are reflected even when remainingRequirements has collapsed to zero.
    const baseRemaining = { ...(plan.baseRequirements || plan.remainingRequirements || {}) };
    Object.entries(checkedCoverage).forEach(([family, covered]) => {
      baseRemaining[family] = Math.max(0, (baseRemaining[family] || 0) - covered);
      if (baseRemaining[family] === 0) {
        delete baseRemaining[family];
      }
    });
    return baseRemaining;
  }, [plan.baseRequirements, plan.remainingRequirements, checkedCoverage]);

  const adjustedRemainingTotal = useMemo(() => {
    return Object.values(adjustedRemaining).reduce((sum, count) => sum + count, 0);
  }, [adjustedRemaining]);

  useEffect(() => {
    const saved = loadPlannerProgress(goalStateKey);
    if (!saved) {
      setCheckedNodes(new Set(prefill.checkedNodes));
      setCheckedNodeGenders(prefill.checkedNodeGenders);
      setCheckedNodeNames(prefill.checkedNodeNames);
      return;
    }

    const previousAutoChecked = new Set(saved.autoCheckedNodes || []);
    const prefillChecked = new Set(prefill.checkedNodes || []);
    const prefillNames = new Set(
      Object.values(prefill.checkedNodeNames || {})
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    );

    const savedManualChecked = (saved.checkedNodes || []).filter((path) => {
      if (previousAutoChecked.has(path)) {
        return false;
      }

      // If this saved node overlaps a currently auto-assigned branch,
      // keep the current auto assignment authoritative and drop stale placement.
      if (Array.from(prefillChecked).some((autoPath) => sharesBranchPath(path, autoPath))) {
        return false;
      }

      // If nicknames are unique (required by this app), do not allow an older saved
      // manual node to keep the same monster nickname as a current auto assignment.
      const savedName = (saved.checkedNodeNames?.[path] || '').trim();
      if (savedName && prefillNames.has(savedName)) {
        return false;
      }

      return true;
    });
    const mergedCheckedNodes = new Set([...savedManualChecked, ...prefill.checkedNodes]);

    const mergedGenders: Record<string, Gender> = { ...prefill.checkedNodeGenders };
    Object.entries(saved.checkedNodeGenders || {}).forEach(([path, gender]) => {
      if (!previousAutoChecked.has(path)) {
        mergedGenders[path] = gender;
      }
    });

    const mergedNames: Record<string, string> = { ...prefill.checkedNodeNames };
    Object.entries(saved.checkedNodeNames || {}).forEach(([path, name]) => {
      if (!previousAutoChecked.has(path)) {
        mergedNames[path] = name;
      }
    });

    setCheckedNodes(mergedCheckedNodes);
    setCheckedNodeGenders(mergedGenders);
    setCheckedNodeNames(mergedNames);
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

  const collectSubtreePaths = (node: BreedingTreeNode, path: string): string[] => {
    const paths = [path];
    if (node.left) {
      paths.push(...collectSubtreePaths(node.left, `${path}.L`));
    }
    if (node.right) {
      paths.push(...collectSubtreePaths(node.right, `${path}.R`));
    }
    return paths;
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
    const stateClass = (isChecked && isSiblingChecked)
      ? 'state-paired'
      : selectedGender
        ? `state-${selectedGender}`
        : 'state-baseline';

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
          </div>
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
          <strong>Remaining after owned + checked nodes:</strong> {adjustedRemainingTotal} ({renderRequirements(adjustedRemaining)})
        </p>
        <p>
          <strong>Boss rule:</strong> Any generic Boss requirement is expanded as Dracolord1.
        </p>
      </div>
    </div>
  );
};
