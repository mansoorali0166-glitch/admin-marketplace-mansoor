import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transformWithOxc } from 'vite';

// Exercise the component's event handlers and transitions with a mocked
// Supabase boundary; no live users or applications are created by these tests.
const source = (await readFile(new URL('../src/seller/SellerLogin.jsx', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?$/gm, '')
  .replace('export default function', 'function');
const { code } = await transformWithOxc(source, 'SellerLogin.jsx', { jsx: { runtime: 'classic' } });

function setup({ validCode = true, status = 'Pending', registering = true } = {}) {
  const state = [], calls = [];
  let cursor = 0, loggedIn = false;
  const user = { id: 'seller-id', identities: [{}] };
  const client = {
    rpc: async (name, payload) => {
      calls.push({ name, payload });
      return { data: name === 'verify_agent_invitation_code' ? validCode : 'application-id', error: null };
    },
    auth: {
      signUp: async (payload) => { calls.push({ name: 'signUp', payload }); return { data: { user, session: {} } }; },
      signOut: async () => { calls.push({ name: 'signOut' }); },
      signInWithPassword: async () => ({ data: { user } }),
    },
    from: (table) => ({ select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: table === 'profiles'
        ? { role: 'seller', allow_login: status === 'Approved', registration_status: status }
        : { status } }),
    }),
  };
  const context = vm.createContext({
    React: { Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    sellerSupabase: client, URLSearchParams,
    window: { location: { pathname: registering ? '/seller/register' : '/seller', search: '?code=INV-TEST' }, history: { replaceState() {} }, alert() {} },
    sessionStorage: { getItem() { return null; }, setItem() {} },
  });
  vm.runInContext(code, context);
  const render = () => { cursor = 0; return context.SellerLogin({ onLoginSuccess: () => { loggedIn = true; } }); };
  const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(nodes)];
  const find = (predicate) => nodes(render()).find(predicate);
  const inputs = () => nodes(render()).filter(node => node.type === 'input');
  const fill = (id, value) => find(node => node.props.id === id).props.onChange({ target: { value } });
  const submit = () => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const start = async () => {
    fill('seller-email', 'seller@example.com'); fill('seller-password', 'test-password');
    await submit();
    const buttons = nodes(render()).filter(node => node.type === 'button');
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].children[0], 'Get Started');
    buttons[0].props.onClick();
  };
  return { calls, find, inputs, fill, submit, start, loggedIn: () => loggedIn };
}

test('email/password -> Get Started -> invitation -> pending application', async () => {
  const app = setup();
  assert.deepEqual(app.inputs().map(node => node.props.id), ['seller-email', 'seller-password']);
  await app.start();
  assert.equal(app.calls.length, 0);
  assert.equal(app.find(node => node.props.id === 'seller-invitation-code').props.value, 'INV-TEST');
  await app.submit();
  const signup = app.calls.find(call => call.name === 'signUp');
  assert.deepEqual(Object.keys(signup.payload.options.data).sort(), ['invitation_code', 'role']);
  assert.equal(signup.payload.email, 'seller@example.com');
  assert.deepEqual(app.calls.map(call => call.name), ['verify_agent_invitation_code', 'signUp', 'ensure_merchant_application', 'signOut']);
  assert.equal(app.loggedIn(), false);
});

test('invalid invitation creates neither a user nor an application', async () => {
  const app = setup({ validCode: false });
  await app.start(); await app.submit();
  assert.deepEqual(app.calls.map(call => call.name), ['verify_agent_invitation_code']);
});

for (const status of ['Pending', 'Rejected', 'Approved']) {
  test(`${status} seller login respects agent approval`, async () => {
    const app = setup({ status, registering: false });
    await app.submit();
    assert.equal(app.loggedIn(), status === 'Approved');
    assert.equal(app.calls.some(call => call.name === 'signOut'), status !== 'Approved');
  });
}
