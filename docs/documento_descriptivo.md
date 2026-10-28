# Documento descriptivo, Caso 1: gestión de flota y mantenimiento

## 1. Contexto de la empresa
Una empresa minera de alta montaña opera una flota de camionetas, camiones y buses que se desplazan entre San Juan, Batidero, Rodeo y La Guanaca. Cada vehículo pertenece a un área de la empresa y sale a ruta con un chofer. Hoy los vencimientos de licencias y documentación no se controlan de forma sistemática, hay salidas sin chequeo previo registrado y el mantenimiento no tiene trazabilidad ni control de repuestos. El sistema busca que ningún vehículo salga sin chequeo, documentación y licencia vigentes, que el mantenimiento preventivo se haga a tiempo y que el pañol tenga el stock bajo control.
## 2. Actores y roles
- **Supervisor de flota.** Solicita salidas, revisa el estado de la flota, genera y atiende alertas de vencimiento y consulta los indicadores.
- **Chofer.** Registra el chequeo previo de su vehículo, inicia la salida si el chequeo fue aprobado y la cierra al regresar informando los kilómetros.
- **Jefe de taller.** Abre y cierra mantenimientos correctivos y preventivos, asigna mecánicos y administra los planes preventivos por kilometraje.
- **Pañolero.** Registra ingresos de repuestos y las entregas a los mantenimientos, y controla el stock y los puntos de reposición.
- **Administrador.** Mantiene los datos maestros: vehículos, áreas, choferes y documentación.
## 3. Datos del negocio según el nuevo MER
Las entidades de la etapa 1 se mantienen. Se incorporan las siguientes (ver sección 3 y el diagrama):
- **VEHICULO** (modificada). Se agrega km_actual, necesario para saber cuándo corresponde un preventivo. Se actualiza al cerrar cada salida.
- **REPUESTO** (modificada). Se agrega stock_minimo, que define cuándo hay que reponer.
- **PLAN_PREVENTIVO** (nueva). Guarda cada plan de mantenimiento por kilometraje de un vehículo (descripción, intervalo y último kilometraje atendido).
- **MOVIMIENTO_STOCK** (nueva). Registra cada ingreso, consumo o ajuste de repuestos; es la única vía para cambiar el stock.
- **ALERTA_VENCIMIENTO** (nueva). Guarda las alertas de vencimiento y quién las atendió.
## 4. Funciones logísticas
- **F1. Plan de mantenimiento preventivo por kilometraje** Problema: El modelo de la etapa 1 registra mantenimientos preventivos, pero nada indica cuándo corresponde hacerlos. Los services se hacen por memoria o tarde. Usuario: Jefe de taller. Datos: Kilometraje actual de cada vehículo, intervalo de cada plan (por ejemplo cada 10.000 km) y kilometraje del último preventivo. Decisión: Se agrega el kilometraje acumulado al vehículo, que se actualiza solo al cerrar cada salida, y una entidad PLAN_PREVENTIVO. Una vista lista los planes vencidos y una función abre el mantenimiento preventivo desde el plan. No se genera el mantenimiento de forma automática porque requiere asignar un mecánico.
- **F2. Control de stock del pañol con movimientos y punto de reposición** Problema: La etapa 1 solo descuenta stock al usar un repuesto. No hay registro de ingresos, ni de quién retiró qué, ni aviso cuando un repuesto se está agotando. Usuario: Pañolero. Datos: Cada movimiento (ingreso, consumo, ajuste) con fecha, cantidad y mantenimiento de origen, y un stock mínimo por repuesto. Decisión: Se agrega la entidad MOVIMIENTO_STOCK y el atributo stock_minimo. El stock cambia únicamente a través de movimientos, lo que da trazabilidad completa. Una vista muestra los repuestos en o bajo el mínimo.
- **F3. Alertas de vencimiento con seguimiento** Problema: La vista de la etapa 1 muestra vencimientos próximos, pero no queda registro de quién los vio ni si se resolvieron. Un vencimiento puede avisarse una y otra vez o pasar inadvertido. Usuario: Supervisor de flota. Datos: Alerta por documento o licencia, con fecha de generación, estado (pendiente o atendida), quién la atendió y cuándo. Decisión: Se agrega la entidad ALERTA_VENCIMIENTO, que se genera una sola vez por vencimiento y se marca como atendida. Una alerta apunta a un documento o a una licencia de chofer, nunca a ambos.
- **F4. Indicadores de flota** Problema: Quien supervisa no puede ver de un vistazo el estado de la flota: cuántos vehículos están operativos, cuántas salidas se bloquearon o cuántos correctivos tuvo cada unidad. Usuario: Supervisor de flota. Datos: Datos que ya existen: estado, kilometraje, salidas y mantenimientos por vehículo. Decisión: No requiere entidades nuevas. Se resuelve con una vista de indicadores por vehículo y un tablero en la aplicación.
## 5. Reglas del negocio
1. Toda salida nace en estado solicitada y solo puede pasar a en curso, bloqueada o finalizada en el orden definido.
2. Una salida solo puede iniciarse si tiene un chequeo aprobado, el vehículo está operativo, tiene seguro, VTV y habilitación de altura vigentes y la licencia del chofer no está vencida.
3. El resultado del chequeo se calcula a partir de sus ítems: si falla uno, el chequeo queda rechazado, la salida se bloquea y el vehículo pasa a fuera de servicio.
4. Un vehículo o un chofer no pueden estar en dos salidas al mismo tiempo.
5. Al abrir un mantenimiento el vehículo pasa a en mantenimiento; al cerrarlo vuelve a operativo si no tiene otros abiertos.
6. Al cerrar una salida, los kilómetros recorridos se suman al kilometraje actual del vehículo.
7. Un plan preventivo vence cuando el kilometraje actual menos el kilometraje del último preventivo alcanza el intervalo del plan.
8. El stock de un repuesto solo cambia mediante movimientos; nunca puede quedar negativo.
9. Un repuesto está en reposición cuando su stock es menor o igual a su stock mínimo.
10. Una alerta de vencimiento se genera una sola vez por documento o licencia y vencimiento, y puede atenderse una sola vez.
## 6. Pantallas y reportes por rol
| Rol | Pantalla | Contenido |
|---|---|---|
| Supervisor de flota | Tablero | Vehículos por estado, salidas en curso, alertas pendientes, preventivos pendientes, repuestos bajo el mínimo e indicadores por vehículo. |
| Supervisor de flota | Salidas | Solicitud de salida (vehículo, chofer, origen, destino) y listado de salidas con su estado. |
| Supervisor de flota | Vehículos | Listado de la flota con área, estado y kilometraje. |
| Supervisor de flota | Alertas | Generación de alertas a 30 días y atención de cada una. |
| Chofer | Mis salidas | Salidas del chofer, formulario de chequeo previo, inicio de salida y cierre con kilómetros. |
| Jefe de taller | Mantenimientos | Apertura de mantenimientos, listado y cierre. |
| Jefe de taller | Preventivos | Planes vencidos por kilometraje con apertura de preventivo, y alta de planes. |
| Pañolero | Repuestos | Stock con aviso de reposición, ingreso de repuestos, entrega a mantenimientos y últimos movimientos. |
| Administrador | Maestros | Alta de vehículos, carga y renovación de documentación, listado de choferes con su licencia. |

## 7. Datos de ejemplo (ficticios)
- Vehículos: AA111AA (camioneta, área Operaciones de mina), AA333CC (camión con VTV vencida), AA444DD (bus con seguro por vencer), AA555EE (camioneta con chequeo rechazado).
- Choferes: CH001 y CH004 con licencia vigente; CH002 con licencia vencida; CH003 con licencia por vencer en 15 días. Los nombres son inventados (Chofer Ficticio Uno, etc.).
- Mecánicos: ME001 y ME002. Repuestos: REP-FILT-01 (filtro de aceite), REP-PAST-02 (pastillas de freno), REP-ACEI-03 (aceite de motor).
- Planes preventivos: service de 10.000 km para AA111AA y AA333CC, cambio de neumáticos cada 40.000 km para AA444DD. AA333CC tiene 12.500 km y tiene el service vencido.
- Una salida finalizada de AA222BB de 180 km, una salida solicitada que espera chequeo y una salida bloqueada con el vehículo en mantenimiento correctivo.
## 8. Requisitos técnicos
- Aplicación web de una sola página con React, TypeScript y Vite, en español, con selector de rol y una pantalla por función.
- Base de datos en Supabase (PostgreSQL). Las reglas del negocio viven en la base (restricciones y triggers). La aplicación consume tablas, vistas y funciones (RPC) mediante supabase-js.
- Seguridad por filas (RLS) habilitada en todas las tablas. En esta versión las políticas son abiertas para la demostración y el rol se elige en pantalla; para producción corresponde usar Supabase Auth y políticas por rol.
- Despliegue en Vercel como sitio estático. Las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY se cargan en Vercel y en un archivo .env local que no se sube al repositorio.
- Repositorio en GitHub con el código, la carpeta docs, el README, un .env.example sin valores y un .gitignore que excluye .env.
- Todos los datos son inventados. No se usan DNI, tarjetas ni nombres de personas reales.
