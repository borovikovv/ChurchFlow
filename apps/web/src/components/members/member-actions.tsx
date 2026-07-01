'use client';

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button';
import { PhoneInputField } from '@/components/ui/phone-input-field';
import { StatusBadge } from '@/components/ui/status-badge';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
type FormAction = (formData: FormData) => void | Promise<void>;

export interface RoleUpdateState {
  role: OrganizationRole;
  updated: boolean;
  version: number;
  error: string | null;
}

type RoleUpdateAction = (
  state: RoleUpdateState,
  formData: FormData,
) => Promise<RoleUpdateState>;

const roleUpdatedEvent = 'churchflow:member-role-updated';

const actionItemClassName =
  'flex min-h-[38px] w-full cursor-pointer items-center justify-start gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left font-medium text-[var(--foreground)] shadow-none hover:bg-[var(--surface-subtle)]';

interface EditableMember {
  id: string;
  role: OrganizationRole;
  accountState: string;
  profile: {
    displayName: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
  };
  activeClaim: {
    id: string;
    status: 'PENDING' | 'REQUESTED';
  } | null;
}

function MenuIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

function EditMemberSheet({
  member,
  organizationId,
  action,
}: {
  member: EditableMember;
  organizationId: string;
  action: FormAction;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        className={actionItemClassName}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <MenuIcon>
          <path d="M4 20h4l11-11-4-4L4 16v4Zm9-13 4 4M13 5l2-2 4 4-2 2" />
        </MenuIcon>
        Edit member
      </button>
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[480px] border-0 border-l border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[-16px_0_48px_rgba(31,35,40,0.18)] backdrop:bg-[rgba(31,35,40,0.45)]"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        ref={dialogRef}
      >
        <form action={action} className="grid h-full grid-rows-[auto_1fr_auto]">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--line-muted)] p-6 [&_h2]:m-0 [&_p]:m-0">
            <div>
              <p>Edit profile</p>
              <h2 id={titleId}>{member.profile.displayName}</h2>
            </div>
            <button
              aria-label="Close edit member panel"
              className="h-8 w-8 cursor-pointer rounded-[var(--radius)] border-0 bg-transparent text-2xl text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="flex flex-col gap-[18px] overflow-y-auto p-6">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="membershipId" value={member.id} />
            <label>
              Name
              <input name="displayName" defaultValue={member.profile.displayName} required />
            </label>
            <label>
              Email
              <input name="email" type="email" defaultValue={member.profile.email ?? ''} />
            </label>
            <label>
              Phone
              <PhoneInputField
                name="phone"
                {...(member.profile.phone ? { defaultValue: member.profile.phone } : {})}
              />
            </label>
            <label>
              Notes
              <textarea name="notes" rows={5} defaultValue={member.profile.notes ?? ''} />
            </label>
          </div>
          <footer className="flex justify-end gap-2 border-t border-[var(--line-muted)] bg-[var(--surface)] px-6 py-4">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

function ChangeRoleDialog({
  member,
  organizationId,
  action,
}: {
  member: EditableMember;
  organizationId: string;
  action: RoleUpdateAction;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(action, {
    role: member.role,
    updated: false,
    version: 0,
    error: null,
  });

  useEffect(() => {
    if (!state.updated) return;

    window.dispatchEvent(
      new CustomEvent(roleUpdatedEvent, {
        detail: { membershipId: member.id, role: state.role },
      }),
    );
    dialogRef.current?.close();
  }, [member.id, state.role, state.updated, state.version]);

  return (
    <>
      <button
        className={actionItemClassName}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <MenuIcon>
          <path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M18 8h4m-2-2v4" />
        </MenuIcon>
        Change role
      </button>
      <dialog
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100%-32px))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[0_16px_48px_rgba(31,35,40,0.2)] backdrop:bg-[rgba(31,35,40,0.45)] backdrop:backdrop-blur-[1px]"
        ref={dialogRef}
      >
        <form action={formAction} className="grid gap-6 p-6">
          <div className="grid gap-2 [&_h2]:m-0 [&_h2]:text-xl [&_p]:m-0 [&_p]:text-[var(--muted)]">
            <h2 id={titleId}>Change member role</h2>
            <p>Choose the organization access level for {member.profile.displayName}.</p>
          </div>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="membershipId" value={member.id} />
          {state.error ? <p className="form-error m-0">{state.error}</p> : null}
          <label>
            Role
            <select name="role" defaultValue={member.role}>
              {member.accountState === 'CLAIMED' ? (
                <>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                </>
              ) : null}
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </label>
          <div className="flex flex-col-reverse items-stretch justify-end gap-2 md:flex-row md:items-center">
            <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? 'Updating…' : 'Update role'}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function MemberRoleStatus({
  membershipId,
  role,
}: {
  membershipId: string;
  role: OrganizationRole;
}) {
  const [currentRole, setCurrentRole] = useState(role);

  useEffect(() => {
    const updateRole = (event: Event) => {
      const { membershipId: updatedMembershipId, role: updatedRole } = (
        event as CustomEvent<{ membershipId: string; role: OrganizationRole }>
      ).detail;

      if (updatedMembershipId === membershipId) setCurrentRole(updatedRole);
    };

    window.addEventListener(roleUpdatedEvent, updateRole);
    return () => window.removeEventListener(roleUpdatedEvent, updateRole);
  }, [membershipId]);

  return <StatusBadge status={currentRole} />;
}

export function MemberActions({
  member,
  organizationId,
  canManage,
  isOwner,
  isCurrentMember,
  updateProfile,
  updateRole,
  removeMember,
  generateClaim,
  claimAction,
}: {
  member: EditableMember;
  organizationId: string;
  canManage: boolean;
  isOwner: boolean;
  isCurrentMember: boolean;
  updateProfile: FormAction;
  updateRole: RoleUpdateAction;
  removeMember: FormAction;
  generateClaim: FormAction;
  claimAction: FormAction;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    };
    document.addEventListener('click', closeOnOutsideClick);
    return () => document.removeEventListener('click', closeOnOutsideClick);
  }, []);

  if (!canManage && !isOwner) return null;

  return (
    <details
      className="group relative col-start-2 row-start-1 row-end-[span_4] self-start justify-self-end md:col-auto md:row-auto md:self-auto"
      ref={menuRef}
    >
      <summary
        className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-[var(--radius)] border border-transparent text-[var(--foreground)] hover:border-[var(--line)] hover:bg-[var(--surface-subtle)] group-open:border-[var(--accent)] group-open:bg-[var(--surface-subtle)] group-open:ring-2 group-open:ring-[rgba(9,105,218,0.15)] [&::-webkit-details-marker]:hidden"
        aria-label={`Actions for ${member.profile.displayName}`}
      >
        <svg aria-hidden="true" className="h-5 w-5 fill-current" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </summary>
      <div className="absolute top-[calc(100%+6px)] right-0 z-10 w-[220px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_12px_32px_rgba(31,35,40,0.16)]">
        {canManage ? (
          <EditMemberSheet member={member} organizationId={organizationId} action={updateProfile} />
        ) : null}
        {isOwner ? (
          <ChangeRoleDialog member={member} organizationId={organizationId} action={updateRole} />
        ) : null}
        {canManage && member.accountState === 'UNCLAIMED' ? (
          <form className="contents" action={generateClaim}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="membershipId" value={member.id} />
            <button className={actionItemClassName} type="submit">
              <MenuIcon><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" /></MenuIcon>
              Give app access
            </button>
          </form>
        ) : null}
        {canManage && member.activeClaim ? (
          <form className="contents" action={claimAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="claimId" value={member.activeClaim.id} />
            {member.activeClaim.status === 'REQUESTED' ? (
              <>
                <button className={actionItemClassName} name="action" value="approve" type="submit">Approve access</button>
                <button className={`${actionItemClassName} !text-[var(--danger)]`} name="action" value="reject" type="submit">Reject request</button>
              </>
            ) : (
              <button className={actionItemClassName} name="action" value="refresh" type="submit">Refresh access link</button>
            )}
            <button className={`${actionItemClassName} !text-[var(--danger)]`} name="action" value="revoke" type="submit">Revoke access link</button>
          </form>
        ) : null}
        {isOwner && !isCurrentMember ? (
          <form className="contents" action={removeMember}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="membershipId" value={member.id} />
            <ConfirmSubmitButton
              confirmLabel="Remove member"
              confirmVariant="danger"
              description={`Remove ${member.profile.displayName} from this organization.`}
              title="Remove member?"
              triggerClassName={`${actionItemClassName} !text-[var(--danger)]`}
              triggerLabel="Remove member"
              variant="ghost"
            />
          </form>
        ) : null}
      </div>
    </details>
  );
}
