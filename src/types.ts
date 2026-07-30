export type GameServicesPlatform = 'gameCenter' | 'playGames';

export type AuthenticationState =
    | {
          status: 'unavailable';
          platform: GameServicesPlatform | null;
          reason: string;
      }
    | { status: 'unauthenticated'; platform: GameServicesPlatform }
    | { status: 'authenticating'; platform: GameServicesPlatform }
    | {
          status: 'authenticated';
          platform: GameServicesPlatform;
          player: GameServicesPlayer;
      };

export type GameServicesPlayer = {
    id: string;
    displayName: string;
    alias?: string;
};

export type GameServicesCapabilities = {
    platform: GameServicesPlatform | null;
    available: boolean;
    authentication: boolean;
    serverIdentityProof: boolean;
    achievements: boolean;
    incrementalAchievements: boolean;
    leaderboards: boolean;
    leaderboardScoreQueries: boolean;
    nativeLeaderboardUI: boolean;
};

export type GameCenterIdentitySignature = {
    type: 'gameCenterIdentitySignature';
    playerId: string;
    gamePlayerId?: string;
    teamPlayerId?: string;
    publicKeyUrl: string;
    signature: string;
    salt: string;
    timestamp: number;
};

export type PlayGamesServerAuthCode = {
    type: 'playGamesServerAuthCode';
    serverAuthCode: string;
};

export type ServerIdentityProof = GameCenterIdentitySignature | PlayGamesServerAuthCode;

export type Achievement = {
    id: string;
    title: string;
    description: string;
    percentComplete: number;
    isUnlocked: boolean;
    lastReportedDate?: string;
};

export type LeaderboardMetadata = {
    id: string;
    title: string;
    sortOrder?: 'ascending' | 'descending';
};

export type LeaderboardScore = {
    leaderboardId: string;
    rank: number;
    score: number;
    formattedScore?: string;
    player: GameServicesPlayer;
    timestamp?: string;
};

export type LeaderboardCollection = 'public' | 'friends';
export type LeaderboardTimeScope = 'today' | 'week' | 'allTime';

export type LeaderboardScoresRequest = {
    leaderboardId: string;
    collection?: LeaderboardCollection;
    timeScope?: LeaderboardTimeScope;
    position?: number;
    range?: number;
    forceReload?: boolean;
};

export type LeaderboardScores = {
    leaderboard: LeaderboardMetadata;
    scores: LeaderboardScore[];
};

export type LeaderboardUIOptions = {
    leaderboardId?: string;
    timeScope?: LeaderboardTimeScope;
};

export type Subscription = {
    remove(): void;
};
