export interface SkillRecipe {
  name: string;
  combineFrom: string[];
  precursor?: string;
}

let skillRecipesCache: SkillRecipe[] | null = null;

const readText = (element: Element | null | undefined): string => (element?.textContent || '').trim();

export const loadSkillRecipesFromXml = async (): Promise<SkillRecipe[]> => {
  if (skillRecipesCache) {
    return skillRecipesCache;
  }

  try {
    const response = await fetch('/data/monster-data.xml');
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) {
      console.error('Failed parsing /data/monster-data.xml for skill recipes');
      return [];
    }

    const recipes: SkillRecipe[] = [];
    const nodes = Array.from(doc.getElementsByTagName('skill-data'));
    nodes.forEach((node) => {
      const name = node.getAttribute('name') || '';
      if (!name) {
        return;
      }

      const combineFromNode = node.getElementsByTagName('combine-from')[0];
      const combineFrom = combineFromNode
        ? Array.from(combineFromNode.getElementsByTagName('skill'))
            .map((skillNode) => readText(skillNode))
            .filter(Boolean)
        : [];
      const precursor = readText(node.getElementsByTagName('precursor')[0]) || undefined;

      recipes.push({
        name,
        combineFrom,
        precursor
      });
    });

    skillRecipesCache = recipes;
    return recipes;
  } catch (error) {
    console.error('Error loading skill recipes:', error);
    return [];
  }
};
