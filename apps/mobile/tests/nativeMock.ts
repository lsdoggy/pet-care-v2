export const ActivityIndicator = 'ActivityIndicator';
export const Image = 'Image';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';
export const Modal = 'Modal';
export const Pressable = 'Pressable';
export const ScrollView = 'ScrollView';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const View = 'View';
export const Platform = { OS: 'android', select: (options: any) => options.android ?? options.default };
export const StyleSheet = { create: (styles: any) => styles };
export const listeners = new Set<(state: string) => void>();
export const AppState = { currentState: 'active', addEventListener: (_event: string, listener: (state: string) => void) => {
  listeners.add(listener); return { remove: () => listeners.delete(listener) };
} };
export function changeAppState(state: string) { AppState.currentState = state; for (const listener of listeners) listener(state); }
