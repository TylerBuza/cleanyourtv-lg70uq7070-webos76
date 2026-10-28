const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, tmp, ok, req, run } = require('./lib');
const P = req('paths'),
  native = req('nativehome');

run(async () => {
  P.STANDIN = path.join(tmp, 'marker');
  const exe = path.join(tmp, 'native-home'),
    wrapper = path.join(P.D, 'native-wrapper.sh');
  fs.mkdirSync(path.join(P.D, 'backup'));
  fs.writeFileSync(
    path.join(P.D, 'backup/home-appinfo.orig.json'),
    JSON.stringify({ id: 'com.webos.app.home', type: 'native', main: 'file://' + exe })
  );
  fs.writeFileSync(wrapper, '#!/bin/sh\n');
  fs.linkSync(wrapper, exe);
  fs.writeFileSync(P.STANDIN, exe);
  native.validate(exe);
  ok(native.same(wrapper, exe), 'the native target must be our wrapper or stand-in inode');
  fs.unlinkSync(exe);
  fs.writeFileSync(exe, 'foreign mount');
  const signals = [];
  let refused = false;
  try {
    await native.stop(exe, { kill: (...a) => signals.push(a) });
  } catch (e) {
    refused = /foreign/.test(e.message);
  }
  ok(refused && signals.length === 0, 'a foreign target cannot cause a process to be stopped');
  fs.unlinkSync(exe);
  fs.linkSync(wrapper, exe);
  const procs = {
    10: { pid: 10, ppid: 1, start: '100', args: ['/bin/sh', P.D + '/home-standin.sh'] },
    11: { pid: 11, ppid: 10, start: '101', args: ['luna-send'] },
    99: { pid: 99, ppid: 1, start: '99', args: ['other-app'] },
  };
  ok(Object.keys(native.tree(procs, ['10'])).join(',') === '10,11', 'cleanup selects descendants, never the app manager or another app');
  const living = Object.assign({}, procs);
  await native.stop(exe, {
    processes: () => Object.assign({}, living),
    kill: (id, sig) => {
      signals.push([id, sig]);
      if (sig === 'SIGTERM') delete living[id];
    },
    sleep: async () => {},
  });
  ok(
    signals.length > 0 && signals.every(s => s[0] === 10 || s[0] === 11) && living[99],
    'only the validated trial process tree is signalled'
  );
  const reused = { 10: { pid: 10, ppid: 1, start: '200', args: ['unrelated'] } };
  let reads = 0;
  signals.length = 0;
  await native.stop(exe, {
    processes: () => (++reads === 1 ? { 10: procs[10] } : reused),
    kill: (...a) => signals.push(a),
    sleep: async () => {},
  });
  ok(signals.length === 0, 'a root PID recycled between discovery and freeze is never adopted as owned');
  fs.writeFileSync(P.STANDIN, '/someone/else');
  refused = false;
  try {
    native.validate(exe);
  } catch (_) {
    refused = true;
  }
  ok(refused, 'an unrelated stand-in marker is refused');
  const old = path.join(tmp, 'original.json'),
    current = path.join(tmp, 'current.json');
  const check = () => cp.spawnSync(process.execPath, [path.join(root, 'scripts/jtool.js'), 'nativecheck', old, current]);
  fs.writeFileSync(old, '{"id":"com.webos.app.home","type":"native","main":"file:///native"}');
  fs.writeFileSync(current, '{"main":"file:///native","type":"native","id":"com.webos.app.home"}');
  ok(check().status === 0, 'native metadata validation tolerates JSON property ordering');
  fs.writeFileSync(current, '{"id":"com.webos.app.home","type":"native","main":"file:///changed"}');
  ok(check().status !== 0, 'changed firmware metadata is refused before takeover');
  const undo = fs.readFileSync(path.join(root, 'scripts/undo-home.sh'), 'utf8');
  ok(
    undo.indexOf('nativehome.js" stop') < undo.indexOf('umount "$EXE"'),
    'the interpreter and listeners stop before the script mount is removed'
  );
  ok(/umount "\$EXE" \|\|/.test(undo), 'a failed unmount retains its marker and fails instead of claiming restoration');
  const jt = path.join(root, 'scripts/jtool.js'),
    runtime = path.join(tmp, "runtime ' quoted"),
    output = path.join(tmp, 'wrapper');
  fs.mkdirSync(runtime);
  fs.writeFileSync(path.join(runtime, 'home-standin.sh'), '#!/bin/sh\nprintf "%s\\n%s\\n" "$CYTV_DIR" "$1"\n');
  let r = cp.spawnSync(process.execPath, [jt, 'nativewrapper', runtime, output], { encoding: 'utf8' });
  ok(r.status === 0 && cp.spawnSync('/bin/sh', ['-n', output]).status === 0, 'the wrapper safely quotes a runtime directory');
  r = cp.spawnSync('/bin/sh', [output, '{"event":"launch"}'], { encoding: 'utf8' });
  ok(
    r.stdout === runtime + '\n{"event":"launch"}\n',
    'exec preserves the native launch argument and runtime path without a resident feeder'
  );
});
