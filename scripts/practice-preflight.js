'use strict';

// =============================================================================
// PRACTICE MODE LAUNCHER (preflight + boot)
//   `npm run practice` runs THIS script. On a clean preflight it spawns firebase
//   ITSELF (see launchFirebase) instead of an npm `&&` chain — gate 4d: under
//   cmd.exe that chained `... && firebase emulators:exec "node ..."` died emitting
//   ZERO output on Blake's shell. A node-spawned child (firebase's JS run directly
//   via node — no shell, no `&&`, no nested quoting, no `.cmd` wrapper) with a loud
//   always-print exit handler CANNOT die silently. Job: never fail silently.
//
// The thing that actually bit Blake: he installed JDK 21 mid-session, but a
// terminal / VS Code window opened BEFORE that can't see Java on its PATH, so
// `firebase emulators:exec` aborts with a one-line "Could not spawn java -version"
// that's easy to miss. This preflight checks the real failure causes up front
// (Java visible + new enough, the four ports free, the Functions deps present,
// the Firebase CLI installed) and, on any problem, prints a plain-English fix
// and exits 1 so firebase never even starts. ASCII-only so nothing mojibakes.
// =============================================================================

const { spawn, spawnSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..'); // the Current Version dir (firebase.json lives here)

const MIN_JAVA = 21; // the Firestore/Auth emulators reject older Java
const PORTS = [
  { port: 8765, who: 'the practice web server' },
  { port: 8080, who: 'the Firestore emulator' },
  { port: 9099, who: 'the Auth emulator' },
  { port: 5001, who: 'the Functions emulator' },
  { port: 9199, who: 'the Storage emulator' },   // gate 12 — image uploads
];
const FUNCTIONS_DIR = path.join(__dirname, '..', 'functions');

const problems = []; // { title, fix }
function pass(label) { console.log('  [OK] ' + label); }
function fail(label, title, fix) { console.log('  [X]  ' + label); problems.push({ title, fix }); }

// Resolve Java the same way firebase-tools does: JAVA_HOME first, then PATH.
function detectJavaMajor() {
  const candidates = [];
  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'));
  }
  candidates.push('java'); // bare name -> resolved off PATH
  for (const cmd of candidates) {
    const isBare = (cmd === 'java');
    if (!isBare && !fs.existsSync(cmd)) continue;
    // `java -version` prints to stderr. Pass ONE shell string (not args + shell:true)
    // to dodge Node's DEP0190 warning; quote the JAVA_HOME path in case it has spaces.
    const invocation = isBare ? 'java -version' : '"' + cmd + '" -version';
    const r = spawnSync(invocation, { shell: true, encoding: 'utf8' });
    const text = String(r.stdout || '') + String(r.stderr || '');
    const m = text.match(/version "(\d+)(?:\.(\d+))?/);
    if (m) return (m[1] === '1' && m[2]) ? parseInt(m[2], 10) : parseInt(m[1], 10); // "1.8" -> 8
  }
  return null;
}

function firebaseCliPresent() {
  // Detect by OUTPUT + PATH-resolvability, NOT exit status. firebase is a .cmd
  // wrapper, so shell:true is required (the Bug-10 note in mode1-server.js). On
  // some shells `firebase --version` PRINTS the version but returns a non-zero/null
  // exit code (update nag / node-engine warning / cmd-wrapper quirk); the old
  // `status === 0` gate false-negatived a perfectly-present CLI (gate 4c). The Java
  // check above already detects by output, which is why it stayed correct.
  const r = spawnSync('firebase --version', { shell: true, encoding: 'utf8' });
  if (/\d+\.\d+\.\d+/.test(String(r.stdout || '') + String(r.stderr || ''))) return true;
  // fallback: is it resolvable on PATH by the same shell the npm script will use?
  const w = spawnSync(process.platform === 'win32' ? 'where firebase' : 'command -v firebase',
    { shell: true, encoding: 'utf8' });
  return Boolean(String(w.stdout || '').trim());
}

function portInUse(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', (e) => resolve(e && e.code === 'EADDRINUSE'));
    srv.once('listening', () => srv.close(() => resolve(false)));
    srv.listen(port, '127.0.0.1');
  });
}

// ---- launch (only after a clean preflight) ---------------------------------
// Resolve firebase's JS entry so we can run it with `node` directly: NO shell,
// NO `&&` chain, NO cmd nested-quoting, NO `.cmd` wrapper — the layer the gate-4d
// silent death lived in. The inner command is passed as ONE argv element, so it
// needs no quoting.
function resolveFirebaseJs() {
  const tries = [];
  if (process.env.APPDATA) tries.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js'));
  try {
    const r = spawnSync('npm root -g', { shell: true, encoding: 'utf8' });
    const groot = String(r.stdout || '').trim();
    if (groot) tries.push(path.join(groot, 'firebase-tools', 'lib', 'bin', 'firebase.js'));
  } catch (_) {}
  return tries.find((c) => { try { return fs.existsSync(c); } catch (_) { return false; } }) || null;
}

function loud(title, body) {
  const bar = '='.repeat(66);
  console.error('\n' + bar);
  console.error('  ' + title);
  console.error(bar);
  console.error('  ' + body);
  console.error(bar + '\n');
}

function launchFirebase() {
  const EXEC = ['emulators:exec', '--only', 'auth,firestore,functions,storage',
    '--project', 'real-anime-reviews', 'node scripts/practice-serve.js'];
  const fbjs = resolveFirebaseJs();
  const started = Date.now();
  let child;
  if (fbjs) {
    // BEST PATH: node <firebase.js> ...  (real .exe, shell:false, clean argv)
    child = spawn(process.execPath, [fbjs].concat(EXEC), { cwd: ROOT, stdio: 'inherit' });
  } else {
    // Fallback (firebase not resolvable as a JS path): shell-invoke the .cmd
    // wrapper (shell:true required). Still wrapped by the exit handler below, so
    // even this path can never die silently.
    console.error('  (could not resolve the Firebase CLI as a JS entry -- using the shell wrapper)');
    const line = 'firebase emulators:exec --only auth,firestore,functions,storage --project real-anime-reviews "node scripts/practice-serve.js"';
    child = spawn(line, { cwd: ROOT, shell: true, stdio: 'inherit' });
  }
  child.on('error', (err) => {
    loud('PRACTICE MODE could not start firebase.',
      'Error: ' + err.message + '\n       Is the Firebase CLI installed?  npm install -g firebase-tools');
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    if (signal || code === 0) { console.log('\n  Practice mode stopped.\n'); process.exit(0); }
    if (Date.now() - started < 12000) {
      // exited fast + non-zero => aborted BEFORE the sandbox was ready. THIS is the
      // gate-4d silent death, now made LOUD (the exit code + firebase's own output,
      // which already printed above because stdio was inherited).
      loud('PRACTICE MODE could not start (firebase exited with code ' + code + ' before it was ready).',
        'Look just above for firebase\'s own error. Most common cause: a stale\n'
        + '       emulator still holding a port (close other terminals), or a Java /\n'
        + '       firebase problem. Then run again:  npm run practice');
      process.exit(code || 1);
    }
    console.log('\n  Practice mode stopped.\n'); // ran a while, then exited (e.g. Ctrl-C)
    process.exit(code || 0);
  });
}

(async () => {
  console.log('\nPractice-mode preflight -- making sure your sandbox can boot:\n');

  // 1) Firebase CLI
  if (firebaseCliPresent()) {
    pass('Firebase CLI installed');
  } else {
    fail('Firebase CLI installed',
      'The Firebase command-line tool is not visible to this terminal.',
      'Install it once with:\n         npm install -g firebase-tools\n       then run  npm run practice  again.');
  }

  // 2) Java (the #1 cause of the "nothing happened" exit)
  const major = detectJavaMajor();
  if (major === null) {
    fail('Java visible to this terminal',
      'Java is not visible to THIS terminal (the emulators cannot start without it).',
      'Most likely this terminal / VS Code window was opened BEFORE Java was\n'
      + '       installed, so it cannot see it yet. FIX: close VS Code completely\n'
      + '       (every window), reopen it, then run  npm run practice  again.\n'
      + '       Confirm it worked first by running:  java -version  (should say 21.x)');
  } else if (major < MIN_JAVA) {
    fail('Java new enough (need ' + MIN_JAVA + '+)',
      'Java ' + major + ' is too old -- the Firestore/Auth emulators need Java ' + MIN_JAVA + ' or newer.',
      'Install a newer JDK (Temurin ' + MIN_JAVA + ' LTS), make sure it is first on your\n'
      + '       PATH, then close + reopen VS Code and run  npm run practice  again.');
  } else {
    pass('Java visible (version ' + major + ')');
  }

  // 3) The four ports
  for (const { port, who } of PORTS) {
    if (await portInUse(port)) {
      fail('Port ' + port + ' free (' + who + ')',
        'Port ' + port + ' (' + who + ') is already in use.',
        'A previous practice run is probably still alive. Close any other terminal\n'
        + '       running practice mode, then try again. To force-free it right now:\n'
        + '         Get-NetTCPConnection -LocalPort ' + port + ' | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }');
    } else {
      pass('Port ' + port + ' free (' + who + ')');
    }
  }

  // 4) Functions deps (practice-serve.js loads firebase-admin from functions/)
  if (fs.existsSync(path.join(FUNCTIONS_DIR, 'node_modules', 'firebase-admin'))) {
    pass('Functions dependencies installed');
  } else {
    fail('Functions dependencies installed',
      'The Cloud Functions dependencies are not installed.',
      'Install them once with:\n         cd functions\n         npm install\n         cd ..\n'
      + '       then run  npm run practice  again.');
  }

  if (problems.length === 0) {
    console.log('\n  All checks passed -- starting the practice sandbox now.');
    console.log('  This takes about 15-20 seconds. WAIT for the big "PRACTICE MODE READY"');
    console.log('  banner, then open:  http://127.0.0.1:8765/?emu=1\n');
    launchFirebase();   // spawn firebase ourselves (no npm `&&` chain) + a loud exit handler
    return;             // do NOT exit -- stay alive as firebase's parent process
  }

  // Loud, unmissable failure block (stderr = always shown, never buffered away)
  const bar = '='.repeat(66);
  console.error('\n' + bar);
  console.error('  PRACTICE MODE CANNOT START YET -- ' + problems.length + ' thing(s) to fix:');
  console.error(bar);
  problems.forEach((p, i) => {
    console.error('\n  ' + (i + 1) + ') ' + p.title);
    console.error('       ' + p.fix);
  });
  console.error('\n' + bar);
  console.error('  Fix the item(s) above, then run:  npm run practice');
  console.error('  (Any "npm ERR!" lines just below are expected -- follow the fix above.)');
  console.error(bar + '\n');
  process.exit(1);
})();
