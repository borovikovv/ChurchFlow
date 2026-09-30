import { cva } from 'class-variance-authority';

export const aiAssistantMessageClassName = cva('grid max-w-[88%] gap-2 text-sm leading-relaxed', {
  variants: {
    role: {
      user: 'justify-self-end rounded-2xl rounded-br-md bg-[var(--accent)] px-3.5 py-2 text-white',
      assistant: 'justify-self-start text-[var(--foreground)]',
    },
  },
});

// The app styles every paragraph as muted text; a message takes the colour of its bubble instead.
export const AI_ASSISTANT_MESSAGE_TEXT_CLASS_NAME =
  'm-0 whitespace-pre-wrap break-words text-inherit';

export const AI_ASSISTANT_THINKING_CLASS_NAME =
  'flex items-center gap-2 justify-self-start rounded-2xl rounded-bl-md bg-[var(--surface-subtle)] px-3.5 py-2 text-sm text-[var(--muted)]';

const THINKING_DOT_CLASS_NAME = 'h-1.5 w-1.5 animate-bounce rounded-full bg-current';

export const AI_ASSISTANT_THINKING_DOT_CLASS_NAMES = [
  `${THINKING_DOT_CLASS_NAME} [animation-delay:-300ms]`,
  `${THINKING_DOT_CLASS_NAME} [animation-delay:-150ms]`,
  THINKING_DOT_CLASS_NAME,
] as const;
