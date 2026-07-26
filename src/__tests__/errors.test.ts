import { GameServicesError, unavailableError } from '../errors';

describe('GameServicesError', () => {
    it('preserves a stable error code and retryability', () => {
        const error = new GameServicesError('network-error', 'Network unavailable.', true);

        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('network-error');
        expect(error.retryable).toBe(true);
    });

    it('uses an Expo Go-safe unavailable error', () => {
        const error = unavailableError();

        expect(error.code).toBe('native-module-unavailable');
        expect(error.retryable).toBe(false);
    });
});
