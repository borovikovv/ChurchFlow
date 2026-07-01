'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  deleteOrganizationRequest,
  resubmitOrganizationRequest,
} from '../actions';
import {
  requestActionDialogClassName,
  requestActionMenuItemClassName,
} from './organization-request-actions.styles';
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
}: OrganizationRequestActionsProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const resubmitDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    };

    document.addEventListener('click', closeOnOutsideClick);
    return () => document.removeEventListener('click', closeOnOutsideClick);
  }, []);

  const openDialog = (dialog: HTMLDialogElement | null) => {
    setError(null);
    if (menuRef.current) menuRef.current.open = false;
    dialog?.showModal();
  };

  const resubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await resubmitOrganizationRequest(request.id);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onResubmitted(result.data.request);
      resubmitDialogRef.current?.close();
    });
  };

  const deleteRequest = () => {
    setError(null);
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

  return (
    <>
      <details className="group relative justify-self-end" ref={menuRef}>
        <summary
          className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-[var(--radius)] border border-transparent text-[var(--foreground)] hover:border-[var(--line)] hover:bg-[var(--surface-subtle)] group-open:border-[var(--accent)] group-open:bg-[var(--surface-subtle)] group-open:ring-2 group-open:ring-[rgba(9,105,218,0.15)] [&::-webkit-details-marker]:hidden"
          aria-label={`Actions for ${request.organizationName}`}
        >
          <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
            <circle cx="10" cy="4" r="1.6" />
            <circle cx="10" cy="10" r="1.6" />
            <circle cx="10" cy="16" r="1.6" />
          </svg>
        </summary>
        <div className="absolute top-[calc(100%+6px)] right-0 z-20 min-w-44 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_12px_32px_rgba(31,35,40,0.16)]">
          {request.status === 'APPROVED' && request.createdOrganization ? (
            <Link
              className={requestActionMenuItemClassName}
              href={`/dashboard/${request.createdOrganization.id}`}
            >
              Open dashboard
            </Link>
          ) : null}
          {request.status === 'EXPIRED' ? (
            <>
              <button
                className={requestActionMenuItemClassName}
                disabled={hasPendingRequest}
                onClick={() => openDialog(resubmitDialogRef.current)}
                title={hasPendingRequest ? 'You already have a pending request' : undefined}
                type="button"
              >
                Submit again
              </button>
              <button
                className={`${requestActionMenuItemClassName} !text-[var(--danger)]`}
                onClick={() => openDialog(deleteDialogRef.current)}
                type="button"
              >
                Delete from history
              </button>
            </>
          ) : null}
        </div>
      </details>

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
