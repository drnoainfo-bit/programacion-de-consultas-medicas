/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Doctor, Appointment, BlockedDay, Shift24h } from '../types';
import { getWeekDates, formatDateString, formatReadableDate, getBlockingForSlot } from '../utils';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  PlusCircle,
  ExternalLink,
  Printer,
  Activity,
  LayoutGrid,
  List
} from 'lucide-react';
import SlotGridPanel from './SlotGridPanel';

interface WeeklyCalendarProps {
  doctors: Doctor[];
  appointments: Appointment[];
  blockedDays: BlockedDay[];
  shifts24h: Shift24h[];
  selectedPeriod: string;
  focusDate?: string;
  onAddAppointmentClick: (docId: string, date: string, shift: any) => void;
  onAddBlockClick: (docId: string, date: string, shift: any) => void;
  onToggleShift24h: (docId: string, date: string) => void;
  onAddSlotBlock: (docId: string, date: string, startTime: string, endTime: string) => void;
}

export default function WeeklyCalendar({
  doctors,
  appointments,
  blockedDays,
  shifts24h,
  selectedPeriod,
  focusDate,
  onAddAppointmentClick,
  onAddBlockClick,
  onToggleShift24h,
  onAddSlotBlock,
}: WeeklyCalendarProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'slots'>('summary');
  const [gridDocId, setGridDocId] = useState<string>('');
  const getPeriodStartDate = (period: string) => {
    const [yearRaw, monthRaw] = period.split('-').map(Number);
    const now = new Date();
    const year = Number.isFinite(yearRaw) ? yearRaw : now.getFullYear();
    const month = Number.isFinite(monthRaw) ? monthRaw : now.getMonth() + 1;
    return new Date(year, month - 1, 1, 12, 0, 0);
  };

  const [currentWeekRef, setCurrentWeekRef] = useState<Date>(() => getPeriodStartDate(selectedPeriod));

  useEffect(() => {
    setCurrentWeekRef(getPeriodStartDate(selectedPeriod));
  }, [selectedPeriod]);

  // Navega a la semana de la fecha accionada desde el panel mensual
  useEffect(() => {
    if (!focusDate) return;
    const [y, m, d] = focusDate.split('-').map(Number);
    setCurrentWeekRef(new Date(y, m - 1, d, 12, 0, 0));
    document.getElementById('calendar-root')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusDate]);

  const weekdays = getWeekDates(currentWeekRef);

  const prevWeek = () => {
    const d = new Date(currentWeekRef);
    d.setDate(d.getDate() - 7);
    setCurrentWeekRef(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeekRef);
    d.setDate(d.getDate() + 7);
    setCurrentWeekRef(d);
  };

  const resetToSelectedMonth = () => {
    setCurrentWeekRef(getPeriodStartDate(selectedPeriod));
  };

  const activeDoctors = doctors.filter(d => d.isActive);

  // Inicializar gridDocId con el primer médico activo
  React.useEffect(() => {
    if (!gridDocId && activeDoctors.length > 0) setGridDocId(activeDoctors[0].id);
  }, [activeDoctors.length]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200" id="calendar-root">
      {/* Calendar Header with controls */}
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl" id="calendar-icon-container">
            <Calendar className="w-5 h-5" id="calendar-icon" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-lg leading-tight" id="calendar-title">
              Agenda Semanal de Planificación
            </h2>
            <p className="text-xs text-slate-500 mt-0.5" id="calendar-subtitle">
              Visualice y asigne consultas o registre bloqueos de lunes a viernes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2" id="calendar-controls">
          {/* Toggle vista */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setViewMode('summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              title="Vista resumen por médico"
            >
              <List className="w-3.5 h-3.5" />
              Resumen
            </button>
            <button
              onClick={() => setViewMode('slots')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 ${viewMode === 'slots' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              title="Vista grilla por slots de 30 minutos"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Vista Slots
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors shadow-sm cursor-pointer print:hidden"
            title="Exportar planificación semanal de cupos a documento PDF"
            id="btn-print-pdf-report"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            <span>Exportar PDF / Imprimir</span>
          </button>

          <button
            onClick={prevWeek}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors print:hidden"
            title="Semana anterior"
            id="btn-prev-week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={resetToSelectedMonth}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors print:hidden"
            id="btn-current-week"
          >
            Inicio del Mes
          </button>
          
          <button
            onClick={nextWeek}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors print:hidden"
            id="btn-next-week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horas de Jornada y Regla de 30 minutos */}
      <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-205 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-705 print:hidden" id="jornadas-info-banner">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-extrabold text-slate-800 flex items-center gap-1 uppercase tracking-wider text-[10px]">
            ⚙️ Horarios Laborales:
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="font-bold text-blue-755 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">☀️ Mañana (Estándar 09:00, editable):</span>
            <span className="text-slate-500 font-medium font-semibold text-rose-700">12 cupos normales</span>
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">🌇 Tarde (14:00 - 17:00):</span>
            <span className="text-slate-500 font-medium">Slots de 30 min (máx. 6 pacientes sugeridos)</span>
          </span>
        </div>
        <div className="flex items-center gap-1 font-bold text-stone-650 bg-white px-2 py-0.5 rounded border border-stone-200 shadow-3xs text-[10.5px]">
          <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse shrink-0" />
          <span>Frecuencia: Agendamiento cada 30 min</span>
        </div>
      </div>

      {/* Week Title Block */}
      <div className="px-5 py-3 bg-slate-800 text-white flex items-center justify-between text-xs font-mono font-medium" id="week-range-banner">
        <span>Semana del {formatReadableDate(formatDateString(weekdays[0]))}</span>
        <span>Al {formatReadableDate(formatDateString(weekdays[6]))}</span>
      </div>

      {/* Vista Slots */}
      {viewMode === 'slots' && (
        <SlotGridPanel
          doctors={activeDoctors}
          appointments={appointments as (import('../types').Appointment & { status?: string })[]}
          blockedDays={blockedDays}
          shifts24h={shifts24h}
          weekdays={weekdays}
          selectedDocId={gridDocId}
          onSelectDoc={setGridDocId}
          onAddSlotBlock={onAddSlotBlock}
        />
      )}

      {/* Vista Resumen — Responsive scrollable week grid — sticky headers */}
      <div className={`overflow-auto max-h-[calc(100vh-340px)] min-h-[300px] ${viewMode !== 'summary' ? 'hidden' : ''}`} id="week-grid-container">
        <div className="min-w-[1050px] divide-y divide-slate-250">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-slate-50 text-center text-xs font-semibold text-slate-600 select-none sticky top-0 z-20 border-b border-slate-200 shadow-sm">
            {weekdays.map((day, idx) => {
              const dateStr = formatDateString(day);
              const isToday = dateStr === formatDateString(new Date());
              return (
                <div 
                  key={dateStr} 
                  className={`py-3 border-r border-slate-200 last:border-r-0 flex flex-col items-center justify-center gap-1 ${
                    isToday ? 'bg-blue-50/40 text-blue-700 font-bold' : ''
                  }`}
                  id={`header-${dateStr}`}
                >
                  <span className="uppercase tracking-wider text-[10px] text-slate-500">
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][idx]}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs ${isToday ? 'bg-blue-600 text-white' : 'text-slate-800'}`}>
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Calendar Body Content */}
          <div className="p-3 bg-slate-50/20" id="calendar-body">
            {activeDoctors.length === 0 ? (
              <div className="text-center py-10" id="no-doctors-alert">
                <p className="text-sm text-slate-400">No hay médicos activos registrados.</p>
                <p className="text-xs text-slate-400 mt-1">Por favor registre médicos en la pestaña de Médicos.</p>
              </div>
            ) : (
              <div className="space-y-4" id="doctors-calendar-list">
                {activeDoctors.map((doc) => {
                  return (
                    <div 
                      key={doc.id} 
                      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-all"
                      id={`row-doctor-${doc.id}`}
                    >
                      {/* Doctor bar header */}
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center select-none">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          <span className="font-semibold text-slate-800 text-sm leading-none">{doc.name}</span>
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                            {doc.specialty}
                          </span>
                        </div>
                        <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>Jornada de Contrato: </span>
                          <span className={`${doc.defaultShift === 'Tarde' ? 'text-amber-800 bg-amber-50 border border-amber-200' : 'text-blue-800 bg-blue-50 border border-blue-200'} px-2 py-0.5 rounded font-bold`}>
                            {doc.defaultShift === 'Tarde' ? 'Tarde (Vespertino)' : 'Mañana (Matutino)'}
                          </span>
                        </div>
                      </div>

                      {/* Weekday grid for doctor */}
                      <div className="grid grid-cols-7 divide-x divide-slate-100 text-xs">
                        {weekdays.map((day) => {
                          const dateStr = formatDateString(day);
                          
                          // Check if there is a 24-hour shift
                          const hasShift24h = shifts24h.some((s) => s.doctorId === doc.id && s.date === dateStr);
                          
                          // Check if weekend
                          const dVal = new Date(dateStr + 'T12:00:00');
                          const isWeekend = dVal.getDay() === 0 || dVal.getDay() === 6; // 0 Sunday, 6 Saturday

                          // We check standard schedule: Morning or Afternoon.
                          // Even though they work fixed, we can view both morning and afternoon status for any day.
                          const morningBlock = getBlockingForSlot(blockedDays, doc.id, dateStr, 'Mañana');
                          const afternoonBlock = getBlockingForSlot(blockedDays, doc.id, dateStr, 'Tarde');
                          const morningQuota = appointments.find(
                            (a) => a.doctorId === doc.id && a.date === dateStr && a.shift === 'Mañana'
                          );
                          const afternoonQuota = appointments.find(
                            (a) => a.doctorId === doc.id && a.date === dateStr && a.shift === 'Tarde'
                          );

                          // Helper to render segment for a shift
                          const renderShiftBlock = (shift: 'Mañana' | 'Tarde') => {
                            const isDefault = doc.defaultShift === shift;
                            const isBlocked = shift === 'Mañana' ? morningBlock : afternoonBlock;
                            const quota = shift === 'Mañana' ? morningQuota : afternoonQuota;

                            // Styles based on status
                            if (isBlocked) {
                              const reasonText = isBlocked.reason === 'Otro' ? isBlocked.customReason || 'Otro' : isBlocked.reason;
                              
                              // High Density spec dynamic styles
                              const styleMap = (() => {
                                const norm = reasonText.toLowerCase().trim();
                                if (norm.includes('upc')) {
                                  return { bg: 'bg-red-50 border-red-200 text-red-900', label: 'bg-red-150 text-red-800' };
                                }
                                if (norm.includes('policlinico') || norm.includes('policlínico')) {
                                  return { bg: 'bg-amber-50 border-amber-200 text-amber-900', label: 'bg-amber-200/50 text-amber-800' };
                                }
                                if (norm.includes('sala')) {
                                  return { bg: 'bg-slate-50 border-slate-300 text-slate-800', label: 'bg-slate-200/50 text-slate-800' };
                                }
                                if (norm.includes('horario protegido')) {
                                  return { bg: 'bg-emerald-50 border-emerald-250 text-emerald-900', label: 'bg-emerald-200/50 text-emerald-800' };
                                }
                                if (norm.includes('actividades adm')) {
                                  return { bg: 'bg-purple-50 border-purple-200 text-purple-900', label: 'bg-purple-100 text-purple-800' };
                                }
                                if (norm.includes('feriado')) {
                                  return { bg: 'bg-rose-50 border-rose-200 text-rose-900', label: 'bg-rose-100 text-rose-800' };
                                }
                                if (norm.includes('permiso')) {
                                  return { bg: 'bg-orange-50 border-orange-200 text-orange-900', label: 'bg-orange-100 text-orange-850' };
                                }
                                if (norm.includes('reunion') || norm.includes('reunión')) {
                                  return { bg: 'bg-indigo-50 border-indigo-200 text-indigo-900', label: 'bg-indigo-150 text-indigo-800' };
                                }
                                if (norm.includes('libre')) {
                                  return { bg: 'bg-blue-50 border-blue-200 text-blue-900', label: 'bg-blue-100 text-blue-800' };
                                }
                                if (norm.includes('licencia')) {
                                  return { bg: 'bg-pink-50 border-pink-200 text-pink-900', label: 'bg-pink-100 text-pink-800' };
                                }
                                if (norm.includes('capacitacion') || norm.includes('capacitación') || norm.includes('comision') || norm.includes('comisión')) {
                                  return { bg: 'bg-teal-50 border-teal-250 text-teal-900', label: 'bg-teal-150 text-teal-800' };
                                }
                                return { bg: 'bg-slate-50 border-slate-200 text-slate-900', label: 'bg-slate-100 text-slate-700' };
                              })();

                              return (
                                <div className={`p-2 border rounded-lg flex flex-col justify-between h-auto gap-1 shadow-sm ${styleMap.bg}`} id={`blocked-${doc.id}-${dateStr}-${shift}`}>
                                  <div className="flex items-start gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-extrabold block tracking-wider uppercase text-[8px] opacity-90 leading-none mb-1">
                                        BLOQUEO {shift.toUpperCase()}
                                      </span>
                                      {isBlocked.startTime && isBlocked.endTime && (
                                        <span className="font-mono font-bold text-[9px] block mb-1 text-slate-700">
                                          ⏰ {isBlocked.startTime} - {isBlocked.endTime}
                                        </span>
                                      )}
                                      <span className={`font-semibold text-[10px] px-1.5 py-0.5 rounded ${styleMap.label}`}>
                                        {reasonText}
                                      </span>
                                    </div>
                                  </div>
                                  {isBlocked.notes && (
                                    <p className="text-[9px] italic leading-tight mt-1 line-clamp-2 opacity-90">
                                      "{isBlocked.notes}"
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            if (quota && (quota.newAdmissions > 0 || quota.controls > 0)) {
                              const totalPlanned = quota.newAdmissions + quota.controls;
                              return (
                                <div className="p-2 bg-blue-50/80 border border-blue-200 rounded-lg space-y-1.5" id={`quota-${doc.id}-${dateStr}-${shift}`}>
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-[8px] uppercase tracking-wider text-blue-700">
                                      {shift} - Cupos
                                    </span>
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                  </div>
                                  
                                  <div className="space-y-1 text-[10px]">
                                    <div className="bg-white px-2 py-1 rounded border border-blue-100 flex flex-col gap-0.5 shadow-sm">
                                      <div className="flex justify-between font-medium text-slate-705">
                                        <span>Nuevos:</span>
                                        <span className="font-bold text-blue-700">{quota.newAdmissions}</span>
                                      </div>
                                      <div className="flex justify-between font-medium text-slate-705">
                                        <span>Controles:</span>
                                        <span className="font-bold text-blue-700">{quota.controls}</span>
                                      </div>
                                      <div className="border-t border-slate-100 mt-1 pt-1 flex justify-between font-bold text-slate-900 text-[10.5px]">
                                        <span>Total:</span>
                                        <span className="text-blue-750 font-mono">{totalPlanned}</span>
                                      </div>
                                      {shift === 'Mañana' && (
                                        <div className="border-t border-dashed border-slate-150 mt-1 pt-1 flex flex-col gap-1">
                                          <div className="flex justify-between items-center text-[9px] font-bold text-slate-600">
                                            <span>Inicio:</span>
                                            <span className="text-blue-800 font-mono">{quota.startTime || '09:00'} AM</span>
                                          </div>
                                          {(quota.include800 || quota.include830) && (
                                            <div className="flex flex-wrap gap-1 items-center pt-0.5 border-t border-slate-100">
                                              <span className="text-[7.5px] font-black uppercase text-slate-500">Módulos:</span>
                                              {quota.include800 && <span className="bg-blue-100 text-blue-900 px-1 py-0.5 text-[8px] rounded font-black shadow-3xs">08:00 AM</span>}
                                              {quota.include830 && <span className="bg-blue-100 text-blue-900 px-1 py-0.5 text-[8px] rounded font-black shadow-3xs">08:30 AM</span>}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {quota.notes && (
                                    <p className="text-[8.5px] text-slate-500 italic truncate" title={quota.notes}>
                                      "{quota.notes}"
                                    </p>
                                  )}

                                  <button
                                    onClick={() => onAddAppointmentClick(doc.id, dateStr, shift)}
                                    className="w-full mt-1.5 py-0.5 text-[9px] font-semibold text-blue-700 hover:text-white bg-blue-100 hover:bg-blue-600 rounded transition-colors print:hidden"
                                    id={`btn-edit-quota-${doc.id}-${dateStr}-${shift}`}
                                  >
                                    Modificar Metas
                                  </button>
                                </div>
                              );
                            }

                            // If out of roster shift hours, apply stunning high density diagonal stripes!
                            if (!isDefault) {
                              return (
                                <div 
                                  className="p-2 rounded-lg bg-stripes-slate border border-slate-200/30 opacity-65 flex flex-col justify-between items-start h-full min-h-[58px] group"
                                  id={`empty-out-of-shift-${doc.id}-${dateStr}-${shift}`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-450">
                                      {shift === 'Mañana' ? 'AM' : 'PM'} - No Disponible
                                    </span>
                                    <span className="text-[8px] text-slate-400 font-medium">
                                      Fuera de horario fijo
                                    </span>
                                  </div>

                                  <div className="w-full flex items-center justify-between mt-1 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                    <button
                                      onClick={() => onAddAppointmentClick(doc.id, dateStr, shift)}
                                      className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded"
                                      title="Programar Cupos Fuera de Horario"
                                      id={`btn-new-app-${doc.id}-${dateStr}-${shift}`}
                                    >
                                      <PlusCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => onAddBlockClick(doc.id, dateStr, shift)}
                                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                                      title="Bloquear Bloque"
                                      id={`btn-new-block-${doc.id}-${dateStr}-${shift}`}
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            // If within standard hours and vacant
                            return (
                              <div 
                                className="p-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/45 hover:bg-white hover:border-blue-400 transition-all duration-150 group flex flex-col justify-between items-start h-full min-h-[58px]"
                                id={`empty-${doc.id}-${dateStr}-${shift}`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-655">
                                    {shift}
                                  </span>
                                  <span className="text-[8px] text-emerald-600 font-semibold bg-emerald-50 px-1 py-[1px] rounded flex items-center gap-1">
                                    Disponible (Turno Fijo)
                                  </span>
                                </div>

                                <div className="w-full flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                                  <button
                                    onClick={() => onAddAppointmentClick(doc.id, dateStr, shift)}
                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded flex items-center gap-1 font-semibold text-[9px] px-1.5 py-0.5 text-xs"
                                    title="Definir cupos diarios"
                                    id={`btn-new-app-${doc.id}-${dateStr}-${shift}`}
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    Definir Cupos
                                  </button>
                                  <button
                                    onClick={() => onAddBlockClick(doc.id, dateStr, shift)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    title="Bloquear Bloque"
                                    id={`btn-new-block-${doc.id}-${dateStr}-${shift}`}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          };

                          // Render cell wrapper or full 24-hour shift block
                          if (hasShift24h) {
                            return (
                              <div key={dateStr} className="p-2.5 border-r border-slate-100 last:border-r-0 flex flex-col justify-between h-auto min-h-[196px] bg-indigo-50 border border-indigo-200 rounded-xl shadow-xs" id={`cell-${doc.id}-${dateStr}`}>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between select-none">
                                    <span className="font-extrabold text-[8.5px] uppercase tracking-widest text-indigo-755 bg-indigo-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                      💂️ Guardia 24 Horas
                                    </span>
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shrink-0"></span>
                                  </div>
                                  <div className="bg-white p-2.5 rounded-lg border border-indigo-150 text-center shadow-xs">
                                    <p className="text-[10.5px] font-black text-indigo-950 leading-tight">Médico de Respaldo</p>
                                    <p className="text-[8.5px] text-indigo-600 font-semibold mt-1">Servicio Completo Activo</p>
                                  </div>
                                  <p className="text-[8.5px] text-slate-500 italic text-center leading-relaxed">
                                    Bloqueado para consultas externas de policlínico.
                                  </p>
                                </div>
                                <button
                                  onClick={() => onToggleShift24h(doc.id, dateStr)}
                                  className="w-full mt-3 py-1.5 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer print:hidden shadow-2xs"
                                >
                                  Quitar Guardia 24h
                                </button>
                              </div>
                            );
                          }

                          if (isWeekend) {
                            return (
                              <div key={dateStr} className="p-2.5 border-r border-slate-100 last:border-r-0 flex flex-col justify-between h-auto min-h-[196px] bg-slate-50 border border-dashed border-slate-200/80 rounded-xl" id={`cell-${doc.id}-${dateStr}`}>
                                <div className="space-y-1.5 text-center p-1.5 select-none">
                                  <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 bg-slate-200/30 px-1.5 py-0.5 rounded">
                                    Fin de Semana
                                  </span>
                                  <p className="text-[9px] font-medium text-slate-400 italic leading-snug mt-1">
                                    No se programan consultas médicas ordinarias
                                  </p>
                                </div>
                                <button
                                  onClick={() => onToggleShift24h(doc.id, dateStr)}
                                  className="w-full py-1.5 text-[9.5px] font-bold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-650 rounded-lg shadow-3xs transition-all cursor-pointer print:hidden text-center"
                                  title="Programar Guardia de 24 horas para este fin de semana"
                                >
                                  + Guardia de 24h
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div key={dateStr} className="p-2 border-r border-slate-100 last:border-r-0 flex flex-col justify-between gap-3 bg-gradient-to-b from-white to-slate-50/20" id={`cell-${doc.id}-${dateStr}`}>
                              <div className="flex flex-col gap-2">
                                {/* Morning slot */}
                                {renderShiftBlock('Mañana')}
                                {/* Afternoon slot */}
                                {renderShiftBlock('Tarde')}
                              </div>
                              <button
                                onClick={() => onToggleShift24h(doc.id, dateStr)}
                                className="w-full py-1 text-[8px] font-semibold text-slate-500 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 rounded-md transition-all cursor-pointer text-center print:hidden"
                                title="Asignar Guardia Completa de 24 Horas a este día"
                              >
                                🩺 Activar Turno 24h
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
