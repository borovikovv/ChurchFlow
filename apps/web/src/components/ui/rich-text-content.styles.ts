import { cva } from 'class-variance-authority';

export const richTextBodyClassName =
  'whitespace-pre-wrap break-words [&_p]:m-0 [&_p]:text-inherit [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li>p]:m-0 [&_a]:text-[#0969da] [&_a]:underline';

// A preview runs every block into one clamped line, so headings and list items read as plain text.
export const richTextContentClassName = cva('', {
  variants: {
    intent: {
      full: `${richTextBodyClassName} text-[var(--foreground)]`,
      preview:
        "line-clamp-1 break-words text-sm text-[var(--muted)] [&_*]:m-0 [&_*]:inline [&_*]:p-0 [&_*]:font-normal [&_*]:[font-size:inherit] [&_*]:after:content-['_']",
    },
  },
  defaultVariants: {
    intent: 'full',
  },
});
