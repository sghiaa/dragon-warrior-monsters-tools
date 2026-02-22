export const KEY_DESCRIPTORS: string[] = [
  'Ylw',
  'Plain',
  'Green',
  'Blue',
  'First',
  'Red',
  'White',
  'Quiet',
  'Black',
  'Gaudy',
  'Silvr',
  'Dream',
  'Misty',
  'Secrt',
  'Shiny',
  'Last'
];

export interface KeyFamilyOption {
  code: string;
  label: string;
  availableFamilies: string[];
}

export const KEY_FAMILY_OPTIONS: KeyFamilyOption[] = [
  { code: 'Beast', label: 'Beast', availableFamilies: ['Beast'] },
  { code: 'Bird', label: 'Bird', availableFamilies: ['Bird'] },
  { code: 'Bug', label: 'Bug', availableFamilies: ['Bug'] },
  { code: 'Death', label: 'Undead', availableFamilies: ['Undead'] },
  { code: 'Devil', label: 'Devil', availableFamilies: ['Devil'] },
  { code: 'Draco', label: 'Dragon', availableFamilies: ['Dragon'] },
  { code: 'Lord', label: '???', availableFamilies: [] },
  { code: 'Slime', label: 'Slime', availableFamilies: ['Slime'] },
  { code: 'Thing', label: 'Material', availableFamilies: ['Material'] },
  { code: 'Tree', label: 'Plant', availableFamilies: ['Plant'] },
  { code: 'Water', label: 'Water', availableFamilies: ['Water'] },
  { code: 'Bsmt', label: 'Slime + Devil', availableFamilies: ['Slime', 'Devil'] },
  { code: 'Cave', label: 'Slime + Dragon', availableFamilies: ['Slime', 'Dragon'] },
  { code: 'Cliff', label: 'Bird + Material', availableFamilies: ['Bird', 'Material'] },
  { code: 'Crag', label: 'Beast + Material', availableFamilies: ['Beast', 'Material'] },
  { code: 'Cstle', label: 'Dragon + Devil', availableFamilies: ['Dragon', 'Devil'] },
  { code: 'Depth', label: 'Plant + Water', availableFamilies: ['Plant', 'Water'] },
  { code: 'Desrt', label: 'Dragon + Material', availableFamilies: ['Dragon', 'Material'] },
  { code: 'Field', label: 'Dragon + Beast', availableFamilies: ['Dragon', 'Beast'] },
  { code: 'Forst', label: 'Beast + Devil', availableFamilies: ['Beast', 'Devil'] },
  { code: 'Gardn', label: 'Slime + Plant', availableFamilies: ['Slime', 'Plant'] },
  { code: 'Grass', label: 'Beast + Bug', availableFamilies: ['Beast', 'Bug'] },
  { code: 'Grave', label: 'Beast + Undead', availableFamilies: ['Beast', 'Undead'] },
  { code: 'Grove', label: 'Plant + Devil', availableFamilies: ['Plant', 'Devil'] },
  { code: 'Gulch', label: 'Undead + Material', availableFamilies: ['Undead', 'Material'] },
  { code: 'Haven', label: 'Beast + Plant', availableFamilies: ['Beast', 'Plant'] },
  { code: 'Hell', label: 'Devil + Undead', availableFamilies: ['Devil', 'Undead'] },
  { code: 'Hill', label: 'Dragon + Bug', availableFamilies: ['Dragon', 'Bug'] },
  { code: 'Hole', label: 'Bug + Devil', availableFamilies: ['Bug', 'Devil'] },
  { code: 'Isle', label: 'Slime + Beast', availableFamilies: ['Slime', 'Beast'] },
  { code: 'Islet', label: 'Bird + Water', availableFamilies: ['Bird', 'Water'] },
  { code: 'Jail', label: 'Slime + Undead', availableFamilies: ['Slime', 'Undead'] },
  { code: 'Jungl', label: 'Beast + Bird', availableFamilies: ['Beast', 'Bird'] },
  { code: 'Lake', label: 'Dragon + Water', availableFamilies: ['Dragon', 'Water'] },
  { code: 'Land', label: 'Plant + Bug', availableFamilies: ['Plant', 'Bug'] },
  { code: 'Log', label: 'Plant + Bird', availableFamilies: ['Plant', 'Bird'] },
  { code: 'Magma', label: 'Slime + Material', availableFamilies: ['Slime', 'Material'] },
  { code: 'Manor', label: 'Plant + Material', availableFamilies: ['Plant', 'Material'] },
  { code: 'Mine', label: 'Plant + Dragon', availableFamilies: ['Plant', 'Dragon'] },
  { code: 'Moon', label: 'Devil + Material', availableFamilies: ['Devil', 'Material'] },
  { code: 'Mound', label: 'Dragon + Undead', availableFamilies: ['Dragon', 'Undead'] },
  { code: 'Mtn.', label: 'Devil + Bird', availableFamilies: ['Devil', 'Bird'] },
  { code: 'Ocean', label: 'Devil + Water', availableFamilies: ['Devil', 'Water'] },
  { code: 'Pit', label: 'Slime + Bug', availableFamilies: ['Slime', 'Bug'] },
  { code: 'Pond', label: 'Water + Bug', availableFamilies: ['Water', 'Bug'] },
  { code: 'River', label: 'Water + Undead', availableFamilies: ['Water', 'Undead'] },
  { code: 'Sea', label: 'Water + Slime', availableFamilies: ['Water', 'Slime'] },
  { code: 'Shore', label: 'Water + Beast', availableFamilies: ['Water', 'Beast'] },
  { code: 'Sky', label: 'Bird + Bug', availableFamilies: ['Bird', 'Bug'] },
  { code: 'Soil', label: 'Bug + Material', availableFamilies: ['Bug', 'Material'] },
  { code: 'Star', label: 'Water + Material', availableFamilies: ['Water', 'Material'] },
  { code: 'Swamp', label: 'Plant + Undead', availableFamilies: ['Plant', 'Undead'] },
  { code: 'Tomb', label: 'Bug + Undead', availableFamilies: ['Bug', 'Undead'] },
  { code: 'Torch', label: 'Slime + Bird', availableFamilies: ['Slime', 'Bird'] },
  { code: 'Tower', label: 'Dragon + Bird', availableFamilies: ['Dragon', 'Bird'] },
  { code: 'View', label: 'Undead + Bird', availableFamilies: ['Undead', 'Bird'] }
];

export const KEY_FAMILY_BY_CODE = new Map(
  KEY_FAMILY_OPTIONS.map((option) => [option.code, option])
);
