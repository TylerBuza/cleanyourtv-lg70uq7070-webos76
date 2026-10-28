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
    'function done(state){console.log(JSON.stringify({state:state,args:process.argv.slice(2)}));process.exit(0)};process.stdin.on("end",function(){done("EOF")});process.stdin.resume();setTimeout(function(){done("OPEN")},100);'
  );
  const command = path.join(bin, 'luna-send');
  fs.writeFileSync(
    command,
    '#!/bin/sh\n[ -z "$CYTV_TEST_EXIT" ] || exit "$CYTV_TEST_EXIT"\nexec "' + process.execPath + '" "' + probe + '" "$@"\n'
  );
  fs.chmodSync(command, 0o755);
  const compat = path.join(root, 'scripts/luna-compat.sh'),
    uri = 'luna://example/query',
    payload = '{"text":"single\' double\\" $(not-a-command); <data>"}';
  const call = (mode, twice, exit) =>
    cp.spawnSync('/bin/sh', ['-c', '. "$1"; luna_send "$2" "$3"; ' + (twice ? 'luna_send "$2" "$3"' : ''), 'sh', compat, uri, payload], {
      encoding: 'utf8',
      timeout: 5000,
      env: Object.assign({}, process.env, {
        PATH: bin + ':' + process.env.PATH,
        CYTV_LUNA_STDIN: mode,
        TMPDIR: tmp,
        CYTV_TEST_EXIT: exit || '',
      }),
    });
  let result = call('closed'),
    reply = JSON.parse(result.stdout);
  ok(result.status === 0 && reply.state === 'EOF', 'shell Luna calls keep closed stdin by default');
  result = call('open');
  reply = JSON.parse(result.stdout);
  ok(result.status === 0 && reply.state === 'OPEN', 'the shell opt-in holds stdin until the child exits');
  ok(reply.args[0] === uri && reply.args[1] === payload, 'URI and quoted JSON remain separate literal arguments');
  result = call('open', true);
  ok(
    result.status === 0 &&
      result.stdout
        .trim()
        .split('\n')
        .every(line => JSON.parse(line).state === 'OPEN') &&
      result.stdout.trim().split('\n').length === 2,
    'the held descriptor can be reused in the same shell'
  );
  ok(call('open', false, '7').status === 7 && call('closed', false, '7').status === 7, 'both modes preserve child failure status');
  ok(!fs.readdirSync(tmp).some(name => /^cytv-luna\./.test(name)), 'FIFO names and temporary directories are removed immediately');
});
