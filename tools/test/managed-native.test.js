const { ok, req, call, memoryConfig, run } = require('./lib');
const P = req('paths'),
  exec = req('exec');
run(async () => {
  const oldManaged = P.MANAGED,
    oldNative = P.NATIVE_HOME,
    oldDetached = exec.detached;
  const commands = [];
  P.MANAGED = true;
  P.NATIVE_HOME = true;
  exec.detached = script => commands.push(script);
  try {
    const conf = memoryConfig({ options: { debloat: false, inputKey: false, liveTv: false } });
    const manager = req('manager').create({ version: '1.6.9', config: conf, luna: async () => ({}), feature: () => null });
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
      ok(r.code === 409 && /Managed/.test(r.j.error), 'external ownership refuses ' + action);
    }
    ok(
      commands.length === 0 && !conf.options().debloat && !conf.options().inputKey,
      'refused requests cannot touch cleanup, keys or installers'
    );
    await call(manager, '/api/manager/home', 'POST', { enabled: true });
    await call(manager, '/api/manager/home', 'POST', { enabled: false });
    ok(
      commands.length === 2 && /native-home\.sh' enable$/.test(commands[0]) && /native-home\.sh' disable$/.test(commands[1]),
      'Home controls call the upstream native lifecycle in its actual runtime folder'
    );
    ok(
      commands.every(s => !/python|runtime\.py|reboot|systemctl/.test(s)),
      'native Home controls have no custom Python takeover or reboot dependency'
    );
  } finally {
    P.MANAGED = oldManaged;
    P.NATIVE_HOME = oldNative;
    exec.detached = oldDetached;
  }
});
