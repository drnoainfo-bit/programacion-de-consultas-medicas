/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Doctor, Appointment, BlockedDay, Shift24h } from '../types';
import { formatDateString } from '../utils';
import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';

interface MonthlyCalendarProps {
  doctors: Doctor[];
  appointments: (Appointment & { status: string })[];
  blockedDays: BlockedDay[];
  shifts24h: Shift24h[];
  onAddAppointmentClick: (docId: string, date: string, shift: 'Mañana' | 'Tarde') => void;
  onAddBlockClick: (docId: string, date: string, shift: 'Mañana' | 'Tarde') => void;
  onToggleShift24h: (docId: string, date: string) => void;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_SHORT = ['Lun','Mar','Mié','Jue','Vie'];

export default function MonthlyCalendar({
  doctors, appointments, blockedDays, shifts24h,
  onAddAppointmentClick, onAddBlockClick, onToggleShift24h,
}: MonthlyCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const activeDoctors = doctors.filter(d => d.isActive);

  const weekdays = useMemo(() => {
    const days: Date[] = [];
    const d = new Date(viewYear, viewMonth, 1);
    while (d.getMonth() === viewMonth) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const minWidth = Math.max(700, activeDoctors.length * 160 + 90);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 rounded-t-2xl">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg leading-tight">Agenda Mensual</h2>
          <p className="text-xs text-slate-500 mt-0.5">Vista completa del mes — click en cualquier celda para editar</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            Hoy
          </button>
          <span className="px-3 py-1.5 text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg min-w-[155px] text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[calc(100vh-320px)]">
        <table className="w-full border-collapse" style={{ minWidth: `${minWidth}px` }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider w-[72px] border-r border-slate-700 sticky left-0 bg-slate-800 z-30">
                Día
              </th>
              {activeDoctors.map(doc => (
                <th key={doc.id} className="px-2 py-2.5 text-center text-[10px] font-bold tracking-wide border-r border-slate-700 last:border-r-0">
                  <div className="truncate">{doc.sheetName}</div>
                  <div className={`text-[8px] font-medium mt-0.5 ${doc.defaultShift === 'Tarde' ? 'text-amber-300' : 'text-blue-300'}`}>
                    {doc.defaultShift === 'Tarde' ? '🌇 Tarde' : '☀️ Mañana'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {weekdays.map((day, idx) => {
              const dateStr = formatDateString(day);
              const isToday = dateStr === formatDateString(today);
              const dowIdx = day.getDay() - 1;

              return (
                <tr key={dateStr} className={isToday ? 'bg-blue-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                  {/* Date cell — sticky left */}
                  <td className={`px-3 py-2 border-r border-slate-200 sticky left-0 z-10 ${isToday ? 'bg-blue-100' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <div className={`text-[10px] font-bold ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{DAY_SHORT[dowIdx]}</div>
                    <div className={`text-base font-extrabold font-mono leading-tight ${isToday ? 'text-blue-700' : 'text-slate-900'}`}>{day.getDate()}</div>
                  </td>

                  {/* Doctor cells */}
                  {activeDoctors.map(doc => {
                    const has24h = shifts24h.some(s => s.doctorId === doc.id && s.date === dateStr);
                    const prevDay = new Date(day);
                    prevDay.setDate(prevDay.getDate() - 1);
                    const isPostTurno = shifts24h.some(s => s.doctorId === doc.id && s.date === formatDateString(prevDay));
                    const blockAM = blockedDays.find(b => b.doctorId === doc.id && b.date === dateStr && (b.shift === 'Mañana' || b.shift === 'Todo el día'));
                    const blockPM = blockedDays.find(b => b.doctorId === doc.id && b.date === dateStr && (b.shift === 'Tarde' || b.shift === 'Todo el día'));
                    const appAM = appointments.find(a => a.doctorId === doc.id && a.date === dateStr && a.shift === 'Mañana' && a.status !== 'Cancelada');
                    const appPM = appointments.find(a => a.doctorId === doc.id && a.date === dateStr && a.shift === 'Tarde' && a.status !== 'Cancelada');

                    if (has24h) {
                      return (
                        <td key={doc.id} className="px-2 py-1.5 border-r border-slate-100 last:border-r-0 bg-indigo-50 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded text-center block">💂 Guardia 24h</span>
                            <button
                              onClick={() => onToggleShift24h(doc.id, dateStr)}
                              className="text-[8px] text-indigo-400 hover:text-indigo-700 text-center transition-colors"
                            >
                              Quitar
                            </button>
                          </div>
                        </td>
                      );
                    }

                    if (isPostTurno) {
                      return (
                        <td key={doc.id} className="px-2 py-1.5 border-r border-slate-100 last:border-r-0 bg-slate-50 align-top">
                          <span className="text-[9px] text-slate-400 italic">Posturno</span>
                        </td>
                      );
                    }

                    return (
                      <td key={doc.id} className="px-1.5 py-1.5 border-r border-slate-100 last:border-r-0 align-top">
                        <div className="flex flex-col gap-1 min-h-[44px]">
                          {/* AM */}
                          {blockAM ? (
                            <button
                              onClick={() => onAddBlockClick(doc.id, dateStr, 'Mañana')}
                              className="bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-left hover:bg-red-100 transition-colors w-full"
                            >
                              <div className="text-[8px] font-bold text-red-700">☀️ AM bloqueado</div>
                              <div className="text-[8px] text-red-500 truncate">{blockAM.reason === 'Otro' ? blockAM.customReason : blockAM.reason}</div>
                            </button>
                          ) : appAM ? (
                            <button
                              onClick={() => onAddAppointmentClick(doc.id, dateStr, 'Mañana')}
                              className="bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 text-left hover:bg-blue-100 transition-colors w-full"
                            >
                              <div className="text-[8px] font-bold text-blue-700">☀️ AM</div>
                              <div className="text-[9px] font-mono font-bold text-blue-800">I:{appAM.newAdmissions} C:{appAM.controls}</div>
                            </button>
                          ) : (
                            <button
                              onClick={() => onAddAppointmentClick(doc.id, dateStr, 'Mañana')}
                              className="text-[8px] text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded px-1 py-0.5 text-left transition-colors flex items-center gap-0.5 w-full"
                            >
                              <PlusCircle className="w-3 h-3 shrink-0" /> AM
                            </button>
                          )}

                          {/* PM */}
                          {blockPM ? (
                            <button
                              onClick={() => onAddBlockClick(doc.id, dateStr, 'Tarde')}
                              className="bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-left hover:bg-amber-100 transition-colors w-full"
                            >
                              <div className="text-[8px] font-bold text-amber-700">🌇 PM bloqueado</div>
                              <div className="text-[8px] text-amber-600 truncate">{blockPM.reason === 'Otro' ? blockPM.customReason : blockPM.reason}</div>
                            </button>
                          ) : appPM ? (
                            <button
                              onClick={() => onAddAppointmentClick(doc.id, dateStr, 'Tarde')}
                              className="bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 text-left hover:bg-emerald-100 transition-colors w-full"
                            >
                              <div className="text-[8px] font-bold text-emerald-700">🌇 PM</div>
                              <div className="text-[9px] font-mono font-bold text-emerald-800">I:{appPM.newAdmissions} C:{appPM.controls}</div>
                            </button>
                          ) : (
                            <button
                              onClick={() => onAddAppointmentClick(doc.id, dateStr, 'Tarde')}
                              className="text-[8px] text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded px-1 py-0.5 text-left transition-colors flex items-center gap-0.5 w-full"
                            >
                              <PlusCircle className="w-3 h-3 shrink-0" /> PM
                            </button>
                          )}

                          {/* 24h toggle */}
                          <button
                            onClick={() => onToggleShift24h(doc.id, dateStr)}
                            className="text-[7px] text-slate-200 hover:text-indigo-500 hover:bg-indigo-50 rounded px-1 py-0.5 text-left transition-colors"
                          >
                            + 24h
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
