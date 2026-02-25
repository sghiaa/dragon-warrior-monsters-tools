import { mergePlannerProgress, sharesBranchPath } from './breedingPlanProgress';
import { PlannerProgressState } from './storage';

describe('breedingPlanProgress helpers', () => {
  it('matches path overlap for same node, ancestor, and descendant', () => {
    expect(sharesBranchPath('root.L', 'root.L')).toBe(true);
    expect(sharesBranchPath('root.L', 'root.L.R')).toBe(true);
    expect(sharesBranchPath('root.R.L', 'root.R')).toBe(true);
    expect(sharesBranchPath('root.L', 'root.R')).toBe(false);
  });

  it('returns prefill as-is when there is no saved progress', () => {
    const merged = mergePlannerProgress(null, {
      checkedNodes: ['root.L'],
      checkedNodeGenders: { 'root.L': 'male' },
      checkedNodeNames: { 'root.L': 'Alpha' }
    });

    expect(Array.from(merged.checkedNodes)).toEqual(['root.L']);
    expect(merged.checkedNodeGenders).toEqual({ 'root.L': 'male' });
    expect(merged.checkedNodeNames).toEqual({ 'root.L': 'Alpha' });
  });

  it('drops stale auto overlaps and keeps manual non-overlapping saved nodes', () => {
    const saved: PlannerProgressState = {
      checkedNodes: ['root.L', 'root.R'],
      autoCheckedNodes: ['root.L'],
      checkedNodeGenders: { 'root.L': 'female', 'root.R': 'male' },
      checkedNodeNames: { 'root.L': 'OldAuto', 'root.R': 'KeepMe' },
      lastUpdated: new Date().toISOString()
    };

    const merged = mergePlannerProgress(saved, {
      checkedNodes: ['root.L.R'],
      checkedNodeGenders: { 'root.L.R': 'male' },
      checkedNodeNames: { 'root.L.R': 'FreshAuto' }
    });

    expect(Array.from(merged.checkedNodes).sort()).toEqual(['root.L.R', 'root.R']);
    expect(merged.checkedNodeGenders).toEqual({ 'root.L.R': 'male', 'root.R': 'male' });
    expect(merged.checkedNodeNames).toEqual({ 'root.L.R': 'FreshAuto', 'root.R': 'KeepMe' });
  });

  it('drops saved manual path that reuses nickname already used by prefill', () => {
    const saved: PlannerProgressState = {
      checkedNodes: ['root.R'],
      checkedNodeGenders: {},
      checkedNodeNames: { 'root.R': 'DuplicateName' },
      lastUpdated: new Date().toISOString()
    };

    const merged = mergePlannerProgress(saved, {
      checkedNodes: ['root.L'],
      checkedNodeGenders: {},
      checkedNodeNames: { 'root.L': 'DuplicateName' }
    });

    expect(Array.from(merged.checkedNodes)).toEqual(['root.L']);
    expect(merged.checkedNodeNames).toEqual({ 'root.L': 'DuplicateName', 'root.R': 'DuplicateName' });
  });
});
