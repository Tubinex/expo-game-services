export type GameServicesErrorCode =
    | 'native-module-unavailable'
    | 'expo-go-unsupported'
    | 'platform-unsupported'
    | 'not-authenticated'
    | 'cancelled'
    | 'configuration-missing'
    | 'feature-unsupported'
    | 'invalid-argument'
    | 'network-error'
    | 'provider-error';

export class GameServicesError extends Error {
    readonly code: GameServicesErrorCode;
    readonly retryable: boolean;

    constructor(code: GameServicesErrorCode, message: string, retryable = false) {
        super(message);
        this.name = 'GameServicesError';
        this.code = code;
        this.retryable = retryable;
    }
}

export function unavailableError(): GameServicesError {
    return new GameServicesError(
        'native-module-unavailable',
        'Game Services requires a development client or store build.',
    );
}
