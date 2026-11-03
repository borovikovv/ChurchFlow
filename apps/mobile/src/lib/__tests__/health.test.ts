import { resolveApiUrl } from '../config';
import { checkApiHealth } from '../health';

function fakeFetch(response: { ok: boolean; body?: unknown } | Error): typeof fetch {
  return (async () => {
    if (response instanceof Error) throw response;
    return { ok: response.ok, json: async () => response.body } as Response;
  }) as typeof fetch;
}

describe('resolveApiUrl', () => {
  it('falls back to the local API', () => {
    expect(resolveApiUrl(undefined)).toBe('http://localhost:4000/v1');
    expect(resolveApiUrl('  ')).toBe('http://localhost:4000/v1');
  });

  it('drops trailing slashes', () => {
    expect(resolveApiUrl('https://api.mychurchflow.org/v1/')).toBe(
      'https://api.mychurchflow.org/v1',
    );
  });
});

describe('checkApiHealth', () => {
  it('reports ok when the API answers status ok', async () => {
    await expect(
      checkApiHealth(fakeFetch({ ok: true, body: { status: 'ok' } }), 'x'),
    ).resolves.toBe('ok');
  });

  it('reports unreachable on an error status, a wrong body or a network failure', async () => {
    await expect(checkApiHealth(fakeFetch({ ok: false }), 'x')).resolves.toBe('unreachable');
    await expect(checkApiHealth(fakeFetch({ ok: true, body: {} }), 'x')).resolves.toBe(
      'unreachable',
    );
    await expect(checkApiHealth(fakeFetch(new Error('offline')), 'x')).resolves.toBe('unreachable');
  });
});
