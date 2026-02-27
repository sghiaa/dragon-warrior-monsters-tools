import { applyPlannerPairBreed } from './plannerBreed';
import { PlannerPairBreedRequest } from '../types/monster';

jest.mock('../data/monsters', () => ({
  getMonsterById: (id: string) => {
    const byId: Record<string, { id: string; name: string; family: string }> = {
      beast_a: { id: 'beast_a', name: 'BeastA', family: 'Beast' },
      slime_a: { id: 'slime_a', name: 'SlimeA', family: 'Slime' },
      darkdrium: { id: 'darkdrium', name: 'Darkdrium', family: 'Boss' }
    };
    return byId[id] || undefined;
  },
  getBreedingResult: (left: string, right: string) => {
    const key = [left, right].sort().join('+');
    if (key === 'beast_a+slime_a') {
      return { parent1: left, parent2: right, result: 'darkdrium' };
    }
    return undefined;
  },
  canonicalMonsterId: (value: string) => value
}));

describe('applyPlannerPairBreed', () => {
  const request: PlannerPairBreedRequest = {
    resultMonsterId: 'darkdrium',
    left: { path: 'root.L', nodeKind: 'monster', nodeValue: 'beast_a', checked: true, gender: 'male', assignedName: 'Beasty' },
    right: { path: 'root.R', nodeKind: 'monster', nodeValue: 'slime_a', checked: true, gender: 'female', assignedName: 'Slimy' }
  };

  it('removes matched parents and adds child egg', () => {
    const next = applyPlannerPairBreed(
      [
        { id: 'o1', monsterId: 'beast_a', gender: 'male', nickname: 'Beasty' },
        { id: 'o2', monsterId: 'slime_a', gender: 'female', nickname: 'Slimy' }
      ],
      request,
      () => 'egg-1'
    );

    expect(next).not.toBeNull();
    expect(next).toHaveLength(1);
    expect(next?.[0]).toEqual({
      id: 'egg-1',
      monsterId: 'darkdrium',
      gender: 'male',
      nickname: 'Egg',
      isEgg: true
    });
  });

  it('returns null when pair does not have opposite genders', () => {
    const invalidRequest: PlannerPairBreedRequest = {
      ...request,
      right: { ...request.right, gender: 'male' }
    };
    const next = applyPlannerPairBreed(
      [
        { id: 'o1', monsterId: 'beast_a', gender: 'male', nickname: 'Beasty' },
        { id: 'o2', monsterId: 'slime_a', gender: 'male', nickname: 'Slimy' }
      ],
      invalidRequest,
      () => 'egg-1'
    );
    expect(next).toBeNull();
  });
});
