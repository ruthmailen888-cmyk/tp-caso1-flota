import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type ToastFn = (mensaje: string, error?: boolean) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ m: string; e: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback<ToastFn>((m, e = false) => {
    setT({ m, e });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={'toast' + (t.e ? ' err' : '')} role="status">{t.m}</div>}
    </ToastCtx.Provider>
  );
}

/** Carga datos y permite recargarlos. Cada pantalla usa `recargar` después de una acción. */
export function useData<T>(loader: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(loader()).then((r) => {
      if (!vivo) return;
      setData(r.data);
      setError(r.error ? r.error.message : null);
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, recargar: () => setN((x) => x + 1) };
}

/** Ejecuta una operación de Supabase, avisa el resultado y recarga. */
export function useAccion(despues?: () => void) {
  const toast = useToast();
  return async (op: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await op;
    if (error) toast(error.message, true);
    else { toast(ok); despues?.(); }
    return !error;
  };
}

const ESTADOS_OK = ['operativo', 'aprobado', 'finalizada', 'disponible', 'atendida', 'cerrada', 'aprobada', 'vigente'];
const ESTADOS_BAD = ['fuera_de_servicio', 'bloqueada', 'rechazado', 'vencido', 'con_fallas', 'en_mantenimiento', 'pendiente_critica'];
const ESTADOS_WARN = ['en_curso', 'en_limpieza', 'proximo', 'pendiente', 'solicitada', 'abierta', 'en_proceso', 'ocupada', 'reservada', 'activa'];
export function Badge({ v }: { v: unknown }) {
  const s = String(v ?? '');
  const c = ESTADOS_OK.includes(s) ? 'ok' : ESTADOS_BAD.includes(s) ? 'bad' : ESTADOS_WARN.includes(s) ? 'warn' : '';
  return <span className={'badge ' + c}>{s.replace(/_/g, ' ')}</span>;
}

export type Col = { key: string; label: string; render?: (r: Row) => ReactNode };
export function Table({ cols, rows, vacio = 'Sin registros' }: { cols: Col[]; rows: Row[] | null; vacio?: string }) {
  if (!rows) return <p className="muted">Cargando…</p>;
  if (rows.length === 0) return <p className="muted">{vacio}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c.key}>{c.render ? c.render(r) : String(r[c.key] ?? '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Card({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="card"><h2>{titulo}</h2>{children}</section>;
}

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="f">{label}{children}</label>;
}

export function Aviso({ msg }: { msg: string | null }) {
  return msg ? <p className="badge bad">{msg}</p> : null;
}
