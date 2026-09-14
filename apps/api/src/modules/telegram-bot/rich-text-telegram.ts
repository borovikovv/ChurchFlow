import { RICH_TEXT_ALLOWED_TAGS, RICH_TEXT_ALLOWED_URL_SCHEMES } from '@churchflow/shared';

type RichTextTag = (typeof RICH_TEXT_ALLOWED_TAGS)[number];

type RichTextNode =
  | { kind: 'text'; value: string }
  | { kind: 'element'; tag: RichTextTag; href: string | null; children: RichTextNode[] };

interface RenderOptions {
  marks: boolean;
}

const TAG_PATTERN = /<(\/)?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)\/?>/g;
const HREF_PATTERN = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};
const BLOCK_TAGS = new Set<RichTextTag>(['p', 'ul', 'ol']);
const INLINE_MARK_TAGS: Partial<Record<RichTextTag, string>> = {
  strong: 'b',
  em: 'i',
  u: 'u',
  s: 's',
};
const LIST_INDENT = '  ';

export function richTextToTelegramHtml(value: string): string {
  return richTextToTelegramHtmlBlocks(value).join('\n\n');
}

export function richTextToTelegramHtmlBlocks(value: string): string[] {
  return renderBlocks(parseRichText(value), '', { marks: true });
}

export function richTextToPlainText(value: string): string {
  return richTextToPlainTextBlocks(value).join('\n\n');
}

export function richTextToPlainTextBlocks(value: string): string[] {
  return renderBlocks(parseRichText(value), '', { marks: false });
}

function parseRichText(value: string): RichTextNode[] {
  const root: RichTextNode = { kind: 'element', tag: 'p', href: null, children: [] };
  const stack: Array<Extract<RichTextNode, { kind: 'element' }>> = [root];
  let cursor = 0;

  for (const match of value.matchAll(TAG_PATTERN)) {
    const [raw, closing, rawTag, attributes] = match;
    const index = match.index;
    appendText(stack, value.slice(cursor, index));
    cursor = index + raw.length;

    const tag = rawTag?.toLowerCase();
    if (!isRichTextTag(tag)) continue;

    if (closing) {
      closeElement(stack, tag);
      continue;
    }

    const element: RichTextNode = {
      kind: 'element',
      tag,
      href: tag === 'a' ? safeHref(attributes ?? '') : null,
      children: [],
    };
    current(stack).children.push(element);
    if (tag !== 'br') stack.push(element);
  }

  appendText(stack, value.slice(cursor));

  return root.children;
}

function appendText(stack: Array<Extract<RichTextNode, { kind: 'element' }>>, value: string): void {
  if (!value) return;
  current(stack).children.push({ kind: 'text', value: decodeEntities(value) });
}

function closeElement(
  stack: Array<Extract<RichTextNode, { kind: 'element' }>>,
  tag: RichTextTag,
): void {
  for (let index = stack.length - 1; index > 0; index -= 1) {
    if (stack[index]?.tag === tag) {
      stack.splice(index);
      return;
    }
  }
}

function current(
  stack: Array<Extract<RichTextNode, { kind: 'element' }>>,
): Extract<RichTextNode, { kind: 'element' }> {
  const top = stack[stack.length - 1];
  if (!top) throw new Error('Rich text parser stack is empty');

  return top;
}

function renderBlocks(nodes: RichTextNode[], indent: string, options: RenderOptions): string[] {
  const blocks: string[] = [];
  let inlineRun: RichTextNode[] = [];

  const flushInline = () => {
    if (inlineRun.length === 0) return;
    const text = renderInline(inlineRun, options).trim();
    if (text) blocks.push(text);
    inlineRun = [];
  };

  for (const node of nodes) {
    if (node.kind === 'element' && BLOCK_TAGS.has(node.tag)) {
      flushInline();
      const block =
        node.tag === 'p'
          ? renderInline(node.children, options).trim()
          : renderList(node, indent, options);
      if (block) blocks.push(block);
      continue;
    }

    inlineRun.push(node);
  }
  flushInline();

  return blocks;
}

function renderList(
  list: Extract<RichTextNode, { kind: 'element' }>,
  indent: string,
  options: RenderOptions,
): string {
  const lines: string[] = [];
  let position = 0;

  for (const item of list.children) {
    if (item.kind !== 'element' || item.tag !== 'li') continue;
    position += 1;
    const marker = list.tag === 'ol' ? `${String(position)}.` : '•';
    const { inline, nestedLists } = splitListItem(item.children);
    const text = renderInlineParagraphs(inline, options);
    lines.push(`${indent}${marker} ${text}`.trimEnd());
    for (const nested of nestedLists) {
      const nestedText = renderList(nested, `${indent}${LIST_INDENT}`, options);
      if (nestedText) lines.push(nestedText);
    }
  }

  return lines.join('\n');
}

function splitListItem(children: RichTextNode[]): {
  inline: RichTextNode[];
  nestedLists: Array<Extract<RichTextNode, { kind: 'element' }>>;
} {
  const inline: RichTextNode[] = [];
  const nestedLists: Array<Extract<RichTextNode, { kind: 'element' }>> = [];

  for (const child of children) {
    if (child.kind === 'element' && (child.tag === 'ul' || child.tag === 'ol')) {
      nestedLists.push(child);
    } else {
      inline.push(child);
    }
  }

  return { inline, nestedLists };
}

function renderInlineParagraphs(nodes: RichTextNode[], options: RenderOptions): string {
  return nodes
    .map((node) =>
      node.kind === 'element' && node.tag === 'p'
        ? renderInline(node.children, options).trim()
        : renderInline([node], options),
    )
    .filter(Boolean)
    .join('\n')
    .trim();
}

function renderInline(nodes: RichTextNode[], options: RenderOptions): string {
  return nodes.map((node) => renderInlineNode(node, options)).join('');
}

function renderInlineNode(node: RichTextNode, options: RenderOptions): string {
  if (node.kind === 'text') {
    return options.marks ? escapeTelegramHtml(node.value) : node.value;
  }

  if (node.tag === 'br') return '\n';

  const inner = renderInline(node.children, options);
  if (!options.marks) return inner;

  const mark = INLINE_MARK_TAGS[node.tag];
  if (mark) return `<${mark}>${inner}</${mark}>`;

  if (node.tag === 'a' && node.href) {
    return `<a href="${escapeTelegramAttribute(node.href)}">${inner}</a>`;
  }

  return inner;
}

function safeHref(attributes: string): string | null {
  const match = HREF_PATTERN.exec(attributes);
  const href = decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
  if (!href) return null;

  try {
    const url = new URL(href);
    const scheme = url.protocol.replace(/:$/, '').toLowerCase();

    return RICH_TEXT_ALLOWED_URL_SCHEMES.some((allowed) => allowed === scheme) ? url.href : null;
  } catch {
    return null;
  }
}

function isRichTextTag(tag: string | undefined): tag is RichTextTag {
  return tag !== undefined && RICH_TEXT_ALLOWED_TAGS.some((allowed) => allowed === tag);
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return codePointToString(Number.parseInt(body.slice(2), 16), entity);
    }
    if (body.startsWith('#')) {
      return codePointToString(Number.parseInt(body.slice(1), 10), entity);
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

function codePointToString(codePoint: number, fallback: string): string {
  if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return fallback;

  return String.fromCodePoint(codePoint);
}

export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeTelegramAttribute(value: string): string {
  return escapeTelegramHtml(value).replace(/"/g, '&quot;');
}
