const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

const source = fs.readFileSync(path.join(root, 'src/app.jsx'), 'utf8');
const pricing = source.slice(source.indexOf('const isLaborOnly ='), source.indexOf('function marginHealth'));
const signature = source.slice(source.indexOf('function signatureFingerprint'), source.indexOf('function QuoteSignature'));
const domain = vm.createContext({});
vm.runInContext(pricing + '\n' + signature, domain);

test('preserves legacy material quotes and computes crew pricing with margin and discount', () => {
  const quote = { crew: 3, days: 2, hoursPerDay: 8, laborRate: 40, items: [{ qty: 2, price: 40 }], overheadPct: 10, marginPct: 25, discountPct: 10 };
  const settings = { overheadPct: 10, targetMargin: 25 };
  assert.equal(domain.computeQuote(quote, settings).total, 2640);
  assert.equal(domain.computeQuote({ ...quote, pricingMode: 'labor' }, settings).materials, 0);
  assert.equal(domain.computeQuote({ ...quote, pricingMode: 'labor', discountPct: 0 }, settings).total, 2816);
});

test('a signature stops matching after a scope or price revision, while activity updates keep it valid', () => {
  const quote = { clientName: 'Demo', scopeItems: [{ on: true, text: 'Paint' }], crew: 2, days: 1, hoursPerDay: 8, laborRate: 35, items: [], overheadPct: 10, marginPct: 25 };
  const first = domain.signatureFingerprint(quote, {});
  assert.equal(domain.signatureFingerprint({ ...quote, history: [{ action: 'Printed' }] }, {}), first);
  assert.notEqual(domain.signatureFingerprint({ ...quote, days: 2 }, {}), first);
  assert.notEqual(domain.signatureFingerprint({ ...quote, scopeItems: [{ on: true, text: 'Paint and patch' }] }, {}), first);
});

function runtime() {
  const calls = [];
  const fetchCalls = [];
  const context = {
    Request, Response, URL, Blob, FileReader: class {}, crypto, alert() {},
    location: { href: 'https://localhost/', origin: 'https://localhost' },
    navigator: {}, CustomEvent: class {},
    document: { addEventListener() {} },
  };
  const plugins = {
    CapacitorHttp: { async request(value) { calls.push(value); return { status: 200, data: '{"ok":true}', headers: { 'content-type': 'application/json' } }; } },
    App: { addListener() {} },
  };
  context.window = {
    Capacitor: { isNativePlatform: () => true, registerPlugin: (name) => plugins[name] || {} },
    fetch: async (...args) => { fetchCalls.push(args); return new Response('local'); },
    SIQ_NATIVE_PUSH_ENABLED: false,
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'mobile/runtime/native-runtime.js'), 'utf8'), context);
  return { ...context, calls, fetchCalls };
}

test('native API transport preserves authentication JSON and Request method and headers', async () => {
  const native = runtime();
  const request = new Request('https://localhost/api/notify', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Check': 'test' },
    body: JSON.stringify({ idToken: 'fixture-token', quoteId: 'fixture-quote' }),
  });
  const response = await native.window.fetch(request);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(native.calls[0].url, 'https://www.s-i-quotespro.com/api/notify');
  assert.equal(native.calls[0].method, 'POST');
  assert.equal(native.calls[0].data.idToken, 'fixture-token');
  assert.equal(native.calls[0].headers['x-check'], 'test');
});

test('Firebase transport and bundled local assets use the original browser fetch', async () => {
  const native = runtime();
  await native.window.fetch('https://firestore.googleapis.com/example');
  await native.window.fetch('./vendor/react.production.min.js');
  assert.equal(native.calls.length, 0);
  assert.equal(native.fetchCalls.length, 2);
});

test('Android has bundled assets and fails release tasks when signing is unavailable', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'mobile/capacitor.config.json')));
  assert.equal(config.server.url, undefined);
  assert.equal(config.server.cleartext, false);
  const gradle = fs.readFileSync(path.join(root, 'mobile/android/app/build.gradle'), 'utf8');
  assert.match(gradle, /Release signing requires/);
  assert.match(gradle, /ANDROID_KEYSTORE_PASSWORD/);
});

test('the native plan screen renders current access and cancellation without checkout', () => {
  const React = require('../node_modules/react');
  const server = require('../node_modules/react-dom/server');
  const babel = require('../../node_modules/@babel/core');
  const component = source.slice(source.indexOf('function NativePlanStatus'), source.indexOf('function BillingCard'));
  const compiled = babel.transformSync(component, {
    babelrc: false, configFile: false,
    presets: [[require.resolve('../../node_modules/@babel/preset-react'), { runtime: 'classic' }]],
  }).code;
  const context = vm.createContext({
    React, useState: React.useState, BRAND: { navy: '#0b1f3a' },
    Card: ({ children }) => React.createElement('div', null, children),
    Btn: ({ children }) => React.createElement('button', null, children),
    PLAN_LABEL: { solo: 'Solo' }, BILL_STATUS: { active: 'Active' },
  });
  vm.runInContext(compiled, context);
  const html = server.renderToStaticMarkup(React.createElement(context.NativePlanStatus, {
    billing: { enabled: true, hasCard: true, plan: 'solo', billingStatus: 'active' },
  }));
  assert.match(html, /Solo/);
  assert.match(html, /Cancel subscription renewal/);
  assert.doesNotMatch(html, /checkout|Pick a plan|Start.*trial/i);
});

test('quote validation catches invalid pricing and accepts a real labor quote', () => {
  const quote = { clientName: 'Sample client', crew: 2, days: 2, hoursPerDay: 8, laborRate: 35, pricingMode: 'labor', items: [], overheadPct: 10, marginPct: 25, discountPct: 0 };
  assert.equal(domain.nativeQuoteErrors(quote, {}, true).length, 0);
  assert.match(domain.nativeQuoteErrors({ ...quote, marginPct: 100 }, {}, true).join(' '), /Margin/);
  assert.match(domain.nativeQuoteErrors({ ...quote, hoursPerDay: 25 }, {}, true).join(' '), /Hours per day/);
  assert.match(domain.nativeQuoteErrors({ ...quote, crew: 1.5 }, {}, true).join(' '), /whole number/);
  assert.match(domain.nativeQuoteErrors({ ...quote, days: 0 }, {}, true).join(' '), /greater than/);
  assert.match(domain.nativeQuoteErrors({ ...quote, pricingMode: 'turnkey', items: [{ qty: -2, price: 20 }] }, {}, true).join(' '), /Material/);
});

test('device drafts isolate company and account and preserve the server revision for conflict checking', () => {
  const storage = {};
  Object.defineProperties(storage, {
    getItem: { value(key) { return storage[key] ?? null; } },
    setItem: { value(key, value) { storage[key] = value; } },
    removeItem: { value(key) { delete storage[key]; } },
  });
  const context = vm.createContext({ localStorage: storage, TENANT: 'company-one' });
  vm.runInContext(source.slice(source.indexOf('function nativeDraftPrefix'), source.indexOf('function nativeQuoteErrors')), context);
  const me = { id: 'manager' }, quote = { id: 'quote-one', createdBy: 'associate', clientName: 'Sample' };
  assert.equal(context.nativeDraftStore(me, quote, 'revision-one'), true);
  assert.equal(context.nativeDrafts(me)[0].baseRevision, 'revision-one');
  assert.equal(context.nativeDrafts({ id: 'another-user' }).length, 0);
  context.TENANT = 'company-two';
  assert.equal(context.nativeDrafts(me).length, 0);
  context.TENANT = 'company-one';
  assert.notEqual(context.nativeRevision({ updatedAt: 'revision-two' }), context.nativeDrafts(me)[0].baseRevision);
  context.nativeDraftRemove(me, quote.id);
  assert.equal(context.nativeDrafts(me).length, 0);
});

test('dashboard renders device recovery and blocks recovery when the server revision changed', () => {
  const React = require('../node_modules/react');
  const server = require('../node_modules/react-dom/server');
  const babel = require('../../node_modules/@babel/core');
  const start = source.indexOf('function Dashboard(');
  const end = source.indexOf('\nfunction ', start + 1);
  const compiled = babel.transformSync(source.slice(start, end), { babelrc: false, configFile: false, presets: [[require.resolve('../../node_modules/@babel/preset-react'), { runtime: 'classic' }]] }).code;
  const quote = { id: 'sample', quoteNo: 'Q-SAMPLE', createdAt: '2026-11-19', createdBy: 'owner', clientName: 'Sample Client', status: 'draft' };
  const context = vm.createContext({
    React, useState: React.useState, useMemo: React.useMemo, IS_PLAY_APP: true, inputStyle: {},
    BRAND: { navy: '#0b1f3a', sub: '#555', gold: '#c9a227', line: '#ddd' },
    Card: ({ children }) => React.createElement('div', null, children), Btn: ({ children }) => React.createElement('button', null, children),
    UpcomingJobs: () => null, FollowUps: () => null, nativeDrafts: () => [{ quote, baseRevision: 'old', at: '2026-11-19T00:00:00Z' }],
    nativeRevision: (q) => q ? q.updatedAt || q.createdAt : null,
    inPeriod: () => true, isVoid: () => false, isDecided: () => false, computeQuote: () => ({ total: 100 }),
    money: (v) => '$' + v, fmtDate: () => 'Nov 19', isOwnerRole: () => true,
    PERIODS: [['month', 'This month']], STATUS: { draft: { label: 'Draft' } }, OPEN_STATUSES: [],
    StatusBadge: () => null, Badge: () => null,
  });
  vm.runInContext(compiled, context);
  const props = { me: { id: 'owner' }, isOwner: true, isManager: true, quotes: [{ ...quote, updatedAt: 'new' }], users: {}, settings: {} };
  const html = server.renderToStaticMarkup(React.createElement(context.Dashboard, props));
  assert.match(html, /EDITS KEPT ON THIS PHONE/);
  assert.match(html, /cloud quote has changed/);
  assert.match(html, /Open current quote/);
  assert.doesNotMatch(html, /Recover edits/);
});

test('editor transaction rejects an old cloud revision without writing anything', async () => {
  let writes = 0;
  const context = vm.createContext({
    CLOUD: true, IS_PLAY_APP: true, quotes: {},
    col: () => ({ doc: () => ({}) }),
    nativeRevision: (q) => q ? q.updatedAt || q.createdAt || null : null,
    db: { runTransaction: async (fn) => fn({ get: async () => ({ exists: true, data: () => ({ updatedAt: 'server-two', status: 'approved' }) }), set: () => { writes++; } }) },
  });
  const start = source.indexOf('const upsertQuote = async');
  const end = source.indexOf('/* Permanent erase', start);
  vm.runInContext(source.slice(start, end) + '\nthis.save = upsertQuote;', context);
  await assert.rejects(context.save({ id: 'sample', status: 'draft', updatedAt: 'editor-three' }, { expectedRevision: 'server-one' }), /changed on another device/);
  assert.equal(writes, 0);
});

test('Firebase configuration matches the registered Android app and rejects another project', () => {
  const os = require('node:os');
  const { configureFirebase } = require('./configure-firebase.cjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'siq-firebase-'));
  try {
    const mobile = path.join(directory, 'mobile');
    fs.mkdirSync(path.join(mobile, 'android/app'), { recursive: true });
    fs.copyFileSync(path.join(root, 'mobile/firebase-android.json'), path.join(mobile, 'firebase-android.json'));
    fs.copyFileSync(path.join(root, 'mobile/capacitor.config.json'), path.join(mobile, 'capacitor.config.json'));
    fs.copyFileSync(path.join(root, 'config.js'), path.join(directory, 'config.js'));
    assert.equal(configureFirebase(mobile), true);
    const configPath = path.join(mobile, 'android/app/google-services.json');
    const config = JSON.parse(fs.readFileSync(configPath));
    assert.equal(config.client[0].client_info.mobilesdk_app_id, '1:994940793610:android:2a152c053a8e689386c0f3');
    config.project_info.project_id = 'another-project';
    fs.writeFileSync(configPath, JSON.stringify(config));
    assert.throws(() => configureFirebase(mobile), /does not match/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
