// The fork's integration keeps the established Home/debloat owner, not the generic installer.
const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, ok, req, call, memoryConfig, run } = require('./lib');
const P = req('paths'),
  exec = req('exec');

run(async () => {
  const bootPath = path.join(root, 'tvmodding/boot.sh'),
    boot = fs.readFileSync(bootPath, 'utf8');
  ok(cp.spawnSync('/bin/sh', ['-n', bootPath]).status === 0, 'managed boot hook has valid portable shell syntax');
  ok(boot.indexOf('runtime.py boot &') < boot.indexOf('curl -fsS'), 'the Home controller starts before helper readiness polling');
  const luna = req('luna');
  const oldRun = exec.run,
    oldPlatform = P.PLATFORM,
    oldStdin = process.env.CYTV_LUNA_STDIN;
  const calls = [];
  exec.run = async (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { out: '{"returnValue":true}' };
  };
  process.env.CYTV_LUNA_STDIN = 'open';
  const reply = await luna('luna://com.webos.applicationManager/launch', { id: 'example.app' });
  ok(
    reply.returnValue && calls[0].cmd === '/usr/bin/luna-send' && calls[0].opts.keepStdinOpen,
    'Luna adapter invokes the executable with an open bounded input pipe'
  );
  ok(
    calls[0].args.indexOf('luna://com.webos.applicationManager/launch') >= 0 && calls[0].args.indexOf('{"id":"example.app"}') >= 0,
    'Luna arguments are data, not shell interpolation'
  );
  exec.run = oldRun;
  if (oldStdin === undefined) delete process.env.CYTV_LUNA_STDIN;
  else process.env.CYTV_LUNA_STDIN = oldStdin;

  P.PLATFORM = 'tvmodding';
  const conf = memoryConfig({ options: { debloat: false, inputKey: false, liveTv: false } });
  const manager = req('manager').create({ version: '1.6.9', config: conf, luna: async () => ({}), feature: () => null });
  const oldDetached = exec.detached,
    detached = [];
  exec.detached = script => detached.push(script);
  for (const action of [
    'update-service',
    'update-frontend',
    'rollback-frontend',
    'channel',
    'uninstall',
    'options',
    'learn-key',
    'notify-api',
  ]) {
    const r = await call(manager, '/api/manager/' + action, 'POST', {});
    ok(r.code === 409 && /TVModding/.test(r.j.error), 'managed deployment refuses ' + action);
  }
  ok(
    detached.length === 0 && !conf.options().debloat && !conf.options().inputKey,
    'refused actions cannot change cleanup, keys or boot scripts'
  );
  await call(manager, '/api/manager/home', 'POST', { enabled: false });
  ok(
    detached.length === 1 && /runtime\.py restore-home$/.test(detached[0]) && !/reboot|systemctl/.test(detached[0]),
    'Home restoration uses the existing controller without restarting SAM or rebooting'
  );
  exec.detached = oldDetached;
  P.PLATFORM = oldPlatform;
});
