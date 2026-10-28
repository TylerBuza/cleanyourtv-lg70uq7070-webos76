// One-shot native stand-in cleanup. Never kill unrelated apps or reused PIDs.
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
    const a = procs[id].args;
    return ['/bin/sh', 'sh'].indexOf(a[0]) >= 0 && [exe, P.D + '/home-standin.sh'].indexOf(a[1]) >= 0;
  });
}
function tree(procs, ids) {
  const found = {};
  for (const id of ids) if (procs[id]) found[id] = procs[id];
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of Object.keys(procs))
      if (!found[id] && found[procs[id].ppid]) {
        found[id] = procs[id];
        changed = true;
      }
  }
  return found;
}
function validate(exe) {
  const a = JSON.parse(fs.readFileSync(P.D + '/backup/home-appinfo.orig.json', 'utf8')),
    main = String(a.main || '').replace(/^file:\/\//, ''),
    candidates = [main.charAt(0) === '/' ? main : P.HOME_APP + '/' + main, '/usr/bin/' + HOME];
  if (a.id !== HOME || a.type !== 'native' || candidates.indexOf(exe) < 0) throw new Error('not the backed-up native Home program');
  if (fs.lstatSync(P.STANDIN).isSymbolicLink() || fs.readFileSync(P.STANDIN, 'utf8').trim() !== exe)
    throw new Error('unexpected stand-in marker');
  if (!same(P.D + '/native-wrapper.sh', exe) && !same(P.D + '/home-standin.sh', exe))
    throw new Error('foreign native program mount: refusing to stop anything');
}
async function stop(exe, io) {
  validate(exe);
  const read = (io && io.processes) || processes,
    kill = (io && io.kill) || ((pid, sig) => process.kill(pid, sig)),
    wait = (io && io.sleep) || sleep,
    initial = read(),
    ids = roots(initial, exe);
  function send(selected, sig) {
    const now = read();
    for (const id of Object.keys(selected))
      if (now[id] && now[id].start === selected[id].start) {
        try {
          kill(Number(id), sig);
        } catch (e) {
          if (e.code !== 'ESRCH') throw e;
        }
      }
  }
  send(tree(initial, ids), 'SIGSTOP');
  const frozen = read(),
    stable = ids.filter(id => frozen[id] && frozen[id].start === initial[id].start && roots(frozen, exe).indexOf(id) >= 0),
    owned = Object.assign({}, tree(initial, ids), tree(frozen, stable));
  send(owned, 'SIGTERM');
  send(owned, 'SIGCONT');
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
