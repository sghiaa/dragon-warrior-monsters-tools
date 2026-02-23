export interface SkillRecipe {
  name: string;
  combineFrom: string[];
  precursor?: string;
  requirements?: {
    level: number;
    hp: number;
    mp: number;
    attack: number;
    defense: number;
    agility: number;
    intelligence: number;
  };
}

let skillRecipesCache: SkillRecipe[] | null = null;

const readText = (element: Element | null | undefined): string => (element?.textContent || '').trim();
const readNumberAttr = (element: Element | null | undefined, key: string): number => {
  if (!element) {
    return 0;
  }
  const raw = element.getAttribute(key);
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const getDataUrl = (filename: string): string => {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/data/${filename}`;
};

export const loadSkillRecipesFromXml = async (): Promise<SkillRecipe[]> => {
  if (skillRecipesCache) {
    return skillRecipesCache;
  }

  try {
    const response = await fetch(getDataUrl('monster-data.xml'));
    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) {
      console.error('Failed parsing monster-data.xml for skill recipes');
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
      const reqNode = node.getElementsByTagName('skill-requirements')[0];

      recipes.push({
        name,
        combineFrom,
        precursor,
        requirements: reqNode
          ? {
              level: readNumberAttr(reqNode, 'lvl'),
              hp: readNumberAttr(reqNode, 'hp'),
              mp: readNumberAttr(reqNode, 'mp'),
              attack: readNumberAttr(reqNode, 'atk'),
              defense: readNumberAttr(reqNode, 'def'),
              agility: readNumberAttr(reqNode, 'agl'),
              intelligence: readNumberAttr(reqNode, 'int')
            }
          : undefined
      });
    });

    skillRecipesCache = recipes;
    return recipes;
  } catch (error) {
    console.error('Error loading skill recipes:', error);
    return [];
  }
};
