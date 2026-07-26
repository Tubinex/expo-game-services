# @tubinex/expo-game-services

Expo native module for Apple Game Center and Google Play Games Services v2. It provides platform authentication, server identity proofs, achievements, leaderboards, and native provider UI.

[![NPM Version](https://img.shields.io/npm/v/@tubinex/expo-game-services.svg)](https://www.npmjs.com/package/@tubinex/expo-game-services)
[![License](https://img.shields.io/npm/l/@tubinex/expo-game-services.svg)](https://github.com/Tubinex/expo-game-services/blob/master/LICENSE)

This package supports iOS and Android.

## Install

```sh
npm install @tubinex/expo-game-services
```

Add the config plugin to `app.json` or `app.config.js`:

```json
{
    "expo": {
        "plugins": [
            [
                "@tubinex/expo-game-services",
                {
                    "ios": {
                        "enabled": true
                    },
                    "android": {
                        "enabled": true,
                        "playGamesAppId": "123456789012"
                    }
                }
            ]
        ]
    }
}
```

`playGamesAppId` is the numeric Play Games Services application ID, not an OAuth client ID. The plugin adds no secrets.

Build a new development, EAS, or store binary after installing or upgrading this package. Game Center and Play Games cannot run in Expo Go. The package is import-safe when the native module is absent, and promise APIs reject with a typed `native-module-unavailable` error.

## Usage

```ts
import { gameServices, GameServicesError } from '@tubinex/expo-game-services';

async function connect() {
    try {
        const state = await gameServices.authentication.signIn();
        if (state.status !== 'authenticated') return;

        await gameServices.achievements.unlock('first_win');
        await gameServices.leaderboards.submitScore('high_scores', 4200);
    } catch (error) {
        if (error instanceof GameServicesError && error.code === 'native-module-unavailable') return;
        throw error;
    }
}
```

Use the native provider dashboards when a custom screen is unnecessary:

```ts
await gameServices.achievements.showUI();
await gameServices.leaderboards.showUI({ leaderboardId: 'high_scores' });
```

## Backend identity exchange

Successful platform authentication is not an application session. Request proof only immediately before sending it to your authenticated backend over TLS:

```ts
const proof = await gameServices.authentication.requestServerIdentityProof({
    serverClientId: process.env.EXPO_PUBLIC_GOOGLE_SERVER_CLIENT_ID,
});
```

-   On iOS, the result is a Game Center identity-verification signature bundle. Before fetching its public key, require HTTPS, allow only Apple's documented public-key host and path, disable redirects, and reject private, loopback, link-local, and other non-public address resolution. Then verify the signature, timestamp freshness, app identity, and replay protection on your server.
-   On Android, the result is a one-time Play Games server auth code. Exchange it only on your server using server-held OAuth credentials.

Do not send either proof to an existing Apple or Google OAuth ID-token endpoint, persist it in analytics, or log it.

## Console prerequisites

### Apple

1. Enable Game Center for the app identifier and App Store Connect app.
2. Create achievements and leaderboards in App Store Connect.
3. Regenerate provisioning profiles if the new entitlement requires it.

### Google

1. Create and link a Play Games Services project to the Android package.
2. Register the SHA-1 certificates used by development, EAS, upload, and Play App Signing builds.
3. Create achievements and leaderboards, add testers, and publish the Play Games configuration to the testing track.

## Platform differences

-   Game Center supports percentage-based achievement progress. Play Games needs console-defined incremental achievements for step progress, use `increment` for those and `unlock` for binary achievements.
-   Platform leaderboard time scopes are provider-defined. They do not automatically model application-specific daily boards.
-   Platform player IDs are not a cross-platform account identifier. Link them to application accounts only through explicit, server-verified flows.
-   Platform sign-out is controlled by the operating system and provider, this package does not offer a universal sign-out method.

## API

-   `gameServices.authentication.getState()`
-   `gameServices.authentication.signIn()`
-   `gameServices.authentication.addStateListener(listener)`
-   `gameServices.authentication.requestServerIdentityProof(options)`
-   `gameServices.capabilities.get()`
-   `gameServices.achievements.load()`
-   `gameServices.achievements.reportProgress(id, percentComplete)`
-   `gameServices.achievements.unlock(id)`
-   `gameServices.achievements.increment(id, steps)`
-   `gameServices.achievements.showUI()`
-   `gameServices.leaderboards.loadMetadata(ids?)`
-   `gameServices.leaderboards.loadScores(request)`
-   `gameServices.leaderboards.loadCurrentPlayerScore(request)`
-   `gameServices.leaderboards.submitScore(id, score, context?)`
-   `gameServices.leaderboards.showUI(options?)`

Check `gameServices.capabilities.get()` before using optional provider behavior.
