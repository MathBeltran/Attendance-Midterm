import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Screen } from '@/components/Screen';
import { StatusMessage } from '@/components/StatusMessage';
import { COLORS } from '@/constants/theme';
import { registerAttendance, type RegisterResult } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [role, setRole] = useState<Role | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setResult(null);
      if (!user) return;
      let active = true;
      getProfile(user.id).then((profile) => active && setRole(profile?.role ?? 'student'));
      return () => {
        active = false;
      };
    }, [user])
  );

  const handleScan = async ({ data }: BarcodeScanningResult) => {
    if (!user || scanned || processing) return;
    setScanned(true);
    setProcessing(true);
    try {
      const next = await registerAttendance(data, user.id);
      setResult(next);
    } catch {
      setResult({ success: false, message: 'Could not save this scan. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  if (role === null) {
    return (
      <Screen title="Scan QR" scroll={false}>
        <View style={styles.center}><ActivityIndicator color={COLORS.ink} /></View>
      </Screen>
    );
  }

  if (role === 'teacher') {
    return (
      <Screen title="Scan QR">
        <StatusMessage text="Student accounts can record attendance." />
      </Screen>
    );
  }

  if (!permission) {
    return (
      <Screen title="Scan QR" scroll={false}>
        <View style={styles.center}><ActivityIndicator color={COLORS.ink} /></View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen title="Scan QR">
        <StatusMessage text="Camera permission is required to scan QR codes." />
        <AppButton label="Allow camera" icon="camera-outline" onPress={requestPermission} />
      </Screen>
    );
  }

  return (
    <Screen title="Scan QR" scroll={false}>
      <View style={styles.cameraFrame}>
        <CameraView
          active={!scanned}
          accessibilityLabel="QR scanner camera"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleScan}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.guide} />
      </View>
      {processing ? <ActivityIndicator color={COLORS.ink} /> : null}
      {result ? <StatusMessage text={result.eventTitle ? `${result.eventTitle}: ${result.message}` : result.message} success={result.success} /> : null}
      {scanned && !processing ? (
        <AppButton
          label="Scan again"
          icon="scan-outline"
          variant="secondary"
          onPress={() => {
            setResult(null);
            setScanned(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraFrame: { flex: 1, minHeight: 300, borderWidth: 3, borderColor: COLORS.primary, borderRadius: 16, overflow: 'hidden', backgroundColor: COLORS.ink },
  guide: { position: 'absolute', width: 220, height: 220, left: '50%', top: '50%', marginLeft: -110, marginTop: -110, borderWidth: 3, borderColor: COLORS.accent, borderRadius: 12 },
});
