# WatchSync

Aplikacja do synchronicznego oglądania filmów w przeglądarce.
Serwer: Node.js + Express + WebSocket (`ws`). Klient: HTML/CSS/JS.

## Podział prac
- Kuba: frontend (`client/`)
- Łukasz: backend (`server/`)

## Wymagania
- Node.js 18 lub nowszy

## Uruchomienie
```bash
npm install
npm run dev    # z automatycznym restartem (nodemon)
npm start      # zwykłe uruchomienie
npm test       # testy (serwer musi działać w drugim terminalu)
```
Aplikacja działa pod adresem http://localhost:3000

Udostępnianie ekranu (`getDisplayMedia`) działa tylko na `localhost` albo przez HTTPS.

## Struktura projektu
```
client/   # interfejs (Kuba)
server/   # serwer HTTP i WebSocket (Łukasz)
tests/    # testy
```

## Role w pokoju
- **Host** to twórca pokoju. Tylko host steruje odtwarzaniem (`play`/`pause`/`seek`), zmienia film (`set_video`) i udostępnia ekran.
- **Gość** ogląda, pisze na czacie i może poprosić o aktualny stan (`sync_request`). W odtwarzaczu ma tylko głośność, wyciszenie i pełny ekran: bez play/pauzy, przewijania i ustawień.
- Gdy host wyjdzie, rolę przejmuje osoba, która jest w pokoju najdłużej (`host_changed`); udostępnianie ekranu kończy się razem z hostem.

## Protokół WebSocket (JSON)

### Klient → serwer
| type | pola | kto | opis |
|---|---|---|---|
| `create` | `name`, `roomName` (opcjonalna nazwa), `room` (opcjonalny kod: 3-32 znaki, litery/cyfry/`-`/`_`), `videoUrl` (opcjonalny, http/https) | każdy | tworzy pokój i zostaje jego hostem; bez `room` serwer generuje kod; kody nie rozróżniają wielkości liter |
| `join` | `room`, `name` | każdy | dołącza do **istniejącego** pokoju (`room_not_found`, gdy nie ma) |
| `play` / `pause` / `seek` | `time` (s, liczba >= 0) | host | zmiana stanu odtwarzania |
| `set_video` | `url` (http/https) | host | zmiana filmu w trakcie sesji; stan wraca na 0:00, pauza |
| `sync_request` | — | każdy | serwer odsyła aktualny `state` tylko do pytającego |
| `screen_start` / `screen_stop` | — | host | początek / koniec udostępniania ekranu |
| `signal` | `to` (userId), `data` (obiekt: oferta/odpowiedź/ICE) | host ↔ gość | sygnalizacja WebRTC, serwer tylko przekazuje |
| `chat_message` | `text` (1-500 znaków) | każdy | wiadomość czatu |

### Serwer → klient
| type | pola | opis |
|---|---|---|
| `joined` | `userId`, `room` (kod), `roomName`, `users`, `hostId`, `videoUrl` (lub `null`), `screenSharing`, `state: {playing, time}` | odpowiedź na `create`/`join`; `time` jest aktualny |
| `user_joined` / `user_left` | `user: {id, name}` | zmiany w składzie pokoju |
| `host_changed` | `hostId` | nowy host po wyjściu poprzedniego |
| `state` | `playing`, `time`, `by` (userId) | zmiana od hosta (nie wraca do nadawcy) albo odpowiedź na `sync_request` |
| `video_changed` | `videoUrl`, `state`, `by` | nowy film; dostają wszyscy, także host |
| `screen_started` / `screen_stopped` | `by` (tylko start) | początek / koniec udostępniania ekranu |
| `signal` | `from` (userId), `data` | przekazana wiadomość sygnalizacyjna |
| `chat_message` | `user: {id, name}`, `text`, `time` (ms) | do wszystkich w pokoju, także do nadawcy |
| `error` | `message`, `code` | `invalid_json`, `invalid_message`, `invalid_video_url`, `invalid_room` (zły lub pusty kod), `invalid_signal`, `invalid_time`, `invalid_text`, `text_too_long`, `room_exists`, `room_not_found`, `not_in_room`, `not_host`, `not_allowed`, `unknown_user`, `unknown_type` |

## Udostępnianie ekranu
Obraz idzie przez WebRTC bezpośrednio od hosta do każdego widza (każdy widz = osobne połączenie).
Serwer WebSocket przekazuje tylko oferty, odpowiedzi i kandydatów ICE (`signal`).
Używamy publicznego serwera STUN; w sieciach, gdzie połączenie bezpośrednie jest niemożliwe, potrzebny byłby serwer TURN.

## Status
- [x] Etap 1: konfiguracja Node.js, serwer WebSocket, struktura projektu
- [x] Etap 2: pokoje, użytkownicy, zdarzenia play/pause/seek
- [x] Etap 3: późne dołączanie, stan pokoju, uprawnienia (host), zmiana filmu, czat, udostępnianie ekranu
- [ ] Etap 4: rozłączenia, testy synchronizacji i opóźnień