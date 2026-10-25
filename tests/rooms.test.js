const assert = require("node:assert");
const WebSocket = require("ws");

const URL = "ws://localhost:3000";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (ws, payload) => ws.send(JSON.stringify(payload));

function connect() {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    ws.messages = [];
    ws.on("message", (d) => ws.messages.push(JSON.parse(d.toString())));
    ws.on("open", () => resolve(ws));
  });
}

const last = (ws, type) => [...ws.messages].reverse().find((m) => m.type === type);

async function main() {
  const a = await connect();
  const b = await connect();

  // dołączanie do pokoju
  send(a, { type: "join", room: "test", name: "A" });
  await wait(100);
  send(b, { type: "join", room: "test", name: "B" });
  await wait(100);

  assert.strictEqual(last(b, "joined").users.length, 2, "B powinien widzieć 2 użytkowników");
  assert.ok(last(a, "user_joined"), "A powinien dostać user_joined");

  // play trafia do drugiego klienta, ale nie wraca do nadawcy
  send(a, { type: "play", time: 12.5 });
  await wait(100);
  assert.deepStrictEqual(
    { playing: last(b, "state").playing, time: last(b, "state").time },
    { playing: true, time: 12.5 }
  );
  assert.strictEqual(last(a, "state"), undefined, "nadawca nie powinien dostać własnego state");

  // seek zachowuje stan odtwarzania
  send(b, { type: "seek", time: 40 });
  await wait(100);
  assert.strictEqual(last(a, "state").playing, true);
  assert.strictEqual(last(a, "state").time, 40);

  // pause
  send(a, { type: "pause", time: 41 });
  await wait(100);
  assert.strictEqual(last(b, "state").playing, false);

  // walidacja
  send(a, { type: "seek", time: "abc" });
  await wait(100);
  assert.ok(last(a, "error"), "zły czas powinien dać error");

  // rozłączenie
  a.close();
  await wait(100);
  assert.ok(last(b, "user_left"), "B powinien dostać user_left");

  b.close();
  console.log("Wszystkie testy przeszły");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test nie przeszedł:", err.message);
  process.exit(1);
});