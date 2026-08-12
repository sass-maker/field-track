import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, PermissionsAndroid, Platform, ScrollView, type Permission,
  StatusBar, StyleSheet, Text, TextInput, View, Pressable,
} from 'react-native';
import { FieldTracking, type Enrollment, type SimSnapshot, type TrackingStatus } from './native';

const RELEASE_API = 'https://field-track.example.workers.dev';
const DEBUG_API = 'http://10.0.2.2:8787';

async function requestTrackingPermissions() {
  if (Platform.OS !== 'android') return false;
  const foreground = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
    title: 'Location required', message: 'This company device continuously reports location for field operations.', buttonPositive: 'Continue',
  });
  if (foreground !== PermissionsAndroid.RESULTS.GRANTED) return false;
  if (Platform.Version >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (Platform.Version >= 30) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION, {
    title: 'Allow all the time', message: 'Choose “Allow all the time” so tracking continues when Field Track is not open.', buttonPositive: 'Open settings',
  });
  return true;
}

async function requestSimPermissions() {
  if (Platform.OS !== 'android') return false;
  const permissions: Permission[] = [PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE];
  if (Platform.Version >= 26) permissions.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);
  const result = await PermissionsAndroid.requestMultiple(permissions);
  return result[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED;
}

export default function App() {
  const [status, setStatus] = useState<TrackingStatus | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState(__DEV__ ? DEBUG_API : RELEASE_API);
  const [enrollmentCode, setEnrollmentCode] = useState('');
  const [message, setMessage] = useState('Checking device enrollment…');
  const [busy, setBusy] = useState(false);
  const [sims, setSims] = useState<SimSnapshot[]>([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [loadingSims, setLoadingSims] = useState(false);

  const refresh = useCallback(async () => {
    try { setStatus(await FieldTracking.getStatus()); }
    catch { setMessage('Native tracking status is unavailable. Reinstall the managed app.'); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!status?.enrolled || !status.serviceConfigured) return;
    void FieldTracking.start().then(async () => {
      setMessage('Tracking service is running.');
      await refresh();
    }).catch(() => setMessage('Tracking could not start. Restart this managed app or contact your manager.'));
  }, [refresh, status?.enrolled, status?.serviceConfigured]);

  const loadSims = useCallback(async () => {
    setLoadingSims(true);
    try {
      const granted = await requestSimPermissions();
      if (!granted) { setMessage('Phone permission is needed to select the assigned SIM.'); return; }
      const activeSims = await FieldTracking.getActiveSims();
      setSims(activeSims);
      setSelectedSubscriptionId((current) => activeSims.some((sim) => sim.subscriptionId === current) ? current : null);
      setMessage(activeSims.length ? 'Select the SIM assigned by your manager.' : 'No active SIM was found. Insert or enable the assigned SIM, then retry.');
    } catch { setMessage('SIM details could not be read. Check phone permission and retry.'); }
    finally { setLoadingSims(false); }
  }, []);

  useEffect(() => {
    if (status && !status.enrolled) void loadSims();
  }, [loadSims, status?.enrolled]);

  async function enroll() {
    const selectedSim = sims.find((sim) => sim.subscriptionId === selectedSubscriptionId);
    const normalizedApi = apiBaseUrl.trim().replace(/\/$/, '');
    if (!enrollmentCode.trim()) return setMessage('Enter the assigned enrollment code.');
    if (!selectedSim) return setMessage('Select the active SIM assigned by your manager.');
    if (__DEV__ && !/^https?:\/\//.test(normalizedApi)) return setMessage('Enter a valid local HTTP or HTTPS API URL.');
    if (!__DEV__ && !normalizedApi.startsWith('https://')) return setMessage('The managed HTTPS API is not configured.');
    setBusy(true); setMessage('Enrolling this device…');
    try {
      const installId = await FieldTracking.getInstallId();
      const response = await fetch(`${normalizedApi}/api/devices/enroll`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enrollmentCode: enrollmentCode.trim(), installId, selectedSim }),
      });
      const result = await response.json() as Enrollment & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Enrollment was rejected.');
      await FieldTracking.configure({ ...result, selectedSim, apiBaseUrl: normalizedApi });
      const granted = await requestTrackingPermissions();
      if (granted) await FieldTracking.start();
      setEnrollmentCode('');
      const simNote = result.simHealth === 'mismatch' ? ' The SIM number differs from the assignment; your manager can see this warning.' : result.simHealth === 'number-unavailable' ? ' Android could not read the number, but the assigned code verified this device.' : '';
      setMessage((granted ? 'Device enrolled. Tracking is running.' : 'Device enrolled. Location permission is still required.') + simNote);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Enrollment failed.'); }
    finally { setBusy(false); }
  }

  async function grantLocationAccess() {
    setBusy(true); setMessage('Requesting required location access…');
    try {
      const granted = await requestTrackingPermissions();
      if (!granted) return setMessage('Location access is still blocked. Open Android Settings for Field Track and allow location all the time.');
      await FieldTracking.start();
      setMessage('Location access granted. Tracking is running.');
      await refresh();
    } catch { setMessage('Tracking could not start. Restart this managed app or contact your manager.'); }
    finally { setBusy(false); }
  }

  if (!status) return <View style={styles.loading}><StatusBar barStyle="dark-content" /><ActivityIndicator color="#1f6957" /><Text>{message}</Text></View>;

  return <View style={styles.safe}>
    <StatusBar barStyle="dark-content" />
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.brand}><Text style={styles.brandMark}>FT</Text><View><Text style={styles.brandName}>Field Track</Text><Text style={styles.brandMeta}>Managed employee device</Text></View></View>
      {status.enrolled ? <>
        <View style={styles.hero}><Text style={styles.kicker}>DEVICE ACTIVE</Text><Text style={styles.title}>Location reporting is on.</Text><Text style={styles.copy}>This managed Android device reports location continuously. There is no employee start or stop control.</Text></View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>{status.serviceConfigured ? 'Foreground service configured' : 'Waiting for location permission'}</Text></View>
        <View style={styles.card}>
          <Row label="Employee" value={status.employeeName ?? 'Assigned'} />
          <Row label="Device ID" value={status.deviceId ?? '—'} />
          <Row label="Policy" value={status.policyId ?? '—'} />
          <Row label="Selected SIM" value={`${status.simCarrierName ?? 'Carrier unavailable'} · slot ${(status.simSlotIndex ?? 0) + 1}${status.simPresent ? '' : ' · not present'}`} />
          <Row label="Saved offline" value={`${status.queuedPoints} points`} />
          <Row label="Last recorded" value={status.lastRecordedAt ? new Date(status.lastRecordedAt).toLocaleString() : 'Waiting for GPS'} />
          <Row label="Last uploaded" value={status.lastUploadedAt ? new Date(status.lastUploadedAt).toLocaleString() : 'Not yet'} last />
        </View>
        <View style={styles.notice}><Text style={styles.noticeTitle}>Tracking notification stays visible</Text><Text style={styles.noticeCopy}>Android requires the ongoing notification for reliable background location. Contact your manager if this device shows Offline on the dashboard.</Text></View>
        {!status.serviceConfigured && <Pressable accessibilityRole="button" accessibilityLabel="Grant required location access" style={({ pressed }) => [styles.button, styles.permissionButton, pressed && styles.buttonPressed]} disabled={busy} onPress={grantLocationAccess}><Text style={styles.buttonText}>Grant location access</Text></Pressable>}
        <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      </> : <>
        <View style={styles.hero}><Text style={styles.kicker}>MANAGED DEVICE SETUP</Text><Text style={styles.title}>Enroll this field device.</Text><Text style={styles.copy}>Select the assigned SIM and enter the one-time code from your manager. After enrollment, tracking starts automatically.</Text></View>
        <View style={styles.cardForm}>
          {__DEV__ && <><Text style={styles.label}>Local API URL</Text><TextInput accessibilityLabel="Local API URL" style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="url" value={apiBaseUrl} onChangeText={setApiBaseUrl} /></>}
          <View style={styles.simHeader}><Text style={styles.label}>Assigned SIM</Text><Pressable accessibilityRole="button" accessibilityLabel="Check for active SIMs again" style={styles.retryButton} onPress={loadSims} disabled={loadingSims}><Text style={styles.retryText}>{loadingSims ? 'Checking…' : 'Check again'}</Text></Pressable></View>
          <View style={styles.simList}>
            {sims.map((sim) => {
              const selected = sim.subscriptionId === selectedSubscriptionId;
              return <Pressable key={sim.subscriptionId} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.simOption, selected && styles.simOptionSelected]} onPress={() => setSelectedSubscriptionId(sim.subscriptionId)}>
                <View style={[styles.radio, selected && styles.radioSelected]} />
                <View style={styles.simCopy}><Text style={styles.simName}>SIM {sim.slotIndex + 1} · {sim.displayName ?? sim.carrierName ?? 'Mobile network'}</Text><Text style={styles.simMeta}>{sim.phoneNumber ?? 'Number unavailable on Android'}</Text></View>
              </Pressable>;
            })}
            {!loadingSims && sims.length === 0 && <Text style={styles.noSim}>No active SIM found.</Text>}
          </View>
          <Text style={styles.label}>Enrollment code</Text><TextInput accessibilityLabel="Enrollment code" style={styles.input} autoCapitalize="characters" autoCorrect={false} value={enrollmentCode} onChangeText={setEnrollmentCode} />
          <Pressable accessibilityRole="button" accessibilityLabel={busy ? 'Enrolling device' : 'Enroll device'} accessibilityState={{ disabled: busy, busy }} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} disabled={busy} onPress={enroll}>
            {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Enroll device</Text>}
          </Pressable>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      </>}
    </ScrollView>
  </View>;
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.row, last && styles.rowLast]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, backgroundColor: '#f3f0e7' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f3f0e7' },
  page: { padding: 22, paddingBottom: 44 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 46 },
  brandMark: { width: 42, height: 42, borderRadius: 12, textAlign: 'center', textAlignVertical: 'center', color: '#173f36', backgroundColor: '#c7df76', fontWeight: '900' },
  brandName: { color: '#173f36', fontSize: 18, fontWeight: '800' }, brandMeta: { color: '#59675f', fontSize: 12 },
  hero: { marginBottom: 24 }, kicker: { marginBottom: 8, color: '#28705d', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#15251f', fontSize: 39, lineHeight: 42, fontWeight: '800', letterSpacing: -1.4 }, copy: { marginTop: 14, color: '#5e6d66', fontSize: 16, lineHeight: 23 },
  liveBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 15, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 99, backgroundColor: '#e1f2eb' },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#178665' }, liveText: { color: '#0d5c48', fontSize: 12, fontWeight: '800' },
  card: { overflow: 'hidden', borderWidth: 1, borderColor: '#d7d6cd', borderRadius: 16, backgroundColor: '#fffdf8' },
  row: { paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#e8e6dd' }, rowLast: { borderBottomWidth: 0 },
  rowLabel: { marginBottom: 4, color: '#6a766f', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: .5 }, rowValue: { color: '#17251f', fontSize: 14, fontWeight: '700' },
  notice: { marginTop: 15, padding: 16, borderWidth: 1, borderColor: '#dfc581', borderRadius: 14, backgroundColor: '#fff3d3' },
  noticeTitle: { color: '#654719', fontSize: 14, fontWeight: '800' }, noticeCopy: { marginTop: 5, color: '#74572b', fontSize: 13, lineHeight: 19 },
  cardForm: { padding: 17, borderWidth: 1, borderColor: '#d7d6cd', borderRadius: 16, backgroundColor: '#fffdf8' },
  label: { marginBottom: 6, color: '#53645d', fontSize: 12, fontWeight: '700' }, input: { minHeight: 50, marginBottom: 16, paddingHorizontal: 13, borderWidth: 1, borderColor: '#d7d6cd', borderRadius: 10, color: '#17251f', backgroundColor: 'white' },
  simHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, retryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }, retryText: { color: '#1f6957', fontSize: 13, fontWeight: '800' },
  simList: { gap: 9, marginBottom: 18 }, simOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: '#d7d6cd', borderRadius: 11, backgroundColor: 'white' }, simOptionSelected: { borderColor: '#1f6957', backgroundColor: '#e9f3ef' },
  radio: { width: 20, height: 20, borderWidth: 2, borderColor: '#829089', borderRadius: 10 }, radioSelected: { borderWidth: 6, borderColor: '#1f6957' }, simCopy: { flex: 1 }, simName: { color: '#17251f', fontSize: 14, fontWeight: '800' }, simMeta: { marginTop: 3, color: '#68766f', fontSize: 12 }, noSim: { paddingVertical: 12, color: '#8b4c2d', fontSize: 13 },
  button: { minHeight: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#173f36' }, permissionButton: { marginTop: 15 }, buttonPressed: { backgroundColor: '#22594b' }, buttonText: { color: 'white', fontSize: 16, fontWeight: '800' },
  message: { marginTop: 14, minHeight: 40, color: '#59675f', fontSize: 13, lineHeight: 19 },
});
