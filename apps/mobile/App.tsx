import { useEffect, useState } from 'react';
import { languageForLocale, LanguageContext } from './src/i18n/language';
import { AuthGate } from './src/auth/AuthGate';
import { ActivityIndicator, AppState, View } from 'react-native';
import { getLocales } from 'expo-localization';
import { useFonts } from 'expo-font';
import { Roboto_400Regular } from '@expo-google-fonts/roboto/400Regular';
import { Roboto_500Medium } from '@expo-google-fonts/roboto/500Medium';
import { Roboto_700Bold } from '@expo-google-fonts/roboto/700Bold';

function deviceLanguage() {
  return languageForLocale(getLocales()[0]?.languageCode ?? '');
}

export default function App() {
  const [language, setLanguage] = useState(deviceLanguage);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setLanguage(deviceLanguage());
    });
    return () => subscription.remove();
  }, []);
  const [loaded, error] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
  if (!loaded && !error) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <LanguageContext.Provider value={language}><AuthGate /></LanguageContext.Provider>;
}
