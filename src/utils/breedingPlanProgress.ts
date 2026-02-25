import { Gender } from '../types/monster';
import { PlannerProgressState } from './storage';

export interface PlannerProgressPrefill {
  checkedNodes: string[];
  checkedNodeGenders: Record<string, Gender>;
  checkedNodeNames: Record<string, string>;
}

export interface MergedPlannerProgress {
  checkedNodes: Set<string>;
  checkedNodeGenders: Record<string, Gender>;
  checkedNodeNames: Record<string, string>;
}

export const sharesBranchPath = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);

export const mergePlannerProgress = (
  saved: PlannerProgressState | null,
  prefill: PlannerProgressPrefill
): MergedPlannerProgress => {
  if (!saved) {
    return {
      checkedNodes: new Set(prefill.checkedNodes),
      checkedNodeGenders: { ...prefill.checkedNodeGenders },
      checkedNodeNames: { ...prefill.checkedNodeNames }
    };
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

    if (Array.from(prefillChecked).some((autoPath) => sharesBranchPath(path, autoPath))) {
      return false;
    }

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

  return {
    checkedNodes: mergedCheckedNodes,
    checkedNodeGenders: mergedGenders,
    checkedNodeNames: mergedNames
  };
};
