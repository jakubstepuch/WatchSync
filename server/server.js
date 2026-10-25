const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "../client")));

wss.on("connection", (socket) => {
  console.log("Nowy klient WebSocket połączony");

  socket.send(JSON.stringify({
    type: "connected",
    message: "Połączono z serwerem WatchSync"
  }));

  socket.on("message", (data) => {
    console.log("Otrzymano wiadomość:", data.toString());

    socket.send(JSON.stringify({
      type: "echo",
      message: data.toString()
    }));
  });

  socket.on("close", () => {
    console.log("Klient WebSocket rozłączony");
  });

  socket.on("error", (error) => {
    console.error("Błąd WebSocket:", error);
  });
});

server.listen(PORT, () => {
  console.log(`Serwer WatchSync działa: http://localhost:${PORT}`);
});