export function normalizePem(value: string): string {
  let normalized = value.trim();
  const quote = normalized[0];

  if ((quote === '"' || quote === "'") && normalized.endsWith(quote)) {
    normalized = normalized.slice(1, -1).trim();
  }

  normalized = normalized.replace(/\\+n/g, '\n').replace(/\r\n?/g, '\n').trim();

  return `${normalized}\n`;
}
