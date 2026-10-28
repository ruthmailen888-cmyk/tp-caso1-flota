# Modelo relacional, Caso 1: gestión de flota y mantenimiento

Generado desde la base resultante (etapa 1 más etapa 2).

- **alerta_vencimiento** (id_alerta (PK), id_doc (FK), legajo_chofer (FK), vencimiento, generada, estado, atendida_por, fecha_atencion)
- **area** (codigo (PK), nombre)
- **chequeo** (id_chequeo (PK), id_salida (FK), fecha_hora, resultado)
- **chofer** (legajo (PK), nombre, licencia, venc_licencia)
- **documentacion** (id_doc (PK), patente (FK), tipo, vencimiento)
- **item_chequeo** (id_chequeo (PK) (FK), nro_item (PK), descripcion, aprobado)
- **mantenimiento** (id_mant (PK), patente (FK), legajo_mecanico (FK), fecha, fecha_cierre, tipo, descripcion, km_vehiculo)
- **mantenimiento_repuesto** (id_mant (PK) (FK), codigo (PK) (FK), cantidad)
- **mecanico** (legajo (PK), nombre)
- **movimiento_stock** (id_mov (PK), codigo (FK), id_mant (FK), fecha_hora, tipo, cantidad, motivo)
- **plan_preventivo** (id_plan (PK), patente (FK), descripcion, cada_km, ultimo_km)
- **repuesto** (codigo (PK), descripcion, stock, stock_minimo)
- **salida** (id_salida (PK), patente (FK), legajo_chofer (FK), estado, hora_salida, hora_regreso, origen, destino, kilometraje)
- **vehiculo** (patente (PK), marca, modelo, tipo, estado, codigo_area (FK), km_actual)
