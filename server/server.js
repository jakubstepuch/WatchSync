const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "../client")));

// roomId -> { id, clients: Set<socket>, state: { playing, time, updatedAt } }
const rooms = new Map();

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcast(room, payload, except = null) {
  for (const client of room.clients) {
    if (client !== except) send(client, payload);
  }
}

function getOrCreateRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, {
      id,
      clients: new Set(),
      state: { playing: false, time: 0, updatedAt: Date.now() },
    });
  }
  return rooms.get(id);
}

// aktualny czas filmu z uwzględnieniem tego, że od ostatniego eventu film leci
function currentState(room) {
  const { playing, time, updatedAt } = room.state;
  const elapsed = playing ? (Date.now() - updatedAt) / 1000 : 0;
  return { playing, time: time + elapsed };
}

function publicUsers(room) {
  return [...room.clients].map((c) => ({ id: c.userId, name: c.name }));
}

function leaveRoom(socket) {
  const room = socket.room;
  if (!room) return;
  room.clients.delete(socket);
  socket.room = null;
  broadcast(room, { type: "user_left", user: { id: socket.userId, name: socket.name } });
  if (room.clients.size === 0) rooms.delete(room.id);
}

function handleMessage(socket, msg) {
  switch (msg.type) {
    case "join": {
      const roomId = String(msg.room || "").trim().slice(0, 32);
      if (!roomId) return send(socket, { type: "error", message: "Brak nazwy pokoju" });

      leaveRoom(socket); // gdyby klient był już w innym pokoju
      const room = getOrCreateRoom(roomId);
      socket.room = room;
      socket.name = String(msg.name || "Gość").trim().slice(0, 24) || "Gość";
      room.clients.add(socket);

      send(socket, {
        type: "joined",
        userId: socket.userId,
        room: room.id,
        users: publicUsers(room),
        state: currentState(room),
      });
      broadcast(room, { type: "user_joined", user: { id: socket.userId, name: socket.name } }, socket);
      break;
    }

    case "play":
    case "pause":
    case "seek": {
      const room = socket.room;
      if (!room) return send(socket, { type: "error", message: "Najpierw dołącz do pokoju" });

      const time = Number(msg.time);
      if (!Number.isFinite(time) || time < 0) {
        return send(socket, { type: "error", message: "Nieprawidłowy czas" });
      }

      const playing = msg.type === "seek" ? room.state.playing : msg.type === "play";
      room.state = { playing, time, updatedAt: Date.now() };

      // do pozostałych; nadawca już zastosował zmianę u siebie
      broadcast(room, { type: "state", playing, time, by: socket.userId }, socket);
      break;
    }

    default:
      send(socket, { type: "error", message: `Nieznany typ: ${msg.type}` });
  }
}

wss.on("connection", (socket) => {
  socket.userId = crypto.randomUUID();
  socket.room = null;
  socket.isAlive = true;
  console.log("Klient połączony:", socket.userId);

  socket.on("pong", () => { socket.isAlive = true; });

  socket.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return send(socket, { type: "error", message: "Wiadomość nie jest poprawnym JSON-em" });
    }
    handleMessage(socket, msg);
  });

  socket.on("close", () => {
    leaveRoom(socket);
    console.log("Klient rozłączony:", socket.userId);
  });

  socket.on("error", (err) => console.error("Błąd WebSocket:", err));
});

// wykrywanie "martwych" połączeń (przyda się w etapie obsługi rozłączeń)
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) { socket.terminate(); continue; }
    socket.isAlive = false;
    socket.ping();
  }
}, 30000);
wss.on("close", () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`Serwer WatchSync działa: http://localhost:${PORT}`);
});