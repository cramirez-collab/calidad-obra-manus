# Control de Calidad de Obra - TODO

## Base de Datos
- [x] Esquema de usuarios con 4 roles (admin, supervisor, jefe_residente, residente)
- [x] Tabla de empresas
- [x] Tabla de unidades
- [x] Tabla de especialidades
- [x] Tabla de atributos
- [x] Tabla de ítems de calidad con fotos antes/después
- [x] Tabla de historial de estados/aprobaciones

## Backend (tRPC Routers)
- [x] Router de autenticación y gestión de usuarios
- [x] Router CRUD de empresas
- [x] Router CRUD de unidades
- [x] Router CRUD de especialidades
- [x] Router CRUD de atributos
- [x] Router de ítems de calidad (crear, actualizar, listar, filtrar)
- [x] Router de aprobaciones (aprobar, rechazar, pendiente)
- [x] Router de estadísticas con filtros múltiples
- [x] Endpoint público para consulta por QR

## Frontend - Autenticación y Roles
- [x] Sistema de login con Manus OAuth
- [x] Dashboard diferenciado por rol
- [x] Protección de rutas según permisos

## Frontend - Gestión de Catálogos
- [x] CRUD de empresas
- [x] CRUD de unidades
- [x] CRUD de especialidades
- [x] CRUD de atributos
- [x] Gestión de usuarios y asignación de roles

## Frontend - Flujo de Ítems
- [x] Formulario de captura de ítem con foto "antes"
- [x] Herramienta de marcado/dibujo en tinta roja sobre imagen
- [x] Captura de foto "después" por jefe de residente
- [x] Panel de aprobación para supervisores
- [x] Timeline de estados del ítem

## Frontend - Seguimiento y QR
- [x] Generación automática de código QR por ítem
- [x] Página pública de seguimiento por QR
- [x] Galería de ítems con vista antes/después

## Frontend - Estadísticas
- [x] Panel de estadísticas general
- [x] Filtros por empresa, residente, supervisor
- [x] Filtros por unidad, especialidad, atributo
- [x] Filtro por rango de fechas
- [x] Gráficos y visualizaciones

## UI/UX
- [x] Diseño responsivo (móvil, tablet, desktop)
- [x] Tema profesional corporativo
- [x] Navegación clara por rol
