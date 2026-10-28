import { useState } from 'react';
import { supabase } from '../supabase';
import { Badge, Campo, Card, Table, useAccion, useData } from '../ui';

const hoy = () => new Date().toISOString().slice(0, 10);

export function Maestros() {
  const docs = useData(() => supabase.from('documentacion').select('*').order('vencimiento'));
  const choferes = useData(() => supabase.from('chofer').select('*').order('venc_licencia'));
  const veh = useData(() => supabase.from('vehiculo').select('patente').order('patente'));
  const areas = useData(() => supabase.from('area').select('*').order('codigo'));
  const accion = useAccion(() => { docs.recargar(); veh.recargar(); });
  const [d, setD] = useState({ patente: '', tipo: 'seguro', vencimiento: '' });
  const [v, setV] = useState({ patente: '', marca: '', modelo: '', tipo: 'camioneta', codigo_area: '' });
  const sit = (f: string) => (f < hoy() ? 'vencido' : 'vigente');
  return (
    <>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <Card titulo="Alta de vehículo">
            <div className="row">
              <Campo label="Patente"><input value={v.patente} onChange={(e) => setV({ ...v, patente: e.target.value.toUpperCase() })} /></Campo>
              <Campo label="Marca"><input value={v.marca} onChange={(e) => setV({ ...v, marca: e.target.value })} /></Campo>
              <Campo label="Modelo"><input value={v.modelo} onChange={(e) => setV({ ...v, modelo: e.target.value })} /></Campo>
              <Campo label="Tipo"><select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}><option>camioneta</option><option>camion</option><option>bus</option></select></Campo>
              <Campo label="Área"><select value={v.codigo_area} onChange={(e) => setV({ ...v, codigo_area: e.target.value })}><option value="">Elegir…</option>{areas.data?.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}</select></Campo>
              <button className="btn" disabled={!v.patente || !v.marca || !v.modelo || !v.codigo_area} onClick={async () => {
                if (await accion(supabase.from('vehiculo').insert(v), 'Vehículo creado')) setV({ patente: '', marca: '', modelo: '', tipo: 'camioneta', codigo_area: '' });
              }}>Crear</button>
            </div>
          </Card>
        </div>
        <div style={{ flex: 1, minWidth: 320 }}>
          <Card titulo="Cargar o renovar documentación">
            <div className="row">
              <Campo label="Vehículo"><select value={d.patente} onChange={(e) => setD({ ...d, patente: e.target.value })}><option value="">Elegir…</option>{veh.data?.map((x) => <option key={x.patente}>{x.patente}</option>)}</select></Campo>
              <Campo label="Tipo"><select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}><option value="seguro">Seguro</option><option value="vtv">VTV</option><option value="habilitacion_altura">Habilitación de altura</option></select></Campo>
              <Campo label="Vencimiento"><input type="date" value={d.vencimiento} onChange={(e) => setD({ ...d, vencimiento: e.target.value })} /></Campo>
              <button className="btn" disabled={!d.patente || !d.vencimiento} onClick={async () => {
                if (await accion(supabase.from('documentacion').upsert(d, { onConflict: 'patente,tipo' }), 'Documentación guardada')) setD({ patente: '', tipo: 'seguro', vencimiento: '' });
              }}>Guardar</button>
            </div>
          </Card>
        </div>
      </div>
      <Card titulo="Documentación de los vehículos">
        <Table
          rows={docs.data}
          cols={[
            { key: 'patente', label: 'Vehículo' },
            { key: 'tipo', label: 'Documento', render: (r) => String(r.tipo).replace(/_/g, ' ') },
            { key: 'vencimiento', label: 'Vence' },
            { key: 'sit', label: 'Situación', render: (r) => <Badge v={sit(r.vencimiento)} /> },
          ]}
        />
      </Card>
      <Card titulo="Choferes">
        <Table
          rows={choferes.data}
          cols={[
            { key: 'legajo', label: 'Legajo' },
            { key: 'nombre', label: 'Nombre' },
            { key: 'licencia', label: 'Licencia' },
            { key: 'venc_licencia', label: 'Vence' },
            { key: 'sit', label: 'Situación', render: (r) => <Badge v={sit(r.venc_licencia)} /> },
          ]}
        />
      </Card>
    </>
  );
}
