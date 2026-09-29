'use client';

import { createContext, useContext } from 'react';
import type { BoardDragSource, BoardDropTarget } from './board.types';

/** React Flow renders the nodes itself, so they reach the board state through context. */
export interface GroupsBoardContextValue {
  organizationId: string;
  canManage: boolean;
  isDragging: boolean;
  pendingMembershipIds: ReadonlySet<string>;
  startDrag: (source: BoardDragSource) => void;
  endDrag: () => void;
  dropOn: (target: BoardDropTarget, copy: boolean) => void;
}

export const GroupsBoardContext = createContext<GroupsBoardContextValue | null>(null);

export function useGroupsBoardContext(): GroupsBoardContextValue {
  const value = useContext(GroupsBoardContext);
  if (!value) throw new Error('useGroupsBoardContext must be used inside GroupsBoardContext');

  return value;
}
