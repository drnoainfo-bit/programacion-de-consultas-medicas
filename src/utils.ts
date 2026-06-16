/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import { Doctor, Appointment, BlockedDay, Shift24h } from './types';

export const CHILEAN_HOLIDAYS_2026: string[] = [
  '2026-01-01',
  '2026-04-03',
  '2026-04-04',
  '2026-05-01',
  '2026-05-21',
  '2026-06-21',
  '2026-06-29',
  '2026-07-16',
  '2026-08-15',
  '2026-09-18',
  '2026-09-19',
  '2026-10-12',
  '2026-10-27',
  '2026-11-01',
  '2026-12-08',
  '2026-12-25',
];

export function isChileanHoliday(dateStr: string): boolean {
  return CHILEAN_HOLIDAYS_2026.includes(dateStr);
}

// Helper to get week dates based on a reference date
export function getWeekDates(refDate: Date): Date[] {
  const currentDay = refDate.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  // Distance to Monday
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + distanceToMonday);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) { // Monday to Sunday (Lunes a Domingo)
    const nextDate = new Date(monday);
    nextDate.setDate(monday.getDate() + i);
    dates.push(nextDate);
  }
  return dates;
}

// Convert a Date object to YYYY-MM-DD
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date to a Spanish readable text
export function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  // Use Date.UTC to avoid local timezone offset shifts
  const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));

  const formatter = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });

  // Capitalize first letter
  const formatted = formatter.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// Check if a doctor is blocked on a particular date and shift
export function getBlockingForSlot(
  blockedDays: BlockedDay[],
  doctorId: string,
  dateStr: string,
  shift: 'Mañana' | 'Tarde'
): BlockedDay | undefined {
  return blockedDays.find(
    (b) =>
      b.doctorId === doctorId &&
      b.date === dateStr &&
      (b.shift === shift || b.shift === 'Todo el día')
  );
}

// Parse a YYYY-MM-DD string as local noon to avoid UTC day-shift bugs
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Pre-configured doctors
export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Alejandro Noa',
    rut: '12.455.986-2',
    specialty: 'Medicina Interna',
    defaultShift: 'Mañana', // Morning
    isActive: true,
    sheetName: 'NOA',
    maxWeeklyPatients: 50
  },
  {
    id: 'doc-2',
    name: 'Dra. Carolina Salazar',
    rut: '15.678.910-K',
    specialty: 'Medicina Interna',
    defaultShift: 'Tarde', // Afternoon
    isActive: true,
    sheetName: 'SALAZAR',
    maxWeeklyPatients: 30
  },
  {
    id: 'doc-3',
    name: 'Dr. Roberto Cárdenas',
    rut: '9.876.543-2',
    specialty: 'Medicina Interna / Cardiología',
    defaultShift: 'Mañana', // Morning
    isActive: true,
    sheetName: 'CARDENAS',
    maxWeeklyPatients: 50
  },
  {
    id: 'doc-4',
    name: 'Dra. Beatriz Ortega',
    rut: '17.456.123-4',
    specialty: 'Medicina Interna',
    defaultShift: 'Mañana', // Morning
    isActive: true,
    sheetName: 'ORTEGA',
    maxWeeklyPatients: 50
  },
  {
    id: 'doc-5',
    name: 'Dra. Pilar Brintrup',
    rut: '14.223.344-5',
    specialty: 'Medicina Interna / Endocrino',
    defaultShift: 'Tarde', // Afternoon
    isActive: true,
    sheetName: 'BRINTRUP',
    maxWeeklyPatients: 30
  },
  {
    id: 'doc-6',
    name: 'Dr. Juan José Muñoz',
    rut: '13.918.273-0',
    specialty: 'Medicina Interna / Geriatría',
    defaultShift: 'Tarde', // Afternoon
    isActive: true,
    sheetName: 'MUÑOZ',
    maxWeeklyPatients: 30
  }
];

// Pre-configured Blocked Days
export const INITIAL_BLOCKED_DAYS: BlockedDay[] = [
  {
    id: 'block-1',
    doctorId: 'doc-1',
    date: formatDateString(getWeekDates(new Date())[1]), // Tuesday of current week
    shift: 'Tarde',
    reason: 'reunion de servicio',
    notes: 'Reunión mensual del consejo de pediatría',
    startTime: '14:00',
    endTime: '17:00'
  },
  {
    id: 'block-2',
    doctorId: 'doc-3',
    date: formatDateString(getWeekDates(new Date())[3]), // Thursday of current week
    shift: 'Mañana',
    reason: 'capacitacion/comision de servicio',
    notes: 'Congreso de Medicina Interna Clínicas de Chile',
    startTime: '08:00',
    endTime: '13:30'
  },
  {
    id: 'block-3',
    doctorId: 'doc-4',
    date: formatDateString(getWeekDates(new Date())[0]), // Monday of current week
    shift: 'Todo el día',
    reason: 'permiso adm/feriado legal',
    notes: 'Permiso administrativo por asuntos particulares',
    startTime: '08:00',
    endTime: '17:00'
  },
];

// Pre-configured Appointments
export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'app-1',
    doctorId: 'doc-1', // Afternoon doctor
    date: formatDateString(getWeekDates(new Date())[0]), // Monday of current week
    shift: 'Tarde',
    newAdmissions: 2,
    controls: 6,
    notes: 'Primer turno de la semana',
  },
  {
    id: 'app-2',
    doctorId: 'doc-3', // Morning doctor
    date: formatDateString(getWeekDates(new Date())[1]), // Tuesday of current week
    shift: 'Mañana',
    newAdmissions: 4,
    controls: 8,
    notes: 'Capacidad alta de control',
  },
  {
    id: 'app-3',
    doctorId: 'doc-2', // Afternoon doctor
    date: formatDateString(getWeekDates(new Date())[2]), // Wednesday of current week
    shift: 'Tarde',
    newAdmissions: 1,
    controls: 8,
    notes: 'Paciente complejo prioritario',
  },
  {
    id: 'app-4',
    doctorId: 'doc-4', // Morning doctor
    date: formatDateString(getWeekDates(new Date())[1]), // Tuesday of current week
    shift: 'Mañana',
    newAdmissions: 3,
    controls: 6,
    notes: 'Horario estándar de consulta',
  },
  {
    id: 'app-5',
    doctorId: 'doc-5', // Morning doctor
    date: formatDateString(getWeekDates(new Date())[3]), // Thursday of current week
    shift: 'Mañana',
    newAdmissions: 2,
    controls: 10,
    notes: 'Turno de alta intensidad',
  }
];

export async function exportDoctorsToExcel(
  doctors: Doctor[],
  appointments: Appointment[],
  blockedDays: BlockedDay[],
  shifts24h: Shift24h[] = [],
  period = '2026-06'
): Promise<void> {
  // ── Colors (ARGB) ────────────────────────────────────────────────────────
  const C = {
    UPC:          'FFCC00FF',
    POLICLINICO:  'FFFFFF00',
    SALA:         'FF70AD47',
    PROT:         'FFFF0000',
    ADM:          'FFC55A11',
    FERIADO_BG:   '00000000',  // transparent — sin relleno
    PERMISO:      'FF4472C4',
    REU_MED:      'FF00B0F0',
    LIBRE:        'FF00FF00',
    LICENCIA:     'FF666666',
    CAPACITACION: 'FFFF00FF',
    INGRESOS:     'FFB8D7F5',
    CONTROLES:    'FFC6EFCE',
    TURNO_24H:    'FF1F3864',
    POST_TURNO:   'FF9DC3E6',
    HEADER_DAY:   'FFDEEAF6',
    DATE_ROW:     'FFFEF2CB',
    DOC_HEADER:   'FF1F3864',
    WHITE:        'FFFFFFFF',
    NONE:         '00000000',
  };

  const REASON_BG: Record<string, string> = {
    'UPC':                               C.UPC,
    'policlinico':                       C.POLICLINICO,
    'sala':                              C.SALA,
    'horario protegido':                 C.PROT,
    'Actividades adm':                   C.ADM,
    'feriado':                           C.FERIADO_BG,
    'permiso adm/feriado legal':         C.PERMISO,
    'reunion de servicio':               C.REU_MED,
    'libre 22x28':                       C.LIBRE,
    'licencia':                          C.LICENCIA,
    'capacitacion/comision de servicio': C.CAPACITACION,
    'Otro':                              C.NONE,
  };

  const ALL_TIME_SLOTS = [
    '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30', '09:30 - 10:00',  // 0-3
    '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30', '11:30 - 12:00',  // 4-7
    '12:00 - 12:30', '12:30 - 13:00', '13:00 - 13:30',                   // 8-10
    '14:00 - 14:30', '14:30 - 15:00', '15:00 - 15:30',                   // 11-13
    '15:30 - 16:00', '16:00 - 16:30', '16:30 - 17:00',                   // 14-16
  ];

  const DAY_LABELS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

  // Solo los 11 conceptos de la leyenda oficial — sin INGRESOS, CONTROLES, TURNO 24h, POST TURNO
  const LEGEND_ITEMS: [string, string][] = [
    ['UPC',                               C.UPC],
    ['policlinico',                       C.POLICLINICO],
    ['sala',                              C.SALA],
    ['horario protegido',                 C.PROT],
    ['Actividades adm',                   C.ADM],
    ['feriado',                           C.FERIADO_BG],
    ['permiso adm/feriado legal',         C.PERMISO],
    ['reunion de servicio',               C.REU_MED],
    ['libre 22x28',                       C.LIBRE],
    ['licencia',                          C.LICENCIA],
    ['capacitacion/comision de servicio', C.CAPACITACION],
  ];

  // Layout: 3 weeks top (cols 1,8,15), 2 weeks bottom (cols 1,8), legend col 22
  const WEEK_COL_STARTS = [1, 8, 15];
  const LEGEND_COL = 22;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getWeeks(p: string): string[][] {
    const [y, m] = p.split('-').map(Number);
    const result: string[][] = [];
    let cursor = new Date(y, m - 1, 1);
    while (cursor.getDay() !== 1) cursor.setDate(cursor.getDate() - 1);
    for (let w = 0; w < 7; w++) {
      const week: string[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() + i);
        week.push(formatDateString(d));
      }
      if (week.some(ds => Number(ds.split('-')[1]) === m)) result.push(week);
      cursor.setDate(cursor.getDate() + 7);
      if (cursor.getMonth() > m - 1) break;
    }
    return result;
  }

  function fmtDate(ds: string): string {
    const [, mo, d] = ds.split('-').map(Number);
    const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d} ${MONTHS[mo - 1]}`;
  }

  function applyStyle(
    cell: ExcelJS.Cell,
    bg: string,
    bold: boolean,
    fc: string,
    halign: ExcelJS.Alignment['horizontal'] = 'center'
  ) {
    if (bg && bg !== C.NONE && bg !== C.FERIADO_BG) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    }
    cell.font = { bold, color: { argb: fc }, size: 9, name: 'Calibri' };
    cell.alignment = { horizontal: halign, vertical: 'middle', wrapText: true };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  }

  function getCellContent(
    dateStr: string,
    slotIdx: number,
    docApps: (Appointment & { status?: string })[],
    docBlocks: BlockedDay[],
    docShifts: Shift24h[],
    postTurnoDates: Set<string>,
    isTarde: boolean
  ): { text: string; bg: string; white: boolean } | null {
    // Turno 24h → todo el día azul oscuro
    if (docShifts.some(s => s.date === dateStr)) {
      return { text: slotIdx === 0 ? 'TURNO 24h' : '', bg: C.TURNO_24H, white: true };
    }
    // Post-turno → sin contenido
    if (postTurnoDates.has(dateStr)) {
      return null;
    }
    // Bloqueo — respetar turno del bloque vs turno del panel
    const relevantShift = isTarde ? 'Tarde' : 'Mañana';
    const block = docBlocks.find(b =>
      b.date === dateStr &&
      (b.shift === 'Todo el día' || b.shift === relevantShift)
    );
    if (block) {
      const bg = REASON_BG[block.reason] ?? C.NONE;
      if (block.reason === 'reunion de servicio') {
        return slotIdx === 1 ? { text: 'REU MED', bg, white: false } : null;
      }
      const label = slotIdx === 0
        ? (block.reason === 'Otro'
            ? (block.customReason || 'OTRO').toUpperCase()
            : block.reason.toUpperCase())
        : '';
      return { text: label, bg, white: false };
    }
    // Consulta
    const app = docApps.find(a => a.date === dateStr && (a as any).status !== 'Cancelada');
    if (app) {
      let startSlot: number;
      if (isTarde) startSlot = 11;
      else if (app.include800) startSlot = 0;
      else if (app.include830) startSlot = 1;
      else startSlot = 2;

      const ingresosEnd = startSlot + (app.newAdmissions || 0);
      const controlesEnd = ingresosEnd + (app.controls || 0);

      if (slotIdx >= startSlot && slotIdx < ingresosEnd) {
        return { text: 'INGRESO', bg: C.POLICLINICO, white: false };
      }
      if (slotIdx >= ingresosEnd && slotIdx < controlesEnd) {
        return { text: 'CONTROL', bg: C.POLICLINICO, white: false };
      }
    }
    // Feriado nacional
    if (CHILEAN_HOLIDAYS_2026.includes(dateStr)) {
      return { text: slotIdx === 0 ? 'FERIADO' : '', bg: C.FERIADO_BG, white: false };
    }
    return null;
  }

  function writeWeekPanel(
    ws: ExcelJS.Worksheet,
    week: string[],
    colStart: number,
    startRow: number,
    slotRange: { start: number; end: number },
    docApps: (Appointment & { status?: string })[],
    docBlocks: BlockedDay[],
    docShifts: Shift24h[],
    postTurnoDates: Set<string>,
    isTarde: boolean,
    lateralCol: number  // columna separadora para anotar turnos de fin de semana
  ) {
    // Day header row
    const hRow = ws.getRow(startRow);
    hRow.height = 18;
    applyStyle(hRow.getCell(colStart), C.HEADER_DAY, true, 'FF1A1A1A');
    hRow.getCell(colStart).value = 'HORARIO';
    DAY_LABELS.forEach((d, i) => {
      const cell = hRow.getCell(colStart + 1 + i);
      cell.value = d;
      applyStyle(cell, C.HEADER_DAY, true, 'FF1A1A1A');
    });

    // Date row
    const dRow = ws.getRow(startRow + 1);
    dRow.height = 16;
    applyStyle(dRow.getCell(colStart), C.DATE_ROW, false, 'FF111111');
    week.forEach((ds, i) => {
      const cell = dRow.getCell(colStart + 1 + i);
      cell.value = fmtDate(ds);
      applyStyle(cell, C.DATE_ROW, true, 'FF111111');
    });

    // Time slots
    for (let si = slotRange.start; si < slotRange.end; si++) {
      const tRow = ws.getRow(startRow + 2 + (si - slotRange.start));
      tRow.height = 18;
      const slotCell = tRow.getCell(colStart);
      slotCell.value = ALL_TIME_SLOTS[si];
      applyStyle(slotCell, C.NONE, false, 'FF404040', 'left');

      week.forEach((ds, di) => {
        const content = getCellContent(ds, si, docApps, docBlocks, docShifts, postTurnoDates, isTarde);
        const cell = tRow.getCell(colStart + 1 + di);
        if (content) {
          cell.value = content.text;
          applyStyle(cell, content.bg, true, content.white ? C.WHITE : 'FF1A1A1A');
        } else {
          applyStyle(cell, C.NONE, false, 'FF111111');
        }
      });
    }

    // Turnos de fin de semana → anotación lateral en columna separadora
    // El sábado sigue al viernes (week[4])
    const [fy, fm, fd] = week[4].split('-').map(Number);
    const satStr = formatDateString(new Date(fy, fm - 1, fd + 1));
    const sunStr = formatDateString(new Date(fy, fm - 1, fd + 2));
    const hasSat = docShifts.some(s => s.date === satStr);
    const hasSun = docShifts.some(s => s.date === sunStr);

    if (hasSat || hasSun) {
      const labels = hasSat && hasSun
        ? ['TURNO', 'SABADO', 'TURNO', 'DOMINGO']
        : hasSat
          ? ['TURNO', 'SABADO']
          : ['TURNO', 'DOMINGO'];

      labels.forEach((txt, i) => {
        const row = ws.getRow(startRow + 2 + i);
        row.height = 18;
        const cell = row.getCell(lateralCol);
        cell.value = txt;
        applyStyle(cell, C.UPC, true, C.WHITE);
      });
    }
  }

  // ── Build workbook ───────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  const weeks = getWeeks(period);
  const topWeeks = weeks.slice(0, 3);
  const bottomWeeks = weeks.slice(3, 5);

  for (const doc of doctors) {
    const docApps   = appointments.filter(a => a.doctorId === doc.id) as (Appointment & { status?: string })[];
    const docBlocks = blockedDays.filter(b => b.doctorId === doc.id);
    const docShifts = shifts24h.filter(s => s.doctorId === doc.id);
    const isTarde   = doc.defaultShift === 'Tarde';
    const slotRange = isTarde ? { start: 11, end: 17 } : { start: 0, end: 11 };
    const slotsCount = slotRange.end - slotRange.start;

    const postTurnoDates = new Set<string>();
    docShifts.forEach(s => {
      const [y, mo, d] = s.date.split('-').map(Number);
      postTurnoDates.add(formatDateString(new Date(y, mo - 1, d + 1)));
    });

    const sheetName = doc.sheetName.replace(/[\[\]*\\?:/]/g, '').slice(0, 30) || `Doc_${doc.id}`;
    const ws = wb.addWorksheet(sheetName);

    // Col widths: week1(1-6) | sep/turno-fds(7) | week2(8-13) | sep/turno-fds(14) | week3(15-20) | sep/turno-fds(21) | legend(22-23)
    ws.columns = [
      { width: 16 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, // 1-6
      { width: 10 },                                                                           // 7 — turno fds semana 1
      { width: 16 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, // 8-13
      { width: 10 },                                                                           // 14 — turno fds semana 2
      { width: 16 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, // 15-20
      { width: 10 },                                                                           // 21 — turno fds semana 3
      { width: 5  }, { width: 26 },                                                           // 22-23 (legend)
    ];

    // Row 1: doctor name merged cols 1-20
    ws.getRow(1).height = 22;
    const hc = ws.getRow(1).getCell(1);
    hc.value = doc.sheetName;
    applyStyle(hc, C.DOC_HEADER, true, C.WHITE);
    ws.mergeCells(1, 1, 1, 20);

    // Top section: weeks 0,1,2 — all start at row 2
    // Lateral cols (separadores): 7, 14, 21 para semanas 0,1,2
    const TOP_LATERAL_COLS = [7, 14, 21];
    const topStartRow = 2;
    topWeeks.forEach((week, wi) => {
      writeWeekPanel(ws, week, WEEK_COL_STARTS[wi], topStartRow, slotRange, docApps, docBlocks, docShifts, postTurnoDates, isTarde, TOP_LATERAL_COLS[wi]);
    });

    // Legend in cols 22-23, starting at row 2
    let lr = topStartRow;
    const legHCell = ws.getRow(lr).getCell(LEGEND_COL);
    legHCell.value = 'LEYENDA';
    ws.getRow(lr).height = 18;
    applyStyle(legHCell, C.DOC_HEADER, true, C.WHITE);
    ws.mergeCells(lr, LEGEND_COL, lr, LEGEND_COL + 1);
    lr++;

    for (const [label, bg] of LEGEND_ITEMS) {
      const lRow = ws.getRow(lr);
      lRow.height = 16;
      const colorCell = lRow.getCell(LEGEND_COL);
      colorCell.value = '';
      // Feriado en leyenda: borde visible con fondo blanco
      applyStyle(colorCell, bg === C.FERIADO_BG ? C.WHITE : bg, false, bg === C.TURNO_24H ? C.WHITE : 'FF1A1A1A');
      const labelCell = lRow.getCell(LEGEND_COL + 1);
      labelCell.value = label;
      applyStyle(labelCell, C.NONE, false, 'FF1A1A1A', 'left');
      lr++;
    }

    // Bottom section: weeks 3,4 — start after top section + 1 gap row
    if (bottomWeeks.length > 0) {
      // Lateral cols para bloques inferiores: misma lógica → 7, 14
      const BOTTOM_LATERAL_COLS = [7, 14];
      const bottomStartRow = topStartRow + 2 + slotsCount + 1; // header + date + slots + gap
      bottomWeeks.forEach((week, wi) => {
        writeWeekPanel(ws, week, WEEK_COL_STARTS[wi], bottomStartRow, slotRange, docApps, docBlocks, docShifts, postTurnoDates, isTarde, BOTTOM_LATERAL_COLS[wi]);
      });
    }
  }

  // ── Download ─────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Rotativa_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
