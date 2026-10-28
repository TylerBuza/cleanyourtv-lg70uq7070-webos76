const fs = require('fs'),
  path = require('path'),
  cp = require('child_process');
const { root, tmp, ok, run } = require('./lib');

run(async () => {
  const source = fs.readFileSync(path.join(root, 'scripts/10-cleanyourtv-home'), 'utf8'),
    start = source.indexOf('    sleep 3\n'),
    end = source.indexOf('    # the launcher must be open', start),
    worker = source.slice(start, end);
  ok(start >= 0 && end > start, 'exercise the actual native startup launch decision');
  function check(app, preference) {
    const log = path.join(tmp, 'boot.log'),
      launch = path.join(tmp, 'launched');
    try {
      fs.unlinkSync(launch);
    } catch (_) {}
    const setup =
      'LOG="$1"; export LOG; up() { echo 1; }; sleep() { :; }; luna_send() { case "$*" in *getForegroundAppInfo*) printf \'{"appId": "%s"}\\n\' "$TEST_APP" ;; *applicationManager/launch*) touch "$TEST_LAUNCH"; echo \'{"returnValue":true}\' ;; esac; };\n';
    const result = cp.spawnSync('/bin/sh', ['-c', setup + worker, 'sh', log], {
      encoding: 'utf8',
      timeout: 5000,
      env: Object.assign({}, process.env, { TEST_APP: app, TEST_LAUNCH: launch, CYTV_BOOT_HOME: preference }),
    });
    if (result.status !== 0) throw new Error(result.stderr || 'startup fixture failed');
    return fs.existsSync(launch);
  }
  ok(!check('com.webos.app.hdmi2', ''), 'default startup does not steal an active HDMI input');
  ok(check('com.webos.app.hdmi2', '1'), 'explicit startup-Home preference opens Home over the last HDMI input');
  ok(check('com.webos.app.home', ''), 'default startup still replaces stock Home when it is foreground');
  ok(check('', ''), 'default startup still opens Home when foreground is empty');
  const output = path.join(tmp, 'runtime-env.sh');
  const result = cp.spawnSync(process.execPath, [path.join(root, 'scripts/jtool.js'), 'runtimeenv', tmp, output], {
    env: Object.assign({}, process.env, { CYTV_BOOT_HOME: '1' }),
  });
  ok(
    result.status === 0 && /CYTV_BOOT_HOME='1'/.test(fs.readFileSync(output, 'utf8')),
    'explicit startup preference survives in the installed runtime options'
  );
});
