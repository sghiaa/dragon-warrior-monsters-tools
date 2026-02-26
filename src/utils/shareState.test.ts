import { importShareState, exportShareState, ShareState } from './shareState';

describe('shareState', () => {
  const baseState: ShareState = {
    ownedMonsters: [
      { id: 'm1', monsterId: 'pizzaro', gender: 'male', nickname: 'Pizza' },
      { id: 'm2', monsterId: 'devila', gender: 'female', nickname: 'Egg', isEgg: true }
    ],
    selectedGoals: ['darkdrium', 'orgodemir2'],
    plannerSeedMonsterIds: ['slime', 'beast']
  };

  it('exports owned stable + selected goals + planner seed ids as a share string', () => {
    const encoded = exportShareState(baseState);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('imports a previously exported string back to equivalent state', () => {
    const encoded = exportShareState(baseState);
    const imported = importShareState(encoded);
    expect(imported.ok).toBe(true);
    expect(imported.value).toEqual(baseState);
  });

  it('returns safe error for invalid/garbled share string', () => {
    const imported = importShareState('totally-not-valid');
    expect(imported.ok).toBe(false);
    expect(imported.error).toBeTruthy();
    expect(imported.value).toBeUndefined();
  });

  it('imports with defaults when optional fields are missing', () => {
    const minimal = {
      ownedMonsters: [{ id: 'x', monsterId: 'slime', gender: 'male', nickname: '' }],
      selectedGoals: ['darkdrium']
    };
    const encoded = btoa(JSON.stringify(minimal));
    const imported = importShareState(encoded);
    expect(imported.ok).toBe(true);
    expect(imported.value).toEqual({
      ownedMonsters: minimal.ownedMonsters,
      selectedGoals: minimal.selectedGoals,
      plannerSeedMonsterIds: null
    });
  });
});
