const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 3000;
const MAX_CHAT_LENGTH = 500;
const ROOM_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;
const MAX_SIGNAL_SIZE = 20000; // bajty JSON-a z danymi sygnalizacji WebRTC (SDP/ICE)

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "../client")));

// roomId -> {
//   id (kod), name (nazwa wyświetlana), hostId, videoUrl (string | null), screenSharing (bool),
//   clients: Set<socket> (kolejność = kolejność dołączania),
//   state: { playing, time, updatedAt }
// }
const rooms = new Map();

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function sendError(socket, message, code) {
  send(socket, { type: "error", message, code });
}

function broadcast(room, payload, except = null) {
  for (const client of room.clients) {
    if (client !== except) send(client, payload);
  }
}

// kod pokoju generowany przez serwer (bez mylących znaków 0/O, 1/I)
function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

// przyjmujemy tylko http/https; zwraca znormalizowany adres albo null
function parseVideoUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
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

function cleanName(value) {
  return String(value || "Gość").trim().slice(0, 24) || "Gość";
}

function stopScreenShare(room) {
  if (!room.screenSharing) return;
  room.screenSharing = false;
  broadcast(room, { type: "screen_stopped" });
}

function leaveRoom(socket) {
  const room = socket.room;
  if (!room) return;
  room.clients.delete(socket);
  socket.room = null;

  if (room.clients.size === 0) {
    rooms.delete(room.id);
    return;
  }

  broadcast(room, { type: "user_left", user: { id: socket.userId, name: socket.name } });

  // host wyszedł: rolę przejmuje osoba, która jest w pokoju najdłużej
  if (room.hostId === socket.userId) {
    stopScreenShare(room); // udostępniał host, więc strumień znika razem z nim
    const newHost = room.clients.values().next().value;
    room.hostId = newHost.userId;
    broadcast(room, { type: "host_changed", hostId: room.hostId });
  }
}

// wspólna część create i join: wpisanie klienta do pokoju + odpowiedź `joined`
function enterRoom(socket, room, name) {
  socket.room = room;
  socket.name = name;
  room.clients.add(socket);

  send(socket, {
    type: "joined",
    userId: socket.userId,
    room: room.id,
    roomName: room.name,
    users: publicUsers(room),
    hostId: room.hostId,
    videoUrl: room.videoUrl,
    screenSharing: room.screenSharing,
    state: currentState(room),
  });
  broadcast(room, { type: "user_joined", user: { id: socket.userId, name: socket.name } }, socket);
}

function requireRoom(socket) {
  if (!socket.room) {
    sendError(socket, "Najpierw dołącz do pokoju", "not_in_room");
    return null;
  }
  return socket.room;
}

function requireHost(socket) {
  const room = requireRoom(socket);
  if (!room) return null;
  if (room.hostId !== socket.userId) {
    sendError(socket, "Tylko host może to zrobić", "not_host");
    return null;
  }
  return room;
}

function handleMessage(socket, msg) {
  switch (msg.type) {
    case "create": {
      // film jest opcjonalny: można go dodać później (set_video) albo udostępnić ekran
      let videoUrl = null;
      if (msg.videoUrl !== undefined && msg.videoUrl !== null && msg.videoUrl !== "") {
        videoUrl = parseVideoUrl(msg.videoUrl);
        if (!videoUrl) {
          return sendError(socket, "Podaj poprawny adres filmu (http/https)", "invalid_video_url");
        }
      }

      // kod: wybrany przez hosta albo wygenerowany; kody nie rozróżniają wielkości liter
      const requested = String(msg.room || "").trim().toUpperCase();
      if (requested && !ROOM_CODE_PATTERN.test(requested)) {
        return sendError(socket, "Kod pokoju: 3-32 znaki (litery, cyfry, - i _)", "invalid_room");
      }
      if (requested && rooms.has(requested)) {
        return sendError(socket, "Pokój o takim kodzie już istnieje", "room_exists");
      }
      const roomId = requested || generateRoomCode();

      // nazwa pokoju jest osobna od kodu; bez nazwy pokazujemy kod
      const roomName = String(msg.roomName || "").trim().slice(0, 50) || roomId;

      leaveRoom(socket);
      const room = {
        id: roomId,
        name: roomName,
        hostId: socket.userId, // twórca pokoju jest hostem
        videoUrl,
        screenSharing: false,
        clients: new Set(),
        state: { playing: false, time: 0, updatedAt: Date.now() },
      };
      rooms.set(roomId, room);
      enterRoom(socket, room, cleanName(msg.name));
      break;
    }

    case "join": {
      const roomId = String(msg.room || "").trim().toUpperCase().slice(0, 32);
      if (!roomId) return sendError(socket, "Podaj kod pokoju", "invalid_room");

      const room = rooms.get(roomId);
      if (!room) {
        // celowo nie tworzymy pokoju – od tego jest `create`
        return sendError(socket, "Pokój o takim kodzie nie istnieje", "room_not_found");
      }

      leaveRoom(socket); // gdyby klient był już w innym pokoju
      enterRoom(socket, room, cleanName(msg.name));
      break;
    }

    case "play":
    case "pause":
    case "seek": {
      const room = requireHost(socket);
      if (!room) return;

      const time = Number(msg.time);
      if (!Number.isFinite(time) || time < 0) {
        return sendError(socket, "Nieprawidłowy czas", "invalid_time");
      }

      const playing = msg.type === "seek" ? room.state.playing : msg.type === "play";
      room.state = { playing, time, updatedAt: Date.now() };

      // do pozostałych; nadawca już zastosował zmianę u siebie
      broadcast(room, { type: "state", playing, time, by: socket.userId }, socket);
      break;
    }

    // gość prosi o aktualny stan (np. po dołączeniu albo gdy mu się rozjechało)
    case "sync_request": {
      const room = requireRoom(socket);
      if (!room) return;
      send(socket, { type: "state", ...currentState(room), by: room.hostId });
      break;
    }

    // host zmienia film w trakcie sesji
    case "set_video": {
      const room = requireHost(socket);
      if (!room) return;

      const videoUrl = parseVideoUrl(msg.url);
      if (!videoUrl) {
        return sendError(socket, "Podaj poprawny adres filmu (http/https)", "invalid_video_url");
      }

      stopScreenShare(room); // film zastępuje udostępnianie ekranu
      room.videoUrl = videoUrl;
      room.state = { playing: false, time: 0, updatedAt: Date.now() };

      // do wszystkich, także do hosta: jedno źródło prawdy
      broadcast(room, {
        type: "video_changed",
        videoUrl,
        state: { playing: false, time: 0 },
        by: socket.userId,
      });
      break;
    }

    // --- udostępnianie ekranu (WebRTC; serwer tylko pośredniczy w sygnalizacji) ---

    case "screen_start": {
      const room = requireHost(socket);
      if (!room) return;
      if (room.screenSharing) return;

      room.screenSharing = true;
      broadcast(room, { type: "screen_started", by: socket.userId }, socket);
      break;
    }

    case "screen_stop": {
      const room = requireHost(socket);
      if (!room) return;
      stopScreenShare(room);
      break;
    }

    // przekazanie oferty/odpowiedzi/ICE między hostem a widzem
    case "signal": {
      const room = requireRoom(socket);
      if (!room) return;

      if (typeof msg.to !== "string" || !msg.data || typeof msg.data !== "object") {
        return sendError(socket, "Nieprawidłowa wiadomość sygnalizacyjna", "invalid_signal");
      }
      if (JSON.stringify(msg.data).length > MAX_SIGNAL_SIZE) {
        return sendError(socket, "Wiadomość sygnalizacyjna jest za duża", "invalid_signal");
      }

      const target = [...room.clients].find((c) => c.userId === msg.to);
      if (!target) return sendError(socket, "Nie ma takiego użytkownika w pokoju", "unknown_user");

      // sygnalizacja ma sens tylko między hostem a widzem
      if (socket.userId !== room.hostId && target.userId !== room.hostId) {
        return sendError(socket, "Niedozwolona wiadomość", "not_allowed");
      }

      send(target, { type: "signal", from: socket.userId, data: msg.data });
      break;
    }

    case "chat_message": {
      const room = requireRoom(socket);
      if (!room) return;

      const text = typeof msg.text === "string" ? msg.text.trim() : "";
      if (!text) return sendError(socket, "Wiadomość jest pusta", "invalid_text");
      if (text.length > MAX_CHAT_LENGTH) {
        return sendError(socket, `Wiadomość jest za długa (max ${MAX_CHAT_LENGTH} znaków)`, "text_too_long");
      }

      // do wszystkich w pokoju, także do nadawcy
      broadcast(room, {
        type: "chat_message",
        user: { id: socket.userId, name: socket.name },
        text,
        time: Date.now(),
      });
      break;
    }

    default:
      sendError(socket, `Nieznany typ: ${msg.type}`, "unknown_type");
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
      return sendError(socket, "Wiadomość nie jest poprawnym JSON-em", "invalid_json");
    }
    if (!msg || typeof msg !== "object") {
      return sendError(socket, "Nieprawidłowa wiadomość", "invalid_message");
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