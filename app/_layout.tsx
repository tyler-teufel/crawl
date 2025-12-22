import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
    return (
        <SafeAreaView className="flex-1">
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#fff' },
                }}
            >
                <Stack.Screen name="index" />
            </Stack>
            <StatusBar style="auto" />
        </SafeAreaView>
    );
}
