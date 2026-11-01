import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'petcare_token';

export const tokenStore = {
  get: (): Promise<string | null> => AsyncStorage.getItem(TOKEN_KEY),
  set: (token: string): Promise<void> => AsyncStorage.setItem(TOKEN_KEY, token),
  clear: (): Promise<void> => AsyncStorage.removeItem(TOKEN_KEY),
};
