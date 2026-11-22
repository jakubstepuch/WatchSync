const assert = require("node:assert");
const WebSocket = require("ws");

const URL = "ws://localhost:3000";
const VIDEO = "https://example.com/film.mp4";
const VIDEO2 = "https://example.com/inny.mp4";
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
const lastError = (ws) => last(ws, "error");
const indexOfType = (ws, type) => ws.messages.findIndex((m) => m.type === type);

async function main() {
  const a = await connect(); // host
  const b = await connect(); // gość
  const room = "TEST-" + Date.now(); // kody są zapisywane wielkimi literami

  // ---------- tworzenie i dołączanie ----------

  // dołączenie do nieistniejącego pokoju NIE tworzy pokoju
  send(b, { type: "join", room, name: "B" });
  await wait(100);
  assert.strictEqual(lastError(b).code, "room_not_found");
  assert.strictEqual(last(b, "joined"), undefined);

  // create: niepoprawny adres filmu
  for (const bad of ["nie-url", "javascript:alert(1)"]) {
    send(a, { type: "create", room, name: "A", videoUrl: bad });
    await wait(100);
    assert.strictEqual(lastError(a).code, "invalid_video_url", bad);
  }

  // create: niepoprawny kod pokoju (za krótki, niedozwolone znaki)
  for (const badCode of ["ab", "z spacją", "kod/ukośnik"]) {
    send(a, { type: "create", room: badCode, name: "A", videoUrl: VIDEO });
    await wait(100);
    assert.strictEqual(lastError(a).code, "invalid_room", badCode);
  }

  // create z filmem: twórca jest hostem, nazwa pokoju osobna od kodu
  send(a, { type: "create", room, roomName: "Wieczorny seans", name: "A", videoUrl: VIDEO });
  await wait(100);
  const createdA = last(a, "joined");
  assert.strictEqual(createdA.room, room);
  assert.strictEqual(createdA.roomName, "Wieczorny seans");
  assert.strictEqual(createdA.videoUrl, VIDEO);
  assert.strictEqual(createdA.hostId, createdA.userId, "twórca pokoju jest hostem");
  assert.strictEqual(createdA.screenSharing, false);
  assert.deepStrictEqual(createdA.state, { playing: false, time: 0 });

  // create z zajętym kodem
  const c = await connect();
  send(c, { type: "create", room, name: "C", videoUrl: VIDEO });
  await wait(100);
  assert.strictEqual(lastError(c).code, "room_exists");

  // create bez filmu i bez kodu: film opcjonalny, kod generowany
  send(c, { type: "create", name: "C" });
  await wait(100);
  const createdC = last(c, "joined");
  assert.match(createdC.room, /^[A-Z2-9]{6}$/);
  assert.strictEqual(createdC.roomName, createdC.room, "bez nazwy pokazujemy kod");
  assert.strictEqual(createdC.videoUrl, null);
  c.close();

  // ---------- późne dołączanie ----------

  send(a, { type: "play", time: 10 });
  await wait(1200);
  send(b, { type: "join", room, name: "B" });
  await wait(100);
  const joinedB = last(b, "joined");
  assert.strictEqual(joinedB.roomName, "Wieczorny seans");
  assert.strictEqual(joinedB.videoUrl, VIDEO, "dołączający dostaje film bez wpisywania adresu");
  assert.strictEqual(joinedB.hostId, createdA.userId);
  assert.strictEqual(joinedB.users.length, 2);
  assert.strictEqual(joinedB.state.playing, true);
  assert.ok(joinedB.state.time > 10.9 && joinedB.state.time < 12, `czas ${joinedB.state.time} powinien być ok. 11.2`);
  assert.ok(last(a, "user_joined"));

  // ---------- uprawnienia ----------

  a.messages.length = 0;
  for (const msg of [
    { type: "play", time: 1 },
    { type: "pause", time: 1 },
    { type: "seek", time: 1 },
    { type: "set_video", url: VIDEO2 },
    { type: "screen_start" },
    { type: "screen_stop" },
  ]) {
    b.messages.length = 0;
    send(b, msg);
    await wait(60);
    assert.strictEqual(lastError(b).code, "not_host", `gość nie może: ${msg.type}`);
  }
  assert.strictEqual(last(a, "state"), undefined, "polecenia gościa nie docierają do hosta");

  // host steruje odtwarzaniem; nie dostaje własnego state
  send(a, { type: "play", time: 12.5 });
  await wait(100);
  assert.deepStrictEqual(
    { playing: last(b, "state").playing, time: last(b, "state").time },
    { playing: true, time: 12.5 }
  );
  assert.strictEqual(last(a, "state"), undefined);

  // seek zachowuje stan odtwarzania
  send(a, { type: "seek", time: 40 });
  await wait(100);
  assert.strictEqual(last(b, "state").playing, true);
  assert.strictEqual(last(b, "state").time, 40);

  // pause zatrzymuje czas: późno dołączający dostaje dokładnie ten moment
  send(a, { type: "pause", time: 41 });
  await wait(100);
  assert.strictEqual(last(b, "state").playing, false);
  const d = await connect();
  send(d, { type: "join", room: room.toLowerCase(), name: "D" }); // kod bez rozróżniania wielkości liter
  await wait(100);
  assert.strictEqual(last(d, "joined").room, room);
  assert.deepStrictEqual(last(d, "joined").state, { playing: false, time: 41 });

  // walidacja czasu
  send(a, { type: "seek", time: "abc" });
  await wait(100);
  assert.strictEqual(lastError(a).code, "invalid_time");

  // gość może poprosić o aktualny stan
  b.messages.length = 0;
  send(b, { type: "sync_request" });
  await wait(100);
  const sync = last(b, "state");
  assert.deepStrictEqual({ playing: sync.playing, time: sync.time }, { playing: false, time: 41 });
  assert.strictEqual(sync.by, createdA.userId);

  // ---------- zmiana filmu w trakcie sesji ----------

  send(a, { type: "set_video", url: "to nie jest url" });
  await wait(100);
  assert.strictEqual(lastError(a).code, "invalid_video_url");

  send(a, { type: "set_video", url: VIDEO2 });
  await wait(100);
  for (const ws of [a, b, d]) {
    const m = last(ws, "video_changed");
    assert.strictEqual(m.videoUrl, VIDEO2, "wszyscy (także host) dostają nowy film");
    assert.deepStrictEqual(m.state, { playing: false, time: 0 });
    assert.strictEqual(m.by, createdA.userId);
  }
  const f = await connect();
  send(f, { type: "join", room, name: "F" });
  await wait(100);
  assert.strictEqual(last(f, "joined").videoUrl, VIDEO2, "nowy gość dostaje już nowy film");
  assert.deepStrictEqual(last(f, "joined").state, { playing: false, time: 0 });

  // ---------- czat ----------

  send(a, { type: "chat_message", text: "  cześć  " });
  await wait(100);
  for (const ws of [a, b, d, f]) {
    const m = last(ws, "chat_message");
    assert.strictEqual(m.text, "cześć");
    assert.strictEqual(m.user.name, "A");
    assert.strictEqual(typeof m.time, "number");
  }
  send(b, { type: "chat_message", text: "   " });
  await wait(100);
  assert.strictEqual(lastError(b).code, "invalid_text");
  send(b, { type: "chat_message", text: "x".repeat(501) });
  await wait(100);
  assert.strictEqual(lastError(b).code, "text_too_long");

  // przed dołączeniem do pokoju
  const e = await connect();
  for (const msg of [{ type: "chat_message", text: "hej" }, { type: "play", time: 1 }, { type: "sync_request" }]) {
    send(e, msg);
    await wait(60);
    assert.strictEqual(lastError(e).code, "not_in_room", msg.type);
  }
  e.close();

  // ---------- udostępnianie ekranu (sygnalizacja) ----------

  send(a, { type: "screen_start" });
  await wait(100);
  for (const ws of [b, d, f]) {
    assert.strictEqual(last(ws, "screen_started").by, createdA.userId);
  }
  const g = await connect();
  send(g, { type: "join", room, name: "G" });
  await wait(100);
  assert.strictEqual(last(g, "joined").screenSharing, true, "późny gość wie, że ktoś udostępnia ekran");
  g.close();
  await wait(50);

  // widz -> host (oferta), host -> widz (odpowiedź)
  const idB = joinedB.userId;
  send(b, { type: "signal", to: createdA.userId, data: { type: "offer", sdp: "v=0..." } });
  await wait(100);
  assert.deepStrictEqual(last(a, "signal"), {
    type: "signal",
    from: idB,
    data: { type: "offer", sdp: "v=0..." },
  });
  send(a, { type: "signal", to: idB, data: { type: "answer", sdp: "v=0 answer" } });
  await wait(100);
  assert.strictEqual(last(b, "signal").from, createdA.userId);
  assert.strictEqual(last(b, "signal").data.type, "answer");

  // walidacja sygnalizacji
  send(b, { type: "signal", to: last(d, "joined").userId, data: { type: "offer" } });
  await wait(100);
  assert.strictEqual(lastError(b).code, "not_allowed", "goście nie przekazują sobie sygnałów");
  send(b, { type: "signal", to: "nie-ma-takiego", data: { type: "offer" } });
  await wait(100);
  assert.strictEqual(lastError(b).code, "unknown_user");
  send(b, { type: "signal", to: createdA.userId, data: "tekst" });
  await wait(100);
  assert.strictEqual(lastError(b).code, "invalid_signal");

  // host kończy udostępnianie
  send(a, { type: "screen_stop" });
  await wait(100);
  for (const ws of [b, d, f]) assert.ok(last(ws, "screen_stopped"));

  // zmiana filmu w trakcie udostępniania kończy udostępnianie
  send(a, { type: "screen_start" });
  await wait(100);
  d.messages.length = 0;
  send(a, { type: "set_video", url: VIDEO });
  await wait(100);
  assert.ok(indexOfType(d, "screen_stopped") !== -1, "set_video kończy udostępnianie ekranu");
  assert.ok(last(d, "video_changed"));

  // ---------- host wychodzi ----------

  send(a, { type: "screen_start" });
  await wait(100);
  b.messages.length = 0;
  a.close();
  await wait(150);
  assert.ok(last(b, "user_left"));
  const iStopped = indexOfType(b, "screen_stopped");
  const iHost = indexOfType(b, "host_changed");
  assert.ok(iStopped !== -1, "udostępnianie kończy się razem z hostem");
  assert.ok(iHost > iStopped, "najpierw screen_stopped, potem host_changed");
  assert.strictEqual(last(b, "host_changed").hostId, idB, "B jest w pokoju najdłużej, więc zostaje hostem");
  assert.strictEqual(last(d, "host_changed").hostId, idB);

  // nowy host steruje, reszta już nie
  send(b, { type: "play", time: 5 });
  await wait(100);
  assert.strictEqual(last(d, "state").time, 5);
  send(d, { type: "pause", time: 6 });
  await wait(100);
  assert.strictEqual(lastError(d).code, "not_host");

  // ---------- sprzątanie ----------

  b.close();
  d.close();
  f.close();
  await wait(150);
  const h = await connect();
  send(h, { type: "join", room, name: "H" });
  await wait(100);
  assert.strictEqual(lastError(h).code, "room_not_found", "pusty pokój jest usuwany");
  h.close();

  console.log("Wszystkie testy przeszły");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test nie przeszedł:", err.message);
  process.exit(1);
});