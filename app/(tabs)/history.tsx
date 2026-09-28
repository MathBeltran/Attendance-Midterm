import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { COLORS } from '@/constants/theme';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';
import { formatDateTime } from '@/utils/date';

function Empty({ label }: { label: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="file-tray-outline" size={28} color={COLORS.ink} />
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

function StudentHistory({ records }: { records: AttendanceRecord[] }) {
  if (!records.length) return <Empty label="No scans in your history yet." />;
  return (
    <View style={styles.list}>
      {records.map((record) => (
        <View key={record.id} style={[styles.card, styles.studentCard]}>
          <View style={styles.studentCardHeader}>
            <View style={styles.scanIcon}>
              <Ionicons name="checkmark" size={18} color={COLORS.inverted} />
            </View>
            <View style={styles.eventHeading}>
              <Text style={styles.cardTitle}>{record.eventTitle || record.eventId}</Text>
              <Text style={styles.meta}>{record.eventId}</Text>
            </View>
          </View>
          <Text style={styles.scanTime}>Scanned {formatDateTime(record.scannedAt)}</Text>
        </View>
      ))}
    </View>
  );
}

function TeacherHistory({ events }: { events: TeacherEventAttendance[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!events.length) return <Empty label="No event history yet." />;
  const totalScans = events.reduce((sum, event) => sum + event.attendeeCount, 0);
  return (
    <View style={styles.list}>
      <View style={styles.summary}>
        <View style={styles.summaryIcon}>
          <Ionicons name="analytics-outline" size={24} color={COLORS.inverted} />
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{totalScans}</Text>
          <Text style={styles.summaryLabel}>{totalScans === 1 ? 'total scan' : 'total scans'}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{events.length}</Text>
          <Text style={styles.summaryLabel}>{events.length === 1 ? 'event' : 'events'}</Text>
        </View>
      </View>
      {events.map((event) => {
        const open = expanded === event.eventId;
        return (
          <View key={event.eventId} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setExpanded(open ? null : event.eventId)}
              style={({ pressed }) => [styles.eventHeader, pressed && styles.pressed]}
            >
              <View style={styles.eventHeading}>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.meta}>{event.eventCode} · Created {formatDateTime(event.createdAt)}</Text>
              </View>
              <View style={styles.count}>
                <Text style={styles.countText}>{event.attendeeCount}</Text>
                <Text style={styles.countLabel}>{event.attendeeCount === 1 ? 'scan' : 'scans'}</Text>
              </View>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.primary} />
            </Pressable>
            {open ? (
              <View style={styles.attendees}>
                {event.attendees.length ? event.attendees.map((attendee) => (
                  <View key={attendee.attendanceId} style={styles.attendee}>
                    <View style={styles.attendeeIcon}>
                      <Ionicons name="scan-outline" size={17} color={COLORS.accent} />
                    </View>
                    <View style={styles.attendeeText}>
                      <Text style={styles.attendeeName}>{attendee.studentName || `...${attendee.studentId.slice(-8)}`}</Text>
                      {attendee.email ? <Text style={styles.meta}>{attendee.email}</Text> : null}
                    </View>
                    <Text style={styles.meta}>{formatDateTime(attendee.scannedAt)}</Text>
                  </View>
                )) : <Text style={styles.meta}>No attendees.</Text>}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const currentRole = (await getProfile(user.id))?.role ?? 'student';
    setRole(currentRole);
    if (currentRole === 'teacher') {
      setTeacherEvents(await getTeacherEventAttendance(user.id));
      setStudentRecords([]);
    } else {
      setStudentRecords(await getAttendanceHistory(user.id));
      setTeacherEvents([]);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <Screen title="Scan history">
      {loading ? <ActivityIndicator color={COLORS.ink} /> : role === 'teacher' ? <TeacherHistory events={teacherEvents} /> : <StudentHistory records={studentRecords} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: COLORS.card, overflow: 'hidden' },
  studentCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary, padding: 16, gap: 12 },
  studentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scanIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  scanTime: { color: COLORS.muted, fontSize: 13, lineHeight: 18, paddingLeft: 46 },
  cardTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800' },
  meta: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
  eventHeader: { minHeight: 68, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventHeading: { flex: 1, gap: 4 },
  count: { minWidth: 52, minHeight: 44, borderRadius: 10, paddingHorizontal: 8, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  countText: { color: COLORS.primary, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  countLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  attendees: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: 14, gap: 12, backgroundColor: COLORS.surface },
  attendee: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  attendeeIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  attendeeText: { flex: 1, gap: 2 },
  attendeeName: { color: COLORS.ink, fontSize: 14, fontWeight: '700' },
  empty: { minHeight: 180, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { color: COLORS.ink, fontSize: 15, fontWeight: '600' },
  summary: { minHeight: 92, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.primary },
  summaryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent },
  summaryItem: { minWidth: 58, gap: 2 },
  summaryNumber: { color: COLORS.inverted, fontSize: 24, lineHeight: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  summaryLabel: { color: COLORS.inverted, fontSize: 12, fontWeight: '600' },
  summaryDivider: { width: 1, height: 42, backgroundColor: COLORS.inverted, opacity: 0.35 },
  pressed: { opacity: 0.65 },
});
