'use client';

import dynamic from 'next/dynamic';

// The chat runtime stays out of the shell bundle until someone opens the assistant.
export const AiAssistantPanelLoader = dynamic(
  () => import('./ai-assistant-panel').then((module) => module.AiAssistantPanel),
  { ssr: false },
);
