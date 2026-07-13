'use client';

import Link from 'next/link';
import { useId, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  TableRowAction,
  TableRowActions,
  tableRowActionClassNameFor,
} from '@/components/ui/table-row-actions';
import {
  deleteOrganizationRequest,
  resendOrganizationRequestNotification,
  resubmitOrganizationRequest,
} from '../actions';
import { requestActionDialogClassName } from './organization-request-actions.styles';
import type {
  LifecycleConfirmationDialogProps,
  OrganizationRequestActionsProps,
} from './organization-request-actions.types';

function LifecycleConfirmationDialog({
  dialogRef,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  error,
  destructive = false,
  onConfirm,
}: LifecycleConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={requestActionDialogClassName}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) event.currentTarget.close();
      }}
      ref={dialogRef}
    >
      <form
        className="grid gap-6 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="grid gap-2 [&_h2]:m-0 [&_h2]:text-xl [&_p]:m-0 [&_p]:text-[var(--muted)]">
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
        {error ? <p className="form-error m-0">{error}</p> : null}
        <div className="flex flex-col-reverse items-stretch justify-end gap-2 md:flex-row md:items-center">
          <Button
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button disabled={pending} type="submit" variant={destructive ? 'danger' : 'primary'}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function OrganizationRequestActions({
  request,
  hasPendingRequest,
  onResubmitted,
  onDeleted,
  onNotificationResult,
}: OrganizationRequestActionsProps) {
  const resubmitDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openDialog = (dialog: HTMLDialogElement | null) => {
    setError(null);
    dialog?.showModal();
  };

  const resubmit = () => {
    setError(null);
    onNotificationResult(null);
    startTransition(async () => {
      const result = await resubmitOrganizationRequest(request.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onResubmitted(result.data.request);
      onNotificationResult(
        result.data.notificationSent
          ? { tone: 'success', text: 'Organization request submitted and admin notified.' }
          : {
              tone: 'warning',
              text: 'Organization request submitted, but admin email notification could not be delivered.',
            },
      );
      resubmitDialogRef.current?.close();
    });
  };

  const deleteRequest = () => {
    setError(null);
    onNotificationResult(null);
    startTransition(async () => {
      const result = await deleteOrganizationRequest(request.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onDeleted(result.data.deletedRequestId);
      deleteDialogRef.current?.close();
    });
  };

  const resendNotification = () => {
    setError(null);
    onNotificationResult(null);
    startTransition(async () => {
      const result = await resendOrganizationRequestNotification(request.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onNotificationResult(
        result.data.notificationSent
          ? { tone: 'success', text: 'Admin notification email sent again.' }
          : {
              tone: 'warning',
              text: 'Request is still saved, but email notification could not be delivered.',
            },
      );
    });
  };

  return (
    <>
      <TableRowActions
        className="group relative justify-self-end"
        label={`Actions for ${request.organizationName}`}
      >
        {request.status === 'PENDING' ? (
          <TableRowAction disabled={pending} onSelect={resendNotification}>
            Resend notification
          </TableRowAction>
        ) : null}
        {request.status === 'APPROVED' && request.createdOrganization ? (
          <Link
            className={`${tableRowActionClassNameFor()} hover:no-underline`}
            href={`/dashboard/${request.createdOrganization.id}`}
          >
            Open dashboard
          </Link>
        ) : null}
        {request.status === 'EXPIRED' ? (
          <>
            <TableRowAction
              disabled={hasPendingRequest}
              onSelect={() => openDialog(resubmitDialogRef.current)}
              title={hasPendingRequest ? 'You already have a pending request' : undefined}
            >
              Submit again
            </TableRowAction>
            <TableRowAction destructive onSelect={() => openDialog(deleteDialogRef.current)}>
              Delete from history
            </TableRowAction>
          </>
        ) : null}
      </TableRowActions>

      <LifecycleConfirmationDialog
        confirmLabel="Submit again"
        description={`Create a new request for ${request.organizationName} using the same details.`}
        dialogRef={resubmitDialogRef}
        error={error}
        onConfirm={resubmit}
        pending={pending}
        pendingLabel="Submitting…"
        title="Submit this request again?"
      />
      <LifecycleConfirmationDialog
        confirmLabel="Delete request"
        description={`Permanently remove the expired request for ${request.organizationName} from your history.`}
        destructive
        dialogRef={deleteDialogRef}
        error={error}
        onConfirm={deleteRequest}
        pending={pending}
        pendingLabel="Deleting…"
        title="Delete this request?"
      />
    </>
  );
}
