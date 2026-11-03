#!/usr/bin/env node
// Todoist side of the mobile agent workflow (.github/workflows/mobile-agent.yml).
//
//   node scripts/mobile-agent/todoist.mjs pick [M-04]         → writes .mobile-agent/ticket.json
//   node scripts/mobile-agent/todoist.mjs label <taskId> +in-progress -blocked
//   node scripts/mobile-agent/todoist.mjs comment <taskId> <text>
//   node scripts/mobile-agent/todoist.mjs close-for-branch <branch>
//
// Needs TODOIST_API_TOKEN and TODOIST_PROJECT_ID. Uses the Todoist API v1.
import { mkdirSync, writeFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import {
  branchNameFor,
  pickTicket,
  ticketIdFromBranch,
  ticketIdOf,
  withLabels,
} from './todoist-core.mjs';

const API = 'https://api.todoist.com/api/v1';

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function todoist(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env('TODOIST_API_TOKEN')}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(
      `Todoist ${method} ${path} failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.status === 204 ? null : response.json();
}

async function openTasks() {
  const projectId = env('TODOIST_PROJECT_ID');
  const tasks = [];
  let cursor = null;
  do {
    const query = new URLSearchParams({ project_id: projectId, limit: '200' });
    if (cursor) query.set('cursor', cursor);
    const page = await todoist(`tasks?${query}`);
    tasks.push(...page.results);
    cursor = page.next_cursor;
  } while (cursor);
  return tasks;
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function updateLabels(taskId, changes) {
  const task = await todoist(`tasks/${taskId}`);
  const add = changes.filter((c) => c.startsWith('+')).map((c) => c.slice(1));
  const remove = changes.filter((c) => c.startsWith('-')).map((c) => c.slice(1));
  await todoist(`tasks/${taskId}`, {
    method: 'POST',
    body: { labels: withLabels(task.labels, add, remove) },
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === 'pick') {
    const picked = pickTicket(await openTasks(), args[0]);
    if (picked.error) {
      console.log(picked.error);
      setOutput('found', 'false');
      return;
    }
    const { task, id } = picked;
    const ticket = {
      id,
      taskId: task.id,
      title: task.content,
      description: task.description ?? '',
      url: `https://app.todoist.com/app/task/${task.id}`,
      branch: branchNameFor(id, task.content),
    };
    mkdirSync('.mobile-agent', { recursive: true });
    writeFileSync('.mobile-agent/ticket.json', `${JSON.stringify(ticket, null, 2)}\n`);
    console.log(`Picked ${ticket.title}`);
    setOutput('found', 'true');
    setOutput('id', ticket.id);
    setOutput('task_id', ticket.taskId);
    setOutput('branch', ticket.branch);
    return;
  }

  if (command === 'label') {
    const [taskId, ...changes] = args;
    await updateLabels(taskId, changes);
    return;
  }

  if (command === 'comment') {
    const [taskId, ...words] = args;
    await todoist('comments', {
      method: 'POST',
      body: { task_id: taskId, content: words.join(' ') },
    });
    return;
  }

  if (command === 'close-for-branch') {
    const id = ticketIdFromBranch(args[0]);
    if (!id) {
      console.log(`Branch ${args[0]} is not a mobile ticket branch`);
      return;
    }
    const task = (await openTasks()).find((candidate) => ticketIdOf(candidate.content) === id);
    if (!task) {
      console.log(`${id} is already closed`);
      return;
    }
    await updateLabels(task.id, ['-review', '-in-progress', '-blocked']);
    await todoist(`tasks/${task.id}/close`, { method: 'POST' });
    console.log(`Closed ${task.content}`);
    return;
  }

  throw new Error(`Unknown command: ${command ?? '(none)'}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
