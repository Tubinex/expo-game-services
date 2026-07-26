const configPlugins = require(require.resolve('@expo/config-plugins', { paths: [process.cwd()] }));

const { AndroidConfig, createRunOncePlugin, withAndroidManifest, withEntitlementsPlist, withStringsXml } =
    configPlugins;

const PACKAGE_NAME = '@tubinex/expo-game-services';
function withGameCenter(config) {
    return withEntitlementsPlist(config, (modConfig) => {
        modConfig.modResults['com.apple.developer.game-center'] = true;
        return modConfig;
    });
}

function withPlayGamesAppId(config, playGamesAppId) {
    const resourceName = 'tubinex_game_services_app_id';

    config = withStringsXml(config, (modConfig) => {
        const strings = modConfig.modResults.resources.string ?? [];
        const existing = strings.find((entry) => entry.$?.name === resourceName);
        const value = {
            $: { name: resourceName, translatable: 'false' },
            _: playGamesAppId,
        };

        if (existing) {
            Object.assign(existing, value);
        } else {
            strings.push(value);
        }
        modConfig.modResults.resources.string = strings;
        return modConfig;
    });

    return withAndroidManifest(config, (modConfig) => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
        const metadata = application['meta-data'] ?? [];
        const metadataName = 'com.google.android.gms.games.APP_ID';
        const existing = metadata.find((entry) => entry.$?.['android:name'] === metadataName);
        const value = {
            $: {
                'android:name': metadataName,
                'android:value': `@string/${resourceName}`,
            },
        };

        if (existing) {
            existing.$ = value.$;
        } else {
            metadata.push(value);
        }
        application['meta-data'] = metadata;
        return modConfig;
    });
}

function withExpoGameServices(config, options = {}) {
    const iosEnabled = options.ios?.enabled ?? true;
    const androidEnabled = options.android?.enabled ?? true;

    if (iosEnabled) config = withGameCenter(config);
    if (androidEnabled) {
        const playGamesAppId = options.android?.playGamesAppId;
        if (typeof playGamesAppId !== 'string' || !/^\d+$/.test(playGamesAppId)) {
            throw new Error(
                `${PACKAGE_NAME}: android.playGamesAppId must be the numeric Play Games Services application ID.`,
            );
        }
        config = withPlayGamesAppId(config, playGamesAppId);
    }
    return config;
}

module.exports = createRunOncePlugin(withExpoGameServices, PACKAGE_NAME, '0.1.0');
