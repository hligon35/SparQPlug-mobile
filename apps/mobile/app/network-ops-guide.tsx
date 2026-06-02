import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0f1f2f',
  card: '#152a40',
  border: '#2b4a67',
  text: '#f4f8ff',
  muted: '#9bb2c9',
  accent: '#1ecbe1',
  good: '#3ddc97',
  warn: '#ffb86b',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export default function NetworkOpsGuideScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Quick Start</Text>
        <Text style={styles.heading}>VPN + Pi-hole Guide</Text>
        <Text style={styles.subheading}>Use this screen as your on-phone checklist for access, performance, and troubleshooting.</Text>

        <Section title="Current live setup">
          <Bullet text="VPN endpoint: vpn.alphazonelabs.com:51820" />
          <Bullet text="Pi-hole domain (LAN/VPN): adblock.alphazonelabs.com" />
          <Bullet text="Pi-hole DNS server: 10.0.0.106" />
          <Bullet text="WireGuard DNS inside tunnel: 10.44.0.1" />
        </Section>

        <Section title="Access basics">
          <Text style={styles.label}>At home</Text>
          <Bullet text="Set device DNS to 10.0.0.106." />
          <Bullet text="Open http://adblock.alphazonelabs.com/admin." />
          <Bullet text="Disable DNS-bypass options like Private Relay for strict filtering." />

          <Text style={[styles.label, { marginTop: 10 }]}>Away from home</Text>
          <Bullet text="Connect WireGuard first." />
          <Bullet text="Confirm endpoint vpn.alphazonelabs.com:51820." />
          <Bullet text="Confirm DNS is 10.44.0.1 in the profile." />
          <Bullet text="Open the same Pi-hole URL over VPN." />
        </Section>

        <Section title="Best performance habits">
          <Bullet text="Use only one DNS on clients: Pi-hole. Avoid fallback public resolvers." />
          <Bullet text="Keep WireGuard in split tunnel unless full tunnel is needed." />
          <Bullet text="Keep Gravity lists and OS updates current." />
          <Bullet text="Use the Network tab controls for quick pause/resume, not permanent disables." />
        </Section>

        <Section title="Easy verification tests">
          <Text style={styles.label}>Pi-hole effect check</Text>
          <Bullet text="Run one speed test with public DNS, then one with Pi-hole DNS." />
          <Bullet text="Expect similar throughput, often faster page loading with fewer ad requests." />

          <Text style={[styles.label, { marginTop: 10 }]}>VPN check</Text>
          <Bullet text="Turn off Wi-Fi and use cellular." />
          <Bullet text="Connect WireGuard and open Pi-hole admin URL." />
          <Bullet text="Back in Network tab, confirm cards refresh and controls respond." />
        </Section>

        <Section title="Security guardrails">
          <Bullet text="Keep Pi-hole admin reachable through LAN/VPN only." />
          <Bullet text="Keep WireGuard DNS record DNS-only (no proxy)." />
          <Bullet text="Rotate API credentials if shared to additional devices." />
        </Section>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Tip</Text>
          <Text style={styles.noteText}>If controls fail, verify VPN is connected and that Pi-hole API auth token/password is set correctly in the Network screen settings.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 12,
  },
  kicker: {
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontSize: 12,
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
    marginTop: -2,
  },
  section: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontFamily: 'AvenirNext-Heavy',
    marginBottom: 4,
  },
  label: {
    color: COLORS.warn,
    fontSize: 13,
    fontFamily: 'AvenirNext-DemiBold',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    color: COLORS.good,
    marginTop: 1,
    fontSize: 14,
    width: 10,
  },
  bulletText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  noteCard: {
    backgroundColor: '#0f3a4a',
    borderColor: '#2b7d93',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 2,
  },
  noteTitle: {
    color: '#8ef0ff',
    fontSize: 14,
    fontFamily: 'AvenirNext-Heavy',
  },
  noteText: {
    color: '#dff7ff',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
