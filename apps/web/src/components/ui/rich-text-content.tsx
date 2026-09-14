'use client';

import { sanitizeRichTextHtml } from '@/lib/rich-text';
import { richTextBodyClassName } from './rich-text-content.styles';

export function RichTextContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={[richTextBodyClassName, 'text-[var(--foreground)]', className]
        .filter(Boolean)
        .join(' ')}
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}
    />
  );
}
