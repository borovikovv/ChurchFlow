import sanitizeHtml from 'sanitize-html';
import {
  RICH_TEXT_ALLOWED_ATTRIBUTES,
  RICH_TEXT_ALLOWED_TAGS,
  RICH_TEXT_ALLOWED_URL_SCHEMES,
} from '@churchflow/shared';

const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
  allowedAttributes: { a: [...RICH_TEXT_ALLOWED_ATTRIBUTES.a] },
  allowedSchemes: [...RICH_TEXT_ALLOWED_URL_SCHEMES],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Dropping the tag but keeping its text would leak script bodies as visible text.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object'],
};

const EMPTY_RICH_TEXT_NOISE_PATTERN = /<\/?p>|<br\s*\/?>|&nbsp;|\s/gi;
const TRAILING_EMPTY_PARAGRAPHS_PATTERN = /(\s*<p>(?:\s|<br\s*\/?>|&nbsp;)*<\/p>)+$/i;

export function sanitizeRichText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;

  const sanitized = sanitizeHtml(value, RICH_TEXT_SANITIZE_OPTIONS)
    .replace(TRAILING_EMPTY_PARAGRAPHS_PATTERN, '')
    .trim();

  return sanitized.replace(EMPTY_RICH_TEXT_NOISE_PATTERN, '') === '' ? null : sanitized;
}
