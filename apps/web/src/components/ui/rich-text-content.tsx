'use client';

import type { VariantProps } from 'class-variance-authority';
import { sanitizeRichTextHtml } from '@/lib/rich-text';
import { richTextContentClassName } from './rich-text-content.styles';

export function RichTextContent({
  html,
  className,
  intent,
}: {
  html: string;
  className?: string;
} & VariantProps<typeof richTextContentClassName>) {
  return (
    <div
      className={richTextContentClassName({ intent, className })}
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}
    />
  );
}
