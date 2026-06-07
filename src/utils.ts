/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
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
 * EXPORT TO EXCEL LOGIC
 * Creates one Workbook where each doctor gets their own custom formatted Sheet
 */
export function exportDoctorsToExcel(
  doctors: Doctor[],
  appointments: Appointment[],
  blockedDays: BlockedDay[],
  shifts24h: Shift24h[] = []
): void {
  const wb = XLSX.utils.book_new();

  doctors.forEach((doc) => {
    // 1. Filter elements related to this doctor, sorted by date
    const docAppointments = appointments
      .filter((app) => app.doctorId === doc.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const docBlocked = blockedDays
      .filter((block) => block.doctorId === doc.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const docShifts24h = shifts24h
      .filter((s) => s.doctorId === doc.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    // 2. Prepare structured data array for formatting
    const excelRows: any[] = [];

    // Header Metadata
    excelRows.push(['SISTEMA DE PLANIFICACIÓN DE TURNOS Y CUPOS MÉDICOS']);
    excelRows.push([`FICHA DE AGENDA: ${doc.name.toUpperCase()}`]);
    excelRows.push([`Especialidad: ${doc.specialty}`]);
    excelRows.push([`RUT Médico: ${doc.rut || 'No especificado'}`]);
    excelRows.push([`Jornada Fija de Atención: ${doc.defaultShift === 'Tarde' ? 'Tarde (Lunes a Viernes)' : 'Mañana (Lunes a Viernes)'}`]);
    excelRows.push([`Estado del Médico: ${doc.isActive ? 'Activo' : 'Inactivo'}`]);
    excelRows.push([]); // blank row

    // Summary Statistics
    const totalNewAdmissions = docAppointments.reduce((acc, curr) => acc + curr.newAdmissions, 0);
    const totalControls = docAppointments.reduce((acc, curr) => acc + curr.controls, 0);
    const totalPatientsPlanned = totalNewAdmissions + totalControls;

    excelRows.push(['RESUMEN DE PLANIFICACIÓN']);
    excelRows.push(['Total Ingresos Nuevos Planificados', totalNewAdmissions]);
    excelRows.push(['Total Controles Planificados', totalControls]);
    excelRows.push(['Total Pacientes Planificados', totalPatientsPlanned]);
    excelRows.push(['Total Bloqueos Registrados', docBlocked.length]);
    excelRows.push(['Total Guardias de 24h Programadas', docShifts24h.length]);
    excelRows.push([]); // blank row

    // Section 1: Quota Allocations
    excelRows.push(['1. CUPOS Y VOLUMEN DE PACIENTES PLANIFICADOS POR DÍA']);
    excelRows.push([
      'Fecha',
      'Jornada',
      'Cupos Ingresos Nuevos',
      'Cupos Controles',
      'Total Pacientes del Bloque',
      'Observaciones / Notas de Planificación'
    ]);

    if (docAppointments.length === 0) {
      excelRows.push(['(No hay programación de cupos registrada para este doctor)', '', '', '', '', '']);
    } else {
      docAppointments.forEach((app) => {
        const blockTotal = app.newAdmissions + app.controls;
        
        let scheduleIntro = '';
        if (app.shift === 'Mañana') {
          const start = app.startTime || '09:00';
          const extraBlocks = [];
          if (app.include800) extraBlocks.push('08:00 AM');
          if (app.include830) extraBlocks.push('08:30 AM');
          scheduleIntro = `[Inicia ${start} AM${extraBlocks.length > 0 ? `, Módulos extra: ${extraBlocks.join(', ')}` : ''}] `;
        }
        
        excelRows.push([
          app.date,
          app.shift,
          app.newAdmissions,
          app.controls,
          blockTotal,
          scheduleIntro + (app.notes || '')
        ]);
      });
    }

    excelRows.push([]); // blank separator
    excelRows.push([]); // blank separator

    // Section 2: Blocked Days
    excelRows.push(['2. CONTRATIEMPOS Y BLOQUEOS DE AGENDA']);
    excelRows.push([
      'Fecha Bloqueada',
      'Bloque Horario',
      'Causa/Motivo de Bloqueo',
      'Notas / Observaciones de Respaldo'
    ]);

    if (docBlocked.length === 0) {
      excelRows.push(['(No hay bloqueos ni contratiempos programados)', '', '', '']);
    } else {
      docBlocked.forEach((b) => {
        const fullReason = b.reason === 'Otro' ? b.customReason || 'Otro contratiempo' : b.reason;
        const timeRangeStr = b.startTime && b.endTime ? ` (${b.startTime} - ${b.endTime})` : '';
        excelRows.push([
          b.date,
          `${b.shift}${timeRangeStr}`,
          fullReason,
          b.notes || ''
        ]);
      });
    }

    excelRows.push([]); // blank separator
    excelRows.push([]); // blank separator

    // Section 3: 24h Guard Shifts
    excelRows.push(['3. DIAS CON TURNO DE GUARDIA 24 HORAS']);
    excelRows.push([
      'Fecha de la Guardia',
      'Tipo de Guardia',
      'Estado',
      'Observación / Respaldo'
    ]);

    if (docShifts24h.length === 0) {
      excelRows.push(['(No registrado con turnos de guardia 24h para esta semana)', '', '', '']);
    } else {
      docShifts24h.forEach((s) => {
        excelRows.push([
          s.date,
          'Guardia 24 Horas Activa',
          'En Servicio de Urgencia/Respaldo',
          s.notes || 'Asignado de forma manual desde el portal'
        ]);
      });
    }

    // Convert array of arrays to Worksheet
    const sheetName = doc.name.replace(/[\[\]\*\\\?\:\/]/g, '').slice(0, 30) || `Doc_${doc.id}`;
    const ws = XLSX.utils.aoa_to_sheet(excelRows);

    // Apply basic column widths to make things legible
    const colWidths = [
      { wch: 15 }, // Fecha
      { wch: 12 }, // Jornada
      { wch: 22 }, // Cupos Ingresos Nuevos
      { wch: 18 }, // Cupos Controles
      { wch: 25 }, // Total Pacientes
      { wch: 45 }, // Observaciones
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // Write and Save
  const fileName = `Planificacion_Ambulatoria_Metas_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
