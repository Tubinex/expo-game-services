import { requireOptionalNativeModule } from 'expo-modules-core';
import type { EmitterSubscription } from 'react-native';
import { NativeEventEmitter } from 'react-native';

import { GameServicesError, unavailableError } from './errors';
import type {
    Achievement,
    AuthenticationState,
    GameServicesCapabilities,
    LeaderboardMetadata,
    LeaderboardScores,
    LeaderboardScoresRequest,
    LeaderboardUIOptions,
    ServerIdentityProof,
} from './types';

type NativeGameServicesModule = {
    getAuthenticationState(): Promise<AuthenticationState>;
    signIn(): Promise<AuthenticationState>;
    requestServerIdentityProof(options: {
        serverClientId?: string;
        forceRefreshToken?: boolean;
    }): Promise<ServerIdentityProof>;
    getCapabilities(): Promise<GameServicesCapabilities>;
    loadAchievements(): Promise<Achievement[]>;
    reportAchievement(achievementId: string, percentComplete: number): Promise<void>;
    incrementAchievement(achievementId: string, steps: number): Promise<void>;
    showAchievements(): Promise<void>;
    loadLeaderboardMetadata(leaderboardIds?: string[]): Promise<LeaderboardMetadata[]>;
    loadLeaderboardScores(request: LeaderboardScoresRequest): Promise<LeaderboardScores>;
    loadCurrentPlayerScore(request: Omit<LeaderboardScoresRequest, 'position' | 'range'>): Promise<LeaderboardScores>;
    submitLeaderboardScore(leaderboardId: string, score: number, context?: string): Promise<void>;
    showLeaderboards(options: LeaderboardUIOptions): Promise<void>;
};

const nativeModule = requireOptionalNativeModule<NativeGameServicesModule>('ExpoGameServices');
const emitter = nativeModule ? new NativeEventEmitter(nativeModule as never) : null;

function requireModule(): NativeGameServicesModule {
    if (!nativeModule) throw unavailableError();
    return nativeModule;
}

export function nativeGameServices(): NativeGameServicesModule {
    return requireModule();
}

export function callNativeGameServices<T>(call: (module: NativeGameServicesModule) => Promise<T>): Promise<T> {
    try {
        return call(requireModule()).catch((error: unknown) => {
            throw normalizeNativeError(error);
        });
    } catch (error) {
        return Promise.reject(normalizeNativeError(error));
    }
}

export function addNativeAuthenticationListener(listener: (state: AuthenticationState) => void): EmitterSubscription {
    if (!emitter) {
        return { remove() { } } as EmitterSubscription;
    }
    return emitter.addListener('onAuthenticationStateChanged', listener);
}

export const isNativeGameServicesAvailable = nativeModule != null;

function normalizeNativeError(error: unknown): GameServicesError {
    if (error instanceof GameServicesError) return error;

    const nativeError = error as { code?: unknown; message?: unknown };
    const nativeCode = typeof nativeError.code === 'string' ? nativeError.code : '';
    const message = typeof nativeError.message === 'string' ? nativeError.message : 'Game Services request failed.';
    const codeByNativeCode: Record<string, ConstructorParameters<typeof GameServicesError>[0]> = {
        CANCELLED: 'cancelled',
        CONFIGURATION_MISSING: 'configuration-missing',
        FEATURE_UNSUPPORTED: 'feature-unsupported',
        INVALID_ARGUMENT: 'invalid-argument',
        NOT_AUTHENTICATED: 'not-authenticated',
        PROVIDER_ERROR: 'provider-error',
    };
    const code = codeByNativeCode[nativeCode] ?? 'provider-error';
    return new GameServicesError(code, message, code === 'network-error');
}
