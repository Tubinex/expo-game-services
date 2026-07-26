import { gameServices, type AuthenticationState } from '@tubinex/expo-game-services';
import { useEffect, useState } from 'react';
import { Button, SafeAreaView, Text } from 'react-native';

function ignoreError(): void {}

export default function App() {
    const [state, setState] = useState<AuthenticationState | null>(null);

    useEffect(() => {
        gameServices.authentication.getState().then(setState).catch(ignoreError);
        const subscription = gameServices.authentication.addStateListener(setState);
        return () => subscription.remove();
    }, []);

    function connect(): void {
        gameServices.authentication.signIn().then(setState).catch(ignoreError);
    }

    function showAchievements(): void {
        gameServices.achievements.showUI().catch(ignoreError);
    }

    function showLeaderboards(): void {
        gameServices.leaderboards.showUI().catch(ignoreError);
    }

    return (
        <SafeAreaView>
            <Text>{state?.status ?? 'loading'}</Text>
            <Button title="Connect" onPress={connect} />
            <Button title="Achievements" onPress={showAchievements} />
            <Button title="Leaderboards" onPress={showLeaderboards} />
        </SafeAreaView>
    );
}
