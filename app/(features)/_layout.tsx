import { Slot } from 'expo-router';
import React from 'react';
import { StatusBar } from 'expo-status-bar';

export default function FeaturesLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Slot />
      {/* If you absolutely need a comment here, place it on its own line like this */}
      {/* or remove it if it's just for self-documentation. */}
    </>
  );
}