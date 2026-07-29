import { callNativeGameServices, isNativeGameServicesAvailable, nativeGameServices } from '../ExpoGameServicesModule';
import { GameServicesError } from '../errors';

jest.mock('expo-modules-core', () => ({
    requireOptionalNativeModule: () => null,
}));

jest.mock('react-native', () => ({
    NativeEventEmitter: class {},
}));

describe('native module guard', () => {
    it('does not load a native module in the Node test runtime', () => {
        expect(isNativeGameServicesAvailable).toBe(false);
    });

    it('returns a typed error when the native module is unavailable', () => {
        expect(() => nativeGameServices()).toThrow(GameServicesError);
        expect(() => nativeGameServices()).toThrow('development, EAS, or store build');
    });

    it('rejects promise APIs instead of throwing synchronously', async () => {
        await expect(callNativeGameServices(() => Promise.resolve())).rejects.toMatchObject({
            code: 'native-module-unavailable',
        });
    });
});
