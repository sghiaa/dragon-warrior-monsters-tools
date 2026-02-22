import { KEY_DESCRIPTORS, KEY_FAMILY_BY_CODE, KEY_FAMILY_OPTIONS } from './keys';

describe('key reference data', () => {
  it('keeps descriptors ordered from common to rare', () => {
    expect(KEY_DESCRIPTORS[0]).toBe('Ylw');
    expect(KEY_DESCRIPTORS[KEY_DESCRIPTORS.length - 1]).toBe('Last');
    expect(KEY_DESCRIPTORS).toHaveLength(16);
  });

  it('uses Undead naming (not Zombie) for all relevant key family options', () => {
    const undeadOptions = KEY_FAMILY_OPTIONS.filter((option) =>
      option.availableFamilies.includes('Undead')
    );
    expect(undeadOptions.length).toBeGreaterThan(0);
    undeadOptions.forEach((option) => {
      expect(option.availableFamilies).not.toContain('Zombie');
    });
  });

  it('maps single-family and dual-family key codes correctly', () => {
    expect(KEY_FAMILY_BY_CODE.get('Beast')?.availableFamilies).toEqual(['Beast']);
    expect(KEY_FAMILY_BY_CODE.get('Death')?.availableFamilies).toEqual(['Undead']);
    expect(KEY_FAMILY_BY_CODE.get('Sky')?.availableFamilies).toEqual(['Bird', 'Bug']);
    expect(KEY_FAMILY_BY_CODE.get('Cstle')?.availableFamilies).toEqual(['Dragon', 'Devil']);
  });

  it('keeps Lord code intentionally unresolved for family availability', () => {
    const lord = KEY_FAMILY_BY_CODE.get('Lord');
    expect(lord?.label).toBe('???');
    expect(lord?.availableFamilies).toEqual([]);
  });
});
