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
```
Aplikacja działa pod adresem http://localhost:3000

## Struktura projektu
```
client/   # interfejs (Kuba)
server/   # serwer HTTP i WebSocket (Łukasz)
tests/    # testy
```
