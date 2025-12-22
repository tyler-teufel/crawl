import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';

export default function Index() {
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-white" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <View className="flex-1 items-center justify-center">
                <Text className="text-2xl font-bold text-gray-800">
                    Welcome to Crawl
                </Text>
                <Text className="mt-4 text-base text-gray-600">
                    Start developing your app here
                </Text>
            </View>
        </View>
    );
}