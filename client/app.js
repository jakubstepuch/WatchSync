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

// Wysłanie wiadomości do serwera; zwraca true, jeśli połączenie było otwarte
function sendToServer(payload) {
    if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) return false;
    roomSocket.send(JSON.stringify(payload));
    return true;
}

// Reakcja na nieoczekiwane zamknięcie połączenia (np. restart serwera)
function watchSocket(socket) {
    socket.addEventListener("close", function() {
        // Zamknięcie świadome (opuszczenie pokoju) ma już wyczyszczony roomSocket
        if (socket !== roomSocket) return;

        setChatEnabled(false);
        stopScreenShare();
        stopViewing();
        hideScreen();
        document.getElementById("syncStatus").textContent = "Rozłączono z serwerem";
    });
}

// Obsługa formularza tworzenia pokoju
createRoomForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const roomName = document.getElementById("roomName").value.trim();
    const roomCode = document.getElementById("roomCodeInput").value.trim(); // opcjonalny
    const videoUrl = document.getElementById("videoUrl").value.trim(); // opcjonalny
    const displayName = document.getElementById("displayName").value.trim();

    if (!roomName || !displayName) {
        createRoomStatus.textContent = "Uzupełnij nazwę pokoju i swoją nazwę.";
        return;
    }

    createRoomStatus.textContent = "Łączenie z serwerem...";

    roomSocket = connectToRoom(roomCode, displayName, function(message) {

        handleRoomMessage(message);

        if (message.type === "joined") {
            document.getElementById("roomNameDisplay").textContent = message.roomName;
            document.getElementById("roomCodeDisplay").textContent = message.room;

            showRoomPreview();

            leaveRoomBtn.textContent = "Opuść pokój";
            document.getElementById("syncStatus").textContent = "Połączono z serwerem";
        }

        if (message.type === "error") {
            createRoomStatus.textContent = message.message;
        }
    }, { mode: "create", videoUrl: videoUrl, roomName: roomName });

    watchSocket(roomSocket);

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
            document.getElementById("roomNameDisplay").textContent = message.roomName;
            document.getElementById("roomCodeDisplay").textContent = message.room;

            showRoomPreview();

            leaveRoomBtn.textContent = "Opuść pokój";
            document.getElementById("syncStatus").textContent = "Połączono z serwerem";

            console.log("Uczestnicy pokoju:", message.users);
        }

        if (message.type === "error") {
            joinRoomStatus.textContent = message.message;
        }
    }, { mode: "join" });

    watchSocket(roomSocket);

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
        const socketToClose = roomSocket;
        roomSocket = null;      // najpierw zerujemy, żeby watchSocket nie traktował tego jak awarii
        stopScreenShare();      // host: zatrzymanie własnego strumienia (bez połączenia nic nie wysyła)
        socketToClose.close();
    }

    resetRoomUi();

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

// --- ROLE: HOST I GOŚĆ ---

const hostControls = document.getElementById("hostControls");
const guestControls = document.getElementById("guestControls");
const roleBadge = document.getElementById("roleBadge");

let myUserId = null;
let hostId = null;

function isHost() {
    return myUserId !== null && myUserId === hostId;
}

// Host steruje odtwarzaniem; gość widzi tylko własną głośność i przycisk "Synchronizuj"
function applyRole() {
    const host = isHost();

    const guest = myUserId !== null && !host;

    hostControls.hidden = !host;
    guestControls.hidden = !guest;
    guestBar.hidden = !guest;
    playerTools.hidden = guest;       // gość ma pełny ekran w swoim pasku
    player.controls = !guest;         // gość: brak play/pauzy, przewijania i ustawień
    screenPlayer.controls = false;

    if (guest) {
        applyGuestAudio();
    } else {
        player.muted = false;
    }

    roleBadge.textContent = myUserId === null ? "" : (host ? "Jesteś hostem" : "Steruje host");

    renderParticipants();
}

// --- UCZESTNICY POKOJU ---

const participantCountElement = document.getElementById("participantCount");
const participantListElement = document.getElementById("participantList");

let participants = []; // [{ id, name }]

// Odświeżenie licznika i listy uczestników
function renderParticipants() {
    participantCountElement.textContent = participants.length;

    // Czyścimy listę i budujemy ją od nowa (textContent chroni przed wstrzyknięciem HTML)
    participantListElement.replaceChildren();

    participants.forEach(function(user) {
        const item = document.createElement("li");

        const nameElement = document.createElement("span");
        nameElement.textContent = user.name;
        item.appendChild(nameElement);

        const tags = [];
        if (user.id === hostId) tags.push("Host");
        if (user.id === myUserId) tags.push("Ty");

        if (tags.length > 0) {
            const tagsElement = document.createElement("span");
            tagsElement.className = "participant-you";
            tagsElement.textContent = tags.join(" · ");
            item.appendChild(tagsElement);
        }

        participantListElement.appendChild(item);
    });
}

function participantName(userId) {
    const user = participants.find(function(u) { return u.id === userId; });
    return user ? user.name : "Ktoś";
}

// --- CZAT ---

const chatMessagesElement = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");

const MAX_CHAT_MESSAGES_IN_DOM = 200;

function setChatEnabled(enabled) {
    chatInput.disabled = !enabled;
    sendMessageBtn.disabled = !enabled;
}

function scrollChatToBottom() {
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
}

function addChatElement(element) {
    chatMessagesElement.appendChild(element);

    // Nie pozwalamy, żeby czat rósł w nieskończoność
    while (chatMessagesElement.children.length > MAX_CHAT_MESSAGES_IN_DOM) {
        chatMessagesElement.removeChild(chatMessagesElement.firstChild);
    }

    scrollChatToBottom();
}

// Wiadomość użytkownika
function addChatMessage(message) {
    const item = document.createElement("div");
    item.className = "chat-message";

    if (message.user && message.user.id === myUserId) {
        item.classList.add("mine");
    }

    const meta = document.createElement("div");
    meta.className = "chat-meta";

    const author = document.createElement("span");
    author.className = "chat-author";
    author.textContent = message.user ? message.user.name : "?";

    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = new Date(message.time).toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit"
    });

    meta.appendChild(author);
    meta.appendChild(time);

    const text = document.createElement("div");
    text.className = "chat-text";
    text.textContent = message.text; // textContent, nie innerHTML

    item.appendChild(meta);
    item.appendChild(text);

    addChatElement(item);
}

// Komunikat systemowy (ktoś dołączył / wyszedł / zmiana filmu)
function addSystemMessage(text) {
    const item = document.createElement("div");
    item.className = "chat-system";
    item.textContent = text;

    addChatElement(item);
}

// Wysyłanie wiadomości
chatForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const text = chatInput.value.trim();

    if (!text) return;

    // Wiadomość pojawi się po odpowiedzi serwera (rozsyła ją także do nadawcy)
    if (sendToServer({ type: "chat_message", text: text })) {
        chatInput.value = "";
        chatInput.focus();
    }
});

// --- FILM: USTAWIANIE I ZMIANA ---

const player = document.getElementById("videoPlayer");
const lastActionElement = document.getElementById("lastAction");
const videoTitleElement = document.getElementById("videoTitle");

let currentVideoUrl = null;

// Wyświetlanie ostatniej akcji użytkownika
function showPlayerAction(message) {
    lastActionElement.textContent = message;
    console.log("Odtwarzacz:", message);
}

function titleFromUrl(url) {
    try {
        const parsed = new URL(url);
        const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
        return lastSegment ? decodeURIComponent(lastSegment) : parsed.hostname;
    } catch {
        return "Film";
    }
}

function updateTitle() {
    if (!screenPlayer.hidden) {
        videoTitleElement.textContent = "Udostępniany ekran";
    } else if (currentVideoUrl) {
        videoTitleElement.textContent = titleFromUrl(currentVideoUrl);
    } else {
        videoTitleElement.textContent = "Nie wybrano materiału";
    }
}

// Załadowanie filmu do odtwarzacza (url === null czyści odtwarzacz)
function loadVideo(url) {
    currentVideoUrl = url;

    if (url) {
        player.src = url;
    } else {
        player.removeAttribute("src");
    }
    player.load();

    updateTitle();
}

// Dla osób dołączających w trakcie filmu: skok do aktualnego momentu i start, jeśli film gra
function applyInitialState(state) {
    if (!state || !currentVideoUrl) return;

    const start = function() {
        if (Number.isFinite(state.time) && state.time > 0) {
            player.currentTime = state.time;
        }

        if (state.playing) {
            suppressNextPlay = true;

            player.play().catch(function() {
                // Przeglądarka może zablokować start bez kliknięcia
                suppressNextPlay = false;
                showPlayerAction("Kliknij „Synchronizuj”, aby dołączyć do odtwarzania");
            });
        }
    };

    if (player.readyState >= 1) {
        start();
    } else {
        player.addEventListener("loadedmetadata", start, { once: true });
    }
}

// Host: zmiana filmu w trakcie sesji
const setVideoForm = document.getElementById("setVideoForm");
const setVideoInput = document.getElementById("setVideoInput");

setVideoForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const url = setVideoInput.value.trim();
    if (!url) return;

    // Film zmieni się u wszystkich (także u hosta) po odpowiedzi serwera
    if (sendToServer({ type: "set_video", url: url })) {
        setVideoInput.value = "";
    }
});

// Gość: przycisk Synchronizuj i własna głośność
const syncBtn = document.getElementById("syncBtn");

syncBtn.addEventListener("click", function() {
    sendToServer({ type: "sync_request" });
});

// Automatyczna synchronizacja uczestnika co 2 sekundy
setInterval(function() {
    // Synchronizujemy tylko uczestnika znajdującego się w pokoju
    if (roomView.hidden || myUserId === null || isHost()) {
        return;
    }

    // Film musi być załadowany
    if (!player.currentSrc) {
        return;
    }

    // Pobierz aktualny stan filmu z serwera
    sendToServer({ type: "sync_request" });

}, 2000);

// Pasek gościa: głośność, wyciszenie i pełny ekran (brak play/pauzy, przewijania i ustawień)
const guestBar = document.getElementById("guestBar");
const muteBtn = document.getElementById("muteBtn");
const volumeRange = document.getElementById("volumeRange");
const guestFullscreenBtn = document.getElementById("guestFullscreenBtn");
const playerTools = document.querySelector(".player-tools");

let guestMuted = false;

function updateMuteButton() {
    muteBtn.textContent = guestMuted ? "Włącz dźwięk" : "Wycisz";
}

// Ustawienia dźwięku gościa dotyczą zarówno filmu, jak i udostępnianego ekranu
function applyGuestAudio() {
    const volume = Number(volumeRange.value);

    player.volume = volume;
    screenPlayer.volume = volume;
    player.muted = guestMuted;
    screenPlayer.muted = guestMuted;

    updateMuteButton();
}

muteBtn.addEventListener("click", function() {
    guestMuted = !guestMuted;
    applyGuestAudio();
});

volumeRange.addEventListener("input", function() {
    // Ruszenie suwaka włącza dźwięk
    if (guestMuted && Number(volumeRange.value) > 0) guestMuted = false;
    applyGuestAudio();
});

// --- PEŁNY EKRAN ---

const fullscreenBtn = document.getElementById("fullscreenBtn");
const videoContainer = document.querySelector(".video-container");

// Pełny ekran obejmuje cały kontener, więc działa zarówno dla filmu, jak i dla udostępnianego ekranu
function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
        return;
    }

    if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen().catch(function() {});
    }
}

fullscreenBtn.addEventListener("click", toggleFullscreen);
document.getElementById("guestFullscreenBtn").addEventListener("click", toggleFullscreen);

document.addEventListener("fullscreenchange", function() {
    const label = document.fullscreenElement ? "Wyjdź z pełnego ekranu" : "Pełny ekran";

    fullscreenBtn.textContent = label;
    document.getElementById("guestFullscreenBtn").textContent = label;
});

// Gość nie ma dostępu do menu przeglądarki dla wideo (prędkość, pobieranie itp.)
videoContainer.addEventListener("contextmenu", function(event) {
    if (myUserId !== null && !isHost()) event.preventDefault();
});

// --- UDOSTĘPNIANIE EKRANU (WebRTC; serwer przekazuje tylko sygnalizację) ---

const screenPlayer = document.getElementById("screenPlayer");
const shareScreenBtn = document.getElementById("shareScreenBtn");

// STUN pozwala połączyć się przez NAT; przy restrykcyjnych sieciach potrzebny byłby serwer TURN
const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

let screenStream = null;          // host: własny strumień ekranu
const hostPeers = new Map();      // host: id widza -> { pc, pending, remoteSet }
let viewerPeer = null;            // widz: { pc, pending, remoteSet, hostId }

function showScreen() {
    player.hidden = true;
    screenPlayer.hidden = false;
    updateTitle();
}

function hideScreen() {
    screenPlayer.srcObject = null;
    screenPlayer.hidden = true;
    player.hidden = false;
    updateTitle();
}

function updateShareButton() {
    shareScreenBtn.textContent = screenStream ? "Zakończ udostępnianie" : "Udostępnij ekran";
}

shareScreenBtn.addEventListener("click", function() {
    if (screenStream) {
        stopScreenShare();
    } else {
        startScreenShare();
    }
});

// Dodanie kandydata ICE; jeśli opis zdalny jeszcze nie ustawiony, kandydat czeka w kolejce
async function addCandidate(peer, candidate) {
    if (!peer.remoteSet) {
        peer.pending.push(candidate);
        return;
    }

    try {
        await peer.pc.addIceCandidate(candidate);
    } catch (error) {
        console.warn("Nie udało się dodać kandydata ICE:", error);
    }
}

async function flushCandidates(peer) {
    peer.remoteSet = true;

    const queued = peer.pending;
    peer.pending = [];

    for (const candidate of queued) {
        await addCandidate(peer, candidate);
    }
}

// --- host ---

async function startScreenShare() {
    if (!isHost() || screenStream) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        showPlayerAction("Udostępnianie ekranu wymaga HTTPS albo adresu localhost.");
        return;
    }

    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (error) {
        showPlayerAction("Nie udostępniono ekranu.");
        return;
    }

    // Użytkownik może zakończyć udostępnianie przyciskiem przeglądarki
    screenStream.getVideoTracks()[0].addEventListener("ended", stopScreenShare);

    if (!player.paused) player.pause();

    screenPlayer.srcObject = screenStream;
    screenPlayer.muted = true;      // własny dźwięk wyciszony, żeby nie było echa
    screenPlayer.controls = false;
    screenPlayer.play().catch(function() {});
    showScreen();

    sendToServer({ type: "screen_start" });

    updateShareButton();
    showPlayerAction("Udostępniasz ekran");
}

function stopScreenShare() {
    if (!screenStream) return;

    screenStream.getTracks().forEach(function(track) { track.stop(); });
    screenStream = null;

    hostPeers.forEach(function(peer) { peer.pc.close(); });
    hostPeers.clear();

    sendToServer({ type: "screen_stop" });

    hideScreen();
    updateShareButton();
    showPlayerAction("Zakończono udostępnianie ekranu");
}

// Widz zgłasza się do hosta z ofertą; host odpowiada strumieniem
async function handleOfferAsHost(viewerId, data) {
    if (!screenStream) return;

    const old = hostPeers.get(viewerId);
    if (old) old.pc.close();

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer = { pc: pc, pending: [], remoteSet: false };
    hostPeers.set(viewerId, peer); // zapisujemy od razu, żeby kandydaci mogli czekać w kolejce

    pc.onicecandidate = function(event) {
        if (event.candidate) {
            sendToServer({
                type: "signal",
                to: viewerId,
                data: { type: "candidate", candidate: event.candidate.toJSON() }
            });
        }
    };

    try {
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });

        screenStream.getTracks().forEach(function(track) {
            pc.addTrack(track, screenStream);
        });

        await flushCandidates(peer);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendToServer({
            type: "signal",
            to: viewerId,
            data: { type: "answer", sdp: pc.localDescription.sdp }
        });
    } catch (error) {
        console.error("Błąd nawiązywania połączenia z widzem:", error);
    }
}

// --- widz ---

async function startViewing() {
    stopViewing();

    if (!hostId || isHost()) return;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer = { pc: pc, pending: [], remoteSet: false, hostId: hostId };
    viewerPeer = peer;

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = function(event) {
        screenPlayer.srcObject = event.streams[0];
        screenPlayer.controls = false;
        applyGuestAudio();

        screenPlayer.play().catch(function() {
            // Autoodtwarzanie z dźwiękiem zablokowane: startujemy bez dźwięku
            guestMuted = true;
            applyGuestAudio();
            screenPlayer.play().catch(function() {});
        });

        showScreen();
        showPlayerAction("Oglądasz udostępniany ekran");
    };

    pc.onicecandidate = function(event) {
        if (event.candidate) {
            sendToServer({
                type: "signal",
                to: peer.hostId,
                data: { type: "candidate", candidate: event.candidate.toJSON() }
            });
        }
    };

    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendToServer({
            type: "signal",
            to: peer.hostId,
            data: { type: "offer", sdp: pc.localDescription.sdp }
        });
    } catch (error) {
        console.error("Błąd rozpoczęcia oglądania ekranu:", error);
    }
}

function stopViewing() {
    if (viewerPeer) {
        viewerPeer.pc.close();
        viewerPeer = null;
    }
}

// Wiadomości sygnalizacyjne od drugiej strony
async function handleSignal(message) {
    const data = message.data || {};

    if (isHost()) {
        if (data.type === "offer") {
            await handleOfferAsHost(message.from, data);
        } else if (data.type === "candidate") {
            const peer = hostPeers.get(message.from);
            if (peer) await addCandidate(peer, data.candidate);
        }
        return;
    }

    if (!viewerPeer || message.from !== viewerPeer.hostId) return;

    if (data.type === "answer") {
        try {
            await viewerPeer.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
            await flushCandidates(viewerPeer);
        } catch (error) {
            console.error("Błąd odpowiedzi hosta:", error);
        }
    } else if (data.type === "candidate") {
        await addCandidate(viewerPeer, data.candidate);
    }
}

// Czyszczenie widoku pokoju po wyjściu
function resetRoomUi() {
    stopScreenShare();
    stopViewing();
    hideScreen();

    myUserId = null;
    hostId = null;
    participants = [];

    loadVideo(null);
    applyRole();

    chatMessagesElement.replaceChildren();
    chatInput.value = "";
    setChatEnabled(false);

    lastActionElement.textContent = "Oczekiwanie na rozpoczęcie sesji";
}

// --- OBSŁUGA ZDARZEŃ ODTWARZACZA HTML5 ---

// Tylko host wysyła zmiany stanu odtwarzania do serwera
function sendPlaybackEvent(type) {
    if (!isHost()) return;

    sendToServer({ type: type, time: player.currentTime });
    console.log("Wysłano " + type.toUpperCase() + ":", player.currentTime);
}

// Rozpoczęcie odtwarzania
player.addEventListener("play", function() {

    showPlayerAction("Rozpoczęto odtwarzanie");

    // Nie odsyłamy do serwera zdarzenia wywołanego synchronizacją
    if (suppressNextPlay) {
        suppressNextPlay = false;
        return;
    }

    sendPlaybackEvent("play");
});

player.addEventListener("pause", function() {

    showPlayerAction("Wstrzymano odtwarzanie");

    if (suppressNextPause) {
        suppressNextPause = false;
        return;
    }

    sendPlaybackEvent("pause");
});

// Przewijanie filmu
player.addEventListener("seeked", function() {
    const time = player.currentTime.toFixed(1);
    showPlayerAction(`Przewinięto do ${time} s`);

    sendPlaybackEvent("seek");
});

// --- SYNCHRONIZACJA PRZEZ WEBSOCKET ---

let suppressNextPlay = false;
let suppressNextPause = false;

// Odbieranie wiadomości z serwera
function handleRoomMessage(message) {

    if (message.type === "joined") {
        myUserId = message.userId;
        hostId = message.hostId;
        participants = message.users || [];

        chatMessagesElement.replaceChildren();
        setChatEnabled(true);

        applyRole();
        loadVideo(message.videoUrl || null);
        applyInitialState(message.state);

        // Ktoś już udostępnia ekran: zgłaszamy się do hosta po strumień
        if (message.screenSharing && !isHost()) {
            startViewing();
        }
        return;
    }

    if (message.type === "user_joined") {
        participants.push(message.user);
        renderParticipants();
        addSystemMessage(`${message.user.name} dołączył(a) do pokoju`);
        return;
    }

    if (message.type === "user_left") {
        participants = participants.filter(function(user) {
            return user.id !== message.user.id;
        });

        const peer = hostPeers.get(message.user.id);
        if (peer) {
            peer.pc.close();
            hostPeers.delete(message.user.id);
        }

        renderParticipants();
        addSystemMessage(`${message.user.name} opuścił(a) pokój`);
        return;
    }

    if (message.type === "chat_message") {
        addChatMessage(message);
        return;
    }

    if (message.type === "host_changed") {
        const wasHost = isHost();
        hostId = message.hostId;

        // Poprzedni host wyszedł, więc jego strumień zniknął
        stopViewing();
        if (!wasHost && !screenStream) hideScreen();

        applyRole();
        addSystemMessage(`${participantName(hostId)} jest teraz hostem`);
        return;
    }

    if (message.type === "video_changed") {
        loadVideo(message.videoUrl);
        hideScreen();
        showPlayerAction("Host zmienił film");
        addSystemMessage("Host zmienił film");
        return;
    }

    if (message.type === "screen_started") {
        if (!isHost()) startViewing();
        addSystemMessage(`${participantName(message.by)} udostępnia ekran`);
        return;
    }

    if (message.type === "screen_stopped") {
        stopViewing();

        if (screenStream) {
            stopScreenShare();          // host: serwer zakończył udostępnianie (np. po zmianie filmu)
        } else {
            hideScreen();
        }
        return;
    }

    if (message.type === "signal") {
        handleSignal(message);
        return;
    }

    if (message.type === "error") {
        if (!roomView.hidden) showPlayerAction(message.message);
        return;
    }

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