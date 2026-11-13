import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, Text as NativeText, TextInput as NativeTextInput } from 'react-native';
import type { TextProps, TextInputProps } from 'react-native';

function face(weight: string | number | undefined) {
  const numeric = weight === 'bold' ? 700 : Number(weight ?? 400);
  if (numeric >= 700) return 'Roboto_700Bold';
  if (numeric >= 500) return 'Roboto_500Medium';
  return 'Roboto_400Regular';
}

export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps>(function Text({ style, ...props }, ref) {
  const flattened = StyleSheet.flatten(style);
  return <NativeText ref={ref} {...props} style={[{ fontSize: 16, lineHeight: Math.round((flattened?.fontSize ?? 16) * 1.5) }, style, {
    fontFamily: face(flattened?.fontWeight), fontWeight: '400',
  }]} />;
});

export const TextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const flattened = StyleSheet.flatten(style);
  return <NativeTextInput ref={ref} {...props} style={[{ fontSize: 16 }, style, {
    fontFamily: face(flattened?.fontWeight), fontWeight: '400',
  }]} />;
});
