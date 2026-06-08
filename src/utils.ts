/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import { Doctor, Appointment, BlockedDay, Shift24h } from './types';

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

/**
 * EXPORT TO EXCEL — Visual weekly grid matching Google Sheet structure.
 * One sheet per doctor, weeks arranged Mon–Fri with 30-min time slots,
 * color-coded by content type (ingresos, controles, blocks, shifts24h).
 */
export async function exportDoctorsToExcel(
  doctors: Doctor[],
  appointments: Appointment[],
  blockedDays: BlockedDay[],
  shifts24h: Shift24h[] = [],
  period = '2026-06'
): Promise<void> {
  // ── Color palette (ARGB — ExcelJS format) ───────────────────────────────
  const C = {
    INGRESOS:     'FFB8D7F5',
    CONTROLES:    'FFC6EFCE',
    TURNO_24H:    'FF4472C4',
    POST_TURNO:   'FF9DC3E6',
    REU_MED:      'FFFFC000',
    UPC:          'FFFF9999',
    POLICLINICO:  'FFFFCC99',
    SALA:         'FFFFB3B3',
    FERIADO:      'FFFF6666',
    PERMISO:      'FFFFFF99',
    LIBRE:        'FFFFF2CC',
    LICENCIA:     'FFFCE4D6',
    CAPACITACION: 'FFEAD1DC',
    PROT:         'FFD9D9D9',
    ADM:          'FFFFE699',
    OTRO:         'FFEDEDED',
    HEADER:       'FF1F3864',
    SUBHEADER:    'FF2E75B6',
    DATE_ROW:     'FFD6E4F0',
    TURNO_COL:    'FFBDD7EE',
    WHITE:        'FFFFFFFF',
    NONE:         '00000000',
  };

  const REASON_BG: Record<string, string> = {
    'UPC':                               C.UPC,
    'policlinico':                       C.POLICLINICO,
    'sala':                              C.SALA,
    'horario protegido':                 C.PROT,
    'Actividades adm':                   C.ADM,
    'feriado':                           C.FERIADO,
    'permiso adm/feriado legal':         C.PERMISO,
    'reunion de servicio':               C.REU_MED,
    'libre 22x28':                       C.LIBRE,
    'licencia':                          C.LICENCIA,
    'capacitacion/comision de servicio': C.CAPACITACION,
    'Otro':                              C.OTRO,
  };

  // Franjas completas: índices 0-10 mañana, 11-16 tarde
  const ALL_TIME_SLOTS = [
    '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30', '09:30 - 10:00',  // 0-3
    '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30', '11:30 - 12:00',  // 4-7
    '12:00 - 12:30', '12:30 - 13:00', '13:00 - 13:30',                   // 8-10
    '14:00 - 14:30', '14:30 - 15:00', '15:00 - 15:30',                   // 11-13
    '15:30 - 16:00', '16:00 - 16:30', '16:30 - 17:00',                   // 14-16
  ];

  const DAY_LABELS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

  const LEGEND_ITEMS: [string, string][] = [
    ['UPC',                               C.UPC],
    ['policlinico',                       C.POLICLINICO],
    ['sala',                              C.SALA],
    ['horario protegido',                 C.PROT],
    ['Actividades adm',                   C.ADM],
    ['feriado',                           C.FERIADO],
    ['permiso adm/feriado legal',         C.PERMISO],
    ['reunion de servicio',               C.REU_MED],
    ['libre 22x28',                       C.LIBRE],
    ['licencia',                          C.LICENCIA],
    ['capacitacion/comision de servicio', C.CAPACITACION],
    ['INGRESOS nuevos',                   C.INGRESOS],
    ['CONTROLES',                         C.CONTROLES],
    ['TURNO 24h',                         C.TURNO_24H],
    ['POST TURNO',                        C.POST_TURNO],
  ];

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
    if (bg && bg !== C.NONE) {
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

  function resolveSlot(
    dateStr: string,
    slotIdx: number,
    docApps: (Appointment & { status?: string })[],
    docBlocks: BlockedDay[],
    docShifts: Shift24h[],
    postTurnoDates: Set<string>,
    isTarde: boolean
  ): { text: string; bg: string; white: boolean } | null {
    // Turno 24h → bloquear todos los slots del día
    if (docShifts.some(s => s.date === dateStr)) {
      return { text: slotIdx === 0 ? 'TURNO 24h' : '', bg: C.TURNO_24H, white: true };
    }

    // Post-turno → dejar en blanco (el médico hace otras actividades asignadas desde el sistema)
    if (postTurnoDates.has(dateStr)) {
      return null;
    }

    // Día bloqueado → mostrar motivo en slot 0, color en todos los slots
    const block = docBlocks.find(b => b.date === dateStr);
    if (block) {
      const bg = REASON_BG[block.reason] || C.OTRO;
      if (block.reason === 'reunion de servicio') {
        // Solo 1 slot para reunión (no bloquea todo el día)
        return slotIdx === 1 ? { text: 'REU MED', bg, white: false } : null;
      }
      // Motivo en slot 0, resto del día con mismo color
      const label = slotIdx === 0
        ? (block.reason === 'Otro'
            ? (block.customReason || 'OTRO').toUpperCase()
            : block.reason.toUpperCase())
        : '';
      return { text: label, bg, white: false };
    }

    // Consulta → cada ingreso/control ocupa su propia franja de 30 min
    const app = docApps.find(a => a.date === dateStr && (a as any).status !== 'Cancelada');
    if (app) {
      // Slot de inicio (índice absoluto en ALL_TIME_SLOTS):
      // mañana: 09:00 (idx 2); tarde: 14:00 (idx 11)
      // include800/include830 solo aplican a turno mañana
      let startSlot: number;
      if (isTarde) startSlot = 11;
      else if (app.include800) startSlot = 0;
      else if (app.include830) startSlot = 1;
      else startSlot = 2;

      const ingresosEnd = startSlot + (app.newAdmissions || 0);
      const controlesEnd = ingresosEnd + (app.controls || 0);

      if (slotIdx >= startSlot && slotIdx < ingresosEnd) {
        return { text: 'INGRESO', bg: C.INGRESOS, white: false };
      }
      if (slotIdx >= ingresosEnd && slotIdx < controlesEnd) {
        return { text: 'CONTROL', bg: C.CONTROLES, white: false };
      }
    }

    return null;
  }

  // ── Build workbook with ExcelJS ──────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  const weeks = getWeeks(period);

  // Group: first week alone, then pairs
  const weekGroups: string[][][] = [];
  if (weeks.length > 0) weekGroups.push([weeks[0]]);
  for (let i = 1; i < weeks.length; i += 2) {
    weekGroups.push(i + 1 < weeks.length ? [weeks[i], weeks[i + 1]] : [weeks[i]]);
  }

  for (const doc of doctors) {
    const docApps   = appointments.filter(a => a.doctorId === doc.id);
    const docBlocks = blockedDays.filter(b => b.doctorId === doc.id);
    const docShifts = shifts24h.filter(s => s.doctorId === doc.id);
    const isTarde   = doc.defaultShift === 'Tarde';
    // Rango de franjas horarias según turno
    const slotRange = isTarde ? { start: 11, end: 17 } : { start: 0, end: 11 };

    const postTurnoDates = new Set<string>();
    docShifts.forEach(s => {
      const [y, mo, d] = s.date.split('-').map(Number);
      postTurnoDates.add(formatDateString(new Date(y, mo - 1, d + 1)));
    });

    const sheetName = doc.sheetName.replace(/[\[\]\*\\\?\:\/]/g, '').slice(0, 30) || `Doc_${doc.id}`;
    const ws = wb.addWorksheet(sheetName);

    // Column widths (13 cols: HORARIO + 5days + TURNO + HORARIO + 5days)
    ws.columns = [
      { width: 16 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
      { width: 8 },
      { width: 16 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
      { width: 3 },
      { width: 22 }, { width: 22 }, { width: 22 },
    ];

    let rowNum = 1; // ExcelJS is 1-indexed

    // Doctor name header
    const headerRow = ws.getRow(rowNum);
    headerRow.height = 22;
    const headerCell = headerRow.getCell(1);
    headerCell.value = doc.sheetName;
    applyStyle(headerCell, C.HEADER, true, C.WHITE);
    ws.mergeCells(rowNum, 1, rowNum, 13);
    rowNum++;

    let firstWeekStartRow = -1;

    for (let gi = 0; gi < weekGroups.length; gi++) {
      if (gi > 0) { rowNum++; } // blank gap between week groups

      const group = weekGroups[gi];
      if (gi === 0) firstWeekStartRow = rowNum;
      const isPair = group.length === 2;

      if (!isPair) {
        const week = group[0];

        // Column headers
        const hRow = ws.getRow(rowNum);
        hRow.height = 18;
        const hLabel = hRow.getCell(1);
        hLabel.value = 'HORARIO';
        applyStyle(hLabel, C.SUBHEADER, true, C.WHITE);
        DAY_LABELS.forEach((d, i) => {
          const c = hRow.getCell(i + 2);
          c.value = d;
          applyStyle(c, C.SUBHEADER, true, C.WHITE);
        });
        rowNum++;

        // Date row
        const dRow = ws.getRow(rowNum);
        dRow.height = 16;
        applyStyle(dRow.getCell(1), C.DATE_ROW, false, 'FF111111');
        week.forEach((ds, i) => {
          const c = dRow.getCell(i + 2);
          c.value = fmtDate(ds);
          applyStyle(c, C.DATE_ROW, true, 'FF111111');
        });
        rowNum++;

        // Time slots (solo el rango del turno del médico)
        for (let si = slotRange.start; si < slotRange.end; si++) {
          const tRow = ws.getRow(rowNum);
          tRow.height = 18;
          const slotCell = tRow.getCell(1);
          slotCell.value = ALL_TIME_SLOTS[si];
          applyStyle(slotCell, C.NONE, false, 'FF404040', 'left');

          week.forEach((ds, di) => {
            const r = resolveSlot(ds, si, docApps, docBlocks, docShifts, postTurnoDates, isTarde);
            const c = tRow.getCell(di + 2);
            if (r) {
              c.value = r.text;
              applyStyle(c, r.bg, true, r.white ? C.WHITE : 'FF1A1A1A');
            } else {
              applyStyle(c, C.NONE, false, 'FF111111');
            }
          });
          rowNum++;
        }

      } else {
        const [weekA, weekB] = group;

        // Weekend turno detection
        const satAfterA = new Date(...(weekA[4].split('-').map(Number) as [number, number, number]));
        satAfterA.setDate(satAfterA.getDate() + 1);
        const satStr = formatDateString(satAfterA);
        const sunStr = formatDateString(new Date(satAfterA.getTime() + 86400000));
        const hasSun = docShifts.some(s => s.date === sunStr);
        const hasSat = docShifts.some(s => s.date === satStr);
        const turnoLabel = hasSun ? ['TURNO', 'DOMINGO'] : hasSat ? ['TURNO', 'SABADO'] : [];

        // Column headers for both weeks
        const hRow = ws.getRow(rowNum);
        hRow.height = 18;
        const hL = hRow.getCell(1); hL.value = 'HORARIO'; applyStyle(hL, C.SUBHEADER, true, C.WHITE);
        DAY_LABELS.forEach((d, i) => { const c = hRow.getCell(i + 2); c.value = d; applyStyle(c, C.SUBHEADER, true, C.WHITE); });
        applyStyle(hRow.getCell(7), C.TURNO_COL, false, 'FF111111');
        const hR = hRow.getCell(8); hR.value = 'HORARIO'; applyStyle(hR, C.SUBHEADER, true, C.WHITE);
        DAY_LABELS.forEach((d, i) => { const c = hRow.getCell(i + 9); c.value = d; applyStyle(c, C.SUBHEADER, true, C.WHITE); });
        rowNum++;

        // Date rows for both weeks
        const dRow = ws.getRow(rowNum);
        dRow.height = 16;
        applyStyle(dRow.getCell(1), C.DATE_ROW, false, 'FF111111');
        weekA.forEach((ds, i) => { const c = dRow.getCell(i + 2); c.value = fmtDate(ds); applyStyle(c, C.DATE_ROW, true, 'FF111111'); });
        applyStyle(dRow.getCell(7), C.TURNO_COL, false, 'FF111111');
        applyStyle(dRow.getCell(8), C.DATE_ROW, false, 'FF111111');
        weekB.forEach((ds, i) => { const c = dRow.getCell(i + 9); c.value = fmtDate(ds); applyStyle(c, C.DATE_ROW, true, 'FF111111'); });
        rowNum++;

        // Time slots for both weeks (solo el rango del turno del médico)
        for (let si = slotRange.start; si < slotRange.end; si++) {
          const tRow = ws.getRow(rowNum);
          tRow.height = 18;
          const relSi = si - slotRange.start; // índice relativo para turnoLabel

          // Left time label
          const sL = tRow.getCell(1); sL.value = ALL_TIME_SLOTS[si]; applyStyle(sL, C.NONE, false, 'FF404040', 'left');
          weekA.forEach((ds, di) => {
            const r = resolveSlot(ds, si, docApps, docBlocks, docShifts, postTurnoDates, isTarde);
            const c = tRow.getCell(di + 2);
            if (r) { c.value = r.text; applyStyle(c, r.bg, true, r.white ? C.WHITE : 'FF1A1A1A'); }
            else { applyStyle(c, C.NONE, false, 'FF111111'); }
          });

          // TURNO separator
          const tText = turnoLabel[relSi] || '';
          const tCol = tRow.getCell(7);
          if (tText) { tCol.value = tText; applyStyle(tCol, C.TURNO_24H, true, C.WHITE); }
          else { applyStyle(tCol, C.TURNO_COL, false, 'FF111111'); }

          // Right time label
          const sR = tRow.getCell(8); sR.value = ALL_TIME_SLOTS[si]; applyStyle(sR, C.NONE, false, 'FF404040', 'left');
          weekB.forEach((ds, di) => {
            const r = resolveSlot(ds, si, docApps, docBlocks, docShifts, postTurnoDates, isTarde);
            const c = tRow.getCell(di + 9);
            if (r) { c.value = r.text; applyStyle(c, r.bg, true, r.white ? C.WHITE : 'FF1A1A1A'); }
            else { applyStyle(c, C.NONE, false, 'FF111111'); }
          });

          rowNum++;
        }
      }
    }

    // ── Legend: columna 15+ (fuera de las tablas de semanas) ──────────────
    if (firstWeekStartRow > 0) {
      let lr = firstWeekStartRow;
      const legH = ws.getRow(lr);
      legH.height = 18;
      const lhC = legH.getCell(15);
      lhC.value = 'LEYENDA';
      applyStyle(lhC, C.SUBHEADER, true, C.WHITE, 'left');
      ws.mergeCells(lr, 15, lr, 17);
      lr++;
      for (const [label, bg] of LEGEND_ITEMS) {
        const lRow = ws.getRow(lr);
        lRow.height = 16;
        const lCell = lRow.getCell(15);
        lCell.value = label;
        applyStyle(lCell, bg, false, bg === C.TURNO_24H ? C.WHITE : 'FF1A1A1A', 'left');
        ws.mergeCells(lr, 15, lr, 17);
        lr++;
      }
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
  a.download = `Programacion_Consultas_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
