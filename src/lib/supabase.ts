import { createClient } from '@supabase/supabase-js';
import type { Doctor, Appointment, BlockedDay, Shift24h } from '../types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Doctors ──────────────────────────────────────────────────────────────────

function dbToDoctor(row: Record<string, unknown>): Doctor {
  return {
    id: row.id as string,
    name: row.name as string,
    rut: row.rut as string | undefined,
    specialty: row.specialty as string,
    defaultShift: row.default_shift as Doctor['defaultShift'],
    isActive: row.is_active as boolean,
    sheetName: row.sheet_name as string,
    maxWeeklyPatients: row.max_weekly_patients as number | undefined,
  };
}

function doctorToDb(d: Doctor) {
  return {
    id: d.id,
    name: d.name,
    rut: d.rut ?? null,
    specialty: d.specialty,
    default_shift: d.defaultShift,
    is_active: d.isActive,
    sheet_name: d.sheetName,
    max_weekly_patients: d.maxWeeklyPatients ?? null,
  };
}

export async function fetchDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase.from('doctors').select('*');
  if (error) throw error;
  return (data ?? []).map(dbToDoctor);
}

export async function upsertDoctor(d: Doctor): Promise<void> {
  const { error } = await supabase.from('doctors').upsert(doctorToDb(d));
  if (error) throw error;
}

export async function deleteDoctor(id: string): Promise<void> {
  const { error } = await supabase.from('doctors').delete().eq('id', id);
  if (error) throw error;
}

// ── Appointments ─────────────────────────────────────────────────────────────

function dbToAppointment(row: Record<string, unknown>): Appointment & { status: string } {
  return {
    id: row.id as string,
    doctorId: row.doctor_id as string,
    date: row.date as string,
    shift: row.shift as Appointment['shift'],
    newAdmissions: row.new_admissions as number,
    controls: row.controls as number,
    notes: row.notes as string | undefined,
    startTime: row.start_time_val as string | undefined,
    include800: row.include800 as boolean | undefined,
    include830: row.include830 as boolean | undefined,
    status: (row.status as string) ?? 'Programada',
  };
}

function appointmentToDb(a: Appointment & { status?: string }) {
  return {
    id: a.id,
    doctor_id: a.doctorId,
    date: a.date,
    shift: a.shift,
    new_admissions: a.newAdmissions,
    controls: a.controls,
    notes: a.notes ?? null,
    start_time_val: a.startTime ?? null,
    include800: a.include800 ?? false,
    include830: a.include830 ?? false,
    status: (a as any).status ?? 'Programada',
  };
}

export async function fetchAppointments(): Promise<(Appointment & { status: string })[]> {
  const { data, error } = await supabase.from('appointments').select('*');
  if (error) throw error;
  return (data ?? []).map(dbToAppointment);
}

export async function upsertAppointment(a: Appointment & { status?: string }): Promise<void> {
  const { error } = await supabase.from('appointments').upsert(appointmentToDb(a));
  if (error) throw error;
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('appointments').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteManyAppointments(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('appointments').delete().in('id', ids);
  if (error) throw error;
}

// ── Blocked days ─────────────────────────────────────────────────────────────

function dbToBlockedDay(row: Record<string, unknown>): BlockedDay {
  return {
    id: row.id as string,
    doctorId: row.doctor_id as string,
    date: row.date as string,
    shift: row.shift as BlockedDay['shift'],
    reason: row.reason as BlockedDay['reason'],
    customReason: row.custom_reason as string | undefined,
    notes: row.notes as string | undefined,
    startTime: row.start_time as string | undefined,
    endTime: row.end_time as string | undefined,
  };
}

function blockedDayToDb(b: BlockedDay) {
  return {
    id: b.id,
    doctor_id: b.doctorId,
    date: b.date,
    shift: b.shift,
    reason: b.reason,
    custom_reason: b.customReason ?? null,
    notes: b.notes ?? null,
    start_time: b.startTime ?? null,
    end_time: b.endTime ?? null,
  };
}

export async function fetchBlockedDays(): Promise<BlockedDay[]> {
  const { data, error } = await supabase.from('blocked_days').select('*');
  if (error) throw error;
  return (data ?? []).map(dbToBlockedDay);
}

export async function upsertBlockedDay(b: BlockedDay): Promise<void> {
  const { error } = await supabase.from('blocked_days').upsert(blockedDayToDb(b));
  if (error) throw error;
}

export async function deleteBlockedDay(id: string): Promise<void> {
  const { error } = await supabase.from('blocked_days').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteManyBlockedDays(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('blocked_days').delete().in('id', ids);
  if (error) throw error;
}

// ── Shifts 24h ───────────────────────────────────────────────────────────────

function dbToShift24h(row: Record<string, unknown>): Shift24h {
  return {
    id: row.id as string,
    doctorId: row.doctor_id as string,
    date: row.date as string,
    notes: row.notes as string | undefined,
  };
}

function shift24hToDb(s: Shift24h) {
  return {
    id: s.id,
    doctor_id: s.doctorId,
    date: s.date,
    notes: s.notes ?? null,
  };
}

export async function fetchShifts24h(): Promise<Shift24h[]> {
  const { data, error } = await supabase.from('shifts24h').select('*');
  if (error) throw error;
  return (data ?? []).map(dbToShift24h);
}

export async function upsertShift24h(s: Shift24h): Promise<void> {
  const { error } = await supabase.from('shifts24h').upsert(shift24hToDb(s));
  if (error) throw error;
}

export async function deleteShift24h(id: string): Promise<void> {
  const { error } = await supabase.from('shifts24h').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteManyShifts24h(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('shifts24h').delete().in('id', ids);
  if (error) throw error;
}
