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


## Mejoras de Usabilidad y Branding (Quinta Iteración)

### Responsividad y Uso en Obra
- [x] Diseño optimizado para tablet en obra
- [x] Diseño optimizado para móvil
- [x] Interfaz rápida y fluida en todos los dispositivos
- [x] Botones grandes para uso con guantes

### Fotos sin Pérdida de Resolución
- [x] Almacenamiento en calidad original
- [x] Sin compresión de imágenes
- [x] Visualización en alta resolución

### Bitácora de Uso
- [x] Tabla de registro de actividades
- [x] Registro por usuario de todas las acciones
- [x] Historial de accesos y modificaciones

### Roles Mejorados
- [x] Superadministrador con acceso total
- [x] Supervisor sin acceso a configuración crítica
- [x] Permisos granulares por rol

### Página de Bienvenida
- [x] Dashboard personalizado por usuario
- [x] Listado de pendientes ordenados del más antiguo al más nuevo
- [x] Acceso rápido a tareas asignadas

### Código Progresivo
- [x] Formato OQC-00001
- [x] Incremento automático de 1 en 1
- [x] Único y secuencial

### Branding Objetiva
- [x] Logo en pantallas principales
- [x] Logo en reportes exportados
- [x] Colores corporativos Objetiva (#02B381 verde, #002C63 azul)


## Relaciones en Cadena (Sexta Iteración)

### Especialidades con Atributos
- [x] Al jalar especialidad, traer sus atributos asociados
- [x] Relación especialidad → atributos en DB

### Residentes con Datos Completos
- [x] Al jalar residente, traer sus especialidades
- [x] Al jalar residente, traer sus atributos
- [x] Al jalar residente, traer sus ítems
- [x] Estadísticas por residente (rechazados, aprobados, pendientes)

### Cadena de Relaciones
- [x] Empresas → Unidades → Ítems
- [x] Supervisores → Ítems aprobados/rechazados
- [x] Jefes de Residente → Ítems revisados
- [x] Cada entidad con sus estadísticas


## Mejoras de UX y QR (Séptima Iteración)

### Formato de Fechas
- [x] Cambiar formato a dd-mm-aa en toda la aplicación
- [x] Aplicar en listas, detalles y reportes

### QR Mejorado
- [x] QR con código OQC visible impreso debajo
- [x] Generador de QR por rangos (ej: OQC-00001 a OQC-00100)
- [x] Vista de impresión optimizada para pegar en sitio
- [x] QR escaneable que lleva directo al ítem

### Vistas de Detalle Enriquecidas
- [x] Detalle de empresa con usuarios, unidades, ítems y gráficos
- [x] Detalle de residente con especialidades, atributos y estadísticas
- [x] Detalle de unidad con empresas y especialidades

### Filtros Inteligentes
- [x] Al seleccionar especialidad, mostrar solo sus atributos
- [x] Filtros en cascada (empresa → unidad → especialidad → atributo)


## Responsividad y Configuración (Octava Iteración)

### Responsividad Optimizada
- [x] Diseño mobile-first para móvil
- [x] Diseño optimizado para tablet en obra
- [x] Diseño completo para PC/desktop
- [x] Menú hamburguesa a la derecha en móvil
- [x] Botones táctiles grandes para uso en obra
- [x] Cards compactas en móvil, expandidas en desktop

### Módulo de Configuración y Metas
- [x] Página de Configuración solo para superadmin/supervisor
- [x] Gestión de metas por empresa/unidad
- [x] Configuración de umbrales de alertas
- [x] Configuración de tiempos límite
- [x] Gestión de parámetros del sistema

### UI Minimalista con Iconos
- [x] Reducir textos, usar más iconos
- [x] Iconos monocromáticos profesionales
- [x] Tooltips en hover para explicar iconos
- [x] Navegación intuitiva sin necesidad de leer
- [x] Acciones rápidas con iconos grandes


## Verificación de Estética Final (Novena Iteración)

### Colores Corporativos Unificados
- [x] Verde primario #02B381 en botones de acción principal
- [x] Azul institucional #002C63 en encabezados y estructura
- [x] Grises corporativos en textos y fondos
- [x] Regla 60-30-10 aplicada correctamente

### Consistencia Visual
- [x] Cards con sombras suaves y bordes limpios
- [x] Iconos monocromáticos profesionales
- [x] Tipografía legible en todos los tamaños
- [x] Espaciado consistente entre elementos

### Verificación de Pantallas
- [x] Página de inicio con colores corporativos
- [x] Página de nuevo ítem con formulario limpio
- [x] Página de generación de QR funcional
- [x] Página de lista de ítems con filtros
- [x] Página de estadísticas con gráficos
- [x] Página de metas con indicadores de progreso


## Optimización Final ObjetivaQC (Décima Iteración)

### Renombrar App
- [x] Cambiar nombre a "ObjetivaQC"
- [x] Actualizar título en todas las páginas
- [x] Actualizar manifest.json para PWA

### Alineación de Contenedores
- [x] Textos bien alineados en todas las cards
- [x] Contenedores con espaciado consistente
- [x] Grid responsivo optimizado
- [x] Sin scroll excesivo para acceder a funciones

### Velocidad de Carga
- [x] Lazy loading de componentes pesados
- [x] Prefetch de rutas frecuentes
- [x] Optimización de bundle size
- [x] Caché agresivo de datos

### Exportación PDF y CSV
- [x] Exportar lista de ítems a Excel
- [x] Exportar lista de ítems a CSV
- [x] Exportar estadísticas a Excel
- [x] Exportar estadísticas a CSV
- [x] Reportes con logo Objetiva


## Gestión Avanzada de Usuarios y Defectos (Undécima Iteración)

### Gestión de Usuarios con Roles y Empresas
- [x] Alta de usuarios manualmente
- [x] Edición de datos de usuarios
- [x] Asignación de roles (Superadmin, Admin, Supervisor, Jefe Residente, Residente)
- [x] Vinculación de usuarios a empresas
- [x] Filtros por rol y empresa
- [x] Estadísticas de usuarios por rol
- [x] Activar/desactivar usuarios

### Catálogo de Defectos
- [x] Tabla de defectos en base de datos
- [x] CRUD completo de defectos
- [x] Código único por defecto
- [x] Severidad (leve, moderado, grave, crítico)
- [x] Tiempo estimado de resolución
- [x] Vinculación defecto-especialidad
- [x] Defectos filtrados por especialidad en formulario de ítem

### Estadísticas de Defectos
- [x] Gráfico de top 10 tipos de defectos
- [x] Distribución por severidad (pie chart)
- [x] Tasa de aprobación por defecto
- [x] KPIs de defectos graves y críticos
- [x] Integración en página de estadísticas

### Reporte Fotográfico PDF
- [x] Página de generación de reportes
- [x] Multifiltro (empresa, unidad, especialidad, estado, fechas)
- [x] Vista previa de ítems seleccionados
- [x] Generación de PDF con fotos antes/después
- [x] Logo de Objetiva en encabezado
- [x] Estadísticas en el reporte
- [x] Exportación a CSV adicional
