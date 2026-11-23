// EXPO_PUBLIC_* values are inlined into the bundle at build time, so they are public.
// Never put secrets here.
const DEFAULT_API_URL = 'http://localhost:4000/v1';

export function resolveApiUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  return (trimmed ? trimmed : DEFAULT_API_URL).replace(/\/+$/, '');
}

export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);
