import { cva } from 'class-variance-authority';

export const aiAssistantMessageClassName = cva('grid max-w-[88%] gap-2 text-sm leading-relaxed', {
  variants: {
    role: {
      user: 'justify-self-end rounded-2xl rounded-br-md bg-[var(--accent)] px-3.5 py-2 text-white',
      assistant: 'justify-self-start text-[var(--foreground)]',
    },
  },
});
