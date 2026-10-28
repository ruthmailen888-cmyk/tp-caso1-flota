import { useState } from 'react';
import { supabase } from '../supabase';
import { Badge, Campo, Card, Table, useAccion, useData } from '../ui';

export function Mantenimientos() {
  const m = useData(() => supabase.from('mantenimiento').select('*').order('fecha', { ascending: false }));
  const veh = useData(() => supabase.from('vehiculo').select('patente,estado').order('patente'));
  const mec = useData(() => supabase.from('mecanico').select('legajo,nombre').order('legajo'));
  const accion = useAccion(() => { m.recargar(); veh.recargar(); });
  const [f, setF] = useState({ patente: '', legajo: '', tipo: 'correctivo', descripcion: '' });
  return (
    <>
      <Card titulo="Abrir mantenimiento">
        <div className="row">
          <Campo label="Vehículo">
            <select value={f.patente} onChange={(e) => setF({ ...f, patente: e.target.value })}>
              <option value="">Elegir…</option>
              {veh.data?.map((x) => <option key={x.patente} value={x.patente}>{x.patente} · {x.estado.replace(/_/g, ' ')}</option>)}
            </select>
          </Campo>
          <Campo label="Mecánico">
            <select value={f.legajo} onChange={(e) => setF({ ...f, legajo: e.target.value })}>
              <option value="">Elegir…</option>
              {mec.data?.map((x) => <option key={x.legajo} value={x.legajo}>{x.legajo} · {x.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Tipo">
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              <option value="correctivo">Correctivo (falla)</option>
              <option value="preventivo">Preventivo</option>
            </select>
          </Campo>
          <Campo label="Descripción"><input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Campo>
          <button className="btn" disabled={!f.patente || !f.legajo || !f.descripcion} onClick={async () => {
            if (await accion(supabase.rpc('abrir_mantenimiento', { p_patente: f.patente, p_legajo: f.legajo, p_tipo: f.tipo, p_descripcion: f.descripcion }), 'Mantenimiento abierto')) setF({ ...f, descripcion: '' });
          }}>Abrir</button>
        </div>
      </Card>
      <Card titulo="Mantenimientos">
        <Table
          rows={m.data}
          cols={[
            { key: 'patente', label: 'Vehículo' },
            { key: 'tipo', label: 'Tipo', render: (r) => <span>{r.tipo}</span> },
            { key: 'descripcion', label: 'Descripción' },
            { key: 'legajo_mecanico', label: 'Mecánico' },
            { key: 'fecha', label: 'Fecha' },
            { key: 'km_vehiculo', label: 'Km' },
            { key: 'estado', label: 'Estado', render: (r) => <Badge v={r.fecha_cierre ? 'cerrada' : 'abierta'} /> },
            { key: 'acc', label: '', render: (r) => (!r.fecha_cierre ? <button className="btn small" onClick={() => accion(supabase.rpc('cerrar_mantenimiento', { p_mant: r.id_mant }), 'Mantenimiento cerrado')}>Cerrar</button> : null) },
          ]}
        />
      </Card>
    </>
  );
}

export function Preventivos() {
  const pend = useData(() => supabase.from('v_preventivos_pendientes').select('*'));
  const planes = useData(() => supabase.from('plan_preventivo').select('*,vehiculo(km_actual)').order('patente'));
  const veh = useData(() => supabase.from('vehiculo').select('patente').order('patente'));
  const mec = useData(() => supabase.from('mecanico').select('legajo,nombre').order('legajo'));
  const accion = useAccion(() => { pend.recargar(); planes.recargar(); });
  const [mecanico, setMecanico] = useState('');
  const [f, setF] = useState({ patente: '', descripcion: '', cada_km: '' });
  return (
    <>
      <Card titulo="Preventivos pendientes por kilometraje">
        <div className="row" style={{ marginBottom: 12 }}>
          <Campo label="Mecánico asignado">
            <select value={mecanico} onChange={(e) => setMecanico(e.target.value)}>
              <option value="">Elegir…</option>
              {mec.data?.map((x) => <option key={x.legajo} value={x.legajo}>{x.legajo} · {x.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <Table
          rows={pend.data}
          vacio="No hay preventivos pendientes"
          cols={[
            { key: 'patente', label: 'Vehículo' },
            { key: 'descripcion', label: 'Plan' },
            { key: 'km_actual', label: 'Km actual' },
            { key: 'km_desde_ultimo', label: 'Km desde el último' },
            { key: 'km_excedidos', label: 'Km excedidos' },
            { key: 'acc', label: '', render: (r) => <button className="btn small" disabled={!mecanico} onClick={() => accion(supabase.rpc('abrir_mantenimiento_preventivo', { p_plan: r.id_plan, p_legajo: mecanico }), 'Preventivo abierto')}>Abrir preventivo</button> },
          ]}
        />
      </Card>
      <Card titulo="Planes de mantenimiento">
        <div className="row" style={{ marginBottom: 12 }}>
          <Campo label="Vehículo">
            <select value={f.patente} onChange={(e) => setF({ ...f, patente: e.target.value })}>
              <option value="">Elegir…</option>
              {veh.data?.map((x) => <option key={x.patente}>{x.patente}</option>)}
            </select>
          </Campo>
          <Campo label="Descripción"><input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Campo>
          <Campo label="Cada (km)"><input type="number" min="1" value={f.cada_km} onChange={(e) => setF({ ...f, cada_km: e.target.value })} /></Campo>
          <button className="btn" disabled={!f.patente || !f.descripcion || !f.cada_km} onClick={async () => {
            if (await accion(supabase.from('plan_preventivo').insert({ patente: f.patente, descripcion: f.descripcion, cada_km: Number(f.cada_km) }), 'Plan creado')) setF({ patente: '', descripcion: '', cada_km: '' });
          }}>Crear plan</button>
        </div>
        <Table
          rows={planes.data}
          cols={[
            { key: 'patente', label: 'Vehículo' },
            { key: 'descripcion', label: 'Plan' },
            { key: 'cada_km', label: 'Cada (km)' },
            { key: 'ultimo_km', label: 'Último (km)' },
            { key: 'km', label: 'Km actual', render: (r) => r.vehiculo?.km_actual },
          ]}
        />
      </Card>
    </>
  );
}
