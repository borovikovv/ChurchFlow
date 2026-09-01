export const GROUP_COLOR_PRESETS = [
  '#7C3AED',
  '#2563EB',
  '#0D9488',
  '#B45309',
  '#4F46E5',
  '#059669',
  '#DC2626',
  '#DB2777',
  '#EA580C',
  '#CA8A04',
  '#475569',
  '#0EA5E9',
] as const;

const DARK_FOREGROUND = '#111827';
const LIGHT_FOREGROUND = '#FFFFFF';

/**
 * Group colours are picked freely by the user, so the badge foreground is whichever of the two
 * candidates contrasts more with it. A fixed luminance threshold gets mid-tone colours wrong:
 * white on #0EA5E9 is 2.8:1 where the dark foreground is 6.4:1.
 */
export function groupForegroundColor(color: string): string {
  const luminance = relativeLuminance(color);
  const darkContrast = contrastRatio(luminance, relativeLuminance(DARK_FOREGROUND));
  const lightContrast = contrastRatio(luminance, 1);

  return darkContrast >= lightContrast ? DARK_FOREGROUND : LIGHT_FOREGROUND;
}

function contrastRatio(left: number, right: number): number {
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function relativeLuminance(color: string): number {
  const { red, green, blue } = toRgb(color);
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toRgb(color: string): { red: number; green: number; blue: number } {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return { red: 0, green: 0, blue: 0 };

  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}
