import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { responsiveWidth, responsiveHeight, responsiveFontSize } from '../utils/responsive';
import { useAppStore } from '../stores/useAppStore';

export default function Toast() {
  const toastMessage = useAppStore((state) => state.toastMessage);

  if (!toastMessage) return null;

  return (
    <View style={styles.container}>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: '6%',
    paddingVertical: '3%',
    borderRadius: responsiveWidth(20),
    maxWidth: '80%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize(16),
    textAlign: 'center',
  },
});