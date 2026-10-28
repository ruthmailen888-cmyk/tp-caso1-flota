-- =====================================================================
-- Caso 1: Gestión de flota y mantenimiento. Etapa 1.
-- Script generado por la IA (versión 1, respuesta original al pedido).
-- Motor: PostgreSQL (Supabase). Todos los datos de prueba son ficticios.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------- Tablas maestras ----------
create table area (
  codigo text primary key,
  nombre text not null
);

create table vehiculo (
  patente     text primary key,
  marca       text not null,
  modelo      text not null,
  tipo        text not null check (tipo in ('camioneta', 'camion', 'bus')),
  estado      text not null default 'operativo'
              check (estado in ('operativo', 'en_mantenimiento', 'fuera_de_servicio')),
  codigo_area text not null references area (codigo)
);

create table chofer (
  legajo        text primary key,
  nombre        text not null,
  licencia      text not null,
  venc_licencia date not null
);

create table mecanico (
  legajo text primary key,
  nombre text not null
);

create table repuesto (
  codigo      text primary key,
  descripcion text not null,
  stock       integer not null default 0 check (stock >= 0)
);

-- ---------- Documentación del vehículo ----------
create table documentacion (
  id_doc      uuid primary key default gen_random_uuid(),
  patente     text not null references vehiculo (patente),
  tipo        text not null check (tipo in ('seguro', 'vtv', 'habilitacion_altura')),
  vencimiento date not null,
  unique (patente, tipo)
);

-- ---------- Salida, chequeo e ítems ----------
create table salida (
  id_salida     uuid primary key default gen_random_uuid(),
  patente       text not null references vehiculo (patente),
  legajo_chofer text not null references chofer (legajo),
  estado        text not null default 'solicitada'
                check (estado in ('solicitada', 'bloqueada', 'en_curso', 'finalizada')),
  hora_salida   timestamptz,
  hora_regreso  timestamptz,
  origen        text not null,
  destino       text not null,
  kilometraje   numeric(8, 1) check (kilometraje >= 0),
  check (hora_regreso is null or (hora_salida is not null and hora_regreso > hora_salida)),
  check (estado <> 'finalizada' or (hora_salida is not null and hora_regreso is not null and kilometraje is not null))
);

-- Un vehículo no puede estar en dos salidas a la vez, ni un chofer.
alter table salida add constraint salida_vehiculo_sin_solape
  exclude using gist (patente with =, tstzrange(hora_salida, coalesce(hora_regreso, 'infinity'::timestamptz)) with &&)
  where (estado in ('en_curso', 'finalizada'));
alter table salida add constraint salida_chofer_sin_solape
  exclude using gist (legajo_chofer with =, tstzrange(hora_salida, coalesce(hora_regreso, 'infinity'::timestamptz)) with &&)
  where (estado in ('en_curso', 'finalizada'));

create table chequeo (
  id_chequeo uuid primary key default gen_random_uuid(),
  id_salida  uuid not null unique references salida (id_salida) on delete cascade,
  fecha_hora timestamptz not null default now(),
  resultado  text not null default 'pendiente' check (resultado in ('pendiente', 'aprobado', 'rechazado'))
);

create table item_chequeo (
  id_chequeo  uuid not null references chequeo (id_chequeo) on delete cascade,
  nro_item    integer not null check (nro_item > 0),
  descripcion text not null,
  aprobado    boolean not null,
  primary key (id_chequeo, nro_item)
);

-- ---------- Mantenimiento y repuestos ----------
create table mantenimiento (
  id_mant         uuid primary key default gen_random_uuid(),
  patente         text not null references vehiculo (patente),
  legajo_mecanico text not null references mecanico (legajo),
  fecha           date not null,
  fecha_cierre    date,
  tipo            text not null check (tipo in ('preventivo', 'correctivo')),
  descripcion     text not null,
  km_vehiculo     numeric(9, 1) check (km_vehiculo >= 0),
  check (fecha_cierre is null or fecha_cierre >= fecha)
);

create table mantenimiento_repuesto (
  id_mant  uuid not null references mantenimiento (id_mant) on delete cascade,
  codigo   text not null references repuesto (codigo),
  cantidad integer not null check (cantidad > 0),
  primary key (id_mant, codigo)
);

-- ---------- Índices sobre claves foráneas ----------
create index on vehiculo (codigo_area);
create index on documentacion (patente);
create index on salida (patente);
create index on salida (legajo_chofer);
create index on mantenimiento (patente);
create index on mantenimiento (legajo_mecanico);
create index on mantenimiento_repuesto (codigo);

-- ---------- Reglas del negocio ----------
-- R1. El resultado del chequeo se calcula a partir de sus ítems.
create function fn_recalcular_chequeo() returns trigger
language plpgsql set search_path = public as $$
declare
  v_id  uuid := coalesce(new.id_chequeo, old.id_chequeo);
  v_res text;
begin
  select case when count(*) = 0 then 'pendiente'
              when bool_and(aprobado) then 'aprobado'
              else 'rechazado' end
    into v_res
    from item_chequeo where id_chequeo = v_id;
  update chequeo set resultado = v_res where id_chequeo = v_id;
  return null;
end $$;

create trigger trg_item_recalcula
  after insert or update or delete on item_chequeo
  for each row execute function fn_recalcular_chequeo();

-- R2. Un chequeo rechazado bloquea la salida.
create function fn_bloquear_salida() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.resultado = 'rechazado' then
    update salida set estado = 'bloqueada'
     where id_salida = new.id_salida and estado = 'solicitada';
  end if;
  return null;
end $$;

create trigger trg_chequeo_bloquea
  after update of resultado on chequeo
  for each row execute function fn_bloquear_salida();

-- R3. Condiciones para que una salida pueda comenzar y pasar de estado.
create function fn_validar_salida() returns trigger
language plpgsql set search_path = public as $$
declare
  v_estado_veh text;
  v_venc_lic   date;
  v_tipo       text;
begin
  if tg_op = 'UPDATE' and old.estado is distinct from new.estado then
    if not ((old.estado = 'solicitada' and new.estado in ('bloqueada', 'en_curso'))
         or (old.estado = 'en_curso' and new.estado = 'finalizada')) then
      raise exception 'Transición de estado no permitida: % -> %', old.estado, new.estado
        using errcode = 'check_violation';
    end if;
  end if;

  if new.estado = 'en_curso' and (tg_op = 'INSERT' or old.estado is distinct from new.estado) then
    if not exists (select 1 from chequeo where id_salida = new.id_salida and resultado = 'aprobado') then
      raise exception 'La salida no tiene un chequeo aprobado' using errcode = 'check_violation';
    end if;

    select estado into v_estado_veh from vehiculo where patente = new.patente;
    if v_estado_veh <> 'operativo' then
      raise exception 'El vehículo % no está operativo (estado: %)', new.patente, v_estado_veh
        using errcode = 'check_violation';
    end if;

    for v_tipo in select unnest(array['seguro', 'vtv', 'habilitacion_altura']) loop
      if not exists (select 1 from documentacion
                      where patente = new.patente and tipo = v_tipo and vencimiento >= current_date) then
        raise exception 'El vehículo % no tiene % vigente', new.patente, v_tipo
          using errcode = 'check_violation';
      end if;
    end loop;

    select venc_licencia into v_venc_lic from chofer where legajo = new.legajo_chofer;
    if v_venc_lic < current_date then
      raise exception 'La licencia del chofer % está vencida', new.legajo_chofer
        using errcode = 'check_violation';
    end if;

    new.hora_salida := coalesce(new.hora_salida, now());
  end if;
  return new;
end $$;

create trigger trg_salida_valida
  before insert or update on salida
  for each row execute function fn_validar_salida();

-- R4. El estado del vehículo sigue a sus mantenimientos abiertos.
create function fn_estado_vehiculo_mant() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.fecha_cierre is null then
    update vehiculo set estado = 'en_mantenimiento' where patente = new.patente;
  elsif tg_op = 'UPDATE' and old.fecha_cierre is null and new.fecha_cierre is not null then
    if not exists (select 1 from mantenimiento
                    where patente = new.patente and fecha_cierre is null and id_mant <> new.id_mant) then
      update vehiculo set estado = 'operativo'
       where patente = new.patente and estado = 'en_mantenimiento';
    end if;
  end if;
  return null;
end $$;

create trigger trg_mant_estado_vehiculo
  after insert or update of fecha_cierre on mantenimiento
  for each row execute function fn_estado_vehiculo_mant();

-- R5. Los repuestos usados descuentan stock (si no alcanza, el CHECK lo rechaza).
create function fn_descontar_stock() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update repuesto set stock = stock - new.cantidad where codigo = new.codigo;
  elsif tg_op = 'UPDATE' then
    update repuesto set stock = stock + old.cantidad - new.cantidad where codigo = new.codigo;
  elsif tg_op = 'DELETE' then
    update repuesto set stock = stock + old.cantidad where codigo = old.codigo;
  end if;
  return null;
end $$;

create trigger trg_mant_repuesto_stock
  after insert or update of cantidad or delete on mantenimiento_repuesto
  for each row execute function fn_descontar_stock();

-- ---------- Alerta de vencimientos ----------
create view v_vencimientos_proximos with (security_invoker = true) as
  select 'documentacion'::text as origen, d.patente as referencia, d.tipo as detalle,
         d.vencimiento, (d.vencimiento - current_date) as dias_restantes,
         case when d.vencimiento < current_date then 'vencido' else 'proximo' end as situacion
    from documentacion d
   where d.vencimiento <= current_date + 30
  union all
  select 'licencia', c.legajo, 'licencia ' || c.licencia,
         c.venc_licencia, (c.venc_licencia - current_date),
         case when c.venc_licencia < current_date then 'vencido' else 'proximo' end
    from chofer c
   where c.venc_licencia <= current_date + 30;

-- ---------- Seguridad (RLS) ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy acceso_demo on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
-- Correcciones tras la revisión crítica (Caso 1).
-- Hallazgo: una salida podía insertarse ya finalizada, salteando chequeo, documentación y licencia.
-- Corrección: toda salida nace en estado 'solicitada'.
create or replace function fn_salida_nace_solicitada() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado <> 'solicitada' then
    raise exception 'Una salida nueva debe crearse en estado solicitada (recibido: %)', new.estado
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger trg_salida_nace_solicitada
  before insert on salida
  for each row execute function fn_salida_nace_solicitada();

-- Hallazgo 2: el enunciado indica que si el chequeo falla el vehículo pasa a fuera de servicio,
-- pero el script solo bloqueaba la salida.
-- Corrección: además de bloquear la salida, el vehículo queda fuera de servicio.
create or replace function fn_bloquear_salida() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.resultado = 'rechazado' then
    update salida set estado = 'bloqueada'
     where id_salida = new.id_salida and estado = 'solicitada';
    update vehiculo set estado = 'fuera_de_servicio'
     where patente = (select patente from salida where id_salida = new.id_salida)
       and estado = 'operativo';
  end if;
  return null;
end $$;
