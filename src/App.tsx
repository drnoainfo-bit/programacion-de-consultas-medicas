/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Doctor, Appointment, BlockedDay, Shift24h } from './types';
import {
  INITIAL_DOCTORS,
  INITIAL_BLOCKED_DAYS,
  INITIAL_APPOINTMENTS,
  exportDoctorsToExcel,
} from './utils';
import {
  fetchDoctors, upsertDoctor, deleteDoctor,
  fetchAppointments, upsertAppointment, deleteAppointment, deleteManyAppointments,
  fetchBlockedDays, upsertBlockedDay, deleteBlockedDay, deleteManyBlockedDays,
  fetchShifts24h, upsertShift24h, deleteShift24h, deleteManyShifts24h,
} from './lib/supabase';
import WeeklyCalendar from './components/WeeklyCalendar';
import DoctorManager from './components/DoctorManager';
import BlockingsManager from './components/BlockingsManager';
import AppointmentsManager from './components/AppointmentsManager';
import ValidationPanel from './components/ValidationPanel';
import MonthlyCalendar from './components/MonthlyCalendar';
import MonthlyDoctorPlanner from './components/MonthlyDoctorPlanner';
import ConfirmModal from './components/ConfirmModal';
import {
  Calendar,
  CalendarDays,
  Users,
  AlertTriangle,
  UserCheck,
  Download,
  Activity,
  ClipboardList,
  FileSpreadsheet,
  ChevronRight,
} from 'lucide-react';

type AppStatus = 'loading' | 'ready' | 'error';

export default function App() {
  const [appStatus, setAppStatus] = useState<AppStatus>('loading');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [appointments, setAppointments] = useState<(Appointment & { status: string })[]>([]);
  const [shifts24h, setShifts24h] = useState<Shift24h[]>([]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const saved = localStorage.getItem('agenda_selectedPeriod');
    if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    localStorage.setItem('agenda_selectedPeriod', period);
  };

  const [activeTab, setActiveTab] = useState<'calendar' | 'monthly' | 'appointments' | 'blockings' | 'doctors'>('calendar');
  const [weekFocusDate, setWeekFocusDate] = useState<string | undefined>(undefined);
  const [shortcutData, setShortcutData] = useState<{
    doctorId?: string;
    date?: string;
    shift?: 'Mañana' | 'Tarde' | 'Todo el día';
    startTime?: string;
    endTime?: string;
  } | null>(null);

  // Load all data from Supabase on mount
  useEffect(() => {
    const salaOverrides: Record<string, boolean> = (() => {
      try { return JSON.parse(localStorage.getItem('morningSala_overrides') || '{}'); }
      catch { return {}; }
    })();
    const scheduleOverrides: Record<string, { start?: string; end?: string }> = (() => {
      try { return JSON.parse(localStorage.getItem('schedule_overrides') || '{}'); }
      catch { return {}; }
    })();
    Promise.all([
      fetchDoctors(),
      fetchAppointments(),
      fetchBlockedDays(),
      fetchShifts24h(),
    ])
      .then(([docs, apps, blocks, shifts]) => {
        setDoctors(docs.map(d => ({
          ...d,
          morningSala: salaOverrides[d.id] ?? d.morningSala ?? false,
          scheduleStart: scheduleOverrides[d.id]?.start ?? d.scheduleStart,
          scheduleEnd:   scheduleOverrides[d.id]?.end   ?? d.scheduleEnd,
        })));
        setAppointments(apps);
        setBlockedDays(blocks);
        setShifts24h(shifts);
        setAppStatus('ready');
      })
      .catch(() => setAppStatus('error'));
  }, []);

  // â”€â”€ Doctor CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleAddDoctor = useCallback(async (newDoc: Omit<Doctor, 'id'>) => {
    const doc: Doctor = { ...newDoc, id: `doc-${Date.now()}` };
    await upsertDoctor(doc);
    setDoctors(prev => [...prev, doc]);
  }, []);

  const handleUpdateDoctor = useCallback(async (id: string, updated: Partial<Doctor>) => {
    if ('morningSala' in updated) {
      try {
        const overrides = JSON.parse(localStorage.getItem('morningSala_overrides') || '{}');
        overrides[id] = !!updated.morningSala;
        localStorage.setItem('morningSala_overrides', JSON.stringify(overrides));
      } catch {}
    }
    if ('scheduleStart' in updated || 'scheduleEnd' in updated) {
      try {
        const overrides = JSON.parse(localStorage.getItem('schedule_overrides') || '{}');
        overrides[id] = { ...(overrides[id] || {}), ...('scheduleStart' in updated ? { start: updated.scheduleStart } : {}), ...('scheduleEnd' in updated ? { end: updated.scheduleEnd } : {}) };
        localStorage.setItem('schedule_overrides', JSON.stringify(overrides));
      } catch {}
    }
    setDoctors(prev => {
      const next = prev.map(d => (d.id === id ? { ...d, ...updated } : d));
      const doc = next.find(d => d.id === id);
      if (doc) upsertDoctor(doc);
      return next;
    });
  }, []);

  const handleDeleteDoctor = useCallback(async (id: string) => {
    await deleteDoctor(id); // cascade deletes appointments, blocks, shifts
    setDoctors(prev => prev.filter(d => d.id !== id));
    setAppointments(prev => prev.filter(a => a.doctorId !== id));
    setBlockedDays(prev => prev.filter(b => b.doctorId !== id));
    setShifts24h(prev => prev.filter(s => s.doctorId !== id));
  }, []);

  // â”€â”€ Blockings CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleAddBlock = useCallback(async (newBlock: Omit<BlockedDay, 'id'>) => {
    const block: BlockedDay = { ...newBlock, id: `block-${Date.now()}` };
    await upsertBlockedDay(block);
    setBlockedDays(prev => [...prev, block]);
  }, []);

  const handleDeleteBlock = useCallback(async (id: string) => {
    await deleteBlockedDay(id);
    setBlockedDays(prev => prev.filter(b => b.id !== id));
  }, []);

  // â”€â”€ Appointments CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleAddAppointment = useCallback(async (newApp: Omit<Appointment, 'id'>) => {
    const app = { ...newApp, id: `app-${Date.now()}`, status: 'Programada' };
    await upsertAppointment(app);
    setAppointments(prev => [...prev, app]);
  }, []);

  const handleUpsertAppointment = useCallback(async (newApp: Omit<Appointment, 'id'>) => {
    const existing = appointments.find(
      a => a.doctorId === newApp.doctorId && a.date === newApp.date && a.shift === newApp.shift
    );
    const app = { ...newApp, id: existing?.id || `app-${Date.now()}`, status: existing?.status || 'Programada' };
    await upsertAppointment(app);
    setAppointments(prev => existing
      ? prev.map(a => (a.id === existing.id ? app : a))
      : [...prev, app]
    );
  }, [appointments]);

  const handleCancelAppointment = useCallback(async (id: string) => {
    await deleteAppointment(id);
    setAppointments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleUpdateAppStatus = useCallback(async (id: string, status: 'Programada' | 'Atendida' | 'Cancelada') => {
    setAppointments(prev => {
      const next = prev.map(a => (a.id === id ? { ...a, status } : a));
      const app = next.find(a => a.id === id);
      if (app) upsertAppointment(app);
      return next;
    });
  }, []);

  // â”€â”€ Shifts 24h â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleToggleShift24h = useCallback(async (doctorId: string, date: string) => {
    const existing = shifts24h.find(s => s.doctorId === doctorId && s.date === date);
    if (existing) {
      await deleteShift24h(existing.id);
      setShifts24h(prev => prev.filter(s => !(s.doctorId === doctorId && s.date === date)));
    } else {
      const newShift: Shift24h = {
        id: `shift24h-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        doctorId,
        date,
      };
      await upsertShift24h(newShift);
      setShifts24h(prev => [...prev, newShift]);

      // Keep manual planning intact. Validation will warn about conflicts instead of deleting user data.
    }
  }, [shifts24h]);

  // â”€â”€ Calendar shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleCalendarAddAppointment = (docId: string, date: string, shift: any) => {
    setShortcutData({ doctorId: docId, date, shift });
    setActiveTab('appointments');
  };

  const handleCalendarAddBlock = (docId: string, date: string, shift: any) => {
    setShortcutData({ doctorId: docId, date, shift });
    setActiveTab('blockings');
  };

  const handleAddSlotBlock = (docId: string, date: string, startTime: string, endTime: string) => {
    const shift: 'Mañana' | 'Tarde' = startTime >= '14:00' ? 'Tarde' : 'Mañana';
    setShortcutData({ doctorId: docId, date, shift, startTime, endTime });
    setActiveTab('blockings');
  };

  const handleClearAppointments = useCallback(async () => {
    const appointmentsToDelete = appointments.filter(a => a.date.startsWith(selectedPeriod));
    await deleteManyAppointments(appointmentsToDelete.map(a => a.id));
    setAppointments(prev => prev.filter(a => !a.date.startsWith(selectedPeriod)));
  }, [appointments, selectedPeriod]);

  const handleClearDoctorMonth = useCallback(async (doctorId: string, mode: 'appointments' | 'all') => {
    const appsToDelete = appointments.filter(a => a.doctorId === doctorId && a.date.startsWith(selectedPeriod));
    if (appsToDelete.length > 0) {
      await deleteManyAppointments(appsToDelete.map(a => a.id));
      setAppointments(prev => prev.filter(a => !(a.doctorId === doctorId && a.date.startsWith(selectedPeriod))));
    }
    if (mode === 'all') {
      const guardsToDelete = shifts24h.filter(s => s.doctorId === doctorId && s.date.startsWith(selectedPeriod));
      if (guardsToDelete.length > 0) {
        await deleteManyShifts24h(guardsToDelete.map(s => s.id));
        setShifts24h(prev => prev.filter(s => !(s.doctorId === doctorId && s.date.startsWith(selectedPeriod))));
      }
    }
  }, [appointments, shifts24h, selectedPeriod]);

  const handleAutoSchedule = useCallback(async (generatedApps: Appointment[], generatedGuards: Shift24h[] = [], generatedBlocks: BlockedDay[] = []) => {
    const existingAppKeys = new Set(appointments.map(a => `${a.doctorId}-${a.date}-${a.shift}`));
    const newApps = generatedApps.filter(a => !existingAppKeys.has(`${a.doctorId}-${a.date}-${a.shift}`));
    const appsWithStatus = newApps.map((a: Appointment) => ({ ...a, status: 'Programada' }));

    for (const app of appsWithStatus) await upsertAppointment(app);

    const existingGuardKeys = new Set(shifts24h.map(s => `${s.doctorId}-${s.date}`));
    const newGuards = generatedGuards.filter(g => !existingGuardKeys.has(`${g.doctorId}-${g.date}`));
    for (const guard of newGuards) await upsertShift24h(guard);

    const existingBlockKeys = new Set(blockedDays.map(b => `${b.doctorId}-${b.date}-${b.shift}`));
    const newBlocks = generatedBlocks.filter(b => !existingBlockKeys.has(`${b.doctorId}-${b.date}-${b.shift}`));
    for (const block of newBlocks) await upsertBlockedDay(block);

    if (appsWithStatus.length > 0) {
      setAppointments(prev => [...prev, ...appsWithStatus]);
      const firstDate = appsWithStatus.sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
      if (firstDate) setWeekFocusDate(firstDate);
    }
    if (newGuards.length > 0) setShifts24h(prev => [...prev, ...newGuards]);
    if (newBlocks.length > 0) setBlockedDays(prev => [...prev, ...newBlocks]);
  }, [appointments, shifts24h, blockedDays]);

  const handleDownloadExcel = async () => {
    await exportDoctorsToExcel(doctors, appointments, blockedDays, shifts24h, selectedPeriod);
  };

  // â”€â”€ Reset to factory defaults â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const executeResetToFactory = async () => {
    // Wipe all remote data first
    for (const d of doctors) await deleteDoctor(d.id);

    const freshDoctors = INITIAL_DOCTORS;
    const freshBlocks = INITIAL_BLOCKED_DAYS;
    const freshApps = INITIAL_APPOINTMENTS.map((a: Appointment) => ({ ...a, status: 'Programada' }));

    for (const d of freshDoctors) await upsertDoctor(d);
    for (const b of freshBlocks) await upsertBlockedDay(b);
    for (const a of freshApps) await upsertAppointment(a);

    setDoctors(freshDoctors);
    setBlockedDays(freshBlocks);
    setAppointments(freshApps);
    setShifts24h([]);
    setShortcutData(null);
    setActiveTab('calendar');
  };

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const totalDoctors = doctors.length;
  const afternoonDoctorsCount = doctors.filter(d => d.defaultShift === 'Tarde').length;
  const totalActiveApps = appointments.filter(a => a.status === 'Programada').length;
  const totalBlockedDays = blockedDays.length;

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (appStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-blue-500 animate-pulse mx-auto" />
          <p className="text-slate-600 text-sm font-medium">Cargando datos de agenda...</p>
        </div>
      </div>
    );
  }

  if (appStatus === 'error') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-slate-700 font-semibold">Error al conectar con la base de datos</p>
          <p className="text-slate-500 text-sm">Verifica las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY</p>
          <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Reintentar</button>
        </div>
      </div>
    );
  }

  const NAV_ITEMS = [
    { id: 'calendar',     label: 'Agenda Semanal',  icon: Calendar,     section: 'Vistas' },
    { id: 'monthly',      label: 'Agenda Mensual',  icon: CalendarDays, section: 'Vistas' },
    { id: 'appointments', label: 'Citas Medicas',   icon: UserCheck,    section: 'Datos' },
    { id: 'blockings',    label: 'Bloqueos',        icon: AlertTriangle,section: 'Datos' },
    { id: 'doctors',      label: 'Medicos',         icon: Users,        section: 'Datos' },
  ] as const;

  const TAB_LABELS: Record<string, string> = {
    calendar:     'Agenda Semanal',
    monthly:      'Agenda Mensual',
    appointments: 'Citas Medicas',
    blockings:    'Bloqueos de Agenda',
    doctors:      'Gestion de Medicos',
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden" id="app-viewport">

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-sm z-20 shrink-0 print:hidden" id="app-header">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-600/20 text-teal-400 rounded-lg border border-teal-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[8px] uppercase font-bold tracking-wider text-teal-400 font-mono">
                Gestion de Agendas Medicas v2.4
              </span>
              <h1 className="text-sm font-bold tracking-tight leading-none mt-0.5" id="app-main-title">
                Planificador de Consultas Medicas
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <label htmlFor="month-selector" className="text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                Mes
              </label>
              <input
                id="month-selector"
                type="month"
                value={selectedPeriod}
                onChange={e => handlePeriodChange(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold border-0 outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 font-semibold text-xs text-white bg-teal-600 hover:bg-teal-500 rounded-lg cursor-pointer transition-all active:scale-95"
              title="Descargar planilla Excel"
              id="btn-download-master-excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Descargar Excel</span>
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all border border-slate-700"
              id="btn-reset-data"
            >
              Restaurar
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: sidebar + content ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col print:hidden overflow-y-auto" id="app-sidebar">

          {/* Stats */}
          <div className="p-3 space-y-2 border-b border-slate-800">
            <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 px-1 mb-1">Resumen del mes</p>

            <div className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-300">Total Medicos</span>
              </div>
              <span className="text-sm font-extrabold text-white font-mono">{totalDoctors}</span>
            </div>

            <div className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-300">Turno Tarde</span>
              </div>
              <span className="text-sm font-extrabold text-white font-mono">{afternoonDoctorsCount}</span>
            </div>

            <div className="flex items-center justify-between bg-teal-900/60 border border-teal-700/40 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-[10px] text-teal-200">Citas activas</span>
              </div>
              <span className="text-sm font-extrabold text-teal-300 font-mono">{totalActiveApps}</span>
            </div>

            <div className="flex items-center justify-between bg-rose-900/40 border border-rose-700/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[10px] text-rose-200">Bloqueos</span>
              </div>
              <span className="text-sm font-extrabold text-rose-300 font-mono">{totalBlockedDays}</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-4">
            {(['Vistas', 'Datos'] as const).map(section => (
              <div key={section}>
                <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 px-2 mb-1">{section}</p>
                <div className="space-y-0.5">
                  {NAV_ITEMS.filter(n => n.section === section).map(({ id, label, icon: Icon }) => {
                    const isActive = activeTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setShortcutData(null);
                          setActiveTab(id as any);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        id={`tab-${id}`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1 text-left">{label}</span>
                        {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer sidebar */}
          <div className="p-3 border-t border-slate-800">
            <p className="text-[8px] text-slate-600 text-center leading-relaxed">
              © 2026 Policlinico de Especialidades
            </p>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-slate-50" id="app-main-content">

          {/* Page header */}
          <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-2 print:hidden">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Menu</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-sm font-bold text-slate-800">{TAB_LABELS[activeTab]}</span>
          </div>

          <div className="p-5" id="tab-content-viewport">

            {activeTab === 'calendar' && (
              <div className="space-y-5">
                <ValidationPanel
                  doctors={doctors}
                  appointments={appointments}
                  blockedDays={blockedDays}
                  shifts24h={shifts24h}
                  selectedPeriod={selectedPeriod}
                  onAutoSchedule={handleAutoSchedule}
                  onClearAppointments={handleClearAppointments}
                />
                <MonthlyDoctorPlanner
                  doctors={doctors}
                  appointments={appointments}
                  blockedDays={blockedDays}
                  shifts24h={shifts24h}
                  selectedPeriod={selectedPeriod}
                  onAddAppointment={handleUpsertAppointment}
                  onAddBlock={handleAddBlock}
                  onDeleteAppointment={handleCancelAppointment}
                  onDeleteBlock={handleDeleteBlock}
                  onToggleShift24h={handleToggleShift24h}
                  onEditAppointment={handleCalendarAddAppointment}
                  onEditBlock={handleCalendarAddBlock}
                  onDayActioned={date => setWeekFocusDate(date)}
                  onClearMonth={handleClearDoctorMonth}
                />
                <WeeklyCalendar
                  doctors={doctors}
                  appointments={appointments}
                  blockedDays={blockedDays}
                  shifts24h={shifts24h}
                  selectedPeriod={selectedPeriod}
                  focusDate={weekFocusDate}
                  onToggleShift24h={handleToggleShift24h}
                  onAddAppointmentClick={handleCalendarAddAppointment}
                  onAddBlockClick={handleCalendarAddBlock}
                  onAddSlotBlock={handleAddSlotBlock}
                />
              </div>
            )}

            {activeTab === 'monthly' && (
              <MonthlyCalendar
                doctors={doctors}
                appointments={appointments}
                blockedDays={blockedDays}
                shifts24h={shifts24h}
                onAddAppointmentClick={handleCalendarAddAppointment}
                onAddBlockClick={handleCalendarAddBlock}
                onToggleShift24h={handleToggleShift24h}
              />
            )}

            {activeTab === 'appointments' && (
              <AppointmentsManager
                doctors={doctors.filter(d => d.isActive)}
                appointments={appointments}
                blockedDays={blockedDays}
                shifts24h={shifts24h}
                onAddAppointment={handleUpsertAppointment}
                onCancelAppointment={handleCancelAppointment}
                onUpdateAppStatus={handleUpdateAppStatus}
                defaultDate={shortcutData?.date}
                defaultDoctorId={shortcutData?.doctorId}
                defaultShift={shortcutData?.shift as any}
              />
            )}

            {activeTab === 'blockings' && (
              <BlockingsManager
                doctors={doctors}
                blockedDays={blockedDays}
                onAddBlock={handleAddBlock}
                onDeleteBlock={handleDeleteBlock}
                defaultDate={shortcutData?.date}
                defaultDoctorId={shortcutData?.doctorId}
                defaultShift={shortcutData?.shift as any}
                defaultStartTime={shortcutData?.startTime}
                defaultEndTime={shortcutData?.endTime}
              />
            )}

            {activeTab === 'doctors' && (
              <DoctorManager
                doctors={doctors}
                onAddDoctor={handleAddDoctor}
                onUpdateDoctor={handleUpdateDoctor}
                onDeleteDoctor={handleDeleteDoctor}
              />
            )}

          </div>
        </main>
      </div>

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={executeResetToFactory}
        title="Restaurar datos de fábrica"
        message="¿Está seguro de que desea restaurar los datos iniciales de la rotativa médica? Esto eliminará todos sus cambios recientes y cargará los profesionales y agendas de demostración de ejemplo."
        confirmText="Restaurar Ejemplos"
        cancelText="Volver"
        type="warning"
      />
    </div>
  );
}


