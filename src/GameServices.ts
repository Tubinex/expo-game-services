import {
    addNativeAuthenticationListener,
    callNativeGameServices,
    isNativeGameServicesAvailable,
} from './ExpoGameServicesModule';
import { GameServicesError } from './errors';
import type {
    Achievement,
    AuthenticationState,
    GameServicesCapabilities,
    LeaderboardMetadata,
    LeaderboardScores,
    LeaderboardScoresRequest,
    LeaderboardUIOptions,
    ServerIdentityProof,
    Subscription,
} from './types';

function assertIdentifier(value: string, field: string): void {
    if (!value.trim()) throw new GameServicesError('invalid-argument', `${field} must not be empty.`);
}

function assertPositiveInteger(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new GameServicesError('invalid-argument', `${field} must be a positive safe integer.`);
    }
}

function reportAchievement(achievementId: string, percentComplete: number): Promise<void> {
    assertIdentifier(achievementId, 'achievementId');
    if (!Number.isFinite(percentComplete) || percentComplete < 0 || percentComplete > 100) {
        throw new GameServicesError('invalid-argument', 'percentComplete must be between 0 and 100.');
    }
    return callNativeGameServices((module) => module.reportAchievement(achievementId, percentComplete));
}

export const gameServices = {
    isAvailable: isNativeGameServicesAvailable,
    authentication: {
        getState(): Promise<AuthenticationState> {
            return callNativeGameServices((module) => module.getAuthenticationState());
        },
        signIn(): Promise<AuthenticationState> {
            return callNativeGameServices((module) => module.signIn());
        },
        requestServerIdentityProof(
            options: { serverClientId?: string; forceRefreshToken?: boolean } = {},
        ): Promise<ServerIdentityProof> {
            if (options.serverClientId !== undefined) assertIdentifier(options.serverClientId, 'serverClientId');
            return callNativeGameServices((module) => module.requestServerIdentityProof(options));
        },
        addStateListener(listener: (state: AuthenticationState) => void): Subscription {
            const subscription = addNativeAuthenticationListener(listener);
            return { remove: () => subscription.remove() };
        },
    },
    capabilities: {
        get(): Promise<GameServicesCapabilities> {
            return callNativeGameServices((module) => module.getCapabilities());
        },
    },
    achievements: {
        load(): Promise<Achievement[]> {
            return callNativeGameServices((module) => module.loadAchievements());
        },
        reportProgress(achievementId: string, percentComplete: number): Promise<void> {
            return reportAchievement(achievementId, percentComplete);
        },
        unlock(achievementId: string): Promise<void> {
            return reportAchievement(achievementId, 100);
        },
        increment(achievementId: string, steps: number): Promise<void> {
            assertIdentifier(achievementId, 'achievementId');
            assertPositiveInteger(steps, 'steps');
            return callNativeGameServices((module) => module.incrementAchievement(achievementId, steps));
        },
        showUI(): Promise<void> {
            return callNativeGameServices((module) => module.showAchievements());
        },
    },
    leaderboards: {
        loadMetadata(leaderboardIds?: string[]): Promise<LeaderboardMetadata[]> {
            leaderboardIds?.forEach((id) => assertIdentifier(id, 'leaderboardId'));
            return callNativeGameServices((module) => module.loadLeaderboardMetadata(leaderboardIds));
        },
        loadScores(request: LeaderboardScoresRequest): Promise<LeaderboardScores> {
            assertIdentifier(request.leaderboardId, 'leaderboardId');
            return callNativeGameServices((module) => module.loadLeaderboardScores(request));
        },
        loadCurrentPlayerScore(
            request: Omit<LeaderboardScoresRequest, 'position' | 'range'>,
        ): Promise<LeaderboardScores> {
            assertIdentifier(request.leaderboardId, 'leaderboardId');
            return callNativeGameServices((module) => module.loadCurrentPlayerScore(request));
        },
        submitScore(leaderboardId: string, score: number, context?: string): Promise<void> {
            assertIdentifier(leaderboardId, 'leaderboardId');
            assertPositiveInteger(score, 'score');
            return callNativeGameServices((module) => module.submitLeaderboardScore(leaderboardId, score, context));
        },
        showUI(options: LeaderboardUIOptions = {}): Promise<void> {
            if (options.leaderboardId) assertIdentifier(options.leaderboardId, 'leaderboardId');
            return callNativeGameServices((module) => module.showLeaderboards(options));
        },
    },
};
