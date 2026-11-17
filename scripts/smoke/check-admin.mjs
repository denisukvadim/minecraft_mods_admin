// Smoke test of the admin panel in headless Chrome via the DevTools protocol.
// Lives outside the project on purpose: it is a one-off verification script.
const BASE = 'http://localhost:4200';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createTarget(url) {
  const response = await fetch(
    `http://127.0.0.1:9223/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' },
  );
  return response.json();
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve());
    socket.addEventListener('error', reject);
  });

  return {
    ready,
    close: () => socket.close(),
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function main() {
  const target = await createTarget(`${BASE}/login`);
  const client = connect(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('unhandled rejection: ' + String(e.reason)));`,
  });

  await sleep(2500);
  const loginText = await evaluate(client, 'document.body.innerText');
  console.log('LOGIN page:', loginText.includes('Sign in') ? 'rendered' : 'BROKEN');

  const loginResult = await evaluate(
    client,
    `(async () => {
      const login = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ${JSON.stringify(EMAIL)}, password: ${JSON.stringify(PASSWORD)} }),
      });
      if (!login.ok) return 'login failed: ' + login.status;
      const token = await login.json();
      const me = await fetch('/api/v1/auth/me', {
        headers: { Authorization: 'Bearer ' + token.access_token },
      }).then((r) => r.json());
      localStorage.setItem('minecraft-mods-admin.session', JSON.stringify({
        token: token.access_token,
        expiresAt: token.expires_at,
        me,
      }));
      return 'ok:' + me.roles.join(',');
    })()`,
  );
  console.log('LOGIN via API:', loginResult);

  const pages = [
    ['/mods', ['Upload mod', 'trackwork-1.20.1-1.2.4.jar']],
    ['/users', ['Users', 'admin@example.com']],
    ['/roles', ['Roles', 'system']],
    ['/permissions', ['Permissions', 'mods:upload']],
    ['/audit', ['Audit log', 'upload']],
  ];

  for (const [path, expected] of pages) {
    await evaluate(client, `location.href = ${JSON.stringify(path)}`);
    await sleep(2200);
    const text = await evaluate(client, 'document.body.innerText');
    const missing = expected.filter((needle) => !text.includes(needle));
    const errorBanner = text.includes('Cannot reach the API');
    console.log(
      `${path}: ${missing.length === 0 && !errorBanner ? 'OK' : 'MISSING ' + missing.join(', ')}`,
    );
    if (missing.length > 0) {
      console.log('--- body ---');
      console.log(text.slice(0, 800));
    }
  }

  const consoleErrors = await evaluate(
    client,
    `(window.__errors || []).join(' | ')`,
  );
  console.log('page errors:', consoleErrors || 'none');

  client.close();
}

main().catch((error) => {
  console.error('SMOKE FAILED', error);
  process.exit(1);
});
