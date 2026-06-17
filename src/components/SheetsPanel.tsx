import React, { useState, useMemo } from 'react';
import { Doctor, Appointment, BlockedDay, Shift24h } from '../types';
import ConfirmModal from './ConfirmModal';
import {
  FileSpreadsheet,
  HelpCircle,
  RefreshCw,
  Send,
  AlertCircle,
  Eye,
  CheckCircle,
  Zap,
} from 'lucide-react';

const N8N_WEBHOOK_URL = 'https://n8n-n8n.tj2360.easypanel.host/webhook/sync-rotativa';

// ── Slot-grid sync helpers ─────────────────────────────────────────────────

const SLOT_STARTS_ALL = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00',
  '14:00','14:30','15:00','15:30','16:00','16:30',
];

// Week index (0-4) → 1-based start column: B=2, I=9, P=16
const WEEK_COL_START = [2, 9, 16, 2, 9];

function colLetter(n: number): string {
  if (n <= 26) return String.fromCharCode(64 + n);
  return String.fromCharCode(64 + Math.floor((n - 1) / 26)) +
         String.fromCharCode(64 + ((n - 1) % 26 + 1));
}

function buildSlotGridUpdates(
  doctors: Doctor[],
  appointments: Appointment[],
  blockedDays: BlockedDay[],
  shifts24h: Shift24h[],
  year: number,
  month: number,
): { range: string; values: string[][] }[] {
  // Monday of the week that contains the 1st of the month
  const firstDay = new Date(year, month - 1, 1);
  const dow0 = firstDay.getDay();
  const daysBack = dow0 === 0 ? 6 : dow0 - 1;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() - daysBack);

  const totalDays = new Date(year, month, 0).getDate();
  const updates: { range: string; values: string[][] }[] = [];

  // Post-turno sets per doctor
  const postTurno: Record<string, Set<string>> = {};
  doctors.forEach(d => {
    const set = new Set<string>();
    shifts24h.filter(s => s.doctorId === d.id).forEach(s => {
      const dt = new Date(`${s.date}T12:00:00`);
      dt.setDate(dt.getDate() + 1);
      set.add(dt.toISOString().slice(0, 10));
    });
    postTurno[d.id] = set;
  });

  doctors.forEach(doc => {
    const isTarde = doc.defaultShift === 'Tarde';
    const slotCount = isTarde ? 17 : 11;
    const docApps   = appointments.filter(a => a.doctorId === doc.id);
    const docBlocks = blockedDays.filter(b => b.doctorId === doc.id);
    const docGuards = shifts24h.filter(s => s.doctorId === doc.id);
    const ptSet = postTurno[doc.id];

    for (let day = 1; day <= totalDays; day++) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const date = new Date(`${dateStr}T12:00:00`);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends

      const mondayDow = dow - 1; // 0=Mon, 4=Fri
      const diffDays = Math.round((date.getTime() - firstMonday.getTime()) / 86400000);
      const weekIdx = Math.floor(diffDays / 7);
      if (weekIdx < 0 || weekIdx > 4) continue;

      const colNum  = WEEK_COL_START[weekIdx] + mondayDow;
      const colStr  = colLetter(colNum);
      const isBlock2 = weekIdx >= 3;
      // Row where slot 0 lives in this block
      const rowStart = !isBlock2 ? 4 : (isTarde ? 24 : 18);

      // ── Compute slot contents ──
      const slots: string[] = new Array(slotCount).fill('');
      const isGuard = docGuards.some(s => s.date === dateStr);
      const isPT    = ptSet.has(dateStr);

      if (isGuard) {
        slots[0] = 'TURNO 24h';
      } else if (!isPT) {
        // Morning block (shift = 'Mañana' | 'Todo el día')
        const mBlock = docBlocks.find(b =>
          b.date === dateStr && (b.shift === 'Mañana' || b.shift === 'Todo el día')
        );
        if (mBlock) {
          const rawFirst = mBlock.startTime
            ? SLOT_STARTS_ALL.findIndex(t => t >= mBlock.startTime!)
            : -1;
          const firstSi = rawFirst >= 0 && rawFirst <= 10 ? rawFirst : 0;
          const label = mBlock.reason === 'Otro'
            ? (mBlock.customReason || 'OTRO').toUpperCase()
            : mBlock.reason.toUpperCase();
          for (let si = 0; si <= 10; si++) {
            const t = SLOT_STARTS_ALL[si];
            const inRange = !mBlock.startTime || !mBlock.endTime ||
              (t >= mBlock.startTime && t < mBlock.endTime);
            if (inRange && si === firstSi) slots[si] = label;
          }
        } else {
          // Morning appointment
          const mApp = docApps.find(a =>
            a.date === dateStr && a.shift !== 'Tarde' && (a as any).status !== 'Cancelada'
          );
          if (mApp) {
            const startSi = mApp.include800 ? 0 : mApp.include830 ? 1 : 2;
            const ingEnd  = startSi + (mApp.newAdmissions || 0);
            const ctlEnd  = ingEnd  + (mApp.controls || 0);
            for (let si = 0; si <= 10; si++) {
              if (si >= startSi && si < ingEnd) slots[si] = 'INGRESO';
              else if (si >= ingEnd && si < ctlEnd) slots[si] = 'CONTROL';
            }
          }
        }

        // Tarde slots (only for tarde doctors, indices 11-16)
        if (isTarde) {
          const tBlock = docBlocks.find(b =>
            b.date === dateStr && (b.shift === 'Tarde' || b.shift === 'Todo el día')
          );
          // 'Todo el día' block already wrote morning label; tarde gets its own label only if shift='Tarde'
          const explicitTBlock = docBlocks.find(b =>
            b.date === dateStr && b.shift === 'Tarde'
          );
          if (explicitTBlock || (tBlock && tBlock.shift === 'Todo el día')) {
            const b = explicitTBlock || tBlock!;
            const label = b.reason === 'Otro'
              ? (b.customReason || 'OTRO').toUpperCase()
              : b.reason.toUpperCase();
            slots[11] = label; // first tarde slot
          } else {
            const tApp = docApps.find(a =>
              a.date === dateStr && a.shift === 'Tarde' && (a as any).status !== 'Cancelada'
            );
            if (tApp) {
              const startSi = 11;
              const ingEnd  = startSi + (tApp.newAdmissions || 0);
              const ctlEnd  = ingEnd  + (tApp.controls || 0);
              for (let si = 11; si < slotCount; si++) {
                if (si >= startSi && si < ingEnd) slots[si] = 'INGRESO';
                else if (si >= ingEnd && si < ctlEnd) slots[si] = 'CONTROL';
              }
            }
          }
        }
      }

      // Push one column-range update per date×doctor
      const endRow = rowStart + slotCount - 1;
      updates.push({
        range: `${doc.sheetName}!${colStr}${rowStart}:${colStr}${endRow}`,
        values: slots.map(v => [v]),
      });
    }
  });

  return updates;
}

// ──────────────────────────────────────────────────────────────────────────

interface SheetsPanelProps {
  doctors: Doctor[];
  appointments: Appointment[];
  blockedDays: BlockedDay[];
  shifts24h: Shift24h[];
  selectedPeriod: string; // YYYY-MM
}

export default function SheetsPanel({
  doctors,
  appointments,
  blockedDays,
  shifts24h,
  selectedPeriod,
}: SheetsPanelProps) {
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [showSheetConfirm, setShowSheetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPreviewIdx, setShowPreviewIdx] = useState<number>(0);

  // Dynamic Google Sheet ID extractor
  const spreadsheetId = useMemo(() => {
    if (!spreadsheetUrl) return '';
    // Standard ID regex search
    const matches = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : spreadsheetUrl; // fallback to literal if URL doesn't match
  }, [spreadsheetUrl]);

  const periodInfo = useMemo(() => {
    const [yearRaw, monthRaw] = selectedPeriod.split('-').map(Number);
    const now = new Date();
    const year = Number.isFinite(yearRaw) ? yearRaw : now.getFullYear();
    const month = Number.isFinite(monthRaw) ? monthRaw : now.getMonth() + 1;
    return {
      year,
      month,
      totalDays: new Date(year, month, 0).getDate(),
      monthLabel: new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(new Date(year, month - 1, 1)),
    };
  }, [selectedPeriod]);

  // Compute cell rows to write to spreadsheet for each doctor in the selected period.
  const sheetsPayload = useMemo(() => {
    const { year, month, totalDays } = periodInfo;
    const payloadMap: { [sheetName: string]: any[][] } = {};

    doctors.forEach((doc) => {
      const rows: any[][] = [];
      const docApps = appointments.filter((a) => a.doctorId === doc.id);
      const docBlocks = blockedDays.filter((b) => b.doctorId === doc.id);
      const docGuards = shifts24h.filter((s) => s.doctorId === doc.id);

      for (let day = 1; day <= totalDays; day++) {
        const currentDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Find appointments for morning and afternoon
        const morningApp = docApps.find((a) => a.date === currentDateStr && String(a.shift) !== 'Tarde');
        const afternoonApp = docApps.find((a) => a.date === currentDateStr && String(a.shift) === 'Tarde');

        // Check 24h Guard shift
        const hasGuard = docGuards.some((s) => s.date === currentDateStr);

        // Check for blocks
        const morningBlock = docBlocks.find((b) => b.date === currentDateStr && (String(b.shift) !== 'Tarde'));
        const afternoonBlock = docBlocks.find((b) => b.date === currentDateStr && (String(b.shift) === 'Tarde' || String(b.shift).toLowerCase().includes('todo')));
        const fullBlock = docBlocks.find((b) => b.date === currentDateStr && String(b.shift).toLowerCase().includes('todo'));

        // 1. Column B: Date string
        const dateCell = currentDateStr;

        // 2 & 3. Column C & D: Morning Slots
        let mornIngresos = '';
        let mornControles = '';
        if (morningBlock) {
          mornIngresos = `BLOQUEADO: ${morningBlock.reason}`;
          mornControles = morningBlock.notes || 'Bloqueo manual';
        } else if (hasGuard) {
          mornIngresos = ' GUARDIA 24H';
          mornControles = '(En servicio urgente)';
        } else if (morningApp) {
          mornIngresos = String(morningApp.newAdmissions);
          mornControles = String(morningApp.controls);
        }

        // 4 & 5. Column E & F: Afternoon Slots
        let aftIngresos = '';
        let aftControles = '';
        if (afternoonBlock) {
          aftIngresos = `BLOQUEADO: ${afternoonBlock.reason}`;
          aftControles = afternoonBlock.notes || 'Bloqueo manual';
        } else if (hasGuard) {
          aftIngresos = ' GUARDIA 24H';
          aftControles = '(En servicio urgente)';
        } else if (afternoonApp) {
          aftIngresos = String(afternoonApp.newAdmissions);
          aftControles = String(afternoonApp.controls);
        }

        // 6. Column G: 24h Shift Indicator
        let guardCell = '';
        if (hasGuard) {
          guardCell = 'GUARDIA ACTIVA';
        } else {
          // Check if yesterday was guard shift (POSTURNO DE DESCANSO!)
          const yesterdayRaw = new Date(currentDateStr);
          yesterdayRaw.setDate(yesterdayRaw.getDate() - 1);
          const yesterdayStr = yesterdayRaw.toISOString().slice(0, 10);
          const hasYesterdayGuard = docGuards.some((s) => s.date === yesterdayStr);
          if (hasYesterdayGuard) {
            guardCell = 'POSTURNO (DESCANSO)';
          }
        }

        let morningStartInfo = '';
        if (morningApp) {
          const mStart = morningApp.startTime || '09:00';
          const preSlotsInfo = [];
          if (morningApp.include800 && mStart !== '08:00') preSlotsInfo.push('08:00');
          if (morningApp.include830 && mStart === '09:00') preSlotsInfo.push('08:30');
          morningStartInfo = ` [Inicio AM: ${mStart}${preSlotsInfo.length > 0 ? ` + manual ${preSlotsInfo.join(',')}` : ''}]`;
        }

        // 7. Column H: Status / Observations / Notes
        let observCell = '';
        if (fullBlock) {
          observCell = `Bloque Completo: ${fullBlock.reason} - ${fullBlock.notes || ''}`;
        } else if (hasGuard) {
          observCell = 'Turno Clínico de Urgencia 24 Horas';
        } else if (morningApp?.notes && afternoonApp?.notes) {
          observCell = `AM: ${morningApp.notes}${morningStartInfo} | PM: ${afternoonApp.notes}`;
        } else if (morningApp?.notes) {
          observCell = `AM: ${morningApp.notes}${morningStartInfo}`;
        } else if (afternoonApp?.notes) {
          observCell = `PM: ${afternoonApp.notes}${morningStartInfo ? ` | ${morningStartInfo}` : ''}`;
        } else if (morningStartInfo) {
          observCell = `Atención regular${morningStartInfo}`;
        } else {
          observCell = 'Atención programada regular';
        }

        // Row of values
        rows.push([
          dateCell,       // Column B
          mornIngresos,   // Column C
          mornControles,  // Column D
          aftIngresos,    // Column E
          aftControles,   // Column F
          guardCell,      // Column G
          observCell     // Column H
        ]);
      }
      payloadMap[doc.sheetName] = rows;
    });

    return payloadMap;
  }, [doctors, appointments, blockedDays, shifts24h, selectedPeriod]);

  // Execute direct writes using Google Sheets API
  const handleExportToGoogleSheets = () => {
    if (!spreadsheetId) {
      setExportResult({
        success: false,
        message: 'Por favor ingrese el enlace o ID de su Google Sheet en la casilla (1).'
      });
      return;
    }
    setShowSheetConfirm(true);
  };

  const executeGoogleSheetsWrite = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const { year, month } = periodInfo;
      const updates = buildSlotGridUpdates(doctors, appointments, blockedDays, shifts24h, year, month);

      if (updates.length === 0) {
        throw new Error('No hay datos de rotativa para el período seleccionado.');
      }

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, updates }),
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.message || `Error HTTP: ${response.status}`);
      }

      setExportResult({ success: true, message: `✓ ${resJson.message}` });
    } catch (error: any) {
      console.error('Sheets sync error:', error);
      setExportResult({
        success: false,
        message: error.message || 'Error de conexión con n8n. Verifique que el workflow esté activo.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const previewDoctor = doctors[showPreviewIdx] || doctors[0];
  const previewRows = previewDoctor ? sheetsPayload[previewDoctor.sheetName] || [] : [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/95 overflow-hidden" id="google-sheets-panel">
      {/* Visual Header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 to-teal-50/35 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              Sincronización Directa con Google Sheets
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Escribe la rotativa directo en las pestañas de sus médicos — sin tokens, sin copiar nada</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-100/65 px-3 py-1 rounded-full border border-emerald-200 select-none">
          <Zap className="w-3 h-3 text-emerald-600" />
          <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Vía n8n · OAuth automático</span>
        </div>
      </div>

      {/* Grid configuration body */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column - input settings */}
        <div className="lg:col-span-5 space-y-4 font-sans">
          
          {/* Spreadsheet ID / link */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">1. URL de la Planilla Google Sheet</label>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={spreadsheetUrl}
              onChange={(e) => setSpreadsheetUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans text-slate-700 bg-white"
            />
            {spreadsheetId && (
              <span className="text-[9.5px] font-mono font-bold text-emerald-700 block">
                ✓ ID: <span className="underline">{spreadsheetId}</span>
              </span>
            )}
          </div>

          {/* Export Actions button */}
          <div className="pt-2">
            <button
              onClick={handleExportToGoogleSheets}
              disabled={isExporting}
              className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-all focus:outline-none cursor-pointer border ${
                isExporting 
                  ? 'bg-emerald-300 border-emerald-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 hover:scale-101 active:scale-95'
              }`}
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-100" />
                  <span>Transfiriendo celdas...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-emerald-100 hover:translate-x-0.5 transition-transform" />
                  <span>Sincronizar Datos con Google Sheet</span>
                </>
              )}
            </button>
          </div>

          {/* Guidelines info card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-[11px] text-slate-600">
            <h4 className="font-extrabold text-slate-700 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Requisitos del Google Sheet</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-500 font-medium">
              <li>Compartir el Sheet con la cuenta Google vinculada a n8n como <strong>Editor</strong>.</li>
              <li>Las pestañas deben llamarse exactamente: <strong className="text-slate-800">NOA, SALAZAR, CARDENAS, ORTEGA, BRINTRUP, MUÑOZ</strong>.</li>
              <li>Colores, gráficos y fórmulas del Sheet se conservarán intactos.</li>
            </ul>
          </div>

        </div>

        {/* Right column - interactive visual cell preview */}
        <div className="lg:col-span-7 flex flex-col space-y-3 font-sans border-t lg:border-t-0 lg:border-l border-slate-150 pt-4 lg:pt-0 lg:pl-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>Simulador del Mapeo de Celdas (Vista Previa de Datos)</span>
            </span>
            
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {doctors.map((doc, idx) => (
                <button
                  key={doc.id}
                  onClick={() => setShowPreviewIdx(idx)}
                  className={`px-2 py-1 text-[10px] font-black tracking-wide rounded-md transition-all cursor-pointer ${
                    showPreviewIdx === idx 
                      ? 'bg-emerald-600 text-white shadow-3xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {doc.sheetName}
                </button>
              ))}
            </div>
          </div>

          {/* Virtual Grid Preview */}
          <div className="flex-grow bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[10.5px] text-slate-300 overflow-x-auto max-h-[360px] overflow-y-auto">
            <div className="border-b border-slate-800 pb-2 mb-2 flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 font-bold">Datos a escribir en Pestana: "{previewDoctor?.sheetName || 'N/A'}"</span>
              <span className="text-slate-500 font-bold">Formato slot-grid · plantilla Excel</span>
            </div>

            <table className="w-full text-left font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-extrabold uppercase text-[9.5px] select-none">
                  <th className="pb-1 text-center w-8">Fila</th>
                  <th className="pb-1 px-1.5">Fecha (B)</th>
                  <th className="pb-1 px-1 text-center">â˜€ï¸ AM (C/D)</th>
                  <th className="pb-1 px-1 text-center">PM (E/F)</th>
                  <th className="pb-1 px-1 text-center">Guardia (G)</th>
                  <th className="pb-1 px-1.5">Obs (H)</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-slate-500 text-center py-6 italic font-bold">Sin datos para el mes seleccionado</td>
                  </tr>
                ) : (
                  previewRows.map((row, idx) => {
                    const rowNum = 4 + idx;
                    const dateVal = row[0];
                    const morningText = row[1] || row[2] ? `${row[1] || '-'}/${row[2] || '-'}` : '';
                    const afternoonText = row[3] || row[4] ? `${row[3] || '-'}/${row[4] || '-'}` : '';
                    const guardText = row[5];
                    const obsText = row[6];

                    // highlight guard or blocked days
                    const isGuard = guardText.includes('GUARDIA');
                    const isBlocked = morningText.includes('BLOQUEADO') || afternoonText.includes('BLOQUEADO');

                    return (
                      <tr 
                        key={dateVal} 
                        className={`border-b border-slate-900/60 hover:bg-slate-900/50 ${
                          isGuard ? 'text-blue-300 font-bold bg-blue-950/20' : isBlocked ? 'text-rose-300 font-medium' : ''
                        }`}
                      >
                        <td className="py-1.5 text-center font-bold text-slate-600 select-none">{rowNum}</td>
                        <td className="py-1.5 px-1.5 font-bold text-slate-400">{dateVal.slice(8, 10)}-{periodInfo.monthLabel}</td>
                        <td className="py-1.5 px-1 text-center font-extrabold text-blue-200">{morningText || <span className="text-slate-700">-</span>}</td>
                        <td className="py-1.5 px-1 text-center font-extrabold text-amber-300">{afternoonText || <span className="text-slate-700">-</span>}</td>
                        <td className="py-1.5 px-1 text-center font-bold">
                          {isGuard ? (
                            <span className="bg-blue-900/40 text-[9px] px-1 py-0.5 rounded border border-blue-800">GUAR-24</span>
                          ) : guardText.includes('POSTURNO') ? (
                            <span className="bg-slate-800/80 text-[8px] px-1 py-0.5 rounded text-slate-400">DESCAN</span>
                          ) : (
                            <span className="text-slate-700">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-1.5 max-w-[120px] truncate text-slate-500" title={obsText}>{obsText}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* Output Status Logs */}
      {exportResult && (
        <div className={`p-4 font-sans text-xs border-t ${
          exportResult.success 
            ? 'bg-emerald-50 border-emerald-150 text-emerald-800' 
            : 'bg-rose-50 border-rose-150 text-rose-800'
        }`}>
          <div className="flex items-start gap-2.5">
            {exportResult.success ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
            )}
            <div>
              <h5 className="font-extrabold uppercase tracking-wider text-[11px]">
                {exportResult.success ? 'Sincronización Completada' : 'Atención Requerida'}
              </h5>
              <p className="mt-1 font-semibold leading-relaxed">{exportResult.message}</p>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showSheetConfirm}
        onClose={() => setShowSheetConfirm(false)}
        onConfirm={executeGoogleSheetsWrite}
        title="Escribir en Google Sheet"
        message="La aplicación escribirá la rotativa médica automatizada directamente en el Google Sheet original, preservando todo el diseño, colores, fuentes y fórmulas existentes. ¿Desea continuar con la sincronización?"
        confirmText="Sincronizar Sheet"
        cancelText="Volver"
        type="success"
      />
    </div>
  );
}

