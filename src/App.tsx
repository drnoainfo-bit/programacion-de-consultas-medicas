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
  fetchShifts24h, upsertShift24h, deleteShift24h,
} from './lib/supabase';
import WeeklyCalendar from './components/WeeklyCalendar';
import DoctorManager from './components/DoctorManager';
import BlockingsManager from './components/BlockingsManager';
import AppointmentsManager from './components/AppointmentsManager';
import ValidationPanel from './components/ValidationPanel';
import SheetsPanel from './components/SheetsPanel';
import MonthlyCalendar from './components/MonthlyCalendar';
import ConfirmModal from './components/ConfirmModal';
import {
  Calendar,
  Users,
  AlertTriangle,
  UserCheck,
  Download,
  Activity,
  ClipboardList,
  FileSpreadsheet,
} from 'lucide-react';

type AppStatus = 'loading' | 'ready' | 'error';

export default function App() {
  const [appStatus, setAppStatus] = useState<AppStatus>('loading');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [appointments, setAppointments] = useState<(Appointment & { status: string })[]>([]);
  const [shifts24h, setShifts24h] = useState<Shift24h[]>([]);

  const [activeTab, setActiveTab] = useState<'calendar' | 'monthly' | 'appointments' | 'blockings' | 'doctors' | 'sheets'>('calendar');
  const [shortcutData, setShortcutData] = useState<{
    doctorId?: string;
    date?: string;
    shift?: 'Mañana' | 'Tarde' | 'Todo el día';
  } | null>(null);

  // Load all data from Supabase on mount
  useEffect(() => {
    Promise.all([
      fetchDoctors(),
      fetchAppointments(),
      fetchBlockedDays(),
      fetchShifts24h(),
    ])
      .then(([docs, apps, blocks, shifts]) => {
        setDoctors(docs);
        setAppointments(apps);
        setBlockedDays(blocks);
        setShifts24h(shifts);
        setAppStatus('ready');
      })
      .catch(() => setAppStatus('error'));
  }, []);

  // ── Doctor CRUD ─────────────────────────────────────────────────────────────

  const handleAddDoctor = useCallback(async (newDoc: Omit<Doctor, 'id'>) => {
    const doc: Doctor = { ...newDoc, id: `doc-${Date.now()}` };
    await upsertDoctor(doc);
    setDoctors(prev => [...prev, doc]);
  }, []);

  const handleUpdateDoctor = useCallback(async (id: string, updated: Partial<Doctor>) => {
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

  // ── Blockings CRUD ──────────────────────────────────────────────────────────

  const handleAddBlock = useCallback(async (newBlock: Omit<BlockedDay, 'id'>) => {
    const block: BlockedDay = { ...newBlock, id: `block-${Date.now()}` };
    await upsertBlockedDay(block);
    setBlockedDays(prev => [...prev, block]);
  }, []);

  const handleDeleteBlock = useCallback(async (id: string) => {
    await deleteBlockedDay(id);
    setBlockedDays(prev => prev.filter(b => b.id !== id));
  }, []);

  // ── Appointments CRUD ───────────────────────────────────────────────────────

  const handleAddAppointment = useCallback(async (newApp: Omit<Appointment, 'id'>) => {
    const app = { ...newApp, id: `app-${Date.now()}`, status: 'Programada' };
    await upsertAppointment(app);
    setAppointments(prev => [...prev, app]);
  }, []);

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

  // ── Shifts 24h ──────────────────────────────────────────────────────────────

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

      // Clean appointments and blocks for shift day and next day
      const [year, month, day] = date.split('-').map(Number);
      const nextD = new Date(year, month - 1, day, 12, 0, 0);
      nextD.setDate(nextD.getDate() + 1);
      const nextDayStr = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}-${String(nextD.getDate()).padStart(2, '0')}`;

      const appsToDelete = appointments.filter(a => a.doctorId === doctorId && (a.date === date || a.date === nextDayStr));
      const blocksToDelete = blockedDays.filter(b => b.doctorId === doctorId && (b.date === date || b.date === nextDayStr));

      await deleteManyAppointments(appsToDelete.map(a => a.id));
      await deleteManyBlockedDays(blocksToDelete.map(b => b.id));

      setAppointments(prev => prev.filter(a => !(a.doctorId === doctorId && (a.date === date || a.date === nextDayStr))));
      setBlockedDays(prev => prev.filter(b => !(b.doctorId === doctorId && (b.date === date || b.date === nextDayStr))));
    }
  }, [shifts24h, appointments, blockedDays]);

  // ── Calendar shortcuts ──────────────────────────────────────────────────────

  const handleCalendarAddAppointment = (docId: string, date: string, shift: 'Mañana' | 'Tarde') => {
    setShortcutData({ doctorId: docId, date, shift });
    setActiveTab('appointments');
  };

  const handleCalendarAddBlock = (docId: string, date: string, shift: 'Mañana' | 'Tarde') => {
    setShortcutData({ doctorId: docId, date, shift });
    setActiveTab('blockings');
  };

  // ── Excel export ────────────────────────────────────────────────────────────

  const handleDownloadExcel = async () => {
    await exportDoctorsToExcel(doctors, appointments, blockedDays, shifts24h);
  };

  // ── Reset to factory defaults ───────────────────────────────────────────────

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

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalDoctors = doctors.length;
  const afternoonDoctorsCount = doctors.filter(d => d.defaultShift === 'Tarde').length;
  const totalActiveApps = appointments.filter(a => a.status === 'Programada').length;
  const totalBlockedDays = blockedDays.length;

  // ── Render ──────────────────────────────────────────────────────────────────

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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans" id="app-viewport">
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-sm relative z-10 print:hidden" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold tracking-wider text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60 font-mono">
                  Gestión de Agendas Médicas v2.4
                </span>
                <h1 className="text-lg font-bold tracking-tight mt-0.5" id="app-main-title">
                  Planificador de Consultas Médicas
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer shadow-sm transition-all border border-emerald-500/20 active:scale-95"
                title="Generar planilla Excel con pestañas divididas por médico"
                id="btn-download-master-excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                <span>Descargar Planilla Excel</span>
              </button>

              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-3 py-2 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all border border-slate-700"
                id="btn-reset-data"
              >
                Restaurar Ejemplos
              </button>
            </div>

          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-5 lg:p-6 space-y-4" id="app-main-content">

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden" id="stats-dashboard">

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Médicos</span>
              <span className="text-xl font-extrabold text-slate-900 mt-0.5 block font-mono">{totalDoctors}</span>
            </div>
            <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Turno Tarde (Reglamento)</span>
              <span className="text-xl font-extrabold text-slate-900 mt-0.5 block font-mono">{afternoonDoctorsCount}</span>
            </div>
            <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Citas Programadas</span>
              <span className="text-xl font-extrabold text-blue-600 mt-0.5 block font-mono">{totalActiveApps}</span>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Bloqueos de Agenda</span>
              <span className="text-xl font-extrabold text-rose-600 mt-0.5 block font-mono">{totalBlockedDays}</span>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-250">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

        </section>

        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl max-w-2xl mx-auto border border-slate-200 shadow-sm print:hidden" id="app-tabs-container">
          <button
            onClick={() => { setShortcutData(null); setActiveTab('calendar'); }}
            className={`flex-1 min-w-[100px] py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'calendar' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            id="tab-calendar"
          >
            📅 Agenda Semanal
          </button>

          <button
            onClick={() => { setShortcutData(null); setActiveTab('monthly'); }}
            className={`flex-1 min-w-[100px] py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'monthly' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            id="tab-monthly"
          >
            🗓️ Agenda Mensual
          </button>

          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex-1 min-w-[100px] py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'appointments' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            id="tab-appointments"
          >
            📝 Citas Médicas
          </button>

          <button
            onClick={() => setActiveTab('blockings')}
            className={`flex-1 min-w-[100px] py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'blockings' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            id="tab-blockings"
          >
            ⚠️ Bloqueos
          </button>

          <button
            onClick={() => { setShortcutData(null); setActiveTab('doctors'); }}
            className={`flex-1 min-w-[100px] py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'doctors' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
            id="tab-doctors"
          >
            👥 Médicos
          </button>

          <button
            onClick={() => { setShortcutData(null); setActiveTab('sheets'); }}
            className={`flex-1 min-w-[125px] py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'sheets' ? 'bg-emerald-700 text-white shadow-sm font-extrabold' : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50'
            }`}
            id="tab-sheets"
          >
            🟢 Sincronizar Sheet
          </button>
        </div>

        <div className="transition-all duration-200" id="tab-content-viewport">

          {activeTab === 'calendar' && (
            <div className="space-y-5 animate-fade-in">
              <ValidationPanel
                doctors={doctors}
                appointments={appointments}
                blockedDays={blockedDays}
                shifts24h={shifts24h}
                selectedPeriod="2026-06"
                onAutoSchedule={(generatedApps, generatedGuards) => {
                  const appsWithStatus = generatedApps.map((a: Appointment) => ({ ...a, status: 'Programada' }));
                  setAppointments(appsWithStatus);
                  if (generatedGuards) setShifts24h(generatedGuards);
                }}
                onClearAppointments={() => setAppointments([])}
              />
              <WeeklyCalendar
                doctors={doctors}
                appointments={appointments}
                blockedDays={blockedDays}
                shifts24h={shifts24h}
                onToggleShift24h={handleToggleShift24h}
                onAddAppointmentClick={handleCalendarAddAppointment}
                onAddBlockClick={handleCalendarAddBlock}
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
              onAddAppointment={handleAddAppointment}
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

          {activeTab === 'sheets' && (
            <SheetsPanel
              doctors={doctors}
              appointments={appointments}
              blockedDays={blockedDays}
              shifts24h={shifts24h}
              selectedPeriod="2026-06"
            />
          )}

        </div>

        <section className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex flex-col md:flex-row md:items-center md:justify-between gap-6 print:hidden" id="excel-helper-banner">
          <div className="space-y-1">
            <h4 className="font-semibold text-emerald-900 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Sincronización a Planilla (Plataforma de Hojas de Cálculo)
            </h4>
            <p className="text-xs text-emerald-800">
              La plataforma le permite exportar los datos ingresados en un archivo de Excel (.xlsx) estructurado con <strong>una hoja independiente para cada médico</strong>.
            </p>
          </div>
          <button
            onClick={handleDownloadExcel}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all whitespace-nowrap active:scale-95 inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar Libro de Excel (.xlsx)
          </button>
        </section>

      </main>

      <footer className="bg-slate-100 border-t border-slate-200/60 py-6 text-center text-xs text-slate-500 print:hidden" id="app-footer">
        <p>© 2026 Policlínico de Especialidades. Sistema Automatizado de Gestión y Programación de Turnos de Consultas.</p>
      </footer>

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
