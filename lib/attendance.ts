import { getEventByCode } from '@/lib/events';
import { parseQRPayload } from '@/lib/qr';
import { supabase } from '@/lib/supabase';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  createdAt: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    attendanceId: string;
    studentId: string;
    studentName: string | null;
    email: string | null;
    scannedAt: string;
  }[];
};

export type TeacherEventSummary = Pick<
  TeacherEventAttendance,
  'eventId' | 'eventCode' | 'title' | 'attendeeCount'
>;

export async function registerAttendance(rawPayload: string, studentId: string): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) return { success: false, message: parsed.message };

  const { payload } = parsed;
  const now = Date.now();
  const start = payload.start ? new Date(payload.start).getTime() : null;
  const end = payload.end ? new Date(payload.end).getTime() : null;

  if (start && now < start) return { success: false, message: 'Event has not started yet.' };
  if (end && now > end) return { success: false, message: 'Event has already ended.' };

  const event = await getEventByCode(payload.event);
  if (!event) return { success: false, message: 'Event not found.' };

  const { error } = await supabase.from('attendance').insert({
    student_id: studentId,
    event_id: event.id,
  });

  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Scan saved to your history.', eventTitle: event.title };
}

export async function getAttendanceHistory(studentId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, events ( event_code, title )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
  }));
}

export async function getTeacherEventAttendance(teacherId: string): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, created_at, start_time, end_time')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events?.length) return [];
  const eventIds = events.map((event) => event.id);
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('id, student_id, scanned_at, event_id')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attendanceError || !attendance) return [];
  const studentIds = [...new Set(attendance.map((row) => row.student_id))];
  const { data: profiles } = studentIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', studentIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return events.map((event) => {
    const rows = attendance.filter((row) => row.event_id === event.id);
    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      createdAt: event.created_at,
      startTime: event.start_time,
      endTime: event.end_time,
      attendeeCount: rows.length,
      attendees: rows.map((row) => {
        const profile = profilesById.get(row.student_id);
        return {
          attendanceId: row.id,
          studentId: row.student_id,
          studentName: profile?.full_name ?? null,
          email: profile?.email ?? null,
          scannedAt: row.scanned_at,
        };
      }),
    };
  });
}

export async function getTeacherEventSummary(teacherId: string): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  if (eventError || !events?.length) return [];

  const eventIds = events.map((event) => event.id);
  const { data: rows, error } = await supabase.from('attendance').select('event_id').in('event_id', eventIds);
  if (error || !rows) return [];

  const counts: Record<string, number> = {};
  rows.forEach((row) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
  });
  return events.map((event) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount: counts[event.id] ?? 0,
  }));
}
