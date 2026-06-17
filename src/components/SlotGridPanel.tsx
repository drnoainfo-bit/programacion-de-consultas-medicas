/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Doctor, Appointment, BlockedDay, Shift24h } from '../types';
import { formatDateString } from '../utils';

interface SlotGridPanelProps {
  doctors: Doctor[];
  appointments: (Appointment & { status?: string })[];
  blockedDays: BlockedDay[];
  shifts24h: Shift24h[];
  weekdays: Date[];
  selectedDocId: string;
  onSelectDoc: (id: string) => void;
  onAddSlotBlock: (docId: string, date: string, startTime: string, endTime: string) => void;
}

const SLOT_STARTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00',
  '14:00','14:30','15:00','15:30','16:00','16:30',
];

const SLOT_ENDS = [
  '08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00',
  '12:30','13:00','13:30',
  '14:30','15:00','15:30','16:00','16:30','17:00',
];

const REASON_STYLE: Record<string, { bg: string; fg: string; short: string }> = {
  'UPC':                               { bg: '#CC00FF', fg: '#fff',    short: 'UPC' },
  'policlinico':                       { bg: '#FFFF00', fg: '#1a1a1a', short: 'POLICL.' },
  'sala':                              { bg: '#70AD47', fg: '#fff',    short: 'SALA' },
  'horario protegido':                 { bg: '#FF0000', fg: '#fff',    short: 'PROT.' },
  'Actividades adm':                   { bg: '#C55A11', fg: '#fff',    short: 'ADM' },
  'feriado':                           { bg: '#f8f8f8', fg: '#555',    short: 'FERIADO' },
  'permiso adm/feriado legal':         { bg: '#4472C4', fg: '#fff',    short: 'PERMISO' },
  'reunion de servicio':               { bg: '#00B0F0', fg: '#1a1a1a', short: 'REU MED' },
  'libre 22x28':                       { bg: '#00FF00', fg: '#1a1a1a', short: 'LIBRE' },
  'licencia':                          { bg: '#666666', fg: '#fff',    short: 'LICENCIA' },
  'capacitacion/comision de servicio': { bg: '#FF00FF', fg: '#fff',    short: 'CAPAC.' },
};

function buildPostTurnoDates(docShifts: Shift24h[]): Set<string> {
  const set = new Set<string>();
  docShifts.forEach(s => {
    const [y, mo, d] = s.date.split('-').map(Number);
    const next = new Date(y, mo - 1, d + 1);
    set.add(formatDateString(next));
  });
  return set;
}

interface CellStatus {
  label: string;
  bg: string;
  fg: string;
  clickable: boolean;
}

function getSlotStatus(
  dateStr: string,
  slotIdx: number,
  docApps: (Appointment & { status?: string })[],
  docBlocks: BlockedDay[],
  docShifts: Shift24h[],
  postTurnoDates: Set<string>,
): CellStatus {
  const slotTime = SLOT_STARTS[slotIdx];
  const slotPeriod: 'Mañana' | 'Tarde' = slotIdx < 11 ? 'Mañana' : 'Tarde';

  // Turno 24h
  if (docShifts.some(s => s.date === dateStr)) {
    return { label: slotIdx === 0 ? 'TURNO 24h' : '', bg: '#1F3864', fg: '#fff', clickable: false };
  }

  // Post-turno
  if (postTurnoDates.has(dateStr)) {
    return { label: slotIdx === 0 ? 'POST TURNO' : '', bg: '#9DC3E6', fg: '#1a1a1a', clickable: false };
  }

  // Bloqueo
  const block = docBlocks.find(b =>
    b.date === dateStr &&
    (b.shift === 'Todo el día' || b.shift === slotPeriod)
  );
  if (block) {
    const inRange = !block.startTime || !block.endTime ||
      (slotTime >= block.startTime && slotTime < block.endTime);
    if (inRange) {
      const rs = REASON_STYLE[block.reason] ?? { bg: '#e2e8f0', fg: '#1a1a1a', short: block.reason };
      const rawFirst = block.startTime ? SLOT_STARTS.findIndex(t => t >= block.startTime!) : -1;
      const first = rawFirst >= 0 ? rawFirst : (slotPeriod === 'Tarde' ? 11 : 0);
      const isFirst = slotIdx === first;
      const label = isFirst
        ? (block.reason === 'Otro' ? (block.customReason || 'OTRO').toUpperCase() : rs.short)
        : '';
      return { label, bg: rs.bg, fg: rs.fg, clickable: false };
    }
  }

  // Consulta
  const app = docApps.find(a =>
    a.date === dateStr && a.shift === slotPeriod && (a as any).status !== 'Cancelada'
  );
  if (app) {
    const startSlot = slotPeriod === 'Tarde' ? 11 : (app.include800 ? 0 : app.include830 ? 1 : 2);
    const ingEnd = startSlot + (app.newAdmissions || 0);
    const ctrEnd = ingEnd + (app.controls || 0);
    if (slotIdx >= startSlot && slotIdx < ingEnd) {
      return { label: slotIdx === startSlot ? `${app.newAdmissions} ING` : '', bg: '#FFFF00', fg: '#1a1a1a', clickable: false };
    }
    if (slotIdx >= ingEnd && slotIdx < ctrEnd) {
      return { label: slotIdx === ingEnd ? `${app.controls} CTR` : '', bg: '#FFFF00', fg: '#1a1a1a', clickable: false };
    }
  }

  return { label: '', bg: '', fg: '', clickable: true };
}

export default function SlotGridPanel({
  doctors,
  appointments,
  blockedDays,
  shifts24h,
  weekdays,
  selectedDocId,
  onSelectDoc,
  onAddSlotBlock,
}: SlotGridPanelProps) {
  const workdays = weekdays.slice(0, 5);
  const doc = doctors.find(d => d.id === selectedDocId);
  const docApps   = appointments.filter(a => a.doctorId === selectedDocId);
  const docBlocks = blockedDays.filter(b => b.doctorId === selectedDocId);
  const docShifts = shifts24h.filter(s => s.doctorId === selectedDocId);
  const postTurnoDates = buildPostTurnoDates(docShifts);

  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  return (
    <div className="p-4 space-y-4">
      {/* Doctor selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-600">Médico:</span>
        <div className="flex flex-wrap gap-2">
          {doctors.filter(d => d.isActive).map(d => (
            <button
              key={d.id}
              onClick={() => onSelectDoc(d.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                d.id === selectedDocId
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {d.sheetName}
            </button>
          ))}
        </div>
        {doc && (
          <span className="text-[10px] text-slate-400 ml-auto">
            Jornada: {doc.defaultShift} · Click en celda vacía para agregar bloqueo
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="min-w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-2 text-left font-mono w-28 border-r border-slate-700">Horario</th>
              {workdays.map((day, i) => {
                const ds = formatDateString(day);
                const isToday = ds === formatDateString(new Date());
                return (
                  <th
                    key={ds}
                    className={`px-2 py-2 text-center font-semibold border-r border-slate-700 last:border-r-0 ${isToday ? 'bg-blue-700' : ''}`}
                  >
                    <div className="uppercase tracking-wide text-[9px] text-slate-300">{DAY_NAMES[i]}</div>
                    <div className="text-sm font-bold mt-0.5">{day.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {SLOT_STARTS.map((slotTime, slotIdx) => {
              // Separator between morning and afternoon
              const isSeparator = slotIdx === 11;
              return (
                <React.Fragment key={slotIdx}>
                  {isSeparator && (
                    <tr>
                      <td colSpan={6} className="h-1.5 bg-slate-200 border-y border-slate-300 text-center text-[8px] text-slate-400 font-bold tracking-widest py-0.5">
                        ── ALMUERZO / COLACIÓN ──
                      </td>
                    </tr>
                  )}
                  <tr className={slotIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-3 py-1 font-mono text-slate-500 border-r border-slate-200 whitespace-nowrap">
                      {slotTime}–{SLOT_ENDS[slotIdx]}
                    </td>
                    {workdays.map(day => {
                      const dateStr = formatDateString(day);
                      const dayOfWeek = day.getDay();
                      if (dayOfWeek === 0 || dayOfWeek === 6) {
                        return <td key={dateStr} className="border border-slate-100 bg-slate-100" />;
                      }
                      const status = getSlotStatus(dateStr, slotIdx, docApps, docBlocks, docShifts, postTurnoDates);
                      return (
                        <td
                          key={dateStr}
                          className={`border border-slate-200 h-7 text-center font-bold transition-colors ${
                            status.clickable
                              ? 'cursor-pointer hover:bg-blue-100 hover:border-blue-400'
                              : ''
                          }`}
                          style={status.bg ? { backgroundColor: status.bg, color: status.fg } : {}}
                          onClick={() => {
                            if (status.clickable && selectedDocId) {
                              onAddSlotBlock(selectedDocId, dateStr, slotTime, SLOT_ENDS[slotIdx]);
                            }
                          }}
                          title={status.clickable ? `Agregar bloqueo ${slotTime}–${SLOT_ENDS[slotIdx]}` : undefined}
                        >
                          {status.label}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(REASON_STYLE).map(([reason, s]) => (
          <div key={reason} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border border-slate-300 shrink-0" style={{ backgroundColor: s.bg }} />
            <span className="text-[9px] text-slate-500">{s.short}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#1F3864' }} />
          <span className="text-[9px] text-slate-500">TURNO 24h</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#9DC3E6' }} />
          <span className="text-[9px] text-slate-500">POST TURNO</span>
        </div>
      </div>
    </div>
  );
}
