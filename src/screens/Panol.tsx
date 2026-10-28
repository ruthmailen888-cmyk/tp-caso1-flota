import { useState } from 'react';
import { supabase } from '../supabase';
import { Badge, Campo, Card, Table, useAccion, useData } from '../ui';

export function Repuestos() {
  const rep = useData(() => supabase.from('repuesto').select('*').order('codigo'));
  const bajo = useData(() => supabase.from('v_reposicion').select('codigo,faltante'));
  const abiertos = useData(() => supabase.from('mantenimiento').select('id_mant,patente,descripcion').is('fecha_cierre', null));
  const mov = useData(() => supabase.from('movimiento_stock').select('*').order('fecha_hora', { ascending: false }).limit(12));
  const recargar = () => { rep.recargar(); bajo.recargar(); mov.recargar(); };
  const accion = useAccion(recargar);
  const [ing, setIng] = useState({ codigo: '', cantidad: '', motivo: '' });
  const [uso, setUso] = useState({ mant: '', codigo: '', cantidad: '' });
  const faltante = (c: string) => bajo.data?.find((b) => b.codigo === c)?.faltante;
  const opciones = rep.data?.map((x) => <option key={x.codigo} value={x.codigo}>{x.codigo} · {x.descripcion}</option>);
  return (
    <>
      <Card titulo="Stock del pañol">
        <Table
          rows={rep.data}
          cols={[
            { key: 'codigo', label: 'Código' },
            { key: 'descripcion', label: 'Descripción' },
            { key: 'stock', label: 'Stock' },
            { key: 'stock_minimo', label: 'Mínimo' },
            { key: 'sit', label: 'Situación', render: (r) => (faltante(r.codigo) !== undefined ? <span className="badge bad">reponer {faltante(r.codigo)}</span> : <Badge v="aprobado" />) },
          ]}
        />
      </Card>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <Card titulo="Ingreso de repuestos">
            <div className="row">
              <Campo label="Repuesto"><select value={ing.codigo} onChange={(e) => setIng({ ...ing, codigo: e.target.value })}><option value="">Elegir…</option>{opciones}</select></Campo>
              <Campo label="Cantidad"><input type="number" min="1" value={ing.cantidad} onChange={(e) => setIng({ ...ing, cantidad: e.target.value })} /></Campo>
              <Campo label="Motivo"><input value={ing.motivo} onChange={(e) => setIng({ ...ing, motivo: e.target.value })} placeholder="Compra, devolución…" /></Campo>
              <button className="btn" disabled={!ing.codigo || !ing.cantidad} onClick={async () => {
                if (await accion(supabase.rpc('ingresar_repuesto', { p_codigo: ing.codigo, p_cantidad: Number(ing.cantidad), p_motivo: ing.motivo || 'Ingreso al pañol' }), 'Ingreso registrado')) setIng({ codigo: '', cantidad: '', motivo: '' });
              }}>Registrar</button>
            </div>
          </Card>
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <Card titulo="Entrega a un mantenimiento">
            <div className="row">
              <Campo label="Mantenimiento abierto"><select value={uso.mant} onChange={(e) => setUso({ ...uso, mant: e.target.value })}><option value="">Elegir…</option>{abiertos.data?.map((x) => <option key={x.id_mant} value={x.id_mant}>{x.patente} · {x.descripcion}</option>)}</select></Campo>
              <Campo label="Repuesto"><select value={uso.codigo} onChange={(e) => setUso({ ...uso, codigo: e.target.value })}><option value="">Elegir…</option>{opciones}</select></Campo>
              <Campo label="Cantidad"><input type="number" min="1" value={uso.cantidad} onChange={(e) => setUso({ ...uso, cantidad: e.target.value })} /></Campo>
              <button className="btn" disabled={!uso.mant || !uso.codigo || !uso.cantidad} onClick={async () => {
                if (await accion(supabase.rpc('usar_repuesto', { p_mant: uso.mant, p_codigo: uso.codigo, p_cantidad: Number(uso.cantidad) }), 'Entrega registrada')) setUso({ mant: '', codigo: '', cantidad: '' });
              }}>Entregar</button>
            </div>
          </Card>
        </div>
      </div>
      <Card titulo="Últimos movimientos">
        <Table
          rows={mov.data}
          cols={[
            { key: 'fecha_hora', label: 'Fecha', render: (r) => new Date(r.fecha_hora).toLocaleString('es-AR') },
            { key: 'codigo', label: 'Repuesto' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'cantidad', label: 'Cantidad' },
            { key: 'motivo', label: 'Motivo' },
          ]}
        />
      </Card>
    </>
  );
}
