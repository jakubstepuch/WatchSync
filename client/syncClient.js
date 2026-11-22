// mode: "create" (tworzy pokój; videoUrl opcjonalny) albo "join" (dołącza do istniejącego)
function connectToRoom(roomCode, displayName, onMessage, options = {}) {
    const mode = options.mode || "join";
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${location.host}`);

    socket.addEventListener("open", () => {
        const payload = {
            type: mode,
            room: roomCode,
            name: displayName
        };

        if (mode === "create") {
            if (options.videoUrl) payload.videoUrl = options.videoUrl;
            if (options.roomName) payload.roomName = options.roomName;
        }

        socket.send(JSON.stringify(payload));
    });

    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        onMessage(message);
    });

    socket.addEventListener("error", (error) => {
        console.error("Błąd WebSocket:", error);
    });

    return socket;
}