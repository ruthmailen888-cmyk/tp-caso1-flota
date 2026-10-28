import { useEffect, useState, type ReactElement } from 'react';
import { configurado } from './supabase';
import { ToastProvider } from './ui';
import { Tablero, Salidas, Vehiculos, Alertas } from './screens/Supervisor';
import { MisSalidas } from './screens/Chofer';
import { Mantenimientos, Preventivos } from './screens/Taller';
import { Repuestos } from './screens/Panol';
import { Maestros } from './screens/Admin';

const PANTALLAS: Record<string, () => ReactElement> = {
  Tablero: () => <Tablero />,
  Salidas: () => <Salidas />,
  Vehículos: () => <Vehiculos />,
  Alertas: () => <Alertas />,
  'Mis salidas': () => <MisSalidas />,
  Mantenimientos: () => <Mantenimientos />,
  Preventivos: () => <Preventivos />,
  Repuestos: () => <Repuestos />,
  Maestros: () => <Maestros />,
};

const ROLES: Record<string, string[]> = {
  'Supervisor de flota': ['Tablero', 'Salidas', 'Vehículos', 'Alertas'],
  Chofer: ['Mis salidas'],
  'Jefe de taller': ['Mantenimientos', 'Preventivos'],
  Pañolero: ['Repuestos'],
  Administrador: ['Maestros'],
};

function leer(k: string, def: string) {
  try { return localStorage.getItem(k) ?? def; } catch { return def; }
}

export default function App() {
  const [rol, setRol] = useState(() => (leer('rol', '') in ROLES ? leer('rol', '') : 'Supervisor de flota'));
  const [tab, setTab] = useState(ROLES[rol][0]);
  useEffect(() => {
    try { localStorage.setItem('rol', rol); } catch { /* sin almacenamiento */ }
    setTab(ROLES[rol][0]);
  }, [rol]);

  if (!configurado) {
    return (
      <div className="config">
        <h1>Falta configurar Supabase</h1>
        <p>Copiá <code>.env.example</code> como <code>.env</code> y completá <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> con los datos del proyecto. En Vercel se cargan como variables de entorno.</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <header className="top">
        <h1>Flota y mantenimiento · Minera de alta montaña</h1>
        <label>
          Rol
          <select value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Rol">
            {Object.keys(ROLES).map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      </header>
      <nav className="tabs">
        {ROLES[rol].map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <main>{(PANTALLAS[tab] ?? PANTALLAS[ROLES[rol][0]])()}</main>
    </ToastProvider>
  );
}
