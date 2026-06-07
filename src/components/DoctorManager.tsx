/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Doctor, Shift } from '../types';
import ConfirmModal from './ConfirmModal';
import { UserPlus, Trash2, Edit2, ShieldAlert, CheckCircle2, User, HelpCircle } from 'lucide-react';

interface DoctorManagerProps {
  doctors: Doctor[];
  onAddDoctor: (doc: Omit<Doctor, 'id'>) => void;
  onUpdateDoctor: (id: string, updated: Partial<Doctor>) => void;
  onDeleteDoctor: (id: string) => void;
}

export default function DoctorManager({
  doctors,
  onAddDoctor,
  onUpdateDoctor,
  onDeleteDoctor,
}: DoctorManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Doctor | null>(null);
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [defaultShift, setDefaultShift] = useState<Shift>('Mañana');
  const [errorMsg, setErrorMsg] = useState('');

  const afternoonCount = doctors.filter(d => d.defaultShift === 'Tarde').length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErrorMsg('El nombre es requerido.');
    if (!specialty.trim()) return setErrorMsg('La especialidad es requerida.');

    onAddDoctor({
      name: name.trim(),
      rut: rut.trim() || undefined,
      specialty: specialty.trim(),
      defaultShift,
      isActive: true,
      sheetName: name.trim().split(' ').pop()?.toUpperCase() || 'DOCTOR'
    });

    // Reset Form
    setName('');
    setRut('');
    setSpecialty('');
    setDefaultShift('Mañana');
    setErrorMsg('');
    setShowAddForm(false);
  };

  // Helper autofill for Chilean RUT formatting (basic)
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9kK]/g, '');
    if (value.length > 1) {
      const dv = value.slice(-1);
      const rest = value.slice(0, -1);
      // add formatting points to numbers (simplified Chilean RUT helper)
      setRut(rest + '-' + dv);
    } else {
      setRut(value);
    }
  };

  return (
    <div className="space-y-6" id="doctor-manager-container">
      {/* Informative Guidance Banner */}
      <div className="bg-blue-50 border border-blue-250 rounded-xl p-4 flex items-start gap-4">
        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg mt-0.5 shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-semibold text-blue-950 text-sm">Distribución Reglamentada de Turnos</h4>
          <p className="text-xs text-blue-900 mt-1 leading-relaxed">
            La directiva establece que <strong>dos médicos siempre atienden en la Tarde</strong>, mientras que 
            el resto del equipo atiende en jornada de la <strong>Mañana</strong> de lunes a viernes. El sistema actual registra{' '}
            <strong className="text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">{afternoonCount} médicos en la Tarde</strong>.
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-fades">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm leading-none">Directorio de Médicos</h3>
          <p className="text-xs text-slate-500 mt-1.5">Configure los profesionales del policlínico, su especialidad y su jornada principal de atención</p>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer shadow-sm transition-all"
          id="btn-toggle-add-doctor"
        >
          <UserPlus className="w-4 h-4" />
          {showAddForm ? 'Cancelar' : 'Registrar Médico'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 transition-all">
          <div className="border-b border-slate-100 pb-3">
            <h4 className="font-semibold text-slate-800 text-sm">Ingresar Nuevo Profesional</h4>
            <p className="text-xs text-slate-500">Registre los datos para integrarlo al calendario de asignaciones</p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
              <input
                type="text"
                placeholder="Ej. Dr. Andrés Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">RUN / RUT (Identificación)</label>
              <input
                type="text"
                placeholder="Ej: 19488334-K"
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Especialidad Clínica *</label>
              <input
                type="text"
                placeholder="Ej: Pediatría, Dermatología"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jornada Asignada (Atención Fija)</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setDefaultShift('Mañana')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    defaultShift === 'Mañana'
                      ? 'bg-blue-50 border-blue-450 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Mañana (Lunes-Viernes)
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultShift('Tarde')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    defaultShift === 'Tarde'
                      ? 'bg-amber-50 border-amber-450 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Tarde (Lunes-Viernes)
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Nota: Dos médicos se configurarán en la Tarde por reglamento; el resto atenderán en la Mañana.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-lg transition-all"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
            >
              Guardar Médico
            </button>
          </div>
        </form>
      )}

      {/* Grid of Doctor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="doctors-grid">
        {doctors.map((doc) => {
          return (
            <div
              key={doc.id}
              className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4 relative overflow-hidden transition-all hover:shadow ${
                !doc.isActive ? 'opacity-60 bg-slate-50/50' : ''
              }`}
            >
              {/* Shift color marker */}
              <div 
                className={`absolute top-0 left-0 right-0 h-1 ${
                  doc.defaultShift === 'Tarde' ? 'bg-amber-500' : 'bg-blue-500'
                }`}
              />

              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className={`p-2.5 rounded-lg ${doc.defaultShift === 'Tarde' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-750 border border-blue-200'}`}>
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm leading-tight">{doc.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{doc.specialty}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onUpdateDoctor(doc.id, { isActive: !doc.isActive })}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase transition-colors ${
                      doc.isActive 
                        ? 'bg-blue-50 text-blue-700 border border-blue-250 hover:bg-blue-100' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {doc.isActive ? 'Activo' : 'Pausado'}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500">
                <div className="flex justify-between">
                  <span>RUT:</span>
                  <span className="font-mono text-slate-700 font-semibold">{doc.rut || 'No especificado'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Jornada Principal:</span>
                  <span className={`font-semibold ${doc.defaultShift === 'Tarde' ? 'text-amber-700' : 'text-blue-700'}`}>
                    {doc.defaultShift === 'Tarde' ? 'Tarde (L-V)' : 'Mañana (L-V)'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    const nextShift = doc.defaultShift === 'Mañana' ? 'Tarde' : 'Mañana';
                    onUpdateDoctor(doc.id, { defaultShift: nextShift });
                  }}
                  className="px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
                >
                  Cambiar Jornada
                </button>
                
                {doctors.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setDocToDelete(doc)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                    title="Eliminar médico"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        isOpen={docToDelete !== null}
        onClose={() => setDocToDelete(null)}
        onConfirm={() => {
          if (docToDelete) {
            onDeleteDoctor(docToDelete.id);
          }
        }}
        title="Desvincular profesional médico"
        message={`¿Está seguro de que desea eliminar a ${docToDelete?.name}? Se perderán todas sus asociaciones de cupos y bloqueos cargados en la rotativa actual de forma permanente.`}
        confirmText="Eliminar Médico"
        cancelText="Volver"
        type="danger"
      />
    </div>
  );
}
