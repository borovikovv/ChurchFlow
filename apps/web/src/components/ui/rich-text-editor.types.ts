export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  id?: string | undefined;
  disabled?: boolean | undefined;
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
  minHeightClassName?: string | undefined;
}

export type RichTextToolbarAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'bulletList'
  | 'orderedList'
  | 'link';

export interface RichTextToolbarState {
  active: Record<RichTextToolbarAction, boolean>;
  canLink: boolean;
}
