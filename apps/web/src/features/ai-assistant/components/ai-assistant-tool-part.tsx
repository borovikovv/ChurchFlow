'use client';

import { useTranslations } from 'next-intl';
import { getToolName } from 'ai';
import {
  aiAssistantToolResult,
  aiAssistantToolStatus,
  isAiAssistantToolName,
  isVisibleAiAssistantTool,
  type AiAssistantToolPart as ToolPart,
} from '../lib/tool-parts';
import { AiAssistantConfirmationCard } from './ai-assistant-confirmation-card';
import { AiAssistantEntityLinks } from './ai-assistant-entity-links';
import {
  aiAssistantToolChipClassName,
  aiAssistantToolDotClassName,
} from './ai-assistant-tool-part.styles';

export function AiAssistantToolPart({
  part,
  organizationId,
  onApprovalResponse,
  onNavigate,
}: {
  part: ToolPart;
  organizationId: string;
  onApprovalResponse: (response: { id: string; approved: boolean }) => void;
  onNavigate: () => void;
}) {
  const t = useTranslations('aiAssistant');
  const toolName = getToolName(part);

  if (!isVisibleAiAssistantTool(toolName)) return null;

  const label = isAiAssistantToolName(toolName) ? t(`tools.${toolName}`) : t('tools.unknown');

  if (part.state === 'approval-requested' && !part.approval.isAutomatic) {
    const approvalId = part.approval.id;

    return (
      <AiAssistantConfirmationCard
        reason={part.approval.requestReason ?? label}
        onRespond={(approved) => onApprovalResponse({ id: approvalId, approved })}
      />
    );
  }

  const status = aiAssistantToolStatus(part);
  const result = part.state === 'output-available' ? aiAssistantToolResult(part.output) : null;

  return (
    <div className="grid justify-items-start gap-1.5">
      <span className={aiAssistantToolChipClassName({ status })}>
        <span aria-hidden="true" className={aiAssistantToolDotClassName({ status })} />
        <span className="truncate">{label}</span>
        <span className="sr-only">{t(`toolStatus.${status}`)}</span>
      </span>
      {result && !result.ok ? (
        <p className="m-0 text-xs text-[var(--danger)]">{result.error}</p>
      ) : null}
      {result?.ok && result.links.length > 0 ? (
        <AiAssistantEntityLinks
          links={result.links}
          organizationId={organizationId}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  );
}
