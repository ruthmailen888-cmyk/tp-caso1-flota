# Caso 1: Gestión de flota y mantenimiento

**Trabajo Práctico 2 – Etapa 2**
**Materia:** Informática Aplicada
**Carrera:** Tecnicatura Universitaria en Logística – UTN

**Integrantes:** Yanila Jasmin Benítez, Ruth Maillen Martínez y Leonardo Domínguez.

## Descripción del proyecto

Este proyecto consiste en desarrollar una aplicación web para la gestión de una flota de vehículos y el control de su mantenimiento.

La aplicación permite organizar la información de los vehículos y realizar diferentes consultas según el rol de cada usuario. También contempla el seguimiento de las salidas, las alertas, los controles necesarios antes de utilizar un vehículo y las tareas de mantenimiento.

El objetivo es tener la información organizada en un solo lugar y facilitar el control de las actividades relacionadas con la flota.

## Objetivo

Aplicar los conocimientos adquiridos en la materia para desarrollar un sistema que ayude a organizar la información y mejorar el seguimiento de los vehículos, teniendo en cuenta la importancia del mantenimiento y el control dentro de una empresa de transporte.

## Tecnologías utilizadas

Para desarrollar el proyecto se utilizaron las siguientes herramientas:

* **React:** para construir la interfaz de la aplicación.
* **TypeScript:** para trabajar con el código de manera organizada.
* **Vite:** para ejecutar y preparar la aplicación web.
* **Supabase y PostgreSQL:** para almacenar y administrar los datos.

## Organización del proyecto

El repositorio contiene los siguientes archivos y carpetas principales:

* `src/`: contiene el código de la aplicación web.
* `supabase/`: contiene los archivos relacionados con la base de datos.
* `supabase/migrations/`: incluye los cambios realizados en la estructura de la base de datos durante las distintas etapas.
* `supabase/seed.sql`: contiene datos ficticios para realizar pruebas.
* `docs/`: incluye la documentación del proyecto, los modelos de datos y las capturas de pantalla.

## Puesta en marcha

Para ejecutar el proyecto en un entorno local, es necesario:

1. Crear un proyecto en Supabase y configurar la base de datos con los archivos SQL incluidos en el repositorio.
2. Configurar las variables de entorno necesarias para conectar la aplicación con Supabase.
3. Instalar las dependencias del proyecto mediante `npm install`.
4. Iniciar la aplicación con `npm run dev`.

## Datos utilizados

Los datos incluidos en el proyecto son ficticios y se utilizan únicamente con fines de demostración y prueba.

## Conclusión

El desarrollo de este trabajo permite relacionar los conocimientos de informática con situaciones propias de la logística. La organización de los datos y el seguimiento de los vehículos son aspectos importantes para llevar un mejor control de la flota y de sus tareas de mantenimiento.
