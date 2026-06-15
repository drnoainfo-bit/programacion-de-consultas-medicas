import React, { useState, useMemo } from 'react';
import { Doctor, Appointment, BlockedDay, Shift24h } from '../types';
import ConfirmModal from './ConfirmModal';
import { 
  FileSpreadsheet, 
  HelpCircle, 
  Key, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  AlertCircle,
  Eye,
  CheckCircle,
  LogOut,
  Sparkles
} from 'lucide-react';

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
  const [manualToken, setManualToken] = useState('');
  const [showSheetConfirm, setShowSheetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [startRow, setStartRow] = useState<number>(8); // Row where schedule starts writing (defaults to 8)
  const [showPreviewIdx, setShowPreviewIdx] = useState<number>(0); // Index of doctor to preview

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
          observCell = 'Turno ClÃ­nico de Urgencia 24 Horas';
        } else if (morningApp?.notes && afternoonApp?.notes) {
          observCell = `AM: ${morningApp.notes}${morningStartInfo} | PM: ${afternoonApp.notes}`;
        } else if (morningApp?.notes) {
          observCell = `AM: ${morningApp.notes}${morningStartInfo}`;
        } else if (afternoonApp?.notes) {
          observCell = `PM: ${afternoonApp.notes}${morningStartInfo ? ` | ${morningStartInfo}` : ''}`;
        } else if (morningStartInfo) {
          observCell = `AtenciÃ³n regular${morningStartInfo}`;
        } else {
          observCell = 'AtenciÃ³n programada regular';
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

    const token = manualToken.trim();
    if (!token) {
      setExportResult({
        success: false,
        message: 'Por favor ingrese un Access Token de Google para autorizar la escritura segura en la casilla (2).'
      });
      return;
    }

    setShowSheetConfirm(true);
  };

  const executeGoogleSheetsWrite = async () => {
    const token = manualToken.trim();
    setIsExporting(true);
    setExportResult(null);

    try {
      // Package values for batch API request
      const dataPayloads = Object.keys(sheetsPayload).map((sheetName) => {
        const rows = sheetsPayload[sheetName];
        // Calculate dynamic range based on start row
        const endRow = startRow + rows.length - 1;
        
        return {
          range: `${sheetName}!B${startRow}:H${endRow}`, // Writing into columns B to H
          values: rows,
        };
      });

      const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: dataPayloads
        })
      });

      const resJson = await response.json();

      if (!response.ok) {
        throw new Error(resJson.error?.message || `Error HTTP: ${response.status}`);
      }

      setExportResult({
        success: true,
        message: `Â¡Guardado Exitoso! Se actualizaron correctamente las pestaÃ±as de planificaciÃ³n para todos los mÃ©dicos (NOA, SALAZAR, CARDENAS, ORTEGA, BRINTRUP, MUÃ‘OZ) desde la celda de inicio B${startRow}.`
      });
    } catch (error: any) {
      console.error('Sheets API Error:', error);
      setExportResult({
        success: false,
        message: `Fallo de Escritura: ${error.message || 'Error de red o permisos insuficientes. Verifique que el token sea vigente y que el Google Sheet haya sido compartido.'}`
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
              Exportador Directo a Google Sheets (Preserva Formato)
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Actualice de forma directa celdas y filas en las pestaÃ±as originales de sus mÃ©dicos</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-100/65 px-3 py-1 rounded-full border border-emerald-250 select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-550 animate-pulse text-emerald-700" />
          <span className="text-[10px] font-black text-emerald-850 uppercase tracking-wider">IntegraciÃ³n Oficial Activa (Google API)</span>
        </div>
      </div>

      {/* Grid configuration body */}
      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column - input settings */}
        <div className="lg:col-span-5 space-y-4 font-sans">
          
          {/* Spreadsheet ID / link */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">1. URL / ID de la Planilla Google Sheet</label>
            <input
              type="text"
              placeholder="Pegue la URL del archivo de Google Sheet (ej: https://docs.google.com/spreadsheets/d/...)"
              value={spreadsheetUrl}
              onChange={(e) => setSpreadsheetUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans text-slate-700 bg-white"
            />
            {spreadsheetId && (
              <span className="text-[9.5px] font-mono font-bold text-emerald-800 block">
                âœ“ ID Identificado: <span className="underline">{spreadsheetId}</span>
              </span>
            )}
          </div>

          {/* Access Token Input */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>2. Access Token de Seguridad (Google OAuth)</span>
              </label>
              <a
                href="https://developers.google.com/oauthplayground/"
                target="_blank"
                rel="noreferrer"
                className="text-[9.5px] text-emerald-600 font-black hover:underline tracking-wide bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"
                title="Consiga un token rÃ¡pido en el playground seguro"
              >
                Como Obtener Token
              </a>
            </div>
            
            <textarea
              placeholder="Pegue su Access Token temporal con permisos de sheets... (Ej: ya29.a0Ax...)"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="w-full h-15 px-3 py-2 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono text-slate-700 bg-white leading-relaxed resize-none"
            />
          </div>

          {/* Row config starting coordinates */}
          <div className="grid grid-cols-2 gap-3 pb-1 border-b border-slate-150">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fila Inicio de Datos</label>
              <input
                type="number"
                min="1"
                value={startRow}
                onChange={(e) => setStartRow(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 font-mono font-bold"
              />
            </div>
            <div className="flex flex-col justify-end">
              <span className="text-[10px] text-slate-400 font-medium leading-tight">
                Recomendado: <strong>Fila 8</strong> de sus pestaÃ±as (NOA, SALAZAR, etc.) para encajar en el formato de diseÃ±o.
              </span>
            </div>
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
              <span>Instrucciones CrÃ­ticas de Seguridad</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-500 font-medium">
              <li>AsegÃºrese de compartir el Google Sheet con permiso de <strong>Editor</strong>.</li>
              <li>Las hojas mÃ©dicas deben llamarse exactamente: <strong className="text-slate-800">NOA, SALAZAR, CARDENAS, ORTEGA, BRINTRUP, MUÃ‘OZ</strong>.</li>
              <li>Los colores, grÃ¡ficos y fÃ³rmulas del Sheet se conservarÃ¡n intactos.</li>
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
              <span className="text-slate-500 font-bold">Rango Estimado: B{startRow} : H{startRow + previewRows.length - 1}</span>
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
                    const rowNum = startRow + idx;
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
                {exportResult.success ? 'SincronizaciÃ³n Completada' : 'AtenciÃ³n Requerida'}
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
        message="La aplicaciÃ³n escribirÃ¡ la rotativa mÃ©dica automatizada directamente en el Google Sheet original, preservando todo el diseÃ±o, colores, fuentes y fÃ³rmulas existentes. Â¿Desea continuar con la sincronizaciÃ³n?"
        confirmText="Sincronizar Sheet"
        cancelText="Volver"
        type="success"
      />
    </div>
  );
}

