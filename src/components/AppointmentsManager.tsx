/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Doctor, Appointment, BlockedDay, Shift24h } from '../types';
import { formatDateString, formatReadableDate, getBlockingForSlot } from '../utils';
import ConfirmModal from './ConfirmModal';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  BookOpen,
  FileText,
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface AppointmentsManagerProps {
  doctors: Doctor[];
  appointments: Appointment[];
  blockedDays: BlockedDay[];
  shifts24h?: Shift24h[];
  onAddAppointment: (app: Omit<Appointment, 'id'>) => void;
  onCancelAppointment: (id: string) => void;
  onUpdateAppStatus?: (id: string, status: any) => void; // Maintained for prop signature stability
  defaultDate?: string;
  defaultDoctorId?: string;
  defaultShift?: 'Mañana' | 'Tarde';
}

export default function AppointmentsManager({
  doctors,
  appointments,
  blockedDays,
  shifts24h = [],
  onAddAppointment,
  onCancelAppointment,
  defaultDate = '',
  defaultDoctorId = '',
  defaultShift = 'Mañana',
}: AppointmentsManagerProps) {
  const [showForm, setShowForm] = useState(defaultDate !== '' || defaultDoctorId !== '');
  const [appToDelete, setAppToDelete] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState(defaultDoctorId || (doctors[0]?.id || ''));
  const [date, setDate] = useState(defaultDate || formatDateString(new Date()));
  const [shift, setShift] = useState<'Mañana' | 'Tarde'>(defaultShift);
  const [newAdmissions, setNewAdmissions] = useState<number>(2);
  const [controls, setControls] = useState<number>(6);
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [include800, setInclude800] = useState<boolean>(false);
  const [include830, setInclude830] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtering variables
  const [filterDocId, setFilterDocId] = useState('todos');
  const [filterDate, setFilterDate] = useState('');

  // Handle defaults when shortcut is selected from calendar
  useEffect(() => {
    if (defaultDoctorId) {
      setSelectedDocId(defaultDoctorId);
      const doc = doctors.find(d => d.id === defaultDoctorId);
      if (doc) {
        setShift(defaultShift || doc.defaultShift);
      }
    }
    if (defaultDate) {
      setDate(defaultDate);
      setShowForm(true);
    }
  }, [defaultDoctorId, defaultDate, defaultShift, doctors]);

  // Reactive Loader: If there is an existing allocation for this doctor, date, and shift, pre-fill it!
  useEffect(() => {
    if (selectedDocId && date && shift) {
      const existing = appointments.find(
        (a) => a.doctorId === selectedDocId && a.date === date && a.shift === shift
      );
      if (existing) {
        setNewAdmissions(existing.newAdmissions);
        setControls(existing.controls);
        setNotes(existing.notes || '');
        setStartTime(existing.startTime || (shift === 'Mañana' ? '09:00' : '14:00'));
        setInclude800(!!existing.include800);
        setInclude830(!!existing.include830);
      } else {
        // Fall back to healthy defaults
        setNewAdmissions(shift === 'Mañana' ? 3 : 2);
        setControls(shift === 'Mañana' ? 9 : 4);
        setNotes('');
        setStartTime(shift === 'Mañana' ? '09:00' : '14:00');
        setInclude800(false);
        setInclude830(false);
      }
    }
  }, [selectedDocId, date, shift, appointments]);

  const handleDoctorChange = (docId: string) => {
    setSelectedDocId(docId);
    const doc = doctors.find(d => d.id === docId);
    if (doc) {
      setShift(doc.defaultShift);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedDocId) {
      setErrorMsg('Debe seleccionar un médico.');
      return;
    }
    if (!date) {
      setErrorMsg('Debe ingresar una fecha.');
      return;
    }

    // Weekend validation
    const d = new Date(date + 'T12:00:00');
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setErrorMsg('No se pueden programar consultas los fines de semana (Sábados/Domingos). El policlínico sólo atiende de lunes a viernes.');
      return;
    }

    // STRICT BLOCK CHECK: Is the doctor blocked on this date and shift?
    const block = getBlockingForSlot(blockedDays, selectedDocId, date, shift);
    if (block) {
      const reasonText = block.reason === 'Otro' ? block.customReason || 'contratiempo imprevisto' : block.reason;
      setErrorMsg(
        `¡Médico no disponible! El profesional seleccionado está bloqueado este día por motivo de: "${reasonText}". Notas de bloqueo: "${block.notes || 'Ninguna'}"`
      );
      return;
    }

    // STRICT GUARD CHECK: Prevent scheduling outpatient consultations on the day of a 24h shift OR the day after (post-shift rest day)
    const docGuards = (shifts24h || []).filter(s => s.doctorId === selectedDocId);
    if (docGuards.length > 0) {
      const parseLocalDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0); // midday to avoid timezone shifting issues
      };

      const sortedDates = docGuards.map(s => s.date).sort();
      const T0 = parseLocalDate(sortedDates[0]);
      
      const currentD = parseLocalDate(date);
      const diffDays = Math.round((currentD.getTime() - T0.getTime()) / (1000 * 60 * 60 * 24));

      // 1. Is it the day of the 24h guard shift?
      if (Math.abs(diffDays) % 6 === 0) {
        setErrorMsg(`¡No se pueden programar consultas! El profesional tiene asignada una Guardia de 24 horas este día (${formatReadableDate(date)}), según el ciclo de rotación recurrente de cada 6 días.`);
        return;
      }

      // 2. Is it the post-guard day? (The day immediately following a 24-hour guard shift)
      const diffDaysYesterday = diffDays - 1;
      if (Math.abs(diffDaysYesterday) % 6 === 0) {
        setErrorMsg(`¡No se pueden programar consultas! El profesional tiene descanso obligatorio de Post-Guardia este día (${formatReadableDate(date)}), tras haber realizado un turno de 24 horas el día anterior.`);
        return;
      }
    }

    // Warn if out of favourite shift
    const doc = doctors.find((doctor) => doctor.id === selectedDocId);
    let alertNotes = '';
    if (doc && doc.defaultShift !== shift) {
      alertNotes = ` (Turno programado fuera de su jornada fija habitual de ${doc.defaultShift})`;
    }

    // Check if we need to update rather than add double (to prevent duplicates in our array)
    const existing = appointments.find(
      (a) => a.doctorId === selectedDocId && a.date === date && a.shift === shift
    );

    if (existing) {
      // Clean up the previous entry first (to replace it cleanly)
      onCancelAppointment(existing.id);
    }

    onAddAppointment({
      doctorId: selectedDocId,
      date,
      shift,
      newAdmissions: Math.max(0, Number(newAdmissions)),
      controls: Math.max(0, Number(controls)),
      notes: notes.trim() + alertNotes,
      startTime,
      include800: shift === 'Mañana' ? include800 : false,
      include830: shift === 'Mañana' ? include830 : false,
    });

    setSuccessMsg('Planificación de cupos e ingresos registrada correctamente.');
    
    setTimeout(() => {
      setSuccessMsg('');
      setShowForm(false);
    }, 1500);
  };

  const handleEditQuota = (app: Appointment) => {
    setSelectedDocId(app.doctorId);
    setDate(app.date);
    setShift(app.shift);
    setNewAdmissions(app.newAdmissions);
    setControls(app.controls);
    // Strip automatic out-of-shift notes if any
    setNotes((app.notes || '').split(' (Turno programado fuera')[0]);
    setStartTime(app.startTime || (app.shift === 'Mañana' ? '09:00' : '14:00'));
    setInclude800(!!app.include800);
    setInclude830(!!app.include830);
    setShowForm(true);
    
    // Smooth scroll to form
    const container = document.getElementById('appointments-manager');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const filteredAppointments = appointments.filter((app) => {
    const docMatches = filterDocId === 'todos' || app.doctorId === filterDocId;
    const dateMatches = !filterDate || app.date === filterDate;
    return docMatches && dateMatches;
  });

  return (
    <div className="space-y-6" id="appointments-manager">
      {/* Overview Block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm leading-none">Planificación de Cupos de Atención</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Configure cuántos <strong>Ingresos Nuevos</strong> y cuántos <strong>Controles</strong> se asignarán a cada médico por cada día de atención. El sistema impedirá grabaciones en días u horarios de médicos bloqueados.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer shadow-sm transition-all text-center shrink-0"
          id="btn-toggle-add-app"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Ocultar Planificador' : 'Programar Turno y Cupos'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">Definir Volumen de Pacientes del Turno</h4>
              <p className="text-xs text-slate-500">Ajuste la cantidad de cupos teóricos para el bloque horario escogido</p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-medium flex items-start gap-2.5 animate-fades">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-medium flex items-start gap-2.5 animate-fades">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Médico Consultor *</label>
              <select
                value={selectedDocId}
                onChange={(e) => handleDoctorChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white font-medium"
                required
              >
                <option value="" disabled>Seleccione médico</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fecha del Turno *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-700 font-medium bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Jornada / Bloque de Atención</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setShift('Mañana')}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg border transition-all ${
                    shift === 'Mañana'
                      ? 'bg-blue-50 border-blue-450 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Mañana (AM)
                </button>
                <button
                  type="button"
                  onClick={() => setShift('Tarde')}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg border transition-all ${
                    shift === 'Tarde'
                      ? 'bg-amber-50 border-amber-450 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Tarde (PM)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" title="Pacientes que ingresan por primera vez">Ingresos Nuevos</label>
                <input
                  type="number"
                  min="0"
                  value={newAdmissions}
                  onChange={(e) => setNewAdmissions(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-center font-mono font-bold bg-white text-blue-900"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" title="Pacientes continuos de control habitual">Controles</label>
                <input
                  type="number"
                  min="0"
                  value={controls}
                  onChange={(e) => setControls(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-center font-mono font-bold bg-white text-blue-900"
                  required
                />
              </div>
            </div>
          </div>

          {/* Configuración de Horario de Inicio e Ingreso Manual de Bloques (SÓLO MAÑANA) */}
          {shift === 'Mañana' && (
            <div className="bg-blue-50/45 p-4 rounded-xl border border-blue-150 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fades">
              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Hora de Inicio de la Agenda AM *</span>
                </label>
                <select
                  value={startTime}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartTime(newStart);
                    // Reset manual flags if they are now contained/redundant in the standard start range
                    if (newStart === '08:00') {
                      setInclude800(false);
                      setInclude830(false);
                    } else if (newStart === '08:30') {
                      setInclude800(false);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-205 rounded-lg focus:outline-none bg-white font-medium text-slate-800"
                >
                  <option value="09:00">09:00 AM (Estándar 12 cupos)</option>
                  <option value="08:30">08:30 AM</option>
                  <option value="08:00">08:00 AM</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  Por defecto la agenda iniciará a las 9 AM ocupando 12 módulos de 30 minutos secuenciales.
                </p>
              </div>

              <div className="flex flex-col justify-center gap-2">
                <span className="block text-xs font-bold text-slate-705 mb-1">Inclusión manual de horas previas</span>
                
                {startTime !== '08:00' && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-650 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={include800}
                      onChange={(e) => setInclude800(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span>Forzar bloque manual extra: <strong>08:00 AM</strong></span>
                  </label>
                )}

                {startTime === '09:00' && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-650 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={include830}
                      onChange={(e) => setInclude830(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span>Forzar bloque manual extra: <strong>08:30 AM</strong></span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Panel interactivo de slots de agendamiento cada 30 minutos */}
          {(() => {
            const totalRequested = Number(newAdmissions) + Number(controls);
            const isMorning = shift === 'Mañana';
            
            // Dynamic evaluation of slots
            let activeSlots: string[] = [];
            if (isMorning) {
              const start = startTime || '09:00';
              const tempSlots: string[] = [];
              
              // 1. Check for manual inclusion fields
              if (include800 && start !== '08:00') {
                tempSlots.push('08:00');
              }
              if (include830 && start !== '08:00' && start !== '08:30') {
                tempSlots.push('08:30');
              }
              
              // 2. Generate the 12 sequential slots
              const helperAddMinutes = (timeStr: string, mins: number) => {
                const [h, m] = timeStr.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m, 0, 0);
                d.setTime(d.getTime() + mins * 60 * 1000);
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              };
              
              for (let i = 0; i < 12; i++) {
                const nextTime = helperAddMinutes(start, i * 30);
                if (!tempSlots.includes(nextTime)) {
                  tempSlots.push(nextTime);
                }
              }
              
              // Chronological sorting so early hours appear at the top beautifully
              tempSlots.sort();
              activeSlots = tempSlots;
            } else {
              // Standard constant Afternoon slots
              const helperAddMinutes = (timeStr: string, mins: number) => {
                const [h, m] = timeStr.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m, 0, 0);
                d.setTime(d.getTime() + mins * 60 * 1000);
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              };
              activeSlots = Array.from({ length: 6 }).map((_, i) => helperAddMinutes('14:00', i * 30));
            }

            const maxAllowed = activeSlots.length;
            const exceedsMax = totalRequested > maxAllowed;

            return (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-205 space-y-3.5 text-xs animate-fades">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-2 select-none">
                  <span className="font-extrabold text-[11.5px] text-slate-800 flex items-center gap-1.5">
                    ⏱️ Distribución estimada de agenda (Slots de 30 min)
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold ${exceedsMax ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                    {totalRequested} de {maxAllowed} Cupos Utilizados
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {activeSlots.map((time, idx) => {
                    const isAssigned = idx < totalRequested;
                    const isOverflow = idx >= maxAllowed;

                    let badgeClass = "border border-slate-200 text-slate-400 bg-white hover:bg-slate-100/50";
                    let textStatus = "Disponible";

                    if (isAssigned) {
                      if (isOverflow) {
                        badgeClass = "bg-rose-550 text-white border-rose-700 shadow-3xs font-extrabold";
                        textStatus = "Sobre-cupo";
                      } else {
                        badgeClass = "bg-blue-600 text-white border-blue-700 shadow-3xs font-bold";
                        textStatus = idx < newAdmissions ? "Nuevo" : "Control";
                      }
                    }

                    return (
                      <div
                        key={time}
                        className={`px-3 py-2 rounded-lg flex flex-col items-center justify-center min-w-[76px] select-none text-[10.5px] transition-all ${badgeClass}`}
                        title={`Agenda ${time} - ${textStatus}`}
                      >
                        <span className="font-mono font-bold">{time}</span>
                        <span className="text-[8px] font-black uppercase opacity-95 mt-0.5">{textStatus}</span>
                      </div>
                    );
                  })}

                  {/* Red pulsing extra slots for deliberate overbookings */}
                  {totalRequested > maxAllowed && Array.from({ length: totalRequested - maxAllowed }).map((_, extraIdx) => {
                    const labelNum = maxAllowed + extraIdx + 1;
                    return (
                      <div
                        key={`over-${labelNum}`}
                        className="px-3 py-2 rounded-lg flex flex-col items-center justify-center min-w-[76px] bg-rose-600 text-white border border-rose-700 font-extrabold animate-pulse text-[10.5px]"
                        title={`Paciente sobre-agendado #${extraIdx + 1}`}
                      >
                        <span className="font-mono font-bold">SOBRE {labelNum}</span>
                        <span className="text-[8px] font-black uppercase opacity-95 mt-0.5">Extra</span>
                      </div>
                    );
                  })}
                </div>

                {exceedsMax && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Alerta de Saturación de Agenda:</strong> El volumen planificado ({totalRequested} cupos) supera el límite recomendado de slots de 30 minutos ({maxAllowed} cupos) para la jornada de la {shift === 'Mañana' ? `Mañana (${startTime || '09:00'} - ${activeSlots[activeSlots.length - 1] || '14:30'})` : 'Tarde (2:00 PM - 5:00 PM)'}. El médico podría tener sobretiempo laboral.
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notas u Observaciones del Supervisor (Opcional)</label>
            <input
              type="text"
              placeholder="Ej. Priorizar derivaciones de urgencia, se sobre-agendan 2 adicionales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Guardar Programación
            </button>
          </div>
        </form>
      )}

      {/* Plan list view */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filters bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Filtrar por Médico:</span>
              <select
                value={filterDocId}
                onChange={(e) => setFilterDocId(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="todos">Todos los médicos</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Filtrar por Día:</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-600"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <span className="text-xs font-bold text-slate-705 bg-slate-200/60 border border-slate-300 px-2.5 py-1 rounded-lg">
            {filteredAppointments.length} bloques planificados
          </span>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="text-center py-16" id="no-apps-state">
            <div className="inline-flex p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500 font-bold">No se registran bloques programados</p>
            <p className="text-xs text-slate-400 mt-1.5">Defina las metas y cupos diarios usando el botón superior o el selector en la agenda semanal.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left border-collapse text-xs" id="table-appointments">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider text-[9.5px] border-b border-slate-200 select-none">
                  <th className="py-3 px-4">Médico Tratante</th>
                  <th className="py-3 px-4">Especialidad</th>
                  <th className="py-3 px-4">Fecha Planificada</th>
                  <th className="py-3 px-4">Bloque</th>
                  <th className="py-3 px-4 text-center">Ingresos Nuevos</th>
                  <th className="py-3 px-4 text-center">Controles habituales</th>
                  <th className="py-3 px-4 text-center font-bold text-blue-800">Total Cupos</th>
                  <th className="py-3 px-4">Observaciones y Alertas de Rango</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredAppointments.map((app) => {
                  const doc = doctors.find((d) => d.id === app.doctorId);
                  const total = app.newAdmissions + app.controls;
                  return (
                    <tr 
                      key={app.id} 
                      className="hover:bg-slate-50/40 transition-colors"
                      id={`row-app-${app.id}`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {doc ? doc.name : 'Médico desvinculado'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {doc?.specialty || 'Sin datos'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {formatReadableDate(app.date)}
                        <span className="block text-[10px] text-slate-400 font-normal font-mono mt-0.5">{app.date}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          app.shift === 'Mañana' 
                            ? 'bg-blue-50 text-blue-800 border border-blue-100' 
                            : 'bg-amber-50 text-amber-850 border border-amber-100'
                        }`}>
                          {app.shift}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-blue-900 font-mono text-xs">
                        {app.newAdmissions}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-blue-900 font-mono text-xs">
                        {app.controls}
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-blue-800 bg-blue-50/20 font-mono text-sm border-x border-slate-100">
                        {total}
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px] truncate text-slate-500" title={app.notes}>
                        <div className="flex flex-col gap-1.5">
                          {(() => {
                            let maxLimit = app.shift === 'Mañana' ? 12 : 6;
                            if (app.shift === 'Mañana') {
                              const start = app.startTime || '09:00';
                              let allowed = 12;
                              if (app.include800 && start !== '08:00') allowed += 1;
                              if (app.include830 && start === '09:00') allowed += 1;
                              maxLimit = allowed;
                            }
                            if (total > maxLimit) {
                              return (
                                <span className="text-[9px] font-extrabold text-red-700 bg-red-55 border border-red-150 px-2.5 py-0.5 rounded-full w-max flex items-center gap-1 select-none">
                                  ⚠️ Sobrecarga ({total} / {maxLimit})
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{app.notes || <span className="text-slate-300 italic">Sin observaciones</span>}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleEditQuota(app)}
                          className="px-2.5 py-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                        >
                          Modificar
                        </button>
                        <button
                          onClick={() => setAppToDelete(app.id)}
                          className="p-1 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded transition-colors inline-block"
                          id={`btn-cancel-${app.id}`}
                          title="Eliminar planificación de cupos"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={appToDelete !== null}
        onClose={() => setAppToDelete(null)}
        onConfirm={() => {
          if (appToDelete) {
            onCancelAppointment(appToDelete);
          }
        }}
        title="Limpiar cupos planificados"
        message="¿Está seguro de que desea limpiar los cupos planificados para este bloque horario de atención médica?"
        confirmText="Limpiar Cupos"
        cancelText="Volver"
        type="danger"
      />
    </div>
  );
}
