import { Stack } from 'expo-router';
import React from 'react';

import SheltersListScreen from '@/screens/SheltersList';

export default function SheltersRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SheltersListScreen />
    </>
  );
}
