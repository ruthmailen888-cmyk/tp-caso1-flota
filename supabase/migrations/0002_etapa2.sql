-- =====================================================================
-- Caso 1: Gestión de flota y mantenimiento. Etapa 2.
-- Migración aditiva sobre la base de la etapa 1 (no se recrea la base).
-- Agrega: plan de mantenimiento preventivo por kilometraje, control de stock
-- con movimientos, alertas de vencimiento con seguimiento e indicadores.
-- Todos los datos de prueba son ficticios.
-- =====================================================================

-- ---------- F1. Plan de mantenimiento preventivo por kilometraje ----------
alter table vehiculo add column km_actual numeric(9, 1) not null default 0 check (km_actual >= 0);

create table plan_preventivo (
  id_plan     uuid primary key default gen_random_uuid(),
  patente     text not null references vehiculo (patente),
  descripcion text not null,
  cada_km     numeric(8, 1) not null check (cada_km > 0),
  ultimo_km   numeric(9, 1) not null default 0 check (ultimo_km >= 0),
  unique (patente, descripcion)
);
create index on plan_preventivo (patente);

-- Al cerrar una salida se suma el kilometraje recorrido al vehículo.
create function fn_sumar_km_vehiculo() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado = 'finalizada' and old.estado = 'en_curso' then
    update vehiculo set km_actual = km_actual + coalesce(new.kilometraje, 0) where patente = new.patente;
  end if;
  return null;
end $$;

create trigger trg_salida_suma_km
  after update of estado on salida
  for each row execute function fn_sumar_km_vehiculo();

create view v_preventivos_pendientes with (security_invoker = true) as
  select p.id_plan, p.patente, p.descripcion, p.cada_km, p.ultimo_km, v.km_actual,
         (v.km_actual - p.ultimo_km) as km_desde_ultimo,
         (v.km_actual - p.ultimo_km - p.cada_km) as km_excedidos
    from plan_preventivo p join vehiculo v using (patente)
   where v.km_actual - p.ultimo_km >= p.cada_km
   order by km_excedidos desc;

create function abrir_mantenimiento_preventivo(p_plan uuid, p_legajo text) returns uuid
language plpgsql set search_path = public as $$
declare
  v_plan plan_preventivo%rowtype;
  v_km   numeric;
  v_id   uuid;
begin
  select * into v_plan from plan_preventivo where id_plan = p_plan;
  if not found then raise exception 'El plan preventivo no existe' using errcode = 'no_data_found'; end if;
  select km_actual into v_km from vehiculo where patente = v_plan.patente;
  insert into mantenimiento (patente, legajo_mecanico, fecha, tipo, descripcion, km_vehiculo)
  values (v_plan.patente, p_legajo, current_date, 'preventivo', v_plan.descripcion, v_km)
  returning id_mant into v_id;
  update plan_preventivo set ultimo_km = v_km where id_plan = p_plan;
  return v_id;
end $$;

-- ---------- F2. Control de stock con movimientos y punto de reposición ----------
alter table repuesto add column stock_minimo integer not null default 0 check (stock_minimo >= 0);

create table movimiento_stock (
  id_mov     uuid primary key default gen_random_uuid(),
  codigo     text not null references repuesto (codigo),
  id_mant    uuid references mantenimiento (id_mant) on delete set null,
  fecha_hora timestamptz not null default now(),
  tipo       text not null check (tipo in ('ingreso', 'consumo', 'ajuste')),
  cantidad   integer not null check (cantidad <> 0),
  motivo     text,
  check (tipo <> 'ingreso' or cantidad > 0),
  check (tipo <> 'consumo' or cantidad < 0)
);
create index on movimiento_stock (codigo);
create index on movimiento_stock (id_mant);

-- Los movimientos son la única vía para cambiar el stock.
create function fn_aplicar_movimiento() returns trigger
language plpgsql set search_path = public as $$
begin
  update repuesto set stock = stock + new.cantidad where codigo = new.codigo;
  return null;
end $$;

create trigger trg_movimiento_aplica
  after insert on movimiento_stock
  for each row execute function fn_aplicar_movimiento();

-- El consumo en un mantenimiento ahora genera su movimiento (reemplaza el descuento directo de la etapa 1).
create or replace function fn_descontar_stock() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into movimiento_stock (codigo, id_mant, tipo, cantidad, motivo)
    values (new.codigo, new.id_mant, 'consumo', -new.cantidad, 'Uso en mantenimiento');
  elsif tg_op = 'UPDATE' then
    if new.cantidad <> old.cantidad then
      insert into movimiento_stock (codigo, id_mant, tipo, cantidad, motivo)
      values (new.codigo, new.id_mant, 'ajuste', old.cantidad - new.cantidad, 'Corrección de cantidad usada');
    end if;
  elsif tg_op = 'DELETE' then
    insert into movimiento_stock (codigo, id_mant, tipo, cantidad, motivo)
    values (old.codigo, null, 'ajuste', old.cantidad, 'Anulación de uso en mantenimiento');
  end if;
  return null;
end $$;

create function ingresar_repuesto(p_codigo text, p_cantidad integer, p_motivo text default 'Ingreso al pañol') returns void
language plpgsql set search_path = public as $$
begin
  insert into movimiento_stock (codigo, tipo, cantidad, motivo) values (p_codigo, 'ingreso', p_cantidad, p_motivo);
end $$;

create view v_reposicion with (security_invoker = true) as
  select codigo, descripcion, stock, stock_minimo, (stock_minimo - stock) as faltante
    from repuesto
   where stock <= stock_minimo
   order by faltante desc;

-- ---------- F3. Alertas de vencimiento con seguimiento ----------
create table alerta_vencimiento (
  id_alerta      uuid primary key default gen_random_uuid(),
  id_doc         uuid references documentacion (id_doc) on delete cascade,
  legajo_chofer  text references chofer (legajo) on delete cascade,
  vencimiento    date not null,
  generada       date not null default current_date,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'atendida')),
  atendida_por   text,
  fecha_atencion date,
  check (num_nonnulls(id_doc, legajo_chofer) = 1),
  check (estado = 'pendiente' or (atendida_por is not null and fecha_atencion is not null))
);
create unique index alerta_doc_unica on alerta_vencimiento (id_doc, vencimiento) where id_doc is not null;
create unique index alerta_lic_unica on alerta_vencimiento (legajo_chofer, vencimiento) where legajo_chofer is not null;
create index on alerta_vencimiento (estado);

create function generar_alertas(p_dias integer default 30) returns integer
language plpgsql set search_path = public as $$
declare v_a integer; v_b integer;
begin
  insert into alerta_vencimiento (id_doc, vencimiento)
  select id_doc, vencimiento from documentacion where vencimiento <= current_date + p_dias
  on conflict do nothing;
  get diagnostics v_a = row_count;
  insert into alerta_vencimiento (legajo_chofer, vencimiento)
  select legajo, venc_licencia from chofer where venc_licencia <= current_date + p_dias
  on conflict do nothing;
  get diagnostics v_b = row_count;
  return v_a + v_b;
end $$;

create function atender_alerta(p_alerta uuid, p_quien text) returns void
language plpgsql set search_path = public as $$
begin
  update alerta_vencimiento set estado = 'atendida', atendida_por = p_quien, fecha_atencion = current_date
   where id_alerta = p_alerta and estado = 'pendiente';
  if not found then raise exception 'La alerta no existe o ya fue atendida' using errcode = 'no_data_found'; end if;
end $$;

-- ---------- F4. Indicadores de flota ----------
create view v_indicadores_vehiculo with (security_invoker = true) as
  select v.patente, v.tipo, v.estado, v.km_actual,
         (select count(*) from salida s where s.patente = v.patente and s.estado = 'finalizada') as salidas_finalizadas,
         (select count(*) from salida s where s.patente = v.patente and s.estado = 'bloqueada') as salidas_bloqueadas,
         (select count(*) from mantenimiento m where m.patente = v.patente and m.tipo = 'preventivo') as preventivos,
         (select count(*) from mantenimiento m where m.patente = v.patente and m.tipo = 'correctivo') as correctivos
    from vehiculo v;

-- ---------- Funciones de la aplicación ----------
create function solicitar_salida(p_patente text, p_legajo text, p_origen text, p_destino text) returns uuid
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  insert into salida (patente, legajo_chofer, origen, destino) values (p_patente, p_legajo, p_origen, p_destino)
  returning id_salida into v_id;
  return v_id;
end $$;

create function registrar_chequeo(p_salida uuid, p_items jsonb) returns text
language plpgsql set search_path = public as $$
declare v_chq uuid; v_n integer := 0; v_item jsonb; v_res text;
begin
  insert into chequeo (id_salida) values (p_salida) returning id_chequeo into v_chq;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_n := v_n + 1;
    insert into item_chequeo values (v_chq, v_n, v_item ->> 'descripcion', (v_item ->> 'aprobado')::boolean);
  end loop;
  select resultado into v_res from chequeo where id_chequeo = v_chq;
  return v_res;
end $$;

create function iniciar_salida(p_salida uuid) returns void
language plpgsql set search_path = public as $$
begin
  update salida set estado = 'en_curso' where id_salida = p_salida;
end $$;

create function cerrar_salida(p_salida uuid, p_km numeric) returns void
language plpgsql set search_path = public as $$
begin
  update salida set estado = 'finalizada', hora_regreso = clock_timestamp(), kilometraje = p_km where id_salida = p_salida;
end $$;

create function abrir_mantenimiento(p_patente text, p_legajo text, p_tipo text, p_descripcion text) returns uuid
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  insert into mantenimiento (patente, legajo_mecanico, fecha, tipo, descripcion, km_vehiculo)
  values (p_patente, p_legajo, current_date, p_tipo, p_descripcion, (select km_actual from vehiculo where patente = p_patente))
  returning id_mant into v_id;
  return v_id;
end $$;

create function cerrar_mantenimiento(p_mant uuid) returns void
language plpgsql set search_path = public as $$
begin
  update mantenimiento set fecha_cierre = current_date where id_mant = p_mant and fecha_cierre is null;
  if not found then raise exception 'El mantenimiento no existe o ya está cerrado' using errcode = 'no_data_found'; end if;
end $$;

create function usar_repuesto(p_mant uuid, p_codigo text, p_cantidad integer) returns void
language plpgsql set search_path = public as $$
begin
  insert into mantenimiento_repuesto values (p_mant, p_codigo, p_cantidad)
  on conflict (id_mant, codigo) do update set cantidad = mantenimiento_repuesto.cantidad + excluded.cantidad;
end $$;

-- ---------- Seguridad (RLS) para las tablas nuevas ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and not rowsecurity loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy acceso_demo on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
