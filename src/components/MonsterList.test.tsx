import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MonsterList } from './MonsterList';

jest.mock('../data/monsters', () => ({
  MONSTERS: [],
  getMonsterById: () => undefined
}));

describe('MonsterList key family highlighting', () => {
  const baseProps = {
    ownedMonsters: [],
    ownedStoryKeyWorlds: [],
    monsterStepCounts: {},
    onOwnedMonsterAdd: jest.fn(),
    onOwnedMonsterRemove: jest.fn(),
    onOwnedKeyAdd: jest.fn(),
    onOwnedKeyRemove: jest.fn(),
    onToggleOwnedStoryKeyWorld: jest.fn()
  };

  it('highlights only keys that contain the selected family and toggles off when clicked again', () => {
    render(
      <MonsterList
        {...baseProps}
        ownedKeys={[
          { id: 'k1', descriptor: 'Plain', family: 'Beast' },
          { id: 'k2', descriptor: 'Blue', family: 'Water' }
        ]}
      />
    );

    const beastCard = screen.getByText('Plain Beast').closest('.key-card');
    const waterCard = screen.getByText('Blue Water').closest('.key-card');
    expect(beastCard).toBeInTheDocument();
    expect(waterCard).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Beast' }));
    expect(beastCard).toHaveClass('highlighted');
    expect(waterCard).toHaveClass('dimmed');

    fireEvent.click(screen.getByRole('button', { name: 'Beast' }));
    expect(beastCard).not.toHaveClass('highlighted');
    expect(waterCard).not.toHaveClass('dimmed');
  });
});
