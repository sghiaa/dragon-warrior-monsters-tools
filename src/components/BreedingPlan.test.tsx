import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BreedingPlan as BreedingPlanType } from '../types/monster';
import { BreedingPlan } from './BreedingPlan';

jest.mock('../data/monsters', () => ({
  getMonsterById: (id: string) => {
    const byId: Record<string, { id: string; name: string; family: string; skills?: string[] }> = {
      darkdrium: { id: 'darkdrium', name: 'darkdrium', family: 'Boss', skills: ['BigBang'] },
      esterk: { id: 'esterk', name: 'esterk', family: 'Slime', skills: ['Bang', 'Bolt'] },
      left_parent: { id: 'left_parent', name: 'left_parent', family: 'Dragon' },
      right_parent: { id: 'right_parent', name: 'right_parent', family: 'Beast' }
    };

    const base = byId[id] || { id, name: id, family: 'Boss' };
    return {
      ...base,
      rank: 1,
      hpGrowth: 1,
      mpGrowth: 1,
      attackGrowth: 1,
      defenseGrowth: 1,
      agilityGrowth: 1,
      intelligenceGrowth: 1
    };
  }
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

  it('caps rendered gender totals to the adjusted remaining requirements', async () => {
    render(
      <BreedingPlan
        plan={buildPlan({
          baseRequirements: { Beast: 2 },
          remainingRequirements: { Beast: 1 },
          totalBaseRequired: 2,
          totalRemaining: 1,
          tree: {
            kind: 'monster',
            value: 'darkdrium',
            left: { kind: 'family', value: 'Any Beast' },
            right: {
              kind: 'monster',
              value: 'esterk',
              left: { kind: 'family', value: 'Any Beast' },
              right: { kind: 'family', value: 'Any Slime' }
            }
          }
        })}
        goalStateKey="goal::cap-gender-totals"
        autoAssignment={{
          checkedNodes: ['root.R.R'],
          checkedNodeGenders: { 'root.L': 'male', 'root.R.L': 'female' },
          checkedNodeNames: {}
        }}
      />
    );

    await waitFor(() => {
      const remainingLine = getRemainingLine();
      expect(remainingLine).toHaveTextContent(
        'Remaining after owned + checked nodes: 1 (1 Beast (1 male))'
      );
    });
  });

  it('renders non-zero remaining from tree leaves when remainingRequirements is empty', () => {
    render(
      <BreedingPlan
        plan={buildPlan({
          baseRequirements: {},
          remainingRequirements: {},
          totalBaseRequired: 0,
          totalRemaining: 0,
          tree: {
            kind: 'monster',
            value: 'darkdrium',
            left: { kind: 'family', value: 'Any Beast' },
            right: { kind: 'family', value: 'Any Slime' }
          }
        })}
        goalStateKey="goal::tree-leaf-fallback"
      />
    );

    const remainingLine = getRemainingLine();
    expect(remainingLine).toHaveTextContent(
      'Remaining after owned + checked nodes: 2 (1 Beast (1 unassigned), 1 Slime (1 unassigned))'
    );
  });

  it('shows male beast remaining when unchecked beast leaf is gender-constrained male', () => {
    render(
      <BreedingPlan
        plan={buildPlan({
          baseRequirements: { Beast: 1 },
          remainingRequirements: {},
          totalBaseRequired: 1,
          totalRemaining: 0,
          tree: {
            kind: 'monster',
            value: 'darkhorn',
            left: { kind: 'family', value: 'Any Beast' },
            right: { kind: 'monster', value: 'dracolord1' }
          }
        })}
        goalStateKey="goal::male-beast-remaining"
        autoAssignment={{
          checkedNodes: [],
          checkedNodeGenders: { 'root.L': 'male' },
          checkedNodeNames: {}
        }}
      />
    );

    const remainingLine = getRemainingLine();
    expect(remainingLine).toHaveTextContent(
      'Remaining after owned + checked nodes: 1 (1 Beast (1 male))'
    );
  });

  it('still shows constrained remaining leaf even when remainingRequirements reports zero', () => {
    render(
      <BreedingPlan
        plan={buildPlan({
          baseRequirements: { Beast: 1 },
          remainingRequirements: { Beast: 0 },
          totalBaseRequired: 1,
          totalRemaining: 0,
          tree: {
            kind: 'monster',
            value: 'darkhorn',
            left: { kind: 'family', value: 'Any Beast' },
            right: { kind: 'monster', value: 'dracolord1' }
          }
        })}
        goalStateKey="goal::male-beast-zero-remaining"
        autoAssignment={{
          checkedNodes: [],
          checkedNodeGenders: { 'root.L': 'male' },
          checkedNodeNames: {}
        }}
      />
    );

    const remainingLine = getRemainingLine();
    expect(remainingLine).toHaveTextContent(
      'Remaining after owned + checked nodes: 1 (1 Beast (1 male))'
    );
  });

  it('keeps male beast remaining when checked sibling branch zeroes family counts', () => {
    render(
      <BreedingPlan
        plan={buildPlan({
          baseRequirements: { Beast: 1, Dragon: 1 },
          remainingRequirements: {},
          totalBaseRequired: 2,
          totalRemaining: 0,
          tree: {
            kind: 'monster',
            value: 'darkhorn',
            left: { kind: 'family', value: 'Any Beast' },
            right: {
              kind: 'monster',
              value: 'dracolord1',
              left: { kind: 'family', value: 'Any Beast' },
              right: { kind: 'family', value: 'Any Dragon' }
            }
          }
        })}
        goalStateKey="goal::sibling-consumption-bug"
        autoAssignment={{
          checkedNodes: ['root.R'],
          checkedNodeGenders: { 'root.R': 'female', 'root.L': 'male' },
          checkedNodeNames: { 'root.R': 'DloF1' }
        }}
      />
    );

    const remainingLine = getRemainingLine();
    expect(remainingLine).toHaveTextContent(
      'Remaining after owned + checked nodes: 1 (1 Beast (1 male))'
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
    const planTree = screen.getByText('Breeding Tree').closest('.plan-tree') as HTMLElement;
    const textNode = within(planTree).getByText(label);
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

  it('renders native move pills on monster nodes with stable family colors when enabled', () => {
    const planWithMonsterLeaf: BreedingPlanType = {
      ...buildTreePlan(),
      tree: {
        kind: 'monster',
        value: 'darkdrium',
        left: { kind: 'monster', value: 'esterk' },
        right: { kind: 'family', value: 'Any Beast' }
      }
    };

    render(<BreedingPlan plan={planWithMonsterLeaf} goalStateKey="goal::native-moves" showNativeMoves />);

    const esterkNode = getNodeByLabel('esterk');
    const bangPill = within(esterkNode).getByText('Bang');
    const boltPill = within(esterkNode).getByText('Bolt');

    expect(bangPill).toHaveClass('stable-family-pill');
    expect(bangPill).toHaveClass('family-slime');
    expect(boltPill).toHaveClass('stable-family-pill');
    expect(boltPill).toHaveClass('family-slime');

    const familyNode = getNodeByLabel('Any Beast');
    expect(within(familyNode).queryByText('Bang')).not.toBeInTheDocument();
  });

  it('shows remaining moves from all uncollapsed monster nodes and removes collapsed branch moves', () => {
    const planWithMoves: BreedingPlanType = {
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
        right: { kind: 'monster', value: 'left_parent' }
      }
    };

    render(<BreedingPlan plan={planWithMoves} goalStateKey="goal::remaining-moves" showNativeMoves />);

    const remainingMovesLine = screen.getByText((_content, node) => {
      if (!node || node.tagName !== 'P') {
        return false;
      }
      return (node.textContent || '').includes('Remaining moves to learn:');
    });

    expect(remainingMovesLine).toHaveTextContent('Remaining moves to learn: 3 (Bang, BigBang, Bolt)');

    const esterkCheckbox = screen.getByText('esterk').closest('.tree-check')?.querySelector('input');
    fireEvent.click(esterkCheckbox as Element);

    expect(remainingMovesLine).toHaveTextContent('Remaining moves to learn: 1 (BigBang)');
  });

  it('enables pair-breed button when both child nodes are checked with opposite genders and emits callback', () => {
    const onBreedPair = jest.fn();
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::pair-breed" onBreedPair={onBreedPair} />);

    const beastCheckbox = screen.getByText('Any Beast').closest('.tree-check')?.querySelector('input');
    fireEvent.click(beastCheckbox as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));

    const slimeCheckbox = screen.getByText('Any Slime').closest('.tree-check')?.querySelector('input');
    fireEvent.click(slimeCheckbox as Element);
    fireEvent.click(screen.getAllByRole('button', { name: 'Female' })[1]);

    const pairButton = screen.getByTestId('breed-pair-root');
    expect(pairButton).toBeEnabled();
    fireEvent.click(pairButton);

    expect(onBreedPair).toHaveBeenCalledTimes(1);
    expect(onBreedPair).toHaveBeenCalledWith(expect.objectContaining({
      resultMonsterId: 'darkdrium',
      left: expect.objectContaining({ path: 'root.L', gender: 'male' }),
      right: expect.objectContaining({ path: 'root.R', gender: 'female' })
    }));
  });

  it('keeps pair-breed button disabled when both child nodes have same gender', () => {
    render(
      <BreedingPlan
        plan={buildTreePlan()}
        goalStateKey="goal::pair-disabled"
        onBreedPair={jest.fn()}
      />
    );

    const beastCheckbox = screen.getByText('Any Beast').closest('.tree-check')?.querySelector('input');
    fireEvent.click(beastCheckbox as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));

    const slimeCheckbox = screen.getByText('Any Slime').closest('.tree-check')?.querySelector('input');
    fireEvent.click(slimeCheckbox as Element);
    fireEvent.click(screen.getAllByRole('button', { name: 'Male' })[1]);

    const pairButton = screen.getByTestId('breed-pair-root');
    expect(pairButton).toBeDisabled();
  });

  it('keeps parent monster baseline when no parent nodes are ready', () => {
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::parent-baseline" />);
    expect(getNodeByLabel('darkdrium')).toHaveClass('state-baseline');
  });

  it('marks parent monster partial-ready when exactly one parent is ready', () => {
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::parent-partial" />);

    const beastCheckbox = screen.getByText('Any Beast').closest('.tree-check')?.querySelector('input');
    fireEvent.click(beastCheckbox as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));

    expect(getNodeByLabel('darkdrium')).toHaveClass('state-parent-partial');
  });

  it('marks parent monster ready when both parents are ready with opposite genders', () => {
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::parent-ready" />);

    const beastCheckbox = screen.getByText('Any Beast').closest('.tree-check')?.querySelector('input');
    fireEvent.click(beastCheckbox as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));

    const slimeCheckbox = screen.getByText('Any Slime').closest('.tree-check')?.querySelector('input');
    fireEvent.click(slimeCheckbox as Element);
    fireEvent.click(screen.getAllByRole('button', { name: 'Female' })[1]);

    expect(getNodeByLabel('darkdrium')).toHaveClass('state-parent-ready');
  });

  it('does not override checked node state with parent-readiness coloring', () => {
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::parent-checked-precedence" />);

    const beastCheckbox = screen.getByText('Any Beast').closest('.tree-check')?.querySelector('input');
    fireEvent.click(beastCheckbox as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Male' }));

    const slimeCheckbox = screen.getByText('Any Slime').closest('.tree-check')?.querySelector('input');
    fireEvent.click(slimeCheckbox as Element);
    fireEvent.click(screen.getAllByRole('button', { name: 'Female' })[1]);

    const planTree = screen.getByText('Breeding Tree').closest('.plan-tree') as HTMLElement;
    const rootCheckbox = within(planTree).getByText('darkdrium').closest('.tree-check')?.querySelector('input');
    fireEvent.click(rootCheckbox as Element);
    fireEvent.click(screen.getAllByRole('button', { name: 'Male' })[0]);

    const rootNode = getNodeByLabel('darkdrium');
    expect(rootNode).toHaveClass('state-male');
    expect(rootNode).not.toHaveClass('state-parent-ready');
    expect(rootNode).not.toHaveClass('state-parent-partial');
  });

  it('shows depth indicator on monster nodes with parents', () => {
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::depth-root" />);
    expect(getNodeByLabel('darkdrium')).toHaveTextContent('Depth: 0');
  });

  it('increments depth down the tree for breedable monster nodes', () => {
    const deepPlan: BreedingPlanType = {
      ...buildTreePlan(),
      tree: {
        kind: 'monster',
        value: 'darkdrium',
        left: {
          kind: 'monster',
          value: 'esterk',
          left: {
            kind: 'monster',
            value: 'left_parent',
            left: { kind: 'family', value: 'Any Beast' },
            right: { kind: 'family', value: 'Any Slime' }
          },
          right: { kind: 'family', value: 'Any Slime' }
        },
        right: { kind: 'family', value: 'Any Devil' }
      }
    };

    render(<BreedingPlan plan={deepPlan} goalStateKey="goal::depth-deep" />);

    expect(getNodeByLabel('darkdrium')).toHaveTextContent('Depth: 0');
    expect(getNodeByLabel('esterk')).toHaveTextContent('Depth: 1');
    expect(getNodeByLabel('left_parent')).toHaveTextContent('Depth: 2');
  });

  it('does not show depth indicator on family leaf nodes', () => {
    render(<BreedingPlan plan={buildTreePlan()} goalStateKey="goal::depth-family" />);
    expect(getNodeByLabel('Any Beast')).not.toHaveTextContent('Depth:');
    expect(getNodeByLabel('Any Slime')).not.toHaveTextContent('Depth:');
  });

  it('keeps depth indicators visible on remaining nodes after branch collapse', () => {
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

    render(<BreedingPlan plan={deepPlan} goalStateKey="goal::depth-collapse" />);
    const esterkCheckbox = screen.getByText('esterk').closest('.tree-check')?.querySelector('input');
    fireEvent.click(esterkCheckbox as Element);

    expect(getNodeByLabel('darkdrium')).toHaveTextContent('Depth: 0');
    expect(getNodeByLabel('esterk')).toHaveTextContent('Depth: 1');
  });
});
