function connectToRoom(roomCode, displayName, onMessage) {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${location.host}`);

    socket.addEventListener("open", () => {
        socket.send(JSON.stringify({
            type: "join",
            room: roomCode,
            name: displayName
        }));
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