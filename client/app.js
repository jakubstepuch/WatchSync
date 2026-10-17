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


// Obsługa formularza

createRoomForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const roomName = document.getElementById("roomName").value.trim();
    const videoUrl = document.getElementById("videoUrl").value.trim();
    const displayName = document.getElementById("displayName").value.trim();

    if (!roomName || !videoUrl || !displayName) {
        createRoomStatus.textContent = "Uzupełnij wszystkie pola.";
        return;
    }

    createRoomStatus.textContent =
        "Formularz jest gotowy. Tworzenie pokoju będzie dostępne po połączeniu z serwerem.";

    console.log("Dane nowego pokoju:", {
        roomName,
        videoUrl,
        displayName
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


// Obsługa formularza dołączania

joinRoomForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const roomCode = document.getElementById("joinRoomCode").value.trim();
    const displayName = document.getElementById("joinDisplayName").value.trim();

    if (!roomCode || !displayName) {
        joinRoomStatus.textContent = "Uzupełnij wszystkie pola.";
        return;
    }

    joinRoomStatus.textContent =
        "Formularz jest gotowy. Dołączanie będzie dostępne po połączeniu z serwerem.";

    console.log("Dane dołączania:", {
        roomCode,
        displayName
    });

});
// 
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

