/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Shift = 'Mañana' | 'Tarde';

export interface Doctor {
  id: string;
  name: string;
  rut?: string;
  specialty: string;
  defaultShift: Shift; // Afternoon for 2 specific doctors, Morning for others
  isActive: boolean;
  sheetName: string;   // Sheet corresponding key (e.g., 'NOA', 'SALAZAR', etc.)
  maxWeeklyPatients?: number; // Quota tracker
}

export type BlockReason =
  | 'UPC'
  | 'policlinico'
  | 'sala'
  | 'horario protegido'
  | 'Actividades adm'
  | 'feriado'
  | 'permiso adm/feriado legal'
  | 'reunion de servicio'
  | 'libre 22x28'
  | 'licencia'
  | 'capacitacion/comision de servicio'
  | 'Otro';

export interface BlockedDay {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  shift: 'Mañana' | 'Tarde' | 'Todo el día';
  reason: BlockReason;
  customReason?: string; // If 'Otro' is selected
  notes?: string;
  startTime?: string;   // HH:MM (desde)
  endTime?: string;     // HH:MM (hasta)
}

export interface Appointment {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  shift: Shift; // Mañana o Tarde
  newAdmissions: number; // Cantidad de Ingresos Nuevos
  controls: number;      // Cantidad de Controles
  notes?: string;
  startTime?: string;    // Custom starting hour e.g. "09:00", "08:30", "08:00"
  include800?: boolean;  // Option to manually enter 8:00 AM slot when starting later
  include830?: boolean;  // Option to manually enter 8:30 AM slot when starting later
}

export interface Shift24h {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  notes?: string;
}

export const BLOCK_REASONS: BlockReason[] = [
  'UPC',
  'policlinico',
  'sala',
  'horario protegido',
  'Actividades adm',
  'feriado',
  'permiso adm/feriado legal',
  'reunion de servicio',
  'libre 22x28',
  'licencia',
  'capacitacion/comision de servicio',
  'Otro'
];
