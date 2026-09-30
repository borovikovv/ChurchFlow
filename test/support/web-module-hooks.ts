import { existsSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// Web modules import through the `@/` alias and without file extensions, as the Next bundler
// allows, and some reach React components that Node cannot strip. These hooks resolve the alias
// and the extensions, and stand in for .tsx modules with stubs exporting the same names, so pure
// web logic can be tested where it lives. Import this first, then load the modules under test
// with a dynamic import(): static imports are resolved before any module runs.
const WEB_ROOT = new URL('../../apps/web/', import.meta.url);
const WEB_SRC = new URL('src/', WEB_ROOT);
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

function isFile(url: URL): boolean {
  const path = fileURLToPath(url);
  return existsSync(path) && statSync(path).isFile();
}

function withSourceExtension(url: URL): URL {
  if (isFile(url)) return url;

  const candidate = SOURCE_EXTENSIONS.map((extension) => new URL(`${url.href}${extension}`)).find(
    isFile,
  );

  return candidate ?? url;
}

function webSourceUrl(specifier: string, parentUrl: string | undefined): URL | null {
  if (specifier.startsWith('@/')) return new URL(specifier.slice(2), WEB_SRC);
  if (!parentUrl?.startsWith(WEB_ROOT.href)) return null;
  if (specifier.startsWith('./') || specifier.startsWith('../'))
    return new URL(specifier, parentUrl);

  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = webSourceUrl(specifier, context.parentURL);

    return nextResolve(url ? withSourceExtension(url).href : specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx')) return nextLoad(url, context);

    const source = readFileSync(fileURLToPath(url), 'utf8');
    const names = [...source.matchAll(/^export function (\w+)/gm)].map(([, name]) => name);

    return {
      format: 'module',
      shortCircuit: true,
      source: names.map((name) => `export const ${name} = () => null;`).join('\n'),
    };
  },
});
