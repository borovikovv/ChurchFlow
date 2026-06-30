'use client';

import { useState } from 'react';

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <div className="actions inline">
      <input aria-label="Invitation link" readOnly value={value} />
      <button className="button secondary" type="button" onClick={copy}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
