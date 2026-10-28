// luna-send, bounded by diag.execFile. Most TVs use closed stdin; the validated
// workaround keeps it open on firmware where EOF can exit before executing a call.
const exec = require('./exec');

function luna(uri, payload, opts) {
  const o = opts || {};
  const wait = o.wait || 5000;
  const script = 'luna-send -n 1 -w ' + wait + ' -f "$1" "$2" </dev/null';
  const keep = typeof o.keepStdinOpen === 'boolean' ? o.keepStdinOpen : process.env.CYTV_LUNA_STDIN === 'open';
  const result = keep
    ? exec.run('/usr/bin/luna-send', ['-n', '1', '-w', String(wait), '-f', uri, JSON.stringify(payload || {})], {
        timeout: o.timeout || wait + 3000,
        keepStdinOpen: true,
      })
    : exec.run('/bin/sh', ['-c', script, 'sh', uri, JSON.stringify(payload || {})], { timeout: o.timeout || wait + 3000 });
  return result.then(r => {
    try {
      return JSON.parse(r.out);
    } catch (_) {
      return { returnValue: false, errorText: r.error || 'bad json' };
    }
  });
}

module.exports = luna;
