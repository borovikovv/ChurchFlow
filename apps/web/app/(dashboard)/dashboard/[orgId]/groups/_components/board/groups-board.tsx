'use client';

import {
  Background,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTranslations } from 'next-intl';
import type { OrganizationGroupBoardPayload } from '@churchflow/shared';
import type { BoardNode } from './board.types';
import { GroupBoardNodeView } from './group-board-node';
import { GroupsBoardContext } from './groups-board-context';
import { PeopleBoardNodeView } from './people-board-node';
import { PromoteLeaderDialog } from './promote-leader-dialog';
import { useGroupsBoard } from './use-groups-board';

const nodeTypes: NodeTypes = {
  group: GroupBoardNodeView,
  people: PeopleBoardNodeView,
};

interface GroupsBoardProps {
  initialPayload: OrganizationGroupBoardPayload;
  organizationId: string;
}

export function GroupsBoard(props: GroupsBoardProps) {
  return (
    <ReactFlowProvider>
      <GroupsBoardCanvas {...props} />
    </ReactFlowProvider>
  );
}

function GroupsBoardCanvas({ initialPayload, organizationId }: GroupsBoardProps) {
  const t = useTranslations('groups.board');
  const board = useGroupsBoard({ initialPayload, organizationId });
  const { fitView } = useReactFlow<BoardNode>();

  const resetLayout = async () => {
    await board.resetLayout();
    void fitView();
  };

  return (
    <GroupsBoardContext.Provider
      value={{
        organizationId,
        canManage: board.canManage,
        isDragging: board.isDragging,
        pendingMembershipIds: board.pendingMembershipIds,
        startDrag: board.startDrag,
        endDrag: board.endDrag,
        dropOn: board.dropOn,
      }}
    >
      <div className="grid gap-2">
        {board.canManage ? (
          <p className="m-0 text-sm text-[var(--muted)]">{t('dragHint')}</p>
        ) : null}
        {board.error ? <p className="form-error">{board.error}</p> : null}
        <div className="h-[calc(100dvh-260px)] min-h-[560px] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)]">
          <ReactFlow<BoardNode>
            deleteKeyCode={null}
            elementsSelectable={false}
            fitView
            minZoom={0.2}
            nodeTypes={nodeTypes}
            nodes={board.nodes}
            nodesConnectable={false}
            nodesDraggable={board.canManage}
            onNodeDragStop={(_event, _node, draggedNodes) => board.saveDraggedNodes(draggedNodes)}
            onNodesChange={board.onNodesChange}
            onlyRenderVisibleElements
          >
            <Background />
            <Controls showInteractive={false}>
              {board.canManage ? (
                <ControlButton
                  aria-label={t('resetLayout')}
                  title={t('resetLayout')}
                  onClick={() => void resetLayout()}
                >
                  ↺
                </ControlButton>
              ) : null}
            </Controls>
          </ReactFlow>
        </div>
      </div>
      {board.promotion ? (
        <PromoteLeaderDialog
          promotion={board.promotion}
          onCancel={board.cancelPromotion}
          onConfirm={board.confirmPromotion}
        />
      ) : null}
    </GroupsBoardContext.Provider>
  );
}
