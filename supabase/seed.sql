-- Datos ficticios. Orden: etapa 1, etapa 2, historial de demostración.
-- Datos ficticios de prueba. Caso 1, etapa 1.
insert into area (codigo, nombre) values
  ('MINA', 'Operaciones de mina'),
  ('TALL', 'Taller central'),
  ('LOGI', 'Logística y traslados');

insert into vehiculo (patente, marca, modelo, tipo, estado, codigo_area) values
  ('AA111AA', 'Marca Alfa', 'Modelo 1', 'camioneta', 'operativo', 'MINA'),
  ('AA222BB', 'Marca Alfa', 'Modelo 2', 'camioneta', 'operativo', 'MINA'),
  ('AA333CC', 'Marca Beta', 'Modelo 3', 'camion',    'operativo', 'LOGI'),
  ('AA444DD', 'Marca Beta', 'Modelo 4', 'bus',       'operativo', 'LOGI'),
  ('AA555EE', 'Marca Gama', 'Modelo 5', 'camioneta', 'operativo', 'MINA'),
  ('AA666FF', 'Marca Gama', 'Modelo 6', 'camion',    'operativo', 'TALL');

insert into documentacion (patente, tipo, vencimiento)
select p, t, current_date + 200
  from unnest(array['AA111AA','AA222BB','AA333CC','AA444DD','AA555EE','AA666FF']) p,
       unnest(array['seguro','vtv','habilitacion_altura']) t;
-- AA333CC tiene la VTV vencida y AA444DD tiene el seguro por vencer.
update documentacion set vencimiento = current_date - 10 where patente = 'AA333CC' and tipo = 'vtv';
update documentacion set vencimiento = current_date + 12 where patente = 'AA444DD' and tipo = 'seguro';

insert into chofer (legajo, nombre, licencia, venc_licencia) values
  ('CH001', 'Chofer Ficticio Uno',  'Profesional D1', current_date + 400),
  ('CH002', 'Chofer Ficticio Dos',  'Profesional D1', current_date - 30),
  ('CH003', 'Chofer Ficticio Tres', 'Profesional C',  current_date + 15),
  ('CH004', 'Chofer Ficticio Cuatro', 'Profesional C', current_date + 300);

insert into mecanico (legajo, nombre) values
  ('ME001', 'Mecánico Ficticio Uno'),
  ('ME002', 'Mecánico Ficticio Dos');

insert into repuesto (codigo, descripcion, stock) values
  ('REP-FILT-01', 'Filtro de aceite', 10),
  ('REP-PAST-02', 'Pastillas de freno', 4);

-- Datos ficticios adicionales, Caso 1, etapa 2.
update repuesto set stock_minimo = 5 where codigo = 'REP-FILT-01';
update repuesto set stock_minimo = 4 where codigo = 'REP-PAST-02';
insert into repuesto (codigo, descripcion, stock, stock_minimo) values ('REP-ACEI-03', 'Aceite de motor 15W40 (litro)', 40, 20);
insert into plan_preventivo (patente, descripcion, cada_km, ultimo_km) values
  ('AA111AA', 'Service de 10.000 km', 10000, 0),
  ('AA333CC', 'Service de 10.000 km', 10000, 0),
  ('AA444DD', 'Cambio de neumáticos', 40000, 0);
update vehiculo set km_actual = 12500 where patente = 'AA333CC';
update vehiculo set km_actual = 9400 where patente = 'AA111AA';

-- Datos ficticios de demostración: historial y casos abiertos para que la aplicación muestre contenido.

-- Salida histórica ya finalizada (AA222BB con CH003, hace tres días, 180 km).
do $$
declare s uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  insert into salida (id_salida, patente, legajo_chofer, origen, destino) values (s, 'AA222BB', 'CH003', 'Base San Juan', 'Rodeo');
  insert into chequeo (id_chequeo, id_salida, fecha_hora) values (c, s, now() - interval '3 days 1 hour');
  insert into item_chequeo values (c, 1, 'Frenos', true), (c, 2, 'Luces', true), (c, 3, 'Neumáticos', true);
  update salida set estado = 'en_curso', hora_salida = now() - interval '3 days' where id_salida = s;
  update salida set estado = 'finalizada', hora_regreso = now() - interval '3 days' + interval '6 hours', kilometraje = 180 where id_salida = s;
end $$;

-- Salida solicitada que espera su chequeo previo (AA111AA con CH001).
insert into salida (patente, legajo_chofer, origen, destino) values ('AA111AA', 'CH001', 'Base San Juan', 'Batidero');

-- Chequeo rechazado: la salida queda bloqueada y el vehículo fuera de servicio (AA555EE).
do $$
declare s uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  insert into salida (id_salida, patente, legajo_chofer, origen, destino) values (s, 'AA555EE', 'CH004', 'Base San Juan', 'La Guanaca');
  insert into chequeo (id_chequeo, id_salida) values (c, s);
  insert into item_chequeo values (c, 1, 'Frenos', false), (c, 2, 'Luces', true), (c, 3, 'Neumáticos', true);
end $$;

-- Mantenimiento correctivo abierto sobre ese vehículo, con repuestos usados.
do $$
declare m uuid := gen_random_uuid();
begin
  insert into mantenimiento (id_mant, patente, legajo_mecanico, fecha, tipo, descripcion, km_vehiculo)
  values (m, 'AA555EE', 'ME001', current_date, 'correctivo', 'Pastillas de freno desgastadas', 0);
  insert into mantenimiento_repuesto values (m, 'REP-PAST-02', 2);
end $$;

select generar_alertas(30);
