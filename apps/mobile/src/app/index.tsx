import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkApiHealth, type ApiHealth } from '@/lib/health';

// Placeholder until the real sign-in flow (M-12) lands. The e2e smoke flow checks that the
// app starts and reaches the API it was built for.
export default function HomeScreen() {
  const [health, setHealth] = useState<ApiHealth | 'checking'>('checking');
  const dark = useColorScheme() === 'dark';

  useEffect(() => {
    let active = true;
    void checkApiHealth().then((result) => {
      if (active) setHealth(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const textColor = dark ? '#f0f6fc' : '#1f2328';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: dark ? '#0d1117' : '#f6f8fa' }]}>
      <View style={styles.content}>
        <Text testID="app-title" style={[styles.title, { color: textColor }]}>
          ChurchFlow
        </Text>
        {health === 'checking' ? (
          <ActivityIndicator testID="api-status-checking" />
        ) : (
          <Text testID={`api-status-${health}`} style={[styles.status, { color: textColor }]}>
            {health === 'ok' ? 'API: ok' : 'API: unreachable'}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 32, fontWeight: '700' },
  status: { fontSize: 16 },
});
