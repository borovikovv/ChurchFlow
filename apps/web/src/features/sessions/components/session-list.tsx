'use client';

import type { UserSession } from '@churchflow/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { revokeOtherSessions, revokeSession } from '../server/actions';
import { formatLastUsed } from '../last-used';

export function SessionList({ sessions, locale }: { sessions: UserSession[]; locale: string }) {
  const t = useTranslations('sessions');
  const router = useRouter();
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const otherSessionCount = sessions.filter((session) => !session.current).length;

  async function handleRevoke(sessionId: string) {
    setPendingSessionId(sessionId);
    try {
      const result = await revokeSession(sessionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t('revoked'));
      router.refresh();
    } finally {
      setPendingSessionId(null);
    }
  }

  async function handleRevokeOthers() {
    setRevokingOthers(true);
    try {
      const result = await revokeOtherSessions();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t('revokedOthers', { count: result.data.revokedCount }));
      router.refresh();
    } finally {
      setRevokingOthers(false);
    }
  }

  return (
    <div className="stack">
      <ul className="stack list-none p-0">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
          >
            <div className="stack gap-1">
              <span className="font-medium">
                {session.deviceName ?? t('unknownDevice')}
                {session.current ? ` — ${t('currentDevice')}` : ''}
              </span>
              <span className="text-sm opacity-70">
                {formatLastUsed(session, locale, {
                  never: t('neverUsed'),
                  lastUsed: (value) => t('lastUsed', { value }),
                })}
                {session.ipAddress ? ` · ${session.ipAddress}` : ''}
              </span>
            </div>
            {session.current ? null : (
              <Button
                variant="danger"
                type="button"
                disabled={pendingSessionId === session.id || revokingOthers}
                onClick={() => void handleRevoke(session.id)}
              >
                {pendingSessionId === session.id ? t('signingOut') : t('signOutDevice')}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {otherSessionCount > 0 ? (
        <div>
          <Button
            variant="secondary"
            type="button"
            disabled={revokingOthers || pendingSessionId !== null}
            onClick={() => void handleRevokeOthers()}
          >
            {revokingOthers ? t('signingOut') : t('signOutOthers', { count: otherSessionCount })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
