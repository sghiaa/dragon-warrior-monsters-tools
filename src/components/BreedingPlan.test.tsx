import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { BreedingPlan as BreedingPlanType } from '../types/monster';
import { BreedingPlan } from './BreedingPlan';

jest.mock('../data/monsters', () => ({
  getMonsterById: (id: string) => ({
    id,
    name: id,
    family: 'Boss',
    rank: 1,
    hpGrowth: 1,
    mpGrowth: 1,
    attackGrowth: 1,
    defenseGrowth: 1,
    agilityGrowth: 1,
    intelligenceGrowth: 1
  })
}));

jest.mock('../utils/storage', () => ({
  loadPlannerProgress: jest.fn(() => null),
  savePlannerProgress: jest.fn()
}));

const buildPlan = (overrides?: Partial<BreedingPlanType>): BreedingPlanType => ({
  targetMonster: 'darkdrium',
  isPossible: true,
  missingMonsters: [],
  steps: [
    {
      step: 1,
      parent1: 'foo',
      parent2: 'bar',
      result: 'darkdrium',
      needToBreed: true
    }
  ],
  baseRequirements: { Beast: 2, Slime: 1 },
  remainingRequirements: {},
  totalBaseRequired: 3,
  totalRemaining: 0,
  ...overrides
});

describe('BreedingPlan remaining summary', () => {
  const getRemainingLine = () =>
    screen.getByText((_content, node) => {
      if (!node || node.tagName !== 'P') return false;
      return (node.textContent || '').includes('Remaining after owned + checked nodes:');
    });

  it('uses base requirements as fallback when remainingRequirements is empty', () => {
    render(
      <BreedingPlan
        plan={buildPlan()}
        goalStateKey="goal::default"
      />
    );

    const remainingLine = getRemainingLine();
    expect(remainingLine).toHaveTextContent(
      'Remaining after owned + checked nodes: 3 (2 Beast (2 unassigned), 1 Slime (1 unassigned))'
    );
  });

  it('subtracts checked coverage from base requirements even when remainingRequirements is empty', () => {
    render(
      <BreedingPlan
        plan={buildPlan({
          baseRequirements: { Beast: 1, Slime: 1 },
          totalBaseRequired: 2,
          tree: {
            kind: 'monster',
            value: 'darkdrium',
            left: { kind: 'family', value: 'Any Beast' },
            right: { kind: 'family', value: 'Any Slime' }
          }
        })}
        goalStateKey="goal::with-prefill"
        autoAssignment={{
          checkedNodes: ['root.L'],
          checkedNodeGenders: {},
          checkedNodeNames: {}
        }}
      />
    );

    const remainingLine = getRemainingLine();
    expect(remainingLine).toHaveTextContent(
      'Remaining after owned + checked nodes: 1 (1 Slime (1 unassigned))'
    );
  });
});

describe('BreedingPlan tree interactions', () => {
  const buildTreePlan = (): BreedingPlanType => ({
    targetMonster: 'darkdrium',
    isPossible: true,
    missingMonsters: [],
    steps: [
      {
        step: 1,
        parent1: 'left_parent',
        parent2: 'right_parent',
        result: 'darkdrium',
        needToBreed: true
      }
    ],
    baseRequirements: { Beast: 1, Slime: 1 },
    remainingRequirements: { Beast: 1, Slime: 1 },
    totalBaseRequired: 2,
    totalRemaining: 2,
    tree: {
      kind: 'monster',
      value: 'darkdrium',
      left: { kind: 'family', value: 'Any Beast' },
      right: { kind: 'family', value: 'Any Slime' }
    }
  });

  const getNodeByLabel = (label: string) => {
    const textNode = screen.getByText(label);
    return textNode.closest('.tree-node') as HTMLElement;
  };

  it('checks and collapses descendants when a parent node is checked', () => {
    const deepPlan: BreedingPlanType = {
      ...buildTreePlan(),
      tree: {
        kind: 'monster',
        value: 'darkdrium',
        left: {
          kind: 'monster',
          value: 'esterk',
          left: { kind: 'family', value: 'Any Beast' },
          right: { kind: 'family', value: 'Any Slime' }
        },
        right: { kind: 'family', value: 'Any Devil' }
      }
    };

    render(<BreedingPlan plan={deepPlan} goalStateKey="goal::collapse" />);

    expect(screen.getByText('Any Beast')).toBeInTheDocument();
    const esterkCheckbox = screen.getByText('esterk').closest('.tree-check')?.querySelector('input');
    expect(esterkCheckbox).toBeInTheDocument();
    fireEvent.click(esterkCheckbox as Element);

    expect(screen.queryByText('Any Beast')).not.toBeInTheDocument();
    expect(screen.queryByText('Any Slime')).not.toBeInTheDocument();
  });

  it('keeps generic label visible while also showing nickname', () => {
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::nickname" />);

    const beastCheckbox = screen.getByText('Any Beast').closest('.tree-check')?.querySelector('input');
    fireEvent.click(beastCheckbox as Element);

    const nameInput = screen.getByPlaceholderText('Custom label');
    fireEvent.change(nameInput, { target: { value: 'My Beast Slot' } });

    expect(screen.getByText('Any Beast')).toBeInTheDocument();
    expect(screen.getByText('[My Beast Slot]')).toBeInTheDocument();
  });

  it('applies state colors for baseline, inferred opposite, explicit gender, and paired-ready', () => {
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::states" />);

    const beastNode = getNodeByLabel('Any Beast');
    const slimeNode = getNodeByLabel('Any Slime');
    expect(beastNode).toHaveClass('state-baseline');
    expect(slimeNode).toHaveClass('state-baseline');

    const beastCheckbox = screen.getByText('Any Beast').closest('.tree-check')?.querySelector('input');
    fireEvent.click(beastCheckbox as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));

    expect(getNodeByLabel('Any Beast')).toHaveClass('state-male');
    expect(getNodeByLabel('Any Slime')).toHaveClass('state-female');

    const slimeCheckbox = screen.getByText('Any Slime').closest('.tree-check')?.querySelector('input');
    fireEvent.click(slimeCheckbox as Element);
    expect(getNodeByLabel('Any Beast')).toHaveClass('state-paired');
    expect(getNodeByLabel('Any Slime')).toHaveClass('state-paired');
  });
});
