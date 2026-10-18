import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppStore } from '../stores/useAppStore';
import { colors, fontFamily, fontSize, radius, spacing, shadow } from '../utils/theme';

export default function Toast() {
  const toastMessage = useAppStore((state) => state.toastMessage);

  if (!toastMessage) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.toast}>
        <Text style={styles.toastText}>{toastMessage}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    backgroundColor: colors.primaryDeep,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    maxWidth: '80%',
    ...shadow.card,
  },
  toastText: {
    fontFamily,
    color: colors.white,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
