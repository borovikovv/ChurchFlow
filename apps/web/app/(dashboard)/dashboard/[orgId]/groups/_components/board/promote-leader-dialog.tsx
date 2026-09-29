'use client';

import { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import type { PendingPromotion } from './board.types';

/** Stays mounted; the board opens it through `dialogRef` when a drop asks for a promotion. */
export function PromoteLeaderDialog({
  dialogRef,
  promotion,
  onConfirm,
  onCancel,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  promotion: PendingPromotion | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('groups.board');
  const commonT = useTranslations('common');

  return (
    <FormDialog
      dialogRef={dialogRef}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            {commonT('cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
              dialogRef.current?.close();
            }}
          >
            {t('promoteConfirm')}
          </Button>
        </>
      }
      title={t('promoteTitle')}
      onClose={onCancel}
    >
      {promotion ? (
        <p className="m-0 text-sm text-[var(--muted)]">
          {t('promoteDescription', { name: promotion.displayName, group: promotion.groupName })}
        </p>
      ) : null}
    </FormDialog>
  );
}
