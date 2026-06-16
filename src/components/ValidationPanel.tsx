import React, { useMemo, useState } from 'react';
import { Doctor, Appointment, BlockedDay, Shift24h } from '../types';
import ConfirmModal from './ConfirmModal';
import { formatReadableDate } from '../utils';
import { AlertTriangle, CheckCircle, Sparkles, Trash2, ShieldAlert } from 'lucide-react';
import { CHILEAN_HOLIDAYS_2026 } from '../utils';

interface ValidationPanelProps {
  doctors: Doctor[];
  appointments: Appointment[];
  blockedDays: BlockedDay[];
  shifts24h: Shift24h[];
  selectedPeriod: string; // YYYY-MM format, e.g. "2026-06"
  onAutoSchedule: (generatedApps: Appointment[], generatedGuards?: Shift24h[], generatedBlocks?: BlockedDay[]) => void;
  onClearAppointments: () => void | Promise<void>;
}

export interface RuleViolation {
  id: string;
  type: 'error' | 'warning';
  category: string;
  message: string;
  doctorName: string;
  dateStr: string;
}


export default function ValidationPanel({
  doctors,
  appointments,
  blockedDays,
  shifts24h,
  selectedPeriod,
  onAutoSchedule,
  onClearAppointments,
}: ValidationPanelProps) {
  
  const [showAutoConfirm, setShowAutoConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const appointmentsInSelectedPeriod = useMemo(
    () => appointments.filter(app => app.date.startsWith(selectedPeriod)),
    [appointments, selectedPeriod]
  );

  // Real-Time Rules Engine
  const violations = useMemo<RuleViolation[]>(() => {
    const list: RuleViolation[] = [];
    const docMap = new Map(doctors.map(d => [d.id, d]));
    const appointmentsInPeriod = appointments.filter(app => app.date.startsWith(selectedPeriod));
    const blockedDaysInPeriod = blockedDays.filter(block => block.date.startsWith(selectedPeriod));
    const rawShiftsInPeriod = shifts24h.filter((shift) => {
      if (shift.date.startsWith(selectedPeriod)) return true;
      const [year, month, day] = shift.date.split('-').map(Number);
      const nextDate = new Date(year, month - 1, day, 12, 0, 0);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDayStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      return nextDayStr.startsWith(selectedPeriod);
    });
    const shiftsInPeriod = Array.from(
      new Map(rawShiftsInPeriod.map(shift => [`${shift.doctorId}-${shift.date}`, shift])).values()
    );

    // Helper to get week number of a date string (YYYY-MM-DD)
    const getWeekKey = (dateStr: string) => {
      const date = new Date(dateStr);
      const oneJan = new Date(date.getFullYear(), 0, 1);
      const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
      return `${date.getFullYear()}-W${Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7)}`;
    };

    // Track weekly quotas
    // Map with key `${doctorId}-${weekKey}` -> total patients
    const weeklyQuotaCount = new Map<string, number>();

    appointmentsInPeriod.forEach((app) => {
      const doc = docMap.get(app.doctorId);
      if (!doc) return;

      const dateStr = app.date;
      const totalPatients = app.newAdmissions + app.controls;

      // Fin de semana: las consultas no se programan — si llega una, es error bloqueante
      const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        list.push({
          id: `weekend-${app.id}`,
          type: 'error',
          category: 'Consulta en Fin de Semana',
          message: `Consulta programada en ${dayOfWeek === 0 ? 'domingo' : 'sábado'}. Los fines de semana no admiten consultas ordinarias. Solo guardias 24h.`,
          doctorName: doc.name,
          dateStr
        });
      }

      // 3. Feriado / Feriado Legal (médico asignado en feriado)
      const isFeriadoNational = CHILEAN_HOLIDAYS_2026.includes(dateStr);
      const hasFeriadoBlock = blockedDaysInPeriod.some(b => 
        b.doctorId === app.doctorId && 
        b.date === dateStr && 
        (b.reason === 'feriado' || b.reason === 'permiso adm/feriado legal')
      );
      if (isFeriadoNational || hasFeriadoBlock) {
        list.push({
          id: `holiday-${app.id}`,
          type: 'error',
          category: 'Asignación en Feriado',
          message: `Médico programado en día feriado o permiso legal (${isFeriadoNational ? 'Feriado Nacional Chile' : 'Permiso/Feriado Personal'}).`,
          doctorName: doc.name,
          dateStr
        });
      }

      // 4. Daily limits exceeded (cupos diarios superados)
      let maxDailyAllowed = app.shift === 'Mañana' ? 12 : 6;
      if (app.shift === 'Mañana') {
        const start = app.startTime || '09:00';
        let allowed = 12;
        if (app.include800 && start !== '08:00') allowed += 1;
        if (app.include830 && start === '09:00') allowed += 1;
        maxDailyAllowed = allowed;
      }
      if (totalPatients > maxDailyAllowed) {
        list.push({
          id: `daily-exceeded-${app.id}`,
          type: 'error',
          category: 'Cupos Diarios Superados',
          message: `Agenda supera el límite sugerido de ${maxDailyAllowed} pacientes por bloque de 30 min (Registrados ${totalPatients}).`,
          doctorName: doc.name,
          dateStr
        });
      }

      // 5. Manual Blocking Ignored (bloqueo manual ignorado)
      const isBlocked = blockedDaysInPeriod.find(b => 
        b.doctorId === app.doctorId && 
        b.date === dateStr && 
        (b.shift === app.shift || b.shift === 'Todo el día')
      );
      if (isBlocked) {
        list.push({
          id: `manual-block-${app.id}`,
          type: 'error',
          category: 'Bloqueo Manual Ignorado',
          message: `Bloqueo manual activo (${isBlocked.reason}${isBlocked.startTime ? ` ${isBlocked.startTime}-${isBlocked.endTime}` : ''}) ignorado en jornada de la ${app.shift}.`,
          doctorName: doc.name,
          dateStr
        });
      }

      // 6. Shift mismatch (médico de mañana en tarde / tarde en mañana)
      if (doc.defaultShift === 'Tarde' && app.shift === 'Mañana') {
        list.push({
          id: `shift-mismatch-morning-${app.id}`,
          type: 'warning',
          category: 'Discrepancia de Jornada',
          message: `Médico contratado para tarde programado en horario de mañana.`,
          doctorName: doc.name,
          dateStr
        });
      }
      if (doc.defaultShift === 'Mañana' && app.shift === 'Tarde') {
        list.push({
          id: `shift-mismatch-afternoon-${app.id}`,
          type: 'warning',
          category: 'Discrepancia de Jornada',
          message: `Médico contratado para mañana programado en horario de tarde.`,
          doctorName: doc.name,
          dateStr
        });
      }

      // Accumulate weekly counts
      const wKey = getWeekKey(dateStr);
      const weekCountKey = `${app.doctorId}-${wKey}`;
      const prev = weeklyQuotaCount.get(weekCountKey) || 0;
      weeklyQuotaCount.set(weekCountKey, prev + totalPatients);
    });

    // 7. Exceso de cupos semanales
    weeklyQuotaCount.forEach((total, key) => {
      const [docId, weekKey] = key.split('-');
      const doc = docMap.get(docId);
      if (!doc) return;

      const maxWeekly = doc.maxWeeklyPatients || (doc.defaultShift === 'Tarde' ? 30 : 50);
      if (total > maxWeekly) {
        list.push({
          id: `weekly-exceeded-${key}`,
          type: 'warning',
          category: 'Exceso de Cupos Semanales',
          message: `El total de pacientes semanales (${total}) excede la capacidad recomendada de ${maxWeekly} para este médico en la semana ${weekKey.split('W')[1]}.`,
          doctorName: doc.name,
          dateStr: `Semana ${weekKey.split('W')[1]}`
        });
      }
    });

    // 8. 24h Guard Shift Posturno Check (posturno no respetado / turno sin descanso posterior)
    shiftsInPeriod.forEach((shift) => {
      const doc = docMap.get(shift.doctorId);
      if (!doc) return;

      // Calculate next day YYYY-MM-DD
      const refDate = new Date(shift.date);
      refDate.setDate(refDate.getDate() + 1);
      const nextDayStr = refDate.toISOString().slice(0, 10);

      // Check if they have ANY appointments on the day immediately following the 24h guard shift
      const hasPostApp = appointmentsInPeriod.some(app => app.doctorId === shift.doctorId && app.date === nextDayStr);
      if (hasPostApp) {
        list.push({
          id: `postshift-violation-${shift.id}`,
          type: 'error',
          category: 'Posturno No Respetado',
          message: `Médico programado en jornada regular al día siguiente de realizar un turno de guardia de 24 horas (Infracción de descanso descanso posterior).`,
          doctorName: doc.name,
          dateStr: nextDayStr
        });
      }
    });

    // 9. Two-rule conflicts (e.g. 24h shift on same day as a manual blocking or same day as appointment)
    shiftsInPeriod.forEach((shift) => {
      const doc = docMap.get(shift.doctorId);
      if (!doc) return;

      const sameDayBlock = blockedDaysInPeriod.find(b => b.doctorId === shift.doctorId && b.date === shift.date);
      if (sameDayBlock) {
        list.push({
          id: `conflict-block-shift-${shift.id}`,
          type: 'error',
          category: 'Conflicto de Reglas Especiales',
          message: `Conflicto Crítico: Turno de Guardia 24h asignado en el mismo día que existe un bloqueo de agenda registrado (${sameDayBlock.reason}).`,
          doctorName: doc.name,
          dateStr: shift.date
        });
      }

      const sameDayApp = appointmentsInPeriod.find(app => app.doctorId === shift.doctorId && app.date === shift.date);
      if (sameDayApp) {
        list.push({
          id: `conflict-app-shift-${shift.id}`,
          type: 'error',
          category: 'Conflicto de Reglas Especiales',
          message: `Conflicto Crítico: Turno de Guardia 24h asignado el mismo día que una consulta regular ambulatoria. (La guardia de 24 horas debe excluir/reemplazar el itinerario ordinario).`,
          doctorName: doc.name,
          dateStr: shift.date
        });
      }
    });

    // 10. Multiple 24H guard shifts on the same day.
    const guardsByDate = new Map<string, Array<{ docId: string; docName: string }>>();
    shiftsInPeriod
      .filter(shift => shift.date.startsWith(selectedPeriod))
      .forEach((shift) => {
        const doc = docMap.get(shift.doctorId);
        if (!doc) return;
        if (!guardsByDate.has(shift.date)) guardsByDate.set(shift.date, []);
        guardsByDate.get(shift.date)!.push({ docId: shift.doctorId, docName: doc.name });
      });

    const collisionDates = Array.from(guardsByDate.entries()).filter(([, docList]) => docList.length > 1);
    if (collisionDates.length > 0) {
      const names = Array.from(
        new Set(collisionDates.flatMap(([, docList]) => docList.map(item => item.docName)))
      ).join(', ');
      list.push({
        id: `guard-collision-summary-${selectedPeriod}`,
        type: 'warning',
        category: 'Colision de Guardia de 24h',
        message: `Hay ${collisionDates.length} dia(s) del mes con mas de un profesional asignado a guardia 24h. Profesionales involucrados: ${names}. Revise solo si la cobertura debe ser de un medico por dia.`,
        doctorName: 'Multiple',
        dateStr: selectedPeriod
      });
    }

    // 11. Manual cycle offsets are allowed and no longer reported as warnings.

    return list;
  }, [doctors, appointments, blockedDays, shifts24h, selectedPeriod]);

  // Programa consultas en todos los días disponibles según el estado real registrado
  const handleAutoGenerateSchedules = () => {
    const generatedApps: Appointment[] = [];
    const generatedBlocks: BlockedDay[] = [];

    const [yearStr, monthStr] = selectedPeriod.split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const month = parseInt(monthStr, 10) || new Date().getMonth() + 1;
    const totalDays = new Date(year, month, 0).getDate();

    const parseLocalDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    };

    const fmt = (y: number, m: number, d: number) =>
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // Usar solo guardias realmente registradas — sin proyección
    const guardsMap = new Set(shifts24h.map(g => `${g.doctorId}-${g.date}`));
    const blocksMap = new Set(blockedDays.map(b => `${b.doctorId}-${b.date}-${b.shift}`));
    const existingAppKeys = new Set(appointments.map(a => `${a.doctorId}-${a.date}-${a.shift}`));

    doctors.filter(d => d.isActive).forEach((doc) => {
      for (let day = 1; day <= totalDays; day++) {
        const dateStr = fmt(year, month, day);
        const dayOfWeek = parseLocalDate(dateStr).getDay();

        // 1. Omitir fin de semana
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        // 2. Omitir feriado
        if (CHILEAN_HOLIDAYS_2026.includes(dateStr)) continue;

        // 3. Omitir si ya tiene consulta
        if (existingAppKeys.has(`${doc.id}-${dateStr}-${doc.defaultShift}`)) continue;

        // 4. Omitir si tiene bloqueo ese día
        if (
          blocksMap.has(`${doc.id}-${dateStr}-${doc.defaultShift}`) ||
          blocksMap.has(`${doc.id}-${dateStr}-Todo el día`)
        ) continue;

        // 5. Omitir si tiene guardia ese día
        if (guardsMap.has(`${doc.id}-${dateStr}`)) continue;

        // 6. Omitir si ayer tuvo guardia (post-turno de descanso)
        const yesterday = parseLocalDate(dateStr);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = fmt(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());
        if (guardsMap.has(`${doc.id}-${yesterdayStr}`)) continue;

        generatedApps.push({
          id: `auto-app-${doc.id}-${dateStr}`,
          doctorId: doc.id,
          date: dateStr,
          shift: doc.defaultShift,
          newAdmissions: 2,
          controls: 3,
          notes: `Generado automáticamente - Jornada ${doc.defaultShift}`,
          startTime: doc.defaultShift === 'Tarde' ? '14:00' : '09:00',
          include800: false,
          include830: false,
        });

        // Sala en mañana para médicos con morningSala activo
        if (doc.morningSala) {
          const alreadyHasMorningSala = blockedDays.some(
            b => b.doctorId === doc.id && b.date === dateStr && b.shift === 'Mañana' && b.reason === 'sala'
          );
          if (!alreadyHasMorningSala) {
            generatedBlocks.push({
              id: `auto-sala-${doc.id}-${dateStr}`,
              doctorId: doc.id,
              date: dateStr,
              shift: 'Mañana',
              reason: 'sala',
              notes: 'Sala generada automáticamente',
              startTime: '08:00',
              endTime: '14:00',
            });
          }
        }
      }
    });

    onAutoSchedule(generatedApps, shifts24h, generatedBlocks);
  };

  const errors = violations.filter(v => v.type === 'error');
  const warnings = violations.filter(v => v.type === 'warning');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden" id="validation-engine-panel">
      {/* Panel Header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-white rounded-xl">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              Validaciones y Motor de Programación (Ficha de Control)
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Análisis en tiempo real de reglas asistenciales, descansos y cupos</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAutoConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-650 hover:bg-blue-700 text-white text-[11px] font-extrabold rounded-lg shadow-xs cursor-pointer border border-blue-700/20 hover:scale-101 active:scale-95 transition-all select-none bg-blue-600"
            title="Auto-completa pacientes del mes libre de conflictos"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-100 animate-pulse" />
            <span>Auto-Programar Médico</span>
          </button>
          
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-bold rounded-lg cursor-pointer border border-rose-200 transition-all select-none"
            title="Limpiar todas las citas médicas programadas"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Limpiar Citas del Mes</span>
          </button>
        </div>
      </div>

      {/* Main Stats Summary in Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-indigo-100/50 bg-indigo-50/20 text-xs text-slate-705">
        <div className="p-4 border-r border-slate-100/80 flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[10px] ${errors.length > 0 ? 'bg-red-500 text-white animate-bounce' : 'bg-green-500 text-white'}`}>
            {errors.length > 0 ? '!' : '✓'}
          </div>
          <div>
            <span className="font-extrabold text-slate-800 block">Conflictos del Mes</span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              {errors.length === 0 ? 'Sin conflictos graves en el mes' : `${errors.length} conflicto(s) requiere(n) corrección`}
            </span>
          </div>
        </div>

        <div className="p-4 border-r border-slate-100/80 flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[10px] ${warnings.length > 0 ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-green-500 text-white'}`}>
            {warnings.length > 0 ? 'i' : '✓'}
          </div>
          <div>
            <span className="font-extrabold text-slate-800 block">Advertencias / Cupos</span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              {warnings.length === 0 ? 'Cupos del mes equilibrados' : `${warnings.length} advertencia(s) de distribución`}
            </span>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-emerald-50/30 to-teal-50/10 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <span className="font-extrabold text-emerald-850 block">Estado General de la Rotativa</span>
            <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block text-teal-800">
              {violations.length === 0 
                ? '¡Rotativa 100% limpia y lista para exportar! ✅' 
                : 'Pendiente de optimizar celdas pre-ajustadas'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Results / List of Violations */}
      <div className="p-5">
        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-150 select-none">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-3xs">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">¡Planificación Aprobada!</h3>
              <p className="text-[11px] font-medium text-slate-500">
                La rotativa actual pasa el 100% de los controles asistenciales. El descanso post-turno, cupos de 30 minutos, feriados y jornadas están perfectamente programados.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
            {violations.map((v) => {
              const isError = v.type === 'error';
              return (
                <div 
                  key={v.id} 
                  className={`p-3.5 rounded-xl border transition-all flex items-start gap-4 ${
                    isError 
                      ? 'bg-rose-50/70 border-rose-150 text-rose-800 hover:bg-rose-50' 
                      : 'bg-amber-50/70 border-amber-150 text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${isError ? 'text-red-600 animate-pulse' : 'text-amber-600'}`} />
                  
                  <div className="flex-grow space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isError ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {v.category}
                      </span>
                      <span className="font-mono text-[10.5px] font-bold opacity-80">
                        🗓️ {v.dateStr}
                      </span>
                    </div>
                    
                    <p className="text-xs leading-relaxed font-semibold">
                      {v.message}
                    </p>
                    
                    <div className="pt-0.5 text-[10px] font-black tracking-wide text-slate-600">
                      Médico afectado: <span className="underline decoration-slate-300 decoration-2">{v.doctorName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showAutoConfirm}
        onClose={() => setShowAutoConfirm(false)}
        onConfirm={handleAutoGenerateSchedules}
        title="Auto-Programar Rotativa Médica"
        message="Esta herramienta programará de manera inteligente toda la rotativa del período. Al procesar, el sistema detectará el primer turno de 24 horas que programó a cada médico en la agenda y le autoprogramará de forma recurrente una guardia de 24 horas cada seís (6) días continuos. Al mismo tiempo, completará el cupo de pacientes ambulatorios respetando feriados nacionales, descansos de descanso post-guardia de 24 horas, bloqueos e itinerarios de atención preferidos sin colisiones. ¿Desea proceder?"
        confirmText="Iniciar Auto-Programación"
        cancelText="Cancelar"
        type="info"
      />

      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={onClearAppointments}
        title="Limpiar citas del mes"
        message={`Se eliminaran ${appointmentsInSelectedPeriod.length} cita(s) del mes ${selectedPeriod}. Los bloqueos y guardias se mantendran. Los avisos asociados a esas citas se limpiaran automaticamente si corresponde.`}
        confirmText="Limpiar Citas del Mes"
        cancelText="Volver"
        type="danger"
      />
    </div>
  );
}
