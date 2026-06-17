/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Doctor, BlockedDay, BLOCK_REASONS, BlockReason } from '../types';
import { formatDateString, formatReadableDate } from '../utils';
import ConfirmModal from './ConfirmModal';
import { Calendar, AlertOctagon, Trash2, ShieldAlert, PlusCircle, Filter } from 'lucide-react';

interface BlockingsManagerProps {
  doctors: Doctor[];
  blockedDays: BlockedDay[];
  onAddBlock: (block: Omit<BlockedDay, 'id'>) => void;
  onDeleteBlock: (id: string) => void;
  defaultDate?: string;
  defaultDoctorId?: string;
  defaultShift?: 'Mañana' | 'Tarde' | 'Todo el día';
  defaultStartTime?: string;
  defaultEndTime?: string;
}

export default function BlockingsManager({
  doctors,
  blockedDays,
  onAddBlock,
  onDeleteBlock,
  defaultDate = '',
  defaultDoctorId = '',
  defaultShift = 'Todo el día',
  defaultStartTime,
  defaultEndTime,
}: BlockingsManagerProps) {
  const [showForm, setShowForm] = useState(defaultDate !== '' || defaultDoctorId !== '');
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState(defaultDoctorId || (doctors[0]?.id || ''));
  const [date, setDate] = useState(defaultDate || formatDateString(new Date()));
  const [shift, setShift] = useState<'Mañana' | 'Tarde' | 'Todo el día'>(defaultShift);
  const [reason, setReason] = useState<BlockReason>('UPC');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState(defaultStartTime || '08:00');
  const [endTime, setEndTime] = useState(defaultEndTime || '17:00');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Automatically update start and end times based on shift defaults
  React.useEffect(() => {
    if (shift === 'Mañana') {
      setStartTime('08:00');
      setEndTime('13:30');
    } else if (shift === 'Tarde') {
      setStartTime('14:00');
      setEndTime('17:00');
    } else if (shift === 'Todo el día') {
      setStartTime('08:00');
      setEndTime('17:00');
    }
  }, [shift]);

  // Filtering
  const [filterDocId, setFilterDocId] = useState('todos');

  // Trigger effect if defaults change (e.g. from calendar click shortcuts)
  React.useEffect(() => {
    if (defaultDoctorId) setSelectedDocId(defaultDoctorId);
    if (defaultDate) {
      setDate(defaultDate);
      setShowForm(true);
    }
    if (defaultShift) setShift(defaultShift);
    if (defaultStartTime) setStartTime(defaultStartTime);
    if (defaultEndTime) setEndTime(defaultEndTime);
  }, [defaultDoctorId, defaultDate, defaultShift, defaultStartTime, defaultEndTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedDocId) {
      setErrorMsg('Debe seleccionar un médico.');
      return;
    }

    if (!date) {
      setErrorMsg('Debe ingresar una fecha válida.');
      return;
    }

    // Check if weekend (6 is Sat, 0 is Sun in getDay)
    const d = new Date(date + 'T12:00:00'); // enforce noon to avoid local shifting
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setErrorMsg('No se pueden registrar bloqueos en fin de semana (Sábado o Domingo) ya que no hay atención regular.');
      return;
    }

    // Check if the block conflict already exists
    const exists = blockedDays.some(
      (b) =>
        b.doctorId === selectedDocId &&
        b.date === date &&
        (b.shift === 'Todo el día' || shift === 'Todo el día' || b.shift === shift)
    );

    if (exists) {
      setErrorMsg('Este médico ya posee un bloqueo o conflicto registrado para esta jornada y fecha.');
      return;
    }

    if (startTime && endTime && startTime >= endTime) {
      setErrorMsg('La hora de inicio seleccionada debe ser anterior a la hora de término.');
      return;
    }

    onAddBlock({
      doctorId: selectedDocId,
      date,
      shift,
      reason,
      customReason: reason === 'Otro' ? customReason : undefined,
      notes: notes.trim(),
      startTime,
      endTime,
    });

    setSuccessMsg('Bloqueo de agenda registrado exitosamente.');
    setNotes('');
    setCustomReason('');
    
    // Auto collapse form after 1.5 seconds of successful state
    setTimeout(() => {
      setSuccessMsg('');
      setShowForm(false);
    }, 1500);
  };

  const filteredBlocks = blockedDays.filter(
    (b) => filterDocId === 'todos' || b.doctorId === filterDocId
  );

  return (
    <div className="space-y-6" id="blocked-slots-manager">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="font-semibold text-slate-800 text-base">Bloqueos de Agenda y Contratiempos</h3>
          <p className="text-xs text-slate-500 mt-1">
            Suspenda temporalmente la programación de un médico para proteger su horario, reuniones, licencias o cursos.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm shrink-0"
          id="btn-toggle-add-block"
        >
          <PlusCircle className="w-4 h-4" />
          {showForm ? 'Ocultar Formulario' : 'Ingresar Contratiempo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm space-y-4">
          <div className="border-b border-rose-50 pb-3 flex items-center gap-2.5">
            <div className="p-1.5 bg-red-50 text-red-600 rounded">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-sm">Registrar Contratiempo / Bloqueo</h4>
              <p className="text-xs text-slate-500">Inhabilite un día o jornada específica de un médico en el sistema</p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-150 text-emerald-700 rounded-xl text-xs font-medium">
              {successMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Médico Afectado</label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-white"
                required
              >
                <option value="" disabled>Seleccione un médico</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialty} - Jornada: {d.defaultShift})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha del Suceso</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                required
              />
              <span className="text-[10px] text-slate-400 block mt-1">Lunes a viernes únicamente</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bloque / Jornada a Bloquear</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-white"
              >
                <option value="Todo el día">Todo el día (Mañana y Tarde)</option>
                <option value="Mañana">Mañana únicamente</option>
                <option value="Tarde">Tarde únicamente</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hora Inicio</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono font-bold text-slate-700 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hora Término</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono font-bold text-slate-700 bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo / Causa del Bloqueo</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as BlockReason)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all bg-white"
              >
                {BLOCK_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {reason === 'Otro' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Otro Motivo Específico</label>
                <input
                  type="text"
                  placeholder="Ej. Vacunatorio, Licencia médica por resfrío, etc."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                  required
                />
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notas Opcionales / Justificación</label>
              <textarea
                placeholder="Indique más detalles o el número de decreto/permiso aquí como respaldo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
            >
              Confirmar Bloqueo
            </button>
          </div>
        </form>
      )}

      {/* Block lists */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="block-list-container">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold">Filtrar por Médico:</span>
            <select
              value={filterDocId}
              onChange={(e) => setFilterDocId(e.target.value)}
              className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="todos">Todos los médicos</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {filteredBlocks.length} bloqueo(s) registrado(s)
          </span>
        </div>

        {filteredBlocks.length === 0 ? (
          <div className="text-center py-12" id="no-blocks-state">
            <div className="inline-flex p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500 font-medium">No se registran bloqueos de agenda</p>
            <p className="text-xs text-slate-400 mt-1">Los médicos seleccionados están completamente disponibles</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs" id="table-blocked-slots">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-100">
                  <th className="py-3 px-4">Médico</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Bloque de Horario</th>
                  <th className="py-3 px-4">Causa / Motivo</th>
                  <th className="py-3 px-4">Comentarios de Respaldo</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredBlocks.map((b) => {
                  const doc = doctors.find((d) => d.id === b.doctorId);
                  const displayReason = b.reason === 'Otro' ? b.customReason || 'Otro' : b.reason;
                  
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors" id={`row-block-${b.id}`}>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {doc ? doc.name : 'Médico Desconocido'}
                        <span className="block text-[10px] text-slate-400 font-normal">{doc?.specialty}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-600 block">{b.date}</span>
                        <span className="text-[10px] text-slate-400">{formatReadableDate(b.date)}</span>
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            b.shift === 'Todo el día' 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : b.shift === 'Mañana' 
                                ? 'bg-sky-50 text-sky-700 border border-sky-100' 
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {b.shift}
                          </span>
                          {b.startTime && b.endTime && (
                            <span className="text-[10px] text-slate-500 font-bold font-mono py-0.5 px-1 bg-slate-100/80 rounded border border-slate-200/50 flex items-center gap-1">
                              ⏰ {b.startTime} - {b.endTime}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-mono font-semibold">
                          {displayReason}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-[200px] truncate" title={b.notes}>
                        {b.notes || <span className="text-slate-300 italic">Sin comentarios</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setBlockToDelete(b.id)}
                          className="p-1 px-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-red-100 transition-colors inline-flex items-center gap-1.5"
                          id={`btn-del-block-${b.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Habilitar</span>
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
        isOpen={blockToDelete !== null}
        onClose={() => setBlockToDelete(null)}
        onConfirm={() => {
          if (blockToDelete) {
            onDeleteBlock(blockToDelete);
          }
        }}
        title="Habilitar agenda médica (Desbloquear)"
        message="¿Está seguro de que desea eliminar este bloqueo y habilitar nuevamente la agenda de atención regular para este médico?"
        confirmText="Habilitar Agenda"
        cancelText="Volver"
        type="info"
      />
    </div>
  );
}
