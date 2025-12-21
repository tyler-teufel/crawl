
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';


export default function App() {
    return (
        <>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Open up App.js to start working on your app!</Text>
                <StatusBar style="auto" />
            </View>
            <StatusBar style="auto" />
        </>
    );
}
