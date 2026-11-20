// Elementy strony głównej

const homeHeader = document.querySelector(".header");
const roomOptions = document.querySelector(".room-options");
const footer = document.querySelector(".footer");

// Widok tworzenia pokoju

const createRoomView = document.getElementById("createRoomView");

// Przyciski

const createRoomBtn = document.getElementById("createRoomBtn");
const backHomeBtn = document.getElementById("backHomeBtn");

// Formularz

const createRoomForm = document.getElementById("createRoomForm");
const createRoomStatus = document.getElementById("createRoomStatus");


// Przejście do formularza tworzenia pokoju

function showCreateRoom() {

    homeHeader.hidden = true;
    roomOptions.hidden = true;
    footer.hidden = true;

    createRoomView.hidden = false;

    document.getElementById("roomName").focus();
}


// Powrót do strony głównej

function showHome() {

    createRoomView.hidden = true;

    homeHeader.hidden = false;
    roomOptions.hidden = false;
    footer.hidden = false;

    createRoomStatus.textContent = "";
}


// Obsługa przycisków

createRoomBtn.addEventListener("click", showCreateRoom);

backHomeBtn.addEventListener("click", showHome);

// Połączenie z serwerem
let roomSocket = null;

// Obsługa formularza tworzenia pokoju
createRoomForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const roomName = document.getElementById("roomName").value.trim();
    const videoUrl = document.getElementById("videoUrl").value.trim();
    const displayName = document.getElementById("displayName").value.trim();

    if (!roomName || !videoUrl || !displayName) {
        createRoomStatus.textContent = "Uzupełnij wszystkie pola.";
        return;
    }

    createRoomStatus.textContent = "Łączenie z serwerem...";

    roomSocket = connectToRoom(roomName, displayName, function(message) {

    handleRoomMessage(message);

        if (message.type === "joined") {
            document.getElementById("roomNameDisplay").textContent = roomName;
            document.getElementById("roomCodeDisplay").textContent = message.room;

            const videoPlayer = document.getElementById("videoPlayer");
            videoPlayer.src = videoUrl;
            videoPlayer.load();
          
            showRoomPreview();

            leaveRoomBtn.textContent = "Opuść pokój";
            document.getElementById("syncStatus").textContent = "Połączono z serwerem";
        }

        if (message.type === "error") {
            createRoomStatus.textContent = message.message;
        }
    });

    roomSocket.addEventListener("error", function() {
        createRoomStatus.textContent = "Błąd połączenia z serwerem.";
    });
});

// Widok dołączania do pokoju

const joinRoomView = document.getElementById("joinRoomView");

const joinRoomBtn = document.getElementById("joinRoomBtn");
const backFromJoinBtn = document.getElementById("backFromJoinBtn");

const joinRoomForm = document.getElementById("joinRoomForm");
const joinRoomStatus = document.getElementById("joinRoomStatus");


// Wyświetlanie formularza dołączania

function showJoinRoom() {

    homeHeader.hidden = true;
    roomOptions.hidden = true;
    footer.hidden = true;

    createRoomView.hidden = true;
    joinRoomView.hidden = false;

    // Przeniesienie kodu wpisanego na stronie głównej

    const homeRoomCode = document.getElementById("roomCode");
    const joinRoomCode = document.getElementById("joinRoomCode");

    joinRoomCode.value = homeRoomCode.value.trim();

    joinRoomStatus.textContent = "";

    if (joinRoomCode.value) {
        document.getElementById("joinDisplayName").focus();
    } else {
        joinRoomCode.focus();
    }
}


// Powrót na stronę główną

function backFromJoin() {

    joinRoomView.hidden = true;

    showHome();
}


// Obsługa przycisków

joinRoomBtn.addEventListener("click", showJoinRoom);

backFromJoinBtn.addEventListener("click", backFromJoin);


// Dołączanie do pokoju
joinRoomForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const roomCode = document.getElementById("joinRoomCode").value.trim();
    const displayName = document.getElementById("joinDisplayName").value.trim();

    if (!roomCode || !displayName) {
        joinRoomStatus.textContent = "Uzupełnij wszystkie pola.";
        return;
    }

    joinRoomStatus.textContent = "Łączenie z pokojem...";

    roomSocket = connectToRoom(roomCode, displayName, function(message) {

    handleRoomMessage(message);

        if (message.type === "joined") {
            document.getElementById("roomNameDisplay").textContent = message.room;
            document.getElementById("roomCodeDisplay").textContent = message.room;

            showRoomPreview();

            leaveRoomBtn.textContent = "Opuść pokój";
            document.getElementById("syncStatus").textContent = "Połączono z serwerem";

            console.log("Uczestnicy pokoju:", message.users);
        }

        if (message.type === "error") {
            joinRoomStatus.textContent = message.message;
        }
    });

    roomSocket.addEventListener("error", function() {
        joinRoomStatus.textContent = "Błąd połączenia z serwerem.";
    });
});

// --PODGLĄD INTERFEJSU POKOJU--
// 

const roomView = document.getElementById("roomView");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");

// Wyświetlenie pokoju w trybie podglądu

function showRoomPreview() {

    document.querySelector(".container").classList.add("room-layout");
    
    // Ukrycie pozostałych widoków
    homeHeader.hidden = true;
    roomOptions.hidden = true;
    createRoomView.hidden = true;
    joinRoomView.hidden = true;
    footer.hidden = true;

    // Wyświetlenie pokoju
    roomView.hidden = false;

    leaveRoomBtn.textContent = "Zamknij podgląd";
}

// Zamknięcie podglądu

function closeRoomPreview() {

    if (roomSocket) {
    roomSocket.close();
    roomSocket = null;
}
    document.querySelector(".container").classList.remove("room-layout");
    
    roomView.hidden = true;
    showHome();
}

// Obsługa przycisku powrotu

leaveRoomBtn.addEventListener("click", closeRoomPreview);

// Uruchomienie podglądu na podstawie adresu URL

const params = new URLSearchParams(window.location.search);

if (params.get("preview") === "room") {
    showRoomPreview();
}

// --- OBSŁUGA ZDARZEŃ ODTWARZACZA HTML5 ---

const player = document.getElementById("videoPlayer");
const lastActionElement = document.getElementById("lastAction");

// Wyświetlanie ostatniej akcji użytkownika
function showPlayerAction(message) {
    lastActionElement.textContent = message;
    console.log("Odtwarzacz:", message);
}

// Rozpoczęcie odtwarzania
player.addEventListener("play", function() {

    showPlayerAction("Rozpoczęto odtwarzanie");

    // Nie odsyłamy do serwera zdarzenia wywołanego synchronizacją
    if (suppressNextPlay) {
        suppressNextPlay = false;
        return;
    }

    if (roomSocket && roomSocket.readyState === WebSocket.OPEN) {

        roomSocket.send(JSON.stringify({
            type: "play",
            time: player.currentTime
        }));

        console.log("Wysłano PLAY:", player.currentTime);
    }
});
player.addEventListener("pause", function() {

    showPlayerAction("Wstrzymano odtwarzanie");

    if (suppressNextPause) {
        suppressNextPause = false;
        return;
    }

    if (roomSocket && roomSocket.readyState === WebSocket.OPEN) {

        roomSocket.send(JSON.stringify({
            type: "pause",
            time: player.currentTime
        }));

        console.log("Wysłano PAUSE:", player.currentTime);
    }
});

// Przewijanie filmu
player.addEventListener("seeked", function() {
    const time = player.currentTime.toFixed(1);
    showPlayerAction(`Przewinięto do ${time} s`);
});

// --- SYNCHRONIZACJA PLAY PRZEZ WEBSOCKET ---

let suppressNextPlay = false;
let suppressNextPause = false;

// Odbieranie aktualizacji stanu z serwera
function handleRoomMessage(message) {

    // Synchronizacja zatrzymania odtwarzania
if (message.type === "state" && message.playing === false) {

    if (!player.currentSrc) return;

    const time = Number(message.time);

    if (Number.isFinite(time) && Math.abs(player.currentTime - time) > 0.5) {
        player.currentTime = time;
    }

    if (!player.paused) {
        suppressNextPause = true;
        player.pause();
    }

    return;
}
    if (message.type !== "state" || message.playing !== true) {
        return;
    }

    if (!player.currentSrc) {
        console.log("Nie załadowano filmu do odtwarzacza.");
        return;
    }

    // Ustawienie pozycji otrzymanej z serwera
    const time = Number(message.time);

    if (Number.isFinite(time) && Math.abs(player.currentTime - time) > 0.5) {
        player.currentTime = time;
    }

    // Uruchomienie odtwarzania bez ponownego wysyłania PLAY
    if (player.paused) {
        suppressNextPlay = true;

        player.play().catch(function(error) {
            suppressNextPlay = false;
            console.error("Nie udało się rozpocząć odtwarzania:", error);
        });
    }
}