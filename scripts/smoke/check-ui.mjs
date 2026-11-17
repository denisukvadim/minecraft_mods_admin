// Deeper UI smoke test: create a user, toggle a direct permission, delete the
// user, open the file-history and role dialogs. One-off verification script.
const BASE = 'http://localhost:4200';

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

const uiHelpers = `
  window.__ui = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    dialog: () => document.querySelector('mat-dialog-container'),
    row: (text) => [...document.querySelectorAll('tbody tr')]
      .find((tr) => tr.textContent.includes(text)),
    button: (root, text) => [...root.querySelectorAll('button')]
      .find((b) => b.textContent.trim().includes(text)),
    setInput: (el, value) => {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      proto.set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    },
  };
`;

async function main() {
  const email = `ui-smoke-${Date.now()}@example.com`;
  const target = await createTarget(`${BASE}/users`);
  const client = connect(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('unhandled rejection: ' + String(e.reason)));`,
  });
  await sleep(2200);

  await evaluate(client, uiHelpers);

  const createResult = await evaluate(
    client,
    `(async () => {
      const ui = window.__ui;
      ui.button(document, 'New user').click();
      await ui.sleep(900);
      const dialog = ui.dialog();
      if (!dialog) return 'no create dialog';
      const inputs = dialog.querySelectorAll('input[matinput], input');
      const byLabel = (label) => {
        const field = [...dialog.querySelectorAll('mat-form-field')]
          .find((f) => f.textContent.includes(label));
        return field ? field.querySelector('input') : null;
      };
      ui.setInput(byLabel('Email'), ${JSON.stringify(email)});
      ui.setInput(byLabel('Username'), 'ui_smoke');
      ui.setInput(byLabel('Password'), 'ui-smoke-password');
      await ui.sleep(300);
      const submit = ui.button(dialog, 'Create user');
      if (!submit) return 'no submit button (' + inputs.length + ' inputs)';
      submit.click();
      await ui.sleep(1800);
      return document.body.innerText.includes(${JSON.stringify(email)})
        ? 'created' : 'user missing from table';
    })()`,
  );
  console.log('CREATE user:', createResult);
  if (createResult !== 'created') {
    client.close();
    return;
  }

  const accessResult = await evaluate(
    client,
    `(async () => {
      const ui = window.__ui;
      const row = ui.row(${JSON.stringify(email)});
      if (!row) return 'row not found';
      ui.button(row, 'Manage').click();
      await ui.sleep(1400);
      let dialog = ui.dialog();
      if (!dialog || !dialog.textContent.includes('Manage user')) return 'manage dialog missing';

      const tabs = [...dialog.querySelectorAll('[role=tab]')];
      const tabsText = tabs.map((t) => t.textContent.trim()).join(',');
      const directTab = tabs.find((t) => t.textContent.includes('Direct permissions'));
      if (!directTab) return 'direct permissions tab missing: ' + tabsText;
      directTab.click();
      await ui.sleep(600);

      const uploadRow = [...dialog.querySelectorAll('.access-row')]
        .find((r) => r.textContent.includes('mods:upload'));
      if (!uploadRow) return 'mods:upload row missing';
      uploadRow.querySelector('input[type=checkbox]').click();
      await ui.sleep(1500);

      dialog = ui.dialog();
      const effective = [...dialog.querySelectorAll('.effective .chip')]
        .map((c) => c.textContent.trim());
      const close = ui.button(dialog, 'Close');
      if (close) close.click();
      await ui.sleep(1200);
      return effective.includes('mods:upload')
        ? 'direct grant applied: ' + effective.join(',')
        : 'effective permissions missing mods:upload: ' + effective.join(',');
    })()`,
  );
  console.log('MANAGE access:', accessResult);

  const deleteResult = await evaluate(
    client,
    `(async () => {
      const ui = window.__ui;
      const row = ui.row(${JSON.stringify(email)});
      if (!row) return 'row not found before delete';
      const buttons = row.querySelectorAll('button');
      buttons[buttons.length - 1].click();
      await ui.sleep(800);
      const dialog = ui.dialog();
      if (!dialog) return 'confirm dialog missing';
      const confirm = ui.button(dialog, 'Delete');
      if (!confirm) return 'confirm button missing';
      confirm.click();
      await ui.sleep(1800);
      return document.body.innerText.includes(${JSON.stringify(email)})
        ? 'user still listed' : 'deleted';
    })()`,
  );
  console.log('DELETE user:', deleteResult);

  await evaluate(client, `location.href = '/mods'`).catch(() => {});
  await sleep(2600);
  await evaluate(client, uiHelpers);
  const historyResult = await evaluate(
    client,
    `(async () => {
      const ui = window.__ui;
      const row = ui.row('trackwork-1.20.1-1.2.4.jar');
      if (!row) return 'mod row missing';
      const buttons = row.querySelectorAll('button');
      buttons[1].click();
      await ui.sleep(1300);
      const dialog = ui.dialog();
      if (!dialog) return 'history dialog missing';
      const text = dialog.textContent;
      const ok = text.includes('File history') && text.includes('upload') && text.includes('admin');
      const close = ui.button(dialog, 'Close');
      if (close) close.click();
      return ok ? 'history dialog OK' : 'history dialog incomplete: ' + text.slice(0, 200);
    })()`,
  );
  console.log('HISTORY dialog:', historyResult);

  await evaluate(client, `location.href = '/roles'`).catch(() => {});
  await sleep(2400);
  await evaluate(client, uiHelpers);
  const roleResult = await evaluate(
    client,
    `(async () => {
      const ui = window.__ui;
      ui.button(document, 'New role').click();
      await ui.sleep(1200);
      const dialog = ui.dialog();
      if (!dialog) return 'role dialog missing';
      const text = dialog.textContent;
      const hasCatalog = text.includes('mods:upload') && text.includes('mods:delete');
      const cancel = ui.button(dialog, 'Cancel');
      if (cancel) cancel.click();
      await ui.sleep(600);
      return hasCatalog ? 'role dialog OK' : 'permission catalog missing in dialog';
    })()`,
  );
  console.log('ROLE dialog:', roleResult);

  const pageErrors = await evaluate(client, `(window.__errors || []).join(' | ')`);
  console.log('page errors:', pageErrors || 'none');

  client.close();
}

main().catch((error) => {
  console.error('UI SMOKE FAILED', error);
  process.exit(1);
});
