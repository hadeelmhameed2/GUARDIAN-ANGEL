import { Stack } from 'expo-router';
import React from 'react';

import DraftsScreen from '@/screens/DraftsScreen';

export default function DraftsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DraftsScreen />
    </>
  );
}
