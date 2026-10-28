const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, tmp, ok, run } = require('./lib');
run(async () => {
  const bin = path.join(tmp, 'bin'),
    probe = path.join(tmp, 'stdin.js');
  fs.mkdirSync(bin);
  fs.writeFileSync(
    probe,
    'process.stdin.on("end",function(){console.log("EOF");process.exit(0)});process.stdin.resume();setTimeout(function(){console.log("OPEN");process.exit(0)},100);'
  );
  const command = path.join(bin, 'luna-send');
  fs.writeFileSync(command, '#!/bin/sh\nexec "' + process.execPath + '" "' + probe + '"\n');
  fs.chmodSync(command, 0o755);
  const compat = path.join(root, 'scripts/luna-compat.sh');
  const call = (mode, twice) =>
    cp.spawnSync('/bin/sh', ['-c', '. "$1"; luna_send -n 1; ' + (twice ? 'luna_send -n 1' : ''), 'sh', compat], {
      encoding: 'utf8',
      timeout: 5000,
      env: Object.assign({}, process.env, { PATH: bin + ':' + process.env.PATH, CYTV_LUNA_STDIN: mode, TMPDIR: tmp }),
    });
  let r = call('closed');
  ok(r.status === 0 && r.stdout === 'EOF\n', 'shell Luna calls keep closed stdin by default');
  r = call('open');
  ok(r.status === 0 && r.stdout === 'OPEN\n', 'the shell workaround retains stdin until the one-shot child exits');
  r = call('open', true);
  ok(r.status === 0 && r.stdout === 'OPEN\nOPEN\n', 'one shell can reuse the held descriptor across bounded calls');
  ok(!fs.readdirSync(tmp).some(n => /^cytv-luna\./.test(n)), 'temporary FIFO names and directories are removed immediately after opening');
});
