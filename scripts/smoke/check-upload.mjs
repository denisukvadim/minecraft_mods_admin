// Upload a file through the real file input, verify it appears, then delete it.
// The fixture is generated locally; the file lands in the backend's MODS_DIR
// while the test runs and is removed through the UI afterwards.
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:4200';
const FILE = join(tmpdir(), 'ui-upload-test.jar');
const NAME = 'ui-upload-test.jar';

writeFileSync(FILE, Buffer.alloc(4096, 1));

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
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function main() {
  const target = await createTarget(`${BASE}/mods`);
  const client = connect(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');
  await sleep(2400);

  const document = await client.send('DOM.getDocument', { depth: -1 });
  const node = await client.send('DOM.querySelector', {
    nodeId: document.root.nodeId,
    selector: 'input[type=file]',
  });
  if (!node.nodeId) {
    console.log('UPLOAD: file input not found');
    client.close();
    return;
  }

  await client.send('DOM.setFileInputFiles', {
    files: [FILE],
    nodeId: node.nodeId,
  });
  await sleep(2600);

  const afterUpload = await evaluate(
    client,
    `(() => {
      const body = document.body.innerText;
      return body.includes(${JSON.stringify(NAME)})
        ? 'uploaded and listed' : 'file missing from table';
    })()`,
  );
  console.log('UPLOAD:', afterUpload);

  const afterDelete = await evaluate(
    client,
    `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const row = [...document.querySelectorAll('tbody tr')]
        .find((tr) => tr.textContent.includes(${JSON.stringify(NAME)}));
      if (!row) return 'row missing';
      const buttons = row.querySelectorAll('button');
      buttons[buttons.length - 1].click();
      await sleep(800);
      const dialog = document.querySelector('mat-dialog-container');
      if (!dialog) return 'confirm dialog missing';
      const confirm = [...dialog.querySelectorAll('button')]
        .find((b) => b.textContent.trim().includes('Delete'));
      if (!confirm) return 'confirm button missing';
      confirm.click();
      await sleep(1800);
      return document.body.innerText.includes(${JSON.stringify(NAME)})
        ? 'file still listed' : 'deleted';
    })()`,
  );
  console.log('DELETE:', afterDelete);

  client.close();
  rmSync(FILE, { force: true });
}

main().catch((error) => {
  rmSync(FILE, { force: true });
  console.error('UPLOAD SMOKE FAILED', error);
  process.exit(1);
});
