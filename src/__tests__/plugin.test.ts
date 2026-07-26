const withExpoGameServices = require('../../plugin');

describe('config plugin', () => {
    it('rejects a missing Android Play Games application ID', () => {
        expect(() => withExpoGameServices({}, { ios: { enabled: false }, android: { enabled: true } })).toThrow(
            'android.playGamesAppId',
        );
    });

    it('accepts a numeric Android Play Games application ID', () => {
        expect(() =>
            withExpoGameServices(
                {},
                {
                    ios: { enabled: false },
                    android: { enabled: true, playGamesAppId: '123456789012' },
                },
            ),
        ).not.toThrow();
    });
});
