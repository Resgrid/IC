import { Stack } from 'expo-router';
import React from 'react';

export default function MapsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="search" />
      <Stack.Screen name="custom/[id]" />
      <Stack.Screen name="indoor/[id]" />
    </Stack>
  );
}
