import DOMPurify from 'dompurify';
import {
  RICH_TEXT_ALLOWED_ATTRIBUTES,
  RICH_TEXT_ALLOWED_TAGS,
  RICH_TEXT_ALLOWED_URL_SCHEMES,
} from '@churchflow/shared';

const ALLOWED_URI_PATTERN = new RegExp(`^(?:${RICH_TEXT_ALLOWED_URL_SCHEMES.join('|')}):`, 'i');
const EMPTY_RICH_TEXT_NOISE_PATTERN = /<\/?p>|<br\s*\/?>|&nbsp;|\s/gi;

if (DOMPurify.isSupported) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export function sanitizeRichTextHtml(html: string): string {
  // DOMPurify has no sanitizer without a DOM (server render); callers are client-only widgets.
  if (!DOMPurify.isSupported) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTRIBUTES.a],
    ALLOWED_URI_REGEXP: ALLOWED_URI_PATTERN,
  });
}

export function isRichTextEmpty(html: string): boolean {
  return html.replace(EMPTY_RICH_TEXT_NOISE_PATTERN, '') === '';
}

export function isAllowedRichTextUrl(value: string): boolean {
  return ALLOWED_URI_PATTERN.test(value.trim());
}
