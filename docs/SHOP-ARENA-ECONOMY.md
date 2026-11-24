# OGIL Reborn shop, rewards, and Arena integration

## Shop control panel

The control panel now has an **Item Shop** view. It supports searching the cosmetics catalog, assigning up to 24 items to Featured and 24 to Daily, saving a draft, and optionally publishing it immediately. Otherwise, the saved draft becomes active at the next 19:30 rotation in `Asia/Jerusalem`. The schedule uses the server's IANA time-zone database, so daylight-saving changes are handled automatically.

Shop selections and partner records are stored in the server's `data/` directory. Keep that directory on persistent storage when deploying the backend.

## Secure panel access

Set `OGFN_PANEL_TOKEN` as a private environment variable on the backend before using administrative controls. Enter this key in **Settings → Panel access** in the dashboard. The panel no longer treats an empty token as permission to administer a public server.

The Owner can add shop partners from **Item Shop → Partner permissions**. A partner key is generated once. Share it privately. Permissions are:
- `shop:view`: view the shop schedule and catalog.
- `shop:edit`: save the next shop draft.
- `shop:publish`: publish the saved draft immediately.

Partner keys are stored as SHA-256 hashes. The Owner key is never returned by an API.

## Starting V-Bucks

Newly created account profiles now start with 2,000 V-Bucks. This does not rewrite existing account profiles.

## Match reward API

Set `OGFN_GAME_EVENT_TOKEN` as a second private environment variable. An **authoritative game server** can then report completed events to:

`POST /ogfn-panel/api/game-events/reward`

Header: `x-ogfn-game-token: <server secret>`

JSON body:
```json
{
  "accountId": "PLAYER_ACCOUNT_ID",
  "eventType": "elimination",
  "matchId": "MATCH_ID_1234",
  "eventId": "ELIM_EVENT_0001"
}
```

Use `eventType: "elimination"` for 50 V-Bucks and `eventType: "victory"` for 200 V-Bucks. Victory rewards are one per account per match; elimination rewards require a unique event ID. Replayed events are rejected. Never call this endpoint directly from an untrusted game client: the game server must verify the event and keep the secret private.

**Important integration boundary:** this repository exposes the secure reward endpoint, but its current game-server integration does not yet emit authoritative elimination or Victory Royale events. Therefore the rewards will not be paid automatically in a live match until a supported game server sends these reports.

## OGIL ARENA modes API

`GET /api/ogil/arena/modes` exposes exactly three Arena choices: SOLO, DUOS, and SQUADS. An authenticated game session can submit its choice to `POST /api/ogil/arena/select`. The selection is stored separately from other playlists, so it does not remove or rewrite the game's other modes.

**Important client boundary:** the backend API is ready for a compatible client to call, but this project does not include an authorized in-game UI extension point for the existing proprietary Fortnite client. The API alone does not draw the CHANGE / ACCEPT modal inside the game. Do not inject code into, patch, or bypass protections in the game executable to add it; use a supported modding/client interface or an original game client.

## Validation

Run:

`npm test`

The suite covers existing matchmaking tests, Israel 19:30 rotation (including daylight-saving time), and reward deduplication.

## Persistent launcher data

When the desktop launcher starts its bundled backend, it points editable server data at the current Windows user's application-data directory. This includes backend config, player profiles, friend relationships, shop settings, shop partner permissions, reward event de-duplication records, custom cosmetics, custom PAK registry metadata, server metadata, and the shop catalog cache. The live party roster and active matchmaking sessions remain in memory because they represent current connections and are expected to expire when the backend stops.

The backend can still use the repository-local `data/` and `.profiles/` folders when it is started directly outside the desktop launcher.
