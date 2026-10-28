import { useState } from 'react';
import { supabase } from '../supabase';
import { Badge, Campo, Card, Table, useAccion, useData } from '../ui';

export function Tablero() {
  const ind = useData(() => supabase.from('v_indicadores_vehiculo').select('*').order('patente'));
  const alertas = useData(() => supabase.from('alerta_vencimiento').select('id_alerta').eq('estado', 'pendiente'));
  const prev = useData(() => supabase.from('v_preventivos_pendientes').select('id_plan'));
  const repu = useData(() => supabase.from('v_reposicion').select('codigo'));
  const enCurso = useData(() => supabase.from('salida').select('id_salida').eq('estado', 'en_curso'));
  const v = ind.data ?? [];
  const n = (estado: string) => v.filter((x) => x.estado === estado).length;
  return (
    <>
      <div className="stats">
        <div className="stat"><b>{n('operativo')}</b><span>Vehículos operativos</span></div>
        <div className="stat"><b>{n('en_mantenimiento')}</b><span>En mantenimiento</span></div>
        <div className="stat"><b>{n('fuera_de_servicio')}</b><span>Fuera de servicio</span></div>
        <div className="stat"><b>{enCurso.data?.length ?? '–'}</b><span>Salidas en curso</span></div>
        <div className="stat"><b>{alertas.data?.length ?? '–'}</b><span>Alertas pendientes</span></div>
        <div className="stat"><b>{prev.data?.length ?? '–'}</b><span>Preventivos pendientes</span></div>
        <div className="stat"><b>{repu.data?.length ?? '–'}</b><span>Repuestos bajo el mínimo</span></div>
      </div>
      <Card titulo="Indicadores por vehículo">
        <Table
          rows={ind.data}
          cols={[
            { key: 'patente', label: 'Patente' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'estado', label: 'Estado', render: (r) => <Badge v={r.estado} /> },
            { key: 'km_actual', label: 'Km actual' },
            { key: 'salidas_finalizadas', label: 'Salidas finalizadas' },
            { key: 'salidas_bloqueadas', label: 'Salidas bloqueadas' },
            { key: 'preventivos', label: 'Preventivos' },
            { key: 'correctivos', label: 'Correctivos' },
          ]}
        />
      </Card>
    </>
  );
}

export function Salidas() {
  const salidas = useData(() => supabase.from('salida').select('*').order('estado'));
  const vehiculos = useData(() => supabase.from('vehiculo').select('patente,tipo,estado').order('patente'));
  const choferes = useData(() => supabase.from('chofer').select('legajo,nombre').order('legajo'));
  const [f, setF] = useState({ patente: '', legajo: '', origen: '', destino: '' });
  const accion = useAccion(salidas.recargar);
  const ok = f.patente && f.legajo && f.origen && f.destino;
  return (
    <>
      <Card titulo="Solicitar salida">
        <div className="row">
          <Campo label="Vehículo">
            <select value={f.patente} onChange={(e) => setF({ ...f, patente: e.target.value })}>
              <option value="">Elegir…</option>
              {vehiculos.data?.map((x) => <option key={x.patente} value={x.patente}>{x.patente} · {x.tipo} · {x.estado.replace(/_/g, ' ')}</option>)}
            </select>
          </Campo>
          <Campo label="Chofer">
            <select value={f.legajo} onChange={(e) => setF({ ...f, legajo: e.target.value })}>
              <option value="">Elegir…</option>
              {choferes.data?.map((x) => <option key={x.legajo} value={x.legajo}>{x.legajo} · {x.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Origen"><input value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value })} /></Campo>
          <Campo label="Destino"><input value={f.destino} onChange={(e) => setF({ ...f, destino: e.target.value })} /></Campo>
          <button className="btn" disabled={!ok} onClick={async () => {
            if (await accion(supabase.rpc('solicitar_salida', { p_patente: f.patente, p_legajo: f.legajo, p_origen: f.origen, p_destino: f.destino }), 'Salida solicitada')) setF({ patente: '', legajo: '', origen: '', destino: '' });
          }}>Solicitar</button>
        </div>
      </Card>
      <Card titulo="Salidas">
        <Table
          rows={salidas.data}
          cols={[
            { key: 'patente', label: 'Vehículo' },
            { key: 'legajo_chofer', label: 'Chofer' },
            { key: 'estado', label: 'Estado', render: (r) => <Badge v={r.estado} /> },
            { key: 'origen', label: 'Origen' },
            { key: 'destino', label: 'Destino' },
            { key: 'hora_salida', label: 'Salida', render: (r) => (r.hora_salida ? new Date(r.hora_salida).toLocaleString('es-AR') : '') },
            { key: 'kilometraje', label: 'Km' },
          ]}
        />
      </Card>
    </>
  );
}

export function Vehiculos() {
  const v = useData(() => supabase.from('vehiculo').select('patente,marca,modelo,tipo,estado,km_actual,area(nombre)').order('patente'));
  return (
    <Card titulo="Vehículos">
      <Table
        rows={v.data}
        cols={[
          { key: 'patente', label: 'Patente' },
          { key: 'marca', label: 'Marca' },
          { key: 'modelo', label: 'Modelo' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'area', label: 'Área', render: (r) => r.area?.nombre },
          { key: 'estado', label: 'Estado', render: (r) => <Badge v={r.estado} /> },
          { key: 'km_actual', label: 'Km actual' },
        ]}
      />
    </Card>
  );
}

export function Alertas() {
  const a = useData(() => supabase.from('alerta_vencimiento').select('*,documentacion(patente,tipo),chofer(legajo,nombre)').order('vencimiento'));
  const accion = useAccion(a.recargar);
  const dias = (f: string) => Math.round((new Date(f + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  return (
    <Card titulo="Alertas de vencimiento">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => accion(supabase.rpc('generar_alertas', { p_dias: 30 }), 'Alertas generadas')}>Generar alertas (30 días)</button>
      </div>
      <Table
        rows={a.data}
        cols={[
          { key: 'origen', label: 'Origen', render: (r) => (r.documentacion ? `${r.documentacion.patente} · ${String(r.documentacion.tipo).replace(/_/g, ' ')}` : `Licencia ${r.chofer?.legajo} · ${r.chofer?.nombre}`) },
          { key: 'vencimiento', label: 'Vence' },
          { key: 'dias', label: 'Situación', render: (r) => { const d = dias(r.vencimiento); return <Badge v={d < 0 ? 'vencido' : 'proximo'} />; } },
          { key: 'estado', label: 'Estado', render: (r) => <Badge v={r.estado} /> },
          { key: 'acc', label: '', render: (r) => (r.estado === 'pendiente' ? <button className="btn small" onClick={() => accion(supabase.rpc('atender_alerta', { p_alerta: r.id_alerta, p_quien: 'Supervisor de flota' }), 'Alerta atendida')}>Marcar atendida</button> : null) },
        ]}
      />
    </Card>
  );
}
