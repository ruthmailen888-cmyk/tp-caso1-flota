import { useState } from 'react';
import { supabase } from '../supabase';
import { Badge, Campo, Card, Table, useAccion, useData, type Row } from '../ui';

const ITEMS = ['Frenos', 'Luces', 'Neumáticos', 'Nivel de aceite', 'Cinturones de seguridad'];

export function MisSalidas() {
  const choferes = useData(() => supabase.from('chofer').select('legajo,nombre,venc_licencia').order('legajo'));
  const [legajo, setLegajo] = useState('');
  const salidas = useData(
    () => (legajo ? supabase.from('salida').select('*,chequeo(resultado)').eq('legajo_chofer', legajo).order('estado') : Promise.resolve({ data: [] as Row[], error: null })),
    [legajo],
  );
  const accion = useAccion(salidas.recargar);
  const [items, setItems] = useState<Record<string, boolean>>(Object.fromEntries(ITEMS.map((i) => [i, true])));
  const [km, setKm] = useState<Record<string, string>>({});
  const chq = (r: Row) => (Array.isArray(r.chequeo) ? r.chequeo[0] : r.chequeo);
  const yo = choferes.data?.find((c) => c.legajo === legajo);
  return (
    <>
      <Card titulo="Chofer">
        <div className="row">
          <Campo label="Soy">
            <select value={legajo} onChange={(e) => setLegajo(e.target.value)}>
              <option value="">Elegir…</option>
              {choferes.data?.map((c) => <option key={c.legajo} value={c.legajo}>{c.legajo} · {c.nombre}</option>)}
            </select>
          </Campo>
          {yo && <span className="muted">Licencia vence: {yo.venc_licencia}</span>}
        </div>
      </Card>
      <Card titulo="Mis salidas">
        <Table
          rows={salidas.data}
          vacio={legajo ? 'No tenés salidas' : 'Elegí un chofer'}
          cols={[
            { key: 'patente', label: 'Vehículo' },
            { key: 'destino', label: 'Destino', render: (r) => `${r.origen} → ${r.destino}` },
            { key: 'estado', label: 'Estado', render: (r) => <Badge v={r.estado} /> },
            { key: 'chequeo', label: 'Chequeo', render: (r) => (chq(r) ? <Badge v={chq(r).resultado} /> : <span className="muted">sin hacer</span>) },
            {
              key: 'acc', label: 'Acción', render: (r) => {
                if (r.estado === 'solicitada' && chq(r)?.resultado === 'aprobado')
                  return <button className="btn small" onClick={() => accion(supabase.rpc('iniciar_salida', { p_salida: r.id_salida }), 'Salida iniciada')}>Iniciar salida</button>;
                if (r.estado === 'en_curso')
                  return (
                    <span className="row">
                      <input style={{ minWidth: 80, width: 90 }} type="number" min="0" placeholder="Km" value={km[r.id_salida] ?? ''} onChange={(e) => setKm({ ...km, [r.id_salida]: e.target.value })} />
                      <button className="btn small" disabled={!km[r.id_salida]} onClick={() => accion(supabase.rpc('cerrar_salida', { p_salida: r.id_salida, p_km: Number(km[r.id_salida]) }), 'Salida cerrada')}>Cerrar salida</button>
                    </span>
                  );
                return null;
              },
            },
          ]}
        />
      </Card>
      <Card titulo="Chequeo previo a la salida">
        {salidas.data?.filter((r) => r.estado === 'solicitada' && !chq(r)).map((r) => (
          <div key={r.id_salida} style={{ marginBottom: 12 }}>
            <p><b>{r.patente}</b> · {r.origen} → {r.destino}</p>
            <div className="checks">
              {ITEMS.map((i) => (
                <label key={i}><input type="checkbox" checked={items[i]} onChange={(e) => setItems({ ...items, [i]: e.target.checked })} />{i}</label>
              ))}
            </div>
            <p><button className="btn" onClick={() => accion(supabase.rpc('registrar_chequeo', { p_salida: r.id_salida, p_items: ITEMS.map((i) => ({ descripcion: i, aprobado: items[i] })) }), 'Chequeo registrado')}>Registrar chequeo</button></p>
          </div>
        ))}
        {!salidas.data?.some((r) => r.estado === 'solicitada' && !chq(r)) && <p className="muted">No hay salidas esperando chequeo.</p>}
      </Card>
    </>
  );
}
