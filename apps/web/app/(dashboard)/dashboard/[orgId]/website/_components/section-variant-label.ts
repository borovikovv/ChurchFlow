// A section keeps the variant it was stored with, so the editor has to name variants that belong to
// another template, or to none: those have no message of their own and are shown as they are stored.
interface VariantTranslator {
  (key: string): string;
  has(key: string): boolean;
}

export function sectionVariantLabel(t: VariantTranslator, variant: string): string {
  const key = `variants.${variant}`;

  return t.has(key) ? t(key) : variant;
}
