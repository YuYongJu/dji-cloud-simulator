import { createServer } from 'net';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { Aedes } from 'aedes';
import mqtt from 'mqtt';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Start an in-memory MQTT broker on a random available port.
 * Returns { broker, server, port, url, close() }.
 */
export async function startBroker() {
  const broker = await Aedes.createBroker();
  const server = createServer(broker.handle);

  await new Promise((resolve, reject) => {
    // Bind to IPv4 explicitly. The default `server.listen(port)` on Node
    // listens on IPv6 :: which on some Windows configurations does not
    // accept connections to mqtt://127.0.0.1, and `localhost` resolves
    // to ::1 on Windows but to 127.0.0.1 on Linux — using 127.0.0.1 on
    // both sides removes the platform-specific resolution path.
    server.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  const port = server.address().port;
  const url = `mqtt://127.0.0.1:${port}`;

  return {
    broker,
    server,
    port,
    url,
    close() {
      return new Promise((resolve) => {
        broker.close(() => {
          server.close(() => resolve());
        });
      });
    },
  };
}

/**
 * Spawn the simulator as a child process.
 * Returns the ChildProcess instance.
 */
export function spawnSimulator({ brokerUrl, scenario, gateway = 'TEST-GW-001', device = 'TEST-DEV-001', extraArgs = [] } = {}) {
  const args = [
    'simulator.mjs',
    '--broker', brokerUrl,
    '--scenario', scenario,
    '--gateway', gateway,
    '--device', device,
    ...extraArgs,
  ];
  return spawn(process.execPath, args, {
    // fileURLToPath resolves correctly on Windows; URL.pathname returns
    // a leading-slash path like /C:/... which is not a valid Windows cwd.
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * Connect to the broker, subscribe to topics, collect messages until
 * the `until` predicate returns true or timeout fires.
 */
export async function collectMessages({ brokerUrl, topics, until, timeoutMs = 15000 }) {
  const messages = [];
  const client = mqtt.connect(brokerUrl, {
    clientId: `test-collector-${Date.now()}`,
    clean: true,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.end(true, () => {});
      resolve(messages);
    }, timeoutMs);

    client.on('connect', () => {
      const topicList = Array.isArray(topics) ? topics : [topics];
      for (const t of topicList) {
        client.subscribe(t, { qos: 0 });
      }
    });

    client.on('message', (topic, payload) => {
      let parsed;
      try {
        parsed = JSON.parse(payload.toString());
      } catch {
        parsed = payload.toString();
      }
      messages.push({ topic, payload: parsed });

      if (until && until(messages)) {
        clearTimeout(timer);
        client.end(true, () => {});
        resolve(messages);
      }
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      client.end(true, () => {});
      reject(err);
    });
  });
}
