#!/usr/bin/env node
/**
 * One Metro per checkout, one fixed port (8081) for the phone and simulator.
 *
 *   npm run metro               Start Metro for this folder on its own port (8082+).
 *   npm run use-metro [name]    Point 8081 at a folder's Metro and relaunch the app.
 *                               name = part of the folder or branch name (e.g. "Tooka", "redesign"),
 *                               or a port. No name = this folder.
 *   npm run metro-list          Show every Metro and which one 8081 points at.
 *
 * Every checkout (the main Tooka folder and each .claude/worktrees/* folder)
 * keeps its own Metro running. A small forwarder on 8081 passes the app's
 * requests to the chosen one, so switching never stops or restarts a Metro.
 * Android reaches 8081 through `adb reverse`; the simulator reaches it directly.
 * State lives in ~/.tooka-metro/state.json, shared by all checkouts.
 */
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const APP_PORT = 8081;
const FIRST_PORT = 8082;
const BUNDLE_ID = 'com.fracspace.tooka';
const DIR = path.join(os.homedir(), '.tooka-metro');
const STATE = path.join(DIR, 'state.json');
// The checkout you run it from (works from any worktree, even one without this file).
const ROOT = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return path.resolve(__dirname, '..');
  }
})();
const ADB = [
  process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools/adb'),
  path.join(os.homedir(), 'Library/Android/sdk/platform-tools/adb'),
].find(p => p && fs.existsSync(p)) || 'adb';

const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch {
    return { folders: {}, target: null };
  }
};
const writeState = s => {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
};

const isListening = port =>
  new Promise(resolve => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });

const nameOf = folder => path.basename(folder);
const branchOf = folder => run('git', ['-C', folder, 'branch', '--show-current']).trim();

/** Read-change-write the shared state with a lock, so two Metros starting together get different ports. */
function updateState(change) {
  fs.mkdirSync(DIR, { recursive: true });
  const lock = path.join(DIR, 'state.lock');
  const until = Date.now() + 5000;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch {
      if (Date.now() > until) fs.rmSync(lock, { recursive: true, force: true }); // stale lock
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try {
    const state = readState();
    const result = change(state);
    writeState(state);
    return result;
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

/** This folder's port, assigned once and kept. */
function portFor(state, folder) {
  if (state.folders[folder]) {
    return state.folders[folder];
  }
  const used = new Set(Object.values(state.folders));
  let port = FIRST_PORT;
  while (used.has(port)) port++;
  state.folders[folder] = port;
  return port;
}

// ─── Forwarder on 8081 ──────────────────────────────────────────────────────

function runProxy() {
  const live = new Set();
  let target = readState().target;
  fs.watchFile(STATE, { interval: 300 }, () => {
    const next = readState().target;
    if (next !== target) {
      target = next;
      // Drop open connections (HMR, debugger) so the app reconnects to the new Metro.
      live.forEach(s => s.destroy());
      live.clear();
    }
  });
  net
    .createServer(client => {
      if (!target) return client.destroy();
      const upstream = net.connect(target, '127.0.0.1');
      live.add(client);
      client.pipe(upstream).pipe(client);
      const close = () => { live.delete(client); client.destroy(); upstream.destroy(); };
      client.on('error', close).on('close', close);
      upstream.on('error', close).on('close', close);
    })
    .on('error', () => process.exit(0)) // another forwarder won the port
    .listen(APP_PORT, () => fs.writeFileSync(path.join(DIR, 'proxy.pid'), String(process.pid)));
}

async function ensureProxy() {
  const pidFile = path.join(DIR, 'proxy.pid');
  const pid = Number(fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8'));
  let ours = false;
  try { ours = pid > 0 && process.kill(pid, 0); } catch {}
  if (ours) return;
  if (await isListening(APP_PORT)) {
    console.error(
      `Port ${APP_PORT} is taken by something else (probably an old "react-native start").\n` +
        `Stop it, then run this again:  lsof -tiTCP:${APP_PORT} -sTCP:LISTEN | xargs kill`,
    );
    process.exit(1);
  }
  fs.mkdirSync(DIR, { recursive: true });
  spawn(process.execPath, [__filename, 'proxy'], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 20 && !(await isListening(APP_PORT)); i++) {
    await new Promise(res => setTimeout(res, 100));
  }
}

// ─── Devices ────────────────────────────────────────────────────────────────

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function relaunchApps() {
  const androids = run(ADB, ['devices'])
    .split('\n')
    .slice(1)
    .filter(l => /\tdevice$/.test(l))
    .map(l => l.split('\t')[0]);
  for (const serial of androids) {
    run(ADB, ['-s', serial, 'reverse', `tcp:${APP_PORT}`, `tcp:${APP_PORT}`]);
    run(ADB, ['-s', serial, 'shell', 'am', 'force-stop', BUNDLE_ID]);
    run(ADB, ['-s', serial, 'shell', 'monkey', '-p', BUNDLE_ID, '-c', 'android.intent.category.LAUNCHER', '1']);
    console.log(`  Android ${serial}: reconnected and relaunched`);
  }
  if (/Booted/.test(run('xcrun', ['simctl', 'list', 'devices', 'booted']))) {
    run('xcrun', ['simctl', 'terminate', 'booted', BUNDLE_ID]);
    run('xcrun', ['simctl', 'launch', 'booted', BUNDLE_ID]);
    console.log('  iOS Simulator: relaunched');
  }
}

// ─── Commands ───────────────────────────────────────────────────────────────

async function start() {
  const { port, target } = updateState(state => {
    const p = portFor(state, ROOT);
    if (!state.target) state.target = p;
    return { port: p, target: state.target };
  });
  await ensureProxy();
  if (await isListening(port)) {
    console.log(`Metro for ${nameOf(ROOT)} is already running on ${port}.`);
    return;
  }
  const active = target === port ? ' (the app is pointed here)' : `  →  npm run use-metro ${nameOf(ROOT)}`;
  console.log(`Metro for ${nameOf(ROOT)} on port ${port}${active}`);
  const metro = spawn('npx', ['react-native', 'start', '--port', String(port), ...process.argv.slice(3)], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  metro.on('exit', code => process.exit(code ?? 0));
}

async function use(query) {
  const state = readState();
  const entries = Object.entries(state.folders);
  const match = !query
    ? entries.find(([f]) => f === ROOT)
    : entries.find(([, p]) => String(p) === query) ||
      entries.find(([f]) => `${nameOf(f)} ${branchOf(f)}`.toLowerCase().includes(query.toLowerCase()));
  if (!match) {
    console.error(`No Metro matches "${query ?? nameOf(ROOT)}". Start one there with: npm run metro`);
    return list();
  }
  const [folder, port] = match;
  if (!(await isListening(port))) {
    console.error(`Metro for ${nameOf(folder)} (port ${port}) isn't running. In that folder run: npm run metro`);
    process.exit(1);
  }
  updateState(s => { s.target = port; });
  await ensureProxy();
  console.log(`8081 → ${nameOf(folder)} (port ${port})`);
  relaunchApps();
}

async function list() {
  const state = readState();
  for (const [folder, port] of Object.entries(state.folders)) {
    const up = (await isListening(port)) ? 'running' : 'stopped';
    const arrow = state.target === port ? '← app' : '';
    console.log(`${String(port).padEnd(6)}${up.padEnd(9)}${nameOf(folder).padEnd(28)}${branchOf(folder).padEnd(38)}${arrow}`);
  }
}

const [cmd, arg] = process.argv.slice(2);
({ proxy: runProxy, start, use: () => use(arg), list })[cmd || 'list']();
