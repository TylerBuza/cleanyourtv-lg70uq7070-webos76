const fs = require('fs'),
  path = require('path'),
  vm = require('vm');
const { root, ok, run } = require('./lib');
function element() {
  return {
    children: [],
    parentNode: null,
    appendChild(c) {
      c.remove();
      this.children.push(c);
      c.parentNode = this;
    },
    remove() {
      if (this.parentNode) {
        const a = this.parentNode.children;
        a.splice(a.indexOf(this), 1);
        this.parentNode = null;
      }
    },
  };
}
function image() {
  const i = element();
  i.requests = [];
  Object.defineProperty(i, 'src', {
    set(v) {
      this.requests.push(v);
    },
    get() {
      return this.requests[this.requests.length - 1];
    },
  });
  return i;
}
run(async () => {
  const c = {
    tiles: {},
    colors: { demo: {}, missing: {} },
    API: 'http://127.0.0.1:8765',
    Image: image,
    document: { createElement: element },
    hit() {},
    paint() {},
    fit() {},
  };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root, 'app/src/js/tiles.js'), 'utf8'), c);
  const d = c.tile({ id: 'demo', title: 'Demo' }),
    i = d._i;
  i.onerror();
  ok(d._iconFailed && d._iconFallback && !i.parentNode, 'an early helper failure keeps a text fallback');
  c.retryTileIcons();
  ok(
    i.requests.length === 2 && /retry=1$/.test(i.src) && d._iconFallback,
    'helper recovery retries the cached tile without hiding its fallback'
  );
  i.onload();
  ok(!d._iconFailed && !d._iconFallback && i.parentNode === d, 'a recovered icon replaces fallback text in the existing tile');
  c.retryTileIcons();
  ok(i.requests.length === 2 && c.tile({ id: 'demo' }) === d, 'successful cached tiles are reused without extra requests');
  const missing = c.tile({ id: 'missing', title: 'Missing' });
  for (let n = 0; n < 10; n++) {
    missing._i.onerror();
    c.retryTileIcons();
  }
  ok(
    missing._i.requests.length === 3 && missing.children.length === 1,
    'permanently missing icons have bounded retries and one fallback, not a network loop'
  );
  const load = fs.readFileSync(path.join(root, 'app/src/js/layout.js'), 'utf8');
  ok(
    load.indexOf('retryTileIcons();') < load.indexOf('if (sig === lastSig)'),
    'a recovered helper retries icons even when app layout is unchanged'
  );
});
