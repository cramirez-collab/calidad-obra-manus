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


## Mejoras Adicionales (Nueva Iteración)

### Notificaciones Push
- [x] Notificación al supervisor cuando hay ítems pendientes de aprobación
- [x] Notificación al jefe de residente cuando hay ítems pendientes de foto después
- [x] Notificación al residente cuando su ítem es aprobado o rechazado
- [x] Centro de notificaciones en el dashboard

### Exportación de Reportes
- [x] Exportar listado de ítems a Excel
- [x] Exportar estadísticas a Excel
- [x] Filtros aplicados en la exportación

### Sistema de Comentarios
- [x] Tabla de comentarios en base de datos
- [x] Agregar comentarios en cada etapa del flujo
- [x] Mostrar historial de comentarios en detalle del ítem
- [x] Comentarios obligatorios al rechazar (ya implementado)


## Mejoras Avanzadas (Tercera Iteración)

### Notificaciones por Email
- [x] Configurar servicio de envío de emails
- [x] Enviar email al supervisor cuando hay ítems pendientes de aprobación
- [x] Enviar email al residente cuando su ítem es aprobado o rechazado
- [x] Plantillas HTML para emails profesionales

### Dashboard de KPIs
- [x] Tiempo promedio de resolución por ítem
- [x] Tasa de aprobación vs rechazo
- [x] Métricas por supervisor (rendimiento)
- [x] Tendencias mensuales con gráficos
- [x] Comparativa entre empresas/unidades

### Modo Offline (PWA)
- [x] Configurar Service Worker
- [x] Manifest.json para instalación
- [x] Cache de recursos estáticos
- [x] Captura de fotos offline con IndexedDB
- [x] Sincronización automática al reconectar


## Optimización de Rendimiento (Cuarta Iteración)

### Tiempo Real Multiusuario (WebSocket)
- [x] Configurar Socket.io en el servidor
- [x] Sincronización en tiempo real de ítems
- [x] Notificaciones push instantáneas
- [x] Soporte para 30+ usuarios concurrentes
- [x] Indicador de usuarios conectados

### Optimización de Velocidad
- [x] Lazy loading de componentes
- [x] Caché agresivo de datos
- [x] Optimización de queries SQL
- [x] Compresión de imágenes
- [x] Paginación eficiente

### Diseño No Invasivo
- [x] Notificaciones sutiles (toast pequeños)
- [x] Eliminar popups intrusivos
- [x] Indicadores discretos de estado
- [x] Interfaz limpia y minimalista
- [x] Animaciones suaves no bloqueantes
