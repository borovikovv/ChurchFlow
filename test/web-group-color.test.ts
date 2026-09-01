import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GROUP_COLOR_PRESETS,
  groupForegroundColor,
} from '../apps/web/src/features/groups/lib/group-color.ts';

const DARK = '#111827';
const LIGHT = '#FFFFFF';

function relativeLuminance(color: string): number {
  const hex = color.replace('#', '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const [r, g, b] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(background: string, foreground: string): number {
  const left = relativeLuminance(background);
  const right = relativeLuminance(foreground);

  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

test('a badge foreground is never the lower-contrast of the two candidates', () => {
  const samples = [...GROUP_COLOR_PRESETS, '#22C55E', '#FDE047', '#000000', '#FFFFFF'];

  for (const color of samples) {
    const chosen = groupForegroundColor(color);
    const other = chosen === DARK ? LIGHT : DARK;

    assert.ok(
      contrastRatio(color, chosen) >= contrastRatio(color, other),
      `${color} picked ${chosen} over the more readable ${other}`,
    );
  }
});

test('every preset colour clears the WCAG AA threshold for normal text', () => {
  for (const color of GROUP_COLOR_PRESETS) {
    const ratio = contrastRatio(color, groupForegroundColor(color));
    assert.ok(ratio >= 4.5, `${color} renders at ${ratio.toFixed(2)}:1`);
  }
});

test('a malformed colour still yields a readable foreground', () => {
  assert.equal(groupForegroundColor('nonsense'), LIGHT);
});
