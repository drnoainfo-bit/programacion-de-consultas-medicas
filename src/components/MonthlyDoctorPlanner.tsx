import React, { useMemo, useState } from 'react';
import { Ban, CalendarDays, Edit3, Moon, Stethoscope } from 'lucide-react';
import { Appointment, BlockedDay, Doctor, Shift24h } from '../types';

type PlannerMode = 'appointment' | 'block' | 'guard' | 'edit';

interface MonthlyDoctorPlannerProps {
  doctors: Doctor[];
  appointments: (Appointment & { status?: string })[];
  blockedDays: BlockedDay[];
  shifts24h: Shift24h[];
  selectedPeriod: string;
  onAddAppointment: (app: Omit<Appointment, 'id'>) => void;
  onAddBlock: (block: Omit<BlockedDay, 'id'>) => void;
  onDeleteAppointment: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onToggleShift24h: (doctorId: string, date: string) => void;
  onEditAppointment: (doctorId: string, date: string, shift: any) => void;
  onEditBlock: (doctorId: string, date: string, shift: any) => void;
}

const modes: Array<{ value: PlannerMode; label: string; icon: React.ElementType }> = [
  { value: 'appointment', label: 'Consulta', icon: Stethoscope },
  { value: 'block', label: 'Bloquear', icon: Ban },
  { value: 'guard', label: 'Guardia 24h', icon: Moon },
  { value: 'edit', label: 'Editar', icon: Edit3 },
];

function parsePeriod(period: string) {
  const [yearRaw, monthRaw] = period.split('-').map(Number);
  const now = new Date();
  return {
    year: Number.isFinite(yearRaw) ? yearRaw : now.getFullYear(),
    month: Number.isFinite(monthRaw) ? monthRaw : now.getMonth() + 1,
  };
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MonthlyDoctorPlanner({
  doctors,
  appointments,
  blockedDays,
  shifts24h,
  selectedPeriod,
  onAddAppointment,
  onAddBlock,
  onDeleteAppointment,
  onDeleteBlock,
  onToggleShift24h,
  onEditAppointment,
  onEditBlock,
}: MonthlyDoctorPlannerProps) {
  const activeDoctors = doctors.filter((doctor) => doctor.isActive);
  const [selectedDoctorId, setSelectedDoctorId] = useState(activeDoctors[0]?.id || doctors[0]?.id || '');
  const [mode, setMode] = useState<PlannerMode>('appointment');
  const [message, setMessage] = useState('');
  const fullDayShift = 'Todo el día' as BlockedDay['shift'];

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId) || activeDoctors[0] || doctors[0];
  const { year, month } = parsePeriod(selectedPeriod);

  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const leadingDays = firstDay === 0 ? 6 : firstDay - 1;
    return [
      ...Array.from({ length: leadingDays }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [year, month]);

  const doctorAppointments = appointments.filter((item) => item.doctorId === selectedDoctor?.id);
  const doctorBlocks = blockedDays.filter((item) => item.doctorId === selectedDoctor?.id);
  const doctorGuards = shifts24h.filter((item) => item.doctorId === selectedDoctor?.id);

  const handleDayClick = (day: number) => {
    if (!selectedDoctor) return;

    const date = formatDate(year, month, day);
    const shift = selectedDoctor.defaultShift;
    const existingAppointment = doctorAppointments.find((item) => item.date === date && item.shift === shift);
    const existingBlock = doctorBlocks.find((item) => item.date === date && (item.shift === shift || item.shift === fullDayShift));
    const hasAppointment = Boolean(existingAppointment);
    const hasBlock = Boolean(existingBlock);
    const hasGuard = doctorGuards.some((item) => item.date === date);

    if (mode === 'appointment') {
      if (existingAppointment) {
        onDeleteAppointment(existingAppointment.id);
        setMessage(`Consulta desactivada para ${date}.`);
        return;
      }
      if (hasBlock || hasGuard) {
        setMessage('Ese dia esta bloqueado o con guardia. No se agrego consulta.');
        return;
      }

      onAddAppointment({
        doctorId: selectedDoctor.id,
        date,
        shift,
        newAdmissions: 2,
        controls: 4,
        notes: 'Programado desde vista mensual',
        startTime: shift === 'Tarde' ? '14:00' : '09:00',
        include800: false,
        include830: false,
      });
      setMessage(`Consulta agregada para ${date}: 2 ingresos y 4 controles.`);
      return;
    }

    if (mode === 'block') {
      if (existingBlock) {
        onDeleteBlock(existingBlock.id);
        setMessage(`Bloqueo desactivado para ${date}.`);
        return;
      }
      onAddBlock({
        doctorId: selectedDoctor.id,
        date,
        shift: fullDayShift,
        reason: 'Otro',
        customReason: 'Bloqueo manual desde vista mensual',
        notes: 'Marcado con clic en calendario mensual',
        startTime: '08:00',
        endTime: '17:00',
      });
      setMessage(`Dia bloqueado para ${selectedDoctor.name}: ${date}.`);
      return;
    }

    if (mode === 'guard') {
      onToggleShift24h(selectedDoctor.id, date);
      setMessage(`${hasGuard ? 'Guardia retirada' : 'Guardia 24h activada'} para ${date}.`);
      return;
    }

    const editableAppointment = doctorAppointments.find((item) => item.date === date && item.shift === shift);
    if (editableAppointment) {
      onEditAppointment(selectedDoctor.id, date, shift);
      setMessage(`Abriendo edicion de consulta para ${date}.`);
      return;
    }

    const editableBlock = doctorBlocks.find((item) => item.date === date);
    if (editableBlock) {
      onEditBlock(selectedDoctor.id, date, shift);
      setMessage(`Abriendo bloqueo para ${date}.`);
      return;
    }

    setMessage('No hay consulta ni bloqueo para editar en ese dia.');
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden" id="monthly-doctor-planner">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Vista mensual rapida por medico</h2>
            <p className="text-[11px] text-slate-500">Elige un modo y marca dias sin recorrer la agenda semanal.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedDoctor?.id || ''}
            onChange={(event) => setSelectedDoctorId(event.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold text-slate-700"
          >
            {activeDoctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} - {doctor.defaultShift}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {modes.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                    mode === option.value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                  }`}
                  title={option.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wide text-slate-400">
          {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => (
            <div key={day} className="py-1">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square rounded-lg bg-slate-50/50" />;
            }

            const date = formatDate(year, month, day);
            const dayDate = new Date(year, month - 1, day, 12, 0, 0);
            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
            const appointment = doctorAppointments.find((item) => item.date === date);
            const block = doctorBlocks.find((item) => item.date === date);
            const guard = doctorGuards.find((item) => item.date === date);

            let statusClass = 'bg-white border-slate-200 hover:border-blue-400';
            if (appointment) statusClass = 'bg-blue-50 border-blue-200 text-blue-950';
            if (block) statusClass = 'bg-rose-50 border-rose-200 text-rose-950';
            if (guard) statusClass = 'bg-indigo-50 border-indigo-200 text-indigo-950';
            if (isWeekend && !guard) statusClass = 'bg-slate-50 border-slate-200 text-slate-400';

            return (
              <button
                key={date}
                type="button"
                onClick={() => handleDayClick(day)}
                className={`aspect-square min-h-[64px] rounded-lg border p-1.5 text-left transition-all ${statusClass}`}
                title={`${date} - ${selectedDoctor?.name || ''}`}
              >
                <span className="text-xs font-black font-mono">{day}</span>
                <div className="mt-1 space-y-0.5 text-[8.5px] font-bold leading-tight">
                  {guard && <div className="text-indigo-700">Guardia</div>}
                  {block && <div className="text-rose-700">Bloqueado</div>}
                  {appointment && <div className="text-blue-700">{appointment.newAdmissions}+{appointment.controls}</div>}
                  {!guard && !block && !appointment && !isWeekend && <div className="text-emerald-700">Libre</div>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap gap-2 font-bold">
            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100">Consulta</span>
            <span className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-100">Bloqueado</span>
            <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">Guardia</span>
          </div>
          {message && <span className="text-slate-600 font-semibold">{message}</span>}
        </div>
      </div>
    </section>
  );
}
