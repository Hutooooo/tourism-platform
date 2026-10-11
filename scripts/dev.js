'use strict';

/**
 * Runs the API and the Vite dev server together so `npm run dev` at the
 * repo root is the only command needed during development.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const procs = [
  { name: 'server', cwd: path.join(root, 'server'), args: ['run', 'dev'] },
  { name: 'client', cwd: path.join(root, 'client'), args: ['run', 'dev'] },
];

const children = [];
let shuttingDown = false;

function start({ name, cwd, args }) {
  const child = spawn('npm', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: process.platform === 'win32',
  });

  const prefix = (line) => `[${name}] ${line}`;
  const pipe = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(`${prefix(line)}\n`);
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    process.stdout.write(`[dev] ${name} exited (${signal || code}); shutting down.\n`);
    shutdown(typeof code === 'number' ? code : 1);
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const proc of procs) start(proc);
process.stdout.write('[dev] API on http://localhost:4000 — client on http://localhost:5173\n');
