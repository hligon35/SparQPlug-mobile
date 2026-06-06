import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  checkPiHoleReachable,
  checkVpnEndpoint,
  getPiHoleAdminUrl,
  getPiHoleSummary,
  getWireGuardAppUrl,
  loadNetworkOpsConfig,
  pausePiHole,
  resumePiHole,
  runRemoteNetworkTests,
  saveNetworkOpsConfig,
  type NetworkOpsConfig,
  type NetworkTestResult,
  type PiHoleSummary,
} from '@/lib/network-ops';

type HealthChecks = {
  piholeReachable: boolean;
  vpnResolvable: boolean;
};

const COLORS = {
  bgTop: '#081423',
  bgBottom: '#0f1f2f',
  card: '#13253a',
  cardSoft: '#17304a',
  border: '#2b4a67',
  text: '#f4f8ff',
  muted: '#9bb2c9',
  accent: '#1ecbe1',
  accentWarm: '#ff9f4a',
  ok: '#3ddc97',
  danger: '#ff5f7a',
};

const DEFAULT_SUMMARY: PiHoleSummary = {
  dns_queries_today: 0,
  ads_blocked_today: 0,
  ads_percentage_today: 0,
  domains_being_blocked: 0,
  unique_clients: 0,
  status: 'disabled',
};

function StatusPill({ label, healthy }: { label: string; healthy: boolean }) {
  return (
    <View style={[styles.pill, healthy ? styles.pillOk : styles.pillWarn]}>
      <Text style={styles.pillDot}>{healthy ? '●' : '○'}</Text>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

export default function NetworkScreen() {
  const router = useRouter();
  const [config, setConfig] = useState<NetworkOpsConfig | null>(null);
  const [summary, setSummary] = useState<PiHoleSummary>(DEFAULT_SUMMARY);
  const [checks, setChecks] = useState<HealthChecks>({ piholeReachable: false, vpnResolvable: false });
  const [remoteTests, setRemoteTests] = useState<NetworkTestResult[]>([]);
  const [runningTests, setRunningTests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revealAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [revealAnim]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        const loaded = await loadNetworkOpsConfig();
        if (!alive) return;
        setConfig(loaded);
        await refreshAll(loaded);
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message || 'Failed to load network settings.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      alive = false;
    };
  }, []);

  const blockingEnabled = useMemo(() => `${summary.status}`.toLowerCase() === 'enabled', [summary.status]);

  async function refreshAll(activeConfig: NetworkOpsConfig = config as NetworkOpsConfig) {
    if (!activeConfig) return;

    setRefreshing(true);
    setError(null);
    try {
      const [latestSummary, piholeReachable, vpnResolvable] = await Promise.all([
        getPiHoleSummary(activeConfig),
        checkPiHoleReachable(activeConfig),
        checkVpnEndpoint(activeConfig.vpnDomain),
      ]);
      setSummary(latestSummary);
      setChecks({ piholeReachable, vpnResolvable });
    } catch (e) {
      setError((e as Error).message || 'Unable to refresh Network Ops data.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSaveConfig() {
    if (!config) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await saveNetworkOpsConfig(config);
      await refreshAll(config);
      Alert.alert('Saved', 'Network settings were saved to this device securely.');
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message || 'Unable to save settings right now.');
    }
  }

  async function handlePause(seconds: number, label: string) {
    if (!config) return;

    setBusyAction(`pause-${seconds}`);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await pausePiHole(config, seconds);
      await refreshAll(config);
      Alert.alert('Blocking paused', `${label} started.`);
    } catch (e) {
      Alert.alert('Action failed', (e as Error).message || 'Could not pause Pi-hole blocking.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResume() {
    if (!config) return;

    setBusyAction('resume');
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await resumePiHole(config);
      await refreshAll(config);
      Alert.alert('Blocking resumed', 'Pi-hole blocking is enabled again.');
    } catch (e) {
      Alert.alert('Action failed', (e as Error).message || 'Could not resume Pi-hole blocking.');
    } finally {
      setBusyAction(null);
    }
  }

  async function openPiHoleAdmin() {
    if (!config) return;
    await Linking.openURL(getPiHoleAdminUrl(config));
  }

  async function openWireGuard() {
    try {
      await Linking.openURL(getWireGuardAppUrl());
    } catch {
      Alert.alert('WireGuard app not found', 'Install WireGuard first, then try again.');
    }
  }

  async function handleRunRemoteTests() {
    if (!config) return;

    setRunningTests(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const results = await runRemoteNetworkTests(config);
      setRemoteTests(results);

      const passCount = results.filter((test) => test.status === 'pass').length;
      const warnCount = results.filter((test) => test.status === 'warn').length;
      const failCount = results.filter((test) => test.status === 'fail').length;

      Alert.alert('Remote Tests Complete', `Passed: ${passCount}\nWarnings: ${warnCount}\nFailed: ${failCount}`);
    } catch (e) {
      Alert.alert('Test run failed', (e as Error).message || 'Unable to run network tests right now.');
    } finally {
      setRunningTests(false);
    }
  }

  if (loading || !config) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Preparing Network Ops...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const animatedStyle = {
    opacity: revealAnim,
    transform: [
      {
        translateY: revealAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.bgOrbOne} />
      <View style={styles.bgOrbTwo} />

      <Animated.View style={[styles.wrapper, animatedStyle]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshAll(config)} tintColor={COLORS.accent} />}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.kicker}>SparQPlug Network Ops</Text>
              <Text style={styles.heading}>VPN + Pi-hole Control Center</Text>
              <Text style={styles.subheading}>Built for your live setup: vpn.alphazonelabs.com + adblock.alphazonelabs.com</Text>
            </View>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[styles.guideButton, runningTests && styles.guideButtonBusy]}
                onPress={handleRunRemoteTests}
                accessibilityRole="button"
                accessibilityLabel="Run remote network tests"
                disabled={runningTests}
              >
                <Ionicons name={runningTests ? 'sync-outline' : 'pulse-outline'} size={20} color={COLORS.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.guideButton}
                onPress={() => router.push('/network-ops-guide')}
                accessibilityRole="button"
                accessibilityLabel="Open Network Ops guide"
              >
                <Ionicons name="book-outline" size={20} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.pillRow}>
            <StatusPill label={checks.piholeReachable ? 'Pi-hole reachable' : 'Pi-hole unreachable'} healthy={checks.piholeReachable} />
            <StatusPill label={checks.vpnResolvable ? 'VPN DNS resolves' : 'VPN DNS check failed'} healthy={checks.vpnResolvable} />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {remoteTests.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Remote Test Results</Text>
              <Text style={styles.sectionHint}>Client and backend checks to validate DNS, reachability, and exposure risk.</Text>
              <View style={styles.testsList}>
                {remoteTests.map((test) => (
                  <View key={`${test.source}-${test.id}`} style={styles.testRow}>
                    <View style={styles.testTitleRow}>
                      <Text style={styles.testName}>{test.label}</Text>
                      <Text
                        style={[
                          styles.testStatus,
                          test.status === 'pass' ? styles.testStatusPass : test.status === 'warn' ? styles.testStatusWarn : styles.testStatusFail,
                        ]}
                      >
                        {test.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.testDetail}>{test.detail}</Text>
                    <Text style={styles.testMeta}>{test.source.toUpperCase()} · {test.durationMs}ms</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.statGrid}>
            <StatCard
              label="Blocking"
              value={blockingEnabled ? 'Enabled' : 'Paused'}
              hint={blockingEnabled ? 'Protection is active' : 'Tracking is temporarily allowed'}
            />
            <StatCard
              label="Blocked Today"
              value={summary.ads_blocked_today.toLocaleString()}
              hint={`${summary.ads_percentage_today.toFixed(1)}% of DNS traffic`}
            />
            <StatCard
              label="DNS Queries"
              value={summary.dns_queries_today.toLocaleString()}
              hint={`Across ${summary.unique_clients} clients`}
            />
            <StatCard
              label="Domains in Gravity"
              value={summary.domains_being_blocked.toLocaleString()}
              hint="Updated from your blocklists"
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Quick Controls</Text>
            <Text style={styles.sectionHint}>Use these from home Wi-Fi or while connected through WireGuard.</Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => refreshAll(config)}>
                <Text style={styles.btnSecondaryText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={openPiHoleAdmin}>
                <Text style={styles.btnSecondaryText}>Open Pi-hole</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={openWireGuard}>
                <Text style={styles.btnSecondaryText}>Open WireGuard</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btnWarn, busyAction === 'pause-300' && styles.btnDisabled]}
                disabled={busyAction !== null}
                onPress={() => handlePause(300, '5 minute pause')}
              >
                <Text style={styles.btnWarnText}>{busyAction === 'pause-300' ? 'Working...' : 'Pause 5m'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnWarn, busyAction === 'pause-1800' && styles.btnDisabled]}
                disabled={busyAction !== null}
                onPress={() => handlePause(1800, '30 minute pause')}
              >
                <Text style={styles.btnWarnText}>{busyAction === 'pause-1800' ? 'Working...' : 'Pause 30m'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnPrimary, busyAction === 'resume' && styles.btnDisabled]}
                disabled={busyAction !== null}
                onPress={handleResume}
              >
                <Text style={styles.btnPrimaryText}>{busyAction === 'resume' ? 'Working...' : 'Resume Now'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Connection Settings</Text>
            <Text style={styles.sectionHint}>These values are stored securely on this phone.</Text>

            <Text style={styles.inputLabel}>VPN Domain</Text>
            <TextInput
              value={config.vpnDomain}
              onChangeText={(value) => setConfig((prev) => (prev ? { ...prev, vpnDomain: value } : prev))}
              placeholder="vpn.alphazonelabs.com"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Pi-hole Domain</Text>
            <TextInput
              value={config.piholeDomain}
              onChangeText={(value) => setConfig((prev) => (prev ? { ...prev, piholeDomain: value } : prev))}
              placeholder="adblock.alphazonelabs.com"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Pi-hole API Token (optional)</Text>
            <TextInput
              value={config.piholeApiToken}
              onChangeText={(value) => setConfig((prev) => (prev ? { ...prev, piholeApiToken: value } : prev))}
              placeholder="paste API token if your Pi-hole requires auth"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={styles.input}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Prefer HTTPS for Pi-hole domain</Text>
              <Switch
                value={config.preferHttps}
                onValueChange={(value) => setConfig((prev) => (prev ? { ...prev, preferHttps: value } : prev))}
                trackColor={{ false: '#38526a', true: '#377ca1' }}
                thumbColor={config.preferHttps ? COLORS.accent : '#d0d8e2'}
              />
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveConfig}>
              <Text style={styles.btnPrimaryText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBottom,
  },
  wrapper: {
    flex: 1,
  },
  bgOrbOne: {
    position: 'absolute',
    top: -120,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#1d748955',
  },
  bgOrbTwo: {
    position: 'absolute',
    bottom: -140,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#e57a2f33',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 15,
    fontFamily: 'AvenirNext-DemiBold',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  heroRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroActions: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
  },
  guideButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#356085',
    backgroundColor: '#11314a',
  },
  guideButtonBusy: {
    opacity: 0.7,
  },
  kicker: {
    color: COLORS.accent,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'AvenirNext-DemiBold',
  },
  heading: {
    color: COLORS.text,
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'AvenirNext-Heavy',
  },
  subheading: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  pillOk: {
    backgroundColor: '#123d2a',
    borderColor: '#2e7c57',
  },
  pillWarn: {
    backgroundColor: '#44222b',
    borderColor: '#6a2f3d',
  },
  pillDot: {
    color: '#f8fbff',
    fontSize: 11,
  },
  pillText: {
    color: '#f8fbff',
    fontSize: 12,
    fontFamily: 'AvenirNext-DemiBold',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    backgroundColor: '#4a1c2a66',
    borderWidth: 1,
    borderColor: '#7f3148',
    borderRadius: 12,
    padding: 10,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 8,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 23,
    lineHeight: 28,
    fontFamily: 'AvenirNext-Heavy',
  },
  statHint: {
    color: '#7ea0be',
    fontSize: 12,
    marginTop: 3,
  },
  sectionCard: {
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontFamily: 'AvenirNext-Heavy',
  },
  sectionHint: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: -2,
  },
  testsList: {
    gap: 8,
  },
  testRow: {
    backgroundColor: '#10263a',
    borderWidth: 1,
    borderColor: '#2d4d69',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  testTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  testName: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
    fontFamily: 'AvenirNext-DemiBold',
  },
  testStatus: {
    fontSize: 10,
    fontFamily: 'AvenirNext-Heavy',
    letterSpacing: 0.8,
  },
  testStatusPass: {
    color: '#63efb4',
  },
  testStatusWarn: {
    color: '#ffd18b',
  },
  testStatusFail: {
    color: '#ff8798',
  },
  testDetail: {
    color: '#cde3f8',
    fontSize: 12,
    lineHeight: 17,
  },
  testMeta: {
    color: '#8eabc5',
    fontSize: 11,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    minWidth: 100,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#07202a',
    fontSize: 13,
    fontFamily: 'AvenirNext-Heavy',
  },
  btnSecondary: {
    backgroundColor: '#1f3b56',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#356085',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnSecondaryText: {
    color: '#dbecfd',
    fontSize: 13,
    fontFamily: 'AvenirNext-DemiBold',
  },
  btnWarn: {
    backgroundColor: '#5a3b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8e5c34',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnWarnText: {
    color: '#ffddb8',
    fontSize: 13,
    fontFamily: 'AvenirNext-DemiBold',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  inputLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    backgroundColor: '#0f2234',
    color: COLORS.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2b4a67',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  switchRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
    paddingRight: 10,
  },
});
