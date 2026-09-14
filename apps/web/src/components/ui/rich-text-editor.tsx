'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { RICH_TEXT_ALLOWED_URL_SCHEMES } from '@churchflow/shared';
import { isAllowedRichTextUrl, isRichTextEmpty } from '@/lib/rich-text';
import { richTextBodyClassName } from './rich-text-content.styles';
import {
  richTextEditorContentClassName,
  richTextEditorFrameClassName,
  richTextToolbarButtonClassName,
  richTextToolbarClassName,
} from './rich-text-editor.styles';
import type {
  RichTextEditorProps,
  RichTextToolbarAction,
  RichTextToolbarState,
} from './rich-text-editor.types';

const TOOLBAR_ACTIONS: RichTextToolbarAction[] = [
  'bold',
  'italic',
  'underline',
  'strike',
  'bulletList',
  'orderedList',
  'link',
];

const TOOLBAR_GLYPHS: Record<RichTextToolbarAction, string> = {
  bold: 'B',
  italic: 'I',
  underline: 'U',
  strike: 'S',
  bulletList: '•',
  orderedList: '1.',
  link: '🔗',
};

const TOOLBAR_GLYPH_CLASSNAMES: Partial<Record<RichTextToolbarAction, string>> = {
  italic: 'italic',
  underline: 'underline',
  strike: 'line-through',
};

const EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: {
      autolink: true,
      defaultProtocol: 'https',
      openOnClick: false,
      protocols: [...RICH_TEXT_ALLOWED_URL_SCHEMES],
    },
  }),
];

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  id,
  disabled = false,
  invalid = false,
  describedBy,
  minHeightClassName = 'min-h-[120px]',
}: RichTextEditorProps) {
  const t = useTranslations('richTextEditor');
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        'aria-invalid': invalid ? 'true' : 'false',
        'aria-multiline': 'true',
        role: 'textbox',
        class: [richTextBodyClassName, minHeightClassName].join(' '),
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      onChange(isRichTextEmpty(html) ? '' : html);
    },
    onBlur: () => onBlur?.(),
  });
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: instance }) => toolbarStateOf(instance),
  });

  // Tiptap owns its document; push external form resets into it without echoing an update back.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const currentIsEmpty = isRichTextEmpty(current);
    if (current === value || (currentIsEmpty && value === '')) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor || editor.isEditable === !disabled) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const runAction = (action: RichTextToolbarAction) => {
    if (!editor) return;
    if (action === 'link') {
      toggleLink(editor, {
        prompt: t('linkPrompt'),
        invalid: t('invalidLink'),
      });
      return;
    }
    const chain = editor.chain().focus();
    switch (action) {
      case 'bold':
        chain.toggleBold().run();
        return;
      case 'italic':
        chain.toggleItalic().run();
        return;
      case 'underline':
        chain.toggleUnderline().run();
        return;
      case 'strike':
        chain.toggleStrike().run();
        return;
      case 'bulletList':
        chain.toggleBulletList().run();
        return;
      case 'orderedList':
        chain.toggleOrderedList().run();
        return;
    }
  };

  return (
    <div className={richTextEditorFrameClassName({ invalid, disabled })}>
      <div className={richTextToolbarClassName} role="toolbar" aria-label={t('toolbar')}>
        {TOOLBAR_ACTIONS.map((action) => {
          const active = toolbarState?.active[action] ?? false;
          const enabled = action === 'link' ? (toolbarState?.canLink ?? false) : Boolean(editor);
          const label = action === 'link' && active ? t('removeLink') : t(`actions.${action}`);

          return (
            <button
              key={action}
              aria-label={label}
              aria-pressed={active}
              className={richTextToolbarButtonClassName({ active })}
              disabled={disabled || !enabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runAction(action)}
              title={label}
              type="button"
            >
              <span className={TOOLBAR_GLYPH_CLASSNAMES[action]}>{TOOLBAR_GLYPHS[action]}</span>
            </button>
          );
        })}
      </div>
      <EditorContent
        className={[richTextEditorContentClassName, minHeightClassName].join(' ')}
        editor={editor}
      />
    </div>
  );
}

const NO_ACTIONS: Record<RichTextToolbarAction, boolean> = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  bulletList: false,
  orderedList: false,
  link: false,
};

function toolbarStateOf(editor: Editor | null): RichTextToolbarState {
  if (!editor) return { active: NO_ACTIONS, canLink: false };

  return {
    active: {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      link: editor.isActive('link'),
    },
    canLink: editor.isActive('link') || !editor.state.selection.empty,
  };
}

function toggleLink(editor: Editor, messages: { prompt: string; invalid: string }): void {
  if (editor.isActive('link')) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }

  const currentHref: unknown = editor.getAttributes('link')['href'];
  const input = window.prompt(messages.prompt, typeof currentHref === 'string' ? currentHref : '');
  if (input === null) return;

  const href = input.trim();
  if (!href) return;
  if (!isAllowedRichTextUrl(href)) {
    window.alert(messages.invalid);
    return;
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
}
