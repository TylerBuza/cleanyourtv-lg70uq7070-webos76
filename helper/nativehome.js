// One-shot cleanup of the owned native stand-in before its script is unmounted.
const fs = require('fs');
const P = require('./paths');
const HOME = 'com.webos.app.home';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function same(a, b) {
  try {
    const x = fs.statSync(a),
      y = fs.statSync(b);
    return x.dev === y.dev && x.ino === y.ino;
  } catch (_) {
    return false;
  }
}
function processes() {
  const out = {};
  for (const name of fs.readdirSync(P.PROC)) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const text = fs.readFileSync(P.PROC + '/' + name + '/stat', 'utf8'),
        fields = text
          .slice(text.lastIndexOf(') ') + 2)
          .trim()
          .split(/\s+/);
      if (fields[0] === 'Z' || !/^\d+$/.test(fields[19] || '')) continue;
      out[name] = {
        pid: Number(name),
        ppid: Number(fields[1]),
        start: fields[19],
        args: fs
          .readFileSync(P.PROC + '/' + name + '/cmdline', 'utf8')
          .split('\0')
          .filter(Boolean),
      };
    } catch (_) {}
  }
  return out;
}
function roots(procs, exe) {
  return Object.keys(procs).filter(id => {
    const args = procs[id].args;
    return ['/bin/sh', 'sh'].indexOf(args[0]) >= 0 && [exe, P.D + '/home-standin.sh'].indexOf(args[1]) >= 0;
  });
}
function tree(procs, ids) {
  const selected = {};
  for (const id of ids) if (procs[id]) selected[id] = procs[id];
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of Object.keys(procs))
      if (!selected[id] && selected[procs[id].ppid]) {
        selected[id] = procs[id];
        changed = true;
      }
  }
  return selected;
}
function validate(exe) {
  const app = JSON.parse(fs.readFileSync(P.D + '/backup/home-appinfo.orig.json', 'utf8')),
    main = String(app.main || '').replace(/^file:\/\//, ''),
    candidates = [main.charAt(0) === '/' ? main : P.HOME_APP + '/' + main, '/usr/bin/' + HOME];
  if (app.id !== HOME || app.type !== 'native' || candidates.indexOf(exe) < 0) throw new Error('not the backed-up native Home program');
  const marker = fs.lstatSync(P.STANDIN);
  if (!marker.isFile() || marker.isSymbolicLink() || fs.readFileSync(P.STANDIN, 'utf8').trim() !== exe)
    throw new Error('unexpected stand-in marker');
  if (!same(P.D + '/home-standin.sh', exe)) throw new Error('foreign native program mount: refusing to stop anything');
}
async function stop(exe, io) {
  validate(exe);
  const read = (io && io.processes) || processes,
    kill = (io && io.kill) || ((pid, signal) => process.kill(pid, signal)),
    wait = (io && io.sleep) || sleep,
    initial = read(),
    ids = roots(initial, exe);
  function send(selected, signal) {
    const now = read();
    let failed = null;
    for (const id of Object.keys(selected))
      if (now[id] && now[id].start === selected[id].start) {
        try {
          kill(Number(id), signal);
        } catch (e) {
          if (e.code !== 'ESRCH' && !failed) failed = e;
        }
      }
    if (failed) throw failed;
  }
  let owned = tree(initial, ids);
  try {
    send(owned, 'SIGSTOP');
    const frozen = read(),
      stable = ids.filter(id => frozen[id] && frozen[id].start === initial[id].start && roots(frozen, exe).indexOf(id) >= 0);
    owned = Object.assign({}, owned, tree(frozen, stable));
    send(owned, 'SIGTERM');
  } finally {
    send(owned, 'SIGCONT');
  }
  for (let n = 0; n < 20; n++) {
    const now = read();
    if (!Object.keys(owned).some(id => now[id] && now[id].start === owned[id].start)) break;
    await wait(50);
  }
  send(owned, 'SIGKILL');
  await wait(50);
  const final = read();
  if (roots(final, exe).length || Object.keys(owned).some(id => final[id] && final[id].start === owned[id].start))
    throw new Error('native stand-in processes did not stop');
  return { stopped: Object.keys(owned).length };
}

module.exports = { same, processes, roots, tree, validate, stop };
if (require.main === module) {
  if (process.argv[2] !== 'stop' || !process.argv[3]) {
    console.error('usage: node nativehome.js stop <native-Home-program>');
    process.exit(2);
  }
  stop(process.argv[3]).then(
    result => console.log(JSON.stringify(result)),
    error => {
      console.error(error.message);
      process.exitCode = 1;
    }
  );
}
