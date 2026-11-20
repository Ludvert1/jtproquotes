const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const originalAccess = fs.readFileSync('tests/fixtures/reviewer-access-before.cjs', 'utf8');
const originalBilling = fs.readFileSync('tests/fixtures/reviewer-billing-before.cjs', 'utf8');
const newAccess = fs.readFileSync('api/_access.js', 'utf8');
const newBilling = fs.readFileSync('api/billing.js', 'utf8');
function access(source, enabled) {
  const context = vm.createContext({ module: { exports: {} }, stripeOn: () => enabled, TRIAL_DAYS: 14, require: (name) => name === './_stripe' ? { TRIAL_DAYS: 14, stripeOn: () => enabled } : {}, console, Date, Map });
  vm.runInContext(source, context);
  return context.module.exports.accessOf;
}
function view(source, allowed) {
  const context = vm.createContext({ accessOf: allowed, DAY: 864e5, TRIAL_QUOTES: 7, stripeOn: () => true, testMode: () => false, PLANS: { solo: { name: 'Solo', amount: 2900, users: 1, blurb: 'Sample plan' } } });
  vm.runInContext(source.slice(source.indexOf('function publicView(co)'), source.indexOf('async function cardCheck') === -1 ? source.length : source.indexOf('async function cardCheck')), context);
  return (co) => JSON.parse(JSON.stringify(context.publicView(co)));
}
const now = Date.now();
const cases = [];
for (const suspended of [false, true]) for (const used of [0, 6, 7, 999]) for (const status of ['', 'active', 'past_due', 'trialing', 'canceled']) for (const hasSubscription of [false, true]) for (const expired of [false, true]) {
  cases.push({ suspended, trialQuotesUsed: used, billingStatus: status, stripeSubscriptionId: hasSubscription ? 'existing-subscription' : '', _createTime: new Date(now - (expired ? 30 : 1) * 864e5).toISOString(), trialEnds: new Date(now + (expired ? -5 : 5) * 864e5).toISOString(), plan: 'trial' });
}
test('ordinary-company access remains identical across billing states', () => {
  for (const enabled of [false, true]) {
    const before = access(originalAccess, enabled), after = access(newAccess, enabled);
    for (const co of cases) for (const flag of [undefined, false, 'true', 1]) assert.equal(after({ ...co, reviewDemo: flag }), before({ ...co, reviewDemo: flag }));
  }
});
test('only an explicit admin flag exempts the review demo from expiration and quote limits', () => {
  const allowed = access(newAccess, true);
  const expired = { _createTime: new Date(now - 90 * 864e5).toISOString(), trialQuotesUsed: 999 };
  assert.equal(allowed(expired), 'locked');
  assert.equal(allowed({ ...expired, reviewDemo: true }), 'ok');
  assert.equal(allowed({ ...expired, reviewDemo: true, suspended: true }), 'suspended');
});
test('ordinary-company billing response remains unchanged', () => {
  const before = view(originalBilling, access(originalAccess, true)), after = view(newBilling, access(newAccess, true));
  for (const co of cases) assert.deepEqual(after(co), before(co));
});
test('review credentials have no expiration, quote cap or purchase options in their billing response', () => {
  const result = view(newBilling, access(newAccess, true))({ reviewDemo: true, trialQuotesUsed: 99, _createTime: new Date(now - 90 * 864e5).toISOString() });
  assert.equal(result.access, 'ok'); assert.equal(result.quoteLimit, null); assert.equal(result.trialEnds, ''); assert.equal(result.hasCard, false); assert.equal(result.trialAvailable, false); assert.deepEqual(result.plans, []);
});
