// Pure helpers for the mobile agent's Todoist workflow. No network here, so they are unit-tested
// from test/mobile-agent-todoist.test.ts.

export const AGENT_LABELS = Object.freeze({
  mobile: 'mobile',
  manual: 'manual',
  inProgress: 'in-progress',
  blocked: 'blocked',
  review: 'review',
});

const TICKET_ID = /^\s*(M-\d{2,})\b/i;
const DEPENDS_LINE = /^\s*Depends on:(.*)$/im;

export function ticketIdOf(content) {
  const match = TICKET_ID.exec(content ?? '');
  return match ? match[1].toUpperCase() : null;
}

export function dependenciesOf(description) {
  const line = DEPENDS_LINE.exec(description ?? '');
  if (!line) return [];
  return [...line[1].matchAll(/M-\d{2,}/gi)].map((m) => m[0].toUpperCase());
}

function ticketNumber(id) {
  return Number(id.slice(2));
}

/**
 * The tickets the agent may take: open, labelled `mobile`, not manual and not already taken,
 * blocked or waiting for review, and with every dependency closed. A dependency counts as closed
 * when no open task in the project carries its id, because closed tasks are not listed.
 */
export function readyTickets(openTasks) {
  const openIds = new Set(openTasks.map((task) => ticketIdOf(task.content)).filter(Boolean));
  const skip = new Set([
    AGENT_LABELS.manual,
    AGENT_LABELS.inProgress,
    AGENT_LABELS.blocked,
    AGENT_LABELS.review,
  ]);

  return openTasks
    .map((task) => ({ task, id: ticketIdOf(task.content) }))
    .filter(({ task, id }) => {
      if (!id) return false;
      const labels = task.labels ?? [];
      if (!labels.includes(AGENT_LABELS.mobile)) return false;
      if (labels.some((label) => skip.has(label))) return false;
      return dependenciesOf(task.description).every((dep) => !openIds.has(dep));
    })
    .sort((a, b) => ticketNumber(a.id) - ticketNumber(b.id));
}

export function pickTicket(openTasks, requestedId) {
  if (requestedId) {
    const wanted = requestedId.trim().toUpperCase();
    const task = openTasks.find((candidate) => ticketIdOf(candidate.content) === wanted);
    if (!task) return { error: `No open ticket ${wanted} in the project` };
    const ready = readyTickets(openTasks).find((entry) => entry.id === wanted);
    if (!ready)
      return {
        error: `${wanted} is not ready: it is manual, taken, blocked, in review or waits on an open dependency`,
      };
    return ready;
  }
  const [next] = readyTickets(openTasks);
  return next ?? { error: 'No ready mobile ticket' };
}

export function withLabels(labels, add = [], remove = []) {
  const next = new Set(labels ?? []);
  for (const label of remove) next.delete(label);
  for (const label of add) next.add(label);
  return [...next];
}

export function branchNameFor(id, content) {
  const slug = (content ?? '')
    .replace(TICKET_ID, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .reduce(
      (state, word) => {
        if (state.full) return state;
        const next = state.slug ? `${state.slug}-${word}` : word;
        return next.length <= 48 ? { slug: next, full: false } : { slug: state.slug, full: true };
      },
      { slug: '', full: false },
    ).slug;
  return `mobile/${id.toLowerCase()}${slug ? `-${slug}` : ''}`;
}

export function ticketIdFromBranch(branch) {
  const match = /^mobile\/(m-\d{2,})/i.exec(branch ?? '');
  return match ? match[1].toUpperCase() : null;
}
