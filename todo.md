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


## Mejoras de Responsividad y Estandarización (Duodécima Iteración)

### Responsividad Móvil
- [x] Corregir botones que salen de pantalla en móvil
- [x] Ajustar grids y contenedores para pantallas pequeñas
- [x] Optimizar cards y formularios para móvil
- [x] Verificar navegación en dispositivos táctiles

### Favicon OQC
- [x] Crear favicon circular con fondo blanco
- [x] Letras "OQC" en verde Objetiva (#02B381)
- [x] Actualizar manifest.json con nuevo favicon

### Catálogo Estándar
- [x] Definir especialidades estándar para construcción
- [x] Definir atributos estándar por especialidad
- [x] Documentar catálogo para referencia


## Sistema Multiproyecto (Decimotercera Iteración)

### Base de Datos - Proyectos
- [x] Crear tabla de proyectos con nombre, descripción, logo, fechas
- [x] Crear tabla de relación proyecto-usuario
- [x] Agregar campo proyectoId a tabla de empresas
- [x] Agregar campo proyectoId a tabla de unidades
- [x] Agregar campo proyectoId a tabla de especialidades
- [x] Agregar campo proyectoId a tabla de ítems
- [ ] Migrar datos existentes al proyecto por defecto

### Backend - Endpoints de Proyectos
- [x] Router CRUD de proyectos
- [x] Endpoint para asignar usuarios a proyectos
- [x] Endpoint para listar usuarios por proyecto
- [x] Filtros en cascada desde proyecto en todos los routers
- [x] Estadísticas por proyecto

### Frontend - Gestión de Proyectos
- [x] Página de listado de proyectos
- [x] Formulario de crear/editar proyecto
- [x] Asignación de usuarios a proyectos
- [x] Selector de proyecto activo en header/sidebar
- [x] Filtros en cascada desde proyecto en todas las páginas

### Reportes con Nombre de Proyecto
- [x] Campo de nombre personalizado en proyecto
- [x] Mostrar nombre de proyecto en reportes PDF
- [ ] Logo del proyecto en reportes (opcional)


## Sistema de Mensajería, Badges y Auditoría (Decimocuarta Iteración)

### Sistema de Mensajería con @mentions
- [x] Crear tabla de mensajes por ítem en base de datos
- [x] Implementar hilos de conversación por ítem
- [x] Sistema de @mentions para etiquetar usuarios
- [x] Notificaciones cuando te mencionan
- [x] Componente de chat en detalle de ítem

### Sistema de Badges con Conteo
- [x] Badge rojo: ítems rechazados (pendientes de corrección)
- [x] Badge verde: ítems aprobados por jefe de residente
- [x] Badge azul: ítems aprobados por supervisor (OK final)
- [x] Contadores visibles en el header
- [x] Actualización en tiempo real de badges

### Permisos Avanzados
- [x] Admin/Superadmin pueden eliminar ítems aprobados
- [x] Admin/Superadmin pueden rechazar ítems ya aprobados
- [x] Registro de quién hizo cada acción con fecha/hora

### Bitácora de Auditoría
- [x] Tabla de auditoría con todas las acciones
- [x] Registro: usuario, acción, fecha, hora, ítem afectado
- [x] Página de bitácora solo para Admin/Superadmin
- [x] Exportación a PDF
- [x] Exportación a CSV

### Estadísticas Avanzadas de Rendimiento
- [x] Ranking de defectos por usuario (mayor a menor)
- [x] Ranking de aprobaciones por usuario
- [x] Ranking de OK de supervisor por usuario
- [x] Tiempos de respuesta por usuario
- [x] Tiempo promedio para aprobar
- [x] Tiempo promedio para lograr OK de supervisor
- [x] Métricas adicionales para toma de decisiones


### Escáner QR Flotante Global
- [x] Crear componente de botón flotante de escáner QR
- [x] Integrar escáner en todas las pantallas (DashboardLayout)
- [x] Al escanear, navegar directamente al ítem correspondiente
- [x] Posición estratégica que no interfiera con la UI


## Corrección Escáner QR (Decimoquinta Iteración)

### Mejoras del Escáner QR
- [x] Mejorar manejo de permisos de cámara denegados
- [x] Agregar opción de ingresar código manualmente
- [x] Mejorar mensajes de error y guía al usuario
- [x] Optimizar para móvil


## Permiso de Cámara al Login (Decimosexta Iteración)

- [x] Solicitar permiso de cámara después del login exitoso
- [x] Guardar estado de permiso en localStorage
- [x] No volver a solicitar si ya fue concedido


## URGENTE: Escáner QR y Usuarios (Enero 2026)

### Escáner QR - MANDATORIO
- [x] Corregir lectura de códigos QR con cámara (@zxing/browser)
- [x] Implementar librería de escaneo más robusta y estable
- [x] Optimizar para dispositivos móviles
- [x] Manejar errores de permisos correctamente
- [x] Fallback a cámara frontal si trasera no disponible
- [x] Escaneo continuo automático
- [x] Navegación directa al ítem al detectar QR
- [x] Marco visual de escaneo con animación

### Alta de Usuarios - Solo Admin/Superadmin
- [x] Restringir formulario de alta de usuarios a Admin/Superadmin
- [x] Agregar campo de contraseña para nuevos usuarios
- [x] Validar permisos en backend


## Enlaces Externos (Enero 2026)
- [x] Agregar enlace "Secuencias" al menú lateral (AppSheet)
- [x] Agregar enlace "Visor" al menú lateral (Google Sheets)
- [x] Agregar enlace "Planos" al menú lateral (Google Drive)
- [x] Abrir URLs externas en nueva pestaña


## Selector de Proyectos (Enero 2026)
- [x] Agregar selector de proyecto en el menú lateral
- [x] Guardar proyecto seleccionado en localStorage
- [ ] Filtrar datos según proyecto activo (pendiente integración)


## Aislamiento por Proyecto (Enero 2026)

### Backend - Filtrado por Proyecto
- [ ] Filtrar usuarios por proyectos asignados
- [ ] Filtrar empresas por proyecto
- [ ] Filtrar unidades por proyecto
- [ ] Filtrar especialidades por proyecto
- [ ] Filtrar ítems por proyecto
- [ ] Superadmin ve todos los proyectos
- [ ] Admin/Supervisor designados por proyecto

### Frontend - Integración de Proyecto Activo
- [ ] Usar proyecto seleccionado en todas las consultas
- [ ] Mostrar solo proyectos asignados al usuario
- [ ] Filtrar listas según proyecto activo


## Aislamiento por Proyecto (Decimoquinta Iteración)

### Contexto Global de Proyecto
- [x] Crear ProjectContext para compartir proyecto seleccionado
- [x] Integrar ProjectProvider en App.tsx
- [x] Actualizar ProjectSelector para usar contexto global
- [x] Persistir proyecto seleccionado en localStorage

### Filtrado de Datos por Proyecto
- [x] Agregar proyectoId a ItemFilters en db.ts
- [x] Filtrar items por proyecto en getItems()
- [x] Filtrar estadísticas por proyecto en getEstadisticas()
- [x] Filtrar empresas por proyecto en frontend
- [x] Filtrar unidades por proyecto en frontend
- [x] Filtrar especialidades por proyecto en frontend

### Actualización de Páginas
- [x] ItemsList: usar useProject para filtrar items
- [x] NuevoItem: usar proyecto del contexto
- [x] Home: estadísticas filtradas por proyecto
- [x] Empresas: filtrar por proyecto activo
- [x] Unidades: filtrar por proyecto activo
- [x] Especialidades: filtrar por proyecto activo
- [x] Atributos: filtrar por proyecto activo
- [x] Defectos: filtrar por proyecto activo
- [x] Usuarios: filtrar por proyecto activo

### Permisos por Proyecto
- [x] Verificar que usuario pertenece al proyecto seleccionado
- [x] Superadmin ve todos los proyectos
- [x] Usuarios normales solo ven proyectos asignados
- [ ] Validación en backend de permisos por proyecto


## Módulo Vista Panorámica de Obra (Decimosexta Iteración)

### Backend
- [x] Agregar campos nivel, fechaInicio, fechaFin a tabla unidades
- [x] Crear endpoint para obtener unidades con estadísticas de ítems
- [x] Endpoint para importar unidades desde Excel

### Frontend - Vista Panorámica
- [x] Crear página VistaPanoramica.tsx con cuadrícula visual
- [x] Cuadrícula organizada por niveles (filas) y unidades (columnas)
- [x] Badges de color: Rojo=rechazados, Verde=pendientes, Azul Objetiva=100% completado
- [x] Click en cuadro navega a ítems filtrados por unidad
- [x] Mostrar fechas inicio/fin de cada unidad

### Carga de Excel
- [x] Componente para subir archivo Excel
- [x] Parser de Excel con columnas: Nivel, Unidad, FechaInicio, FechaFin
- [x] Validación y preview antes de importar

### Segundo Proyecto de Prueba
- [x] Proyecto "Torre Mayas" ya existe para validar aislamiento
- [x] Verificar que datos se separan correctamente por proyecto
- [x] Asignar usuario Carlos Ramirez al proyecto


## Notificaciones Personalizadas (Decimoséptima Iteración)

### Notificaciones Push al Celular
- [x] Configurar Web Push API con VAPID keys
- [x] Crear endpoint para suscripción de push
- [x] Guardar suscripciones en base de datos
- [x] Service worker para recibir notificaciones push
- [ ] Enviar push automático cuando hay ítems pendientes
- [ ] Enviar push automático cuando aprueban/rechazan un ítem
- [ ] Enviar push automático cuando te mencionan (@mention)

### Notificaciones In-App Mejoradas
- [x] Campana con contador de notificaciones no leídas
- [x] Panel desplegable con lista de notificaciones
- [x] Marcar como leída individual y todas
- [x] Tipos: pendientes, aprobaciones, rechazos, menciones
- [x] Navegación directa al ítem desde la notificación
- [x] Configuración de push en panel de notificaciones
- [x] Botón de prueba de notificación push


## Pantalla de Selección de Proyectos (Decimoctava Iteración)

### Estructura de Navegación
- [x] Pantalla inicial con lista de proyectos (cards grandes)
- [x] Click en proyecto lleva al dashboard de ESE proyecto
- [x] Todos los módulos dentro del proyecto son exclusivos de ese proyecto
- [x] Botón "Cambiar proyecto" regresa a la pantalla inicial
- [x] Reemplazar selector dropdown por botón de cambio de proyecto

### Permisos de Creación
- [x] Solo superadmin y admin pueden crear proyectos
- [x] Solo superadmin y admin configuran usuarios/roles por proyecto
- [x] Usuarios normales solo ven proyectos donde están asignados

### Contexto de Proyecto
- [x] Guardar proyecto activo en contexto global
- [x] Todas las consultas filtran por proyecto activo
- [x] Redirección automática si no hay proyecto seleccionado


## Proyecto Activo en la Nube (Decimonovena Iteración)

### Base de Datos
- [x] Agregar campo proyectoActivoId a tabla usuarios
- [x] Migración de base de datos

### Backend
- [x] Endpoint para obtener proyecto activo del usuario
- [x] Endpoint para cambiar proyecto activo del usuario
- [x] Sincronización en tiempo real via WebSocket

### Frontend
- [x] Eliminar localStorage para proyecto seleccionado
- [x] Usar base de datos para proyecto activo
- [x] Actualizar en tiempo real cuando cambia el proyecto


## Correcciones de Navegación (Vigésima Iteración)

- [x] Hidalma ahora aparece en lista de proyectos (se asignó usuario)
- [x] Pantalla de selección de proyectos funciona correctamente
- [x] Menú lateral despliega correctamente al seleccionar proyecto
- [x] Nombre del proyecto se actualiza en el sidebar al cambiar de proyecto


## Corrección de Redirección Inicial (Vigésima Primera Iteración)

- [x] Pantalla de selección de proyecto es la primera después de autenticarse
- [x] Ruta raíz (/) ahora muestra selección de proyecto
- [x] Al seleccionar proyecto navega a /bienvenida (dashboard)

## Logo y Portadas de Proyecto (Vigésima Segunda Iteración)
- [x] Corregir logo de Objetiva que no se muestra
- [x] Agregar campo imagenPortada en tabla proyectos
- [x] Permitir subir foto de portada para cada proyecto
- [x] Mostrar foto de portada en tarjetas de selección de proyecto

- [x] Crear ícono PWA optimizado con logo de Objetiva
- [x] Configurar splash screen con ícono OQC durante la carga
- [x] Actualizar PWA para mostrar ícono correcto en instalación
- [x] BUG: Especialidades no se muestran después de crear
- [x] BUG: Especialidades no se vinculan a proyecto
- [x] BUG: Empresas no se muestran después de crear - vincular a proyecto
- [x] BUG: Usuarios no se muestran después de crear - vincular a proyecto
- [x] Verificar vinculación de Unidades a proyecto y empresa
- [x] Verificar vinculación de Atributos a proyecto
- [x] Verificar vinculación de Defectos a proyecto
- [ ] Verificar estructura completa de Items con filtros
- [ ] Asegurar reportes muestren datos reales del proyecto


## Mejoras Stacking y Configuración (Ene 26)
- [x] Corregir submenú Configuración para que se despliegue
- [x] Implementar drag & drop en Stacking con espacios vacíos
- [x] Permitir insertar unidades intermedias en Stacking
- [x] Interacción móvil: tap para stats, segundo tap para ítems


## QR Consecutivos por Proyecto (Enero 2026)
- [ ] Modificar esquema de QR para numeración consecutiva por proyecto
- [ ] Actualizar lógica de generación de QR para usar numeración por proyecto
- [ ] Cada proyecto tiene su propia secuencia (Proyecto A: QR-001, QR-002... Proyecto B: QR-001, QR-002...)


## Ligar Especialidades a Empresas
- [ ] Crear relación empresa-especialidades en base de datos
- [ ] Actualizar frontend de empresas para asignar especialidades


## BUG CRÍTICO: Mezcla de Datos entre Proyectos
- [x] Diagnosticar por qué Torre Mayas muestra datos de Hidalma y viceversa
- [x] Corregir unidades.list para filtrar por proyectoId en backend
- [x] Corregir empresas.list para filtrar por proyectoId en backend
- [x] Corregir especialidades.list para filtrar por proyectoId en backend
- [x] Actualizar todas las páginas frontend para pasar proyectoId a las queries
- [x] Verificar aislamiento correcto de datos por proyecto

## BUG: Ruta /proyectos/nuevo no existe
- [x] Verificar si la ruta está registrada en App.tsx
- [x] Crear página NuevoProyecto.tsx
- [x] Registrar la ruta correctamente


## Limpieza de código no utilizado
- [x] Identificar imports no utilizados en archivos
- [x] Identificar archivos/páginas no utilizadas
- [x] Eliminar código comentado innecesario (bloques temporalmente desactivados)
- [x] Eliminar componentes no utilizados (ComponentShowcase, OfflineIndicator, CameraPermissionRequest, Map, AIChatBox, ManusDialog, useOfflineSync)
- [x] Optimizar cache de queries (staleTime 2-5 min, gcTime 10 min)
- [x] Limpiar RAM y cache de Vite
- [x] Verificar que la aplicación sigue funcionando (133 tests pasando)

## Agregar campo especialidad a empresas
- [x] Agregar campo especialidadId a tabla empresas en schema
- [x] Ejecutar migración de base de datos
- [x] Actualizar routers para incluir especialidad
- [x] Actualizar UI de empresas para seleccionar especialidad

## Sistema de Espacios y relaciones
- [x] Crear tabla de espacios (sala, comedor, cocina, recámaras, baños, etc.)
- [x] Ligar espacios a unidades (campo unidadId)
- [x] especialidadId ya existía en atributos
- [x] especialidadId ya existía en defectos
- [x] Agregar residenteId a especialidades
- [ ] Crear routers CRUD para espacios
- [ ] Crear UI para gestionar espacios por unidad
- [ ] Actualizar UI de atributos para filtrar por especialidad
- [ ] Actualizar UI de defectos para filtrar por especialidad
- [ ] Implementar sugerencias de atributos/defectos por especialidad


## Sistema de Espacios (Enero 2026)
- [x] Crear tabla de espacios en base de datos
- [x] Ligar espacios a unidades (campo unidadId)
- [x] Agregar residenteId a especialidades
- [x] Crear router y funciones CRUD para espacios
- [x] Crear página de gestión de Espacios con plantilla
- [x] Espacios sugeridos (Sala, Comedor, Cocina, Recámaras, Baños, etc.)
- [x] Copiar espacios plantilla a unidades
- [x] Agregar Espacios al menú de configuración
- [x] Actualizar UI de especialidades para agregar residente responsable
- [ ] Integrar espacios en formulario de nuevo ítem

## Simplificación del formulario de Nuevo Ítem (Enero 26)
- [ ] QR de ítem: agregar opción de foto "después" y validar
- [ ] Empresa → Especialidad automática al seleccionar empresa
- [ ] Proyecto automático (sin selector, usa el proyecto activo)
- [ ] Tipo de problema opcional (no obligatorio)
- [ ] Eliminar campo de atributos del formulario
- [ ] Defectos en cascada por especialidad con sugerencias típicas
- [ ] Reemplazar "Ubicación Específica" por selector de Espacios
- [ ] Eliminar campos descripción y comentario adicional
- [ ] Formulario en una sola pantalla (sin botón "Siguiente")


## Simplificación del formulario de nuevo ítem (Enero 2026)
- [x] Eliminar selector de proyecto (usar proyecto activo automáticamente)
- [x] Empresa → Especialidad automática
- [x] Tipo de problema opcional (defectoId opcional)
- [x] Eliminar atributos del formulario
- [x] Defectos en cascada por especialidad
- [x] Espacios en lugar de "Ubicación Específica"
- [x] Eliminar descripción y comentario
- [x] Formulario en una sola pantalla con fotos
- [x] QR de ítem: agregar opción de foto "después" y validar

## Permisos de eliminación y selección desde BD
- [x] Botón eliminar solo visible para admin/superadmin/supervisor
- [x] Residentes no ven el icono de eliminar
- [x] Espacios seleccionables desde base de datos (filtrados por unidad)
- [x] Defectos seleccionables desde base de datos (filtrados por especialidad)
- [x] Poblados 48 defectos típicos por especialidad (estructura, hidráulica, eléctrica, gas, hvac, supervisión)


## Optimización Ultra-Rápida del Flujo de Trabajo (Enero 26)

### Prellenado Automático desde Configuración
- [x] Usuario → Empresa automática (si tiene una sola asignada)
- [x] Empresa → Especialidades automáticas (las de esa empresa)
- [x] Unidad → Espacios automáticos (los de esa unidad)
- [x] Especialidad → Defectos automáticos (los de esa especialidad)
- [x] Residente → Su empresa, especialidades y unidades asignadas

### Dashboard Pivote de Residentes
- [x] Vista principal enfocada en tareas del residente (/mis-tareas)
- [x] Pendientes ordenados por antigüedad (más viejo primero)
- [x] Indicadores de urgencia por días sin resolver (crítico >7d, alto >3d)
- [x] Acceso directo a crear ítem con prellenado

### Priorización de Correcciones (Peor a Mejor)
- [x] Lista de ítems ordenada por severidad + antigüedad (/prioridades)
- [x] Indicadores visuales de criticidad (rojo/naranja/amarillo)
- [x] Top 5 empresas con más defectos graves
- [x] Top 5 residentes con más pendientes
- [x] Top 5 especialidades más problemáticas

### UI/UX Mínima Suficiente
- [x] Eliminar campos innecesarios del formulario
- [x] Botones de acción rápida (1-2 toques máximo)
- [x] Cards compactas con información esencial
- [x] Sin scroll excesivo para funciones principales
- [x] Navegación por iconos sin texto redundante

### Formulario Nuevo Ítem Ultra-Rápido
- [x] Prellenar empresa del usuario logueado
- [x] Prellenar especialidad de la empresa
- [x] Prellenar unidad si hay una sola asignada
- [x] Selector de espacio con búsqueda rápida
- [x] Selector de defecto con sugerencias frecuentes (defectos frecuentes del usuario)
- [x] Captura de foto en un solo paso
- [x] Modo rápido activable/desactivable


## Vinculaciones de Usuarios y Estadísticas Completas (Enero 26)

### Vinculaciones de Usuarios en Ítems
- [x] Verificar campo creadoPor (residenteId - usuario que creó el ítem)
- [x] Verificar campo asignadoA (empresaId - empresa responsable)
- [x] Verificar campo aprobadoPor (jefeResidenteId - jefe residente que aprobó)
- [x] Verificar campo supervisorOk (supervisorId - supervisor que dio OK final)
- [x] Mostrar usuarios vinculados en detalle del ítem

### Estadísticas por Usuario
- [x] Ítems creados por usuario (getEstadisticasUsuario)
- [x] Ítems aprobados por usuario
- [x] Ítems rechazados por usuario
- [x] Tiempo promedio de resolución por usuario
- [x] Ranking de rendimiento por usuario (getRankingRendimientoUsuarios)

### Estadísticas por Defecto
- [x] Top defectos más frecuentes (getEstadisticasDefecto)
- [x] Defectos por severidad
- [x] Defectos por especialidad
- [x] Tiempo promedio de corrección por tipo de defecto

### Estadísticas de Mensajería y Seguimiento
- [x] Mensajes por ítem (getEstadisticasMensajeria)
- [x] @mentions por usuario (usuariosMasMencionados)
- [x] Actividad de seguimiento por usuario (getEstadisticasSeguimiento)
- [x] Bitácora de acciones por día

### Integración QR con Stacking
- [x] QR vinculado a unidad en stacking (botón QR en modal de unidad)
- [x] Generar QR por unidad específica (selector en GenerarQR)
- [x] Trazabilidad completa desde QR hasta estadísticas (getEstadisticasQR)
- [x] Distribución de ítems por unidad en estadísticas


## Mejoras UI Enero 27

### Lista de Ítems
- [x] Agregar botón eliminar en cada ítem de la lista
- [x] Solo visible para admin/supervisor/superadmin
- [x] Icono de bote de basura discreto

### Mis Tareas
- [x] Eliminar colores plasta grandes (fondo azul oscuro)
- [x] Diseño más limpio y minimalista
- [x] Mantener funcionalidad pero mejorar estética

### Formulario Nuevo Ítem
- [x] Cambiar "¿Qué problema encontraste?" por "Descripción breve (opcional)"
- [x] Título ahora es opcional - usa nombre del defecto si no hay título
- [x] Selector de Unidad ya existe
- [x] Selector de Espacio (del catálogo por unidad)
- [x] Selector de Defecto (del catálogo por especialidad)
- [x] Selector de Empresa (responsable)


## Mejoras Stacking Enero 27

### Problemas a corregir
- [x] Corregir alta de unidades en stacking (agregados campos nivel y orden al formulario)
- [x] Ordenar stacking de piso menor a mayor (revisión de abajo hacia arriba)

### Nuevas funcionalidades
- [x] Botón para ver/descargar PDF del stacking
- [x] PDF ordenado de mayor a menor (para impresión)
- [x] Página /stacking/pdf con vista previa e impresión


## Limpieza de Módulos Redundantes Enero 27

- [x] Eliminar módulo Prioridades
- [x] Eliminar módulo Revisión
- [x] Eliminar módulo Estadísticas Avanzadas
- [x] Eliminar módulo Reportes
- [x] Limpiar menú de navegación


## Corrección Generador QR Enero 27

- [x] Cambiar generación de QR de unidad a ítem (modo "Por Ítems")
- [x] Ajustar diseño para 6 QR por hoja carta (2x3)
- [x] Encuadrar correctamente los QR para impresión
- [x] Mantener modo "Por Rango" como alternativa


## Mejoras Empresas y Plantilla PDF Enero 27

### Formulario Empresas
- [x] Eliminar campo RFC del formulario
- [x] Eliminar columna Proyecto de la tabla
- [x] Agregar botón para descargar PDF

### Plantilla Estándar PDF
- [x] Logo Objetiva en encabezado izquierdo
- [x] Nombre del proyecto en encabezado derecho
- [x] Fecha de impresión
- [x] Numeración de páginas "1 de X"
- [x] Utilidad reutilizable en /lib/pdfTemplate.ts
- [x] Actualizado StackingPDF con encabezado estándar
- [x] Actualizado Empresas con plantilla PDF


## Botones PDF y Rediseño Home Enero 27

### Rediseño Home
- [ ] Cambiar botones grandes abajo por iconos compactos arriba
- [ ] Eliminar botón circular redundante "Crear nuevo ítem"
- [ ] Iconos del mismo tamaño y estilo uniforme

### Botones PDF en todas las pantallas
- [ ] PDF en Mis Tareas
- [ ] PDF en lista de Ítems (con filtros)
- [ ] PDF en Estadísticas
- [ ] PDF en KPIs
- [ ] PDF en catálogos (Unidades, Especialidades, Usuarios)


## Mejoras Stacking y PDF Enero 27

### Botones PDF en catálogos
- [x] Agregar botón PDF en Unidades
- [x] Agregar botón PDF en Mis Tareas
- [x] Agregar botón PDF en Items (menú Exportar)
- [x] Agregar botón PDF en Estadísticas
- [x] Agregar botón PDF en KPIs

### Drag & Drop en Stacking
- [x] Permitir arrastrar unidades entre niveles
- [x] Solo admin/superadmin pueden editar posiciones
- [x] Ocultar handle de arrastre para otros roles
- [x] Guardar nueva posición y nivel al soltar


## Corrección PDF Stacking Enero 27

- [x] Ocultar sidebar y header en impresión (solo contenido)
- [x] Cambiar orden de niveles a ascendente (menor a mayor) en el PDF


## Mejoras PDF y Home Enero 27

### PDF Formato Profesional
- [x] Asegurar formato estándar Objetiva en TODOS los PDFs
- [x] Logo Objetiva a la izquierda
- [x] Nombre del proyecto a la derecha
- [x] Fecha de impresión
- [x] Paginación "1 de X"

### Reorganización Home
- [x] Mover iconos de acceso rápido arriba (al lado de cámara)
- [x] Eliminar botón Ítems (repetido)
- [x] Eliminar botón cámara (repetido)
- [x] Eliminar botón KPIs
- [x] Dejar solo Nuevo y Stats


## Reestructuración Defectos y Eliminación Atributos (Enero 27)

### Eliminar Atributos
- [x] Eliminar tabla de atributos del schema
- [x] Eliminar rutas de atributos del router
- [x] Eliminar página de Atributos
- [x] Eliminar del menú de navegación

### Defectos en Cascada por Especialidad
- [x] Al crear especialidad, proponer 5 defectos típicos automáticamente
- [x] Defectos vinculados a especialidad (especialidadId)
- [x] Mostrar defectos dentro de la vista de especialidad

### Defectos dentro de Empresas
- [x] Empresa tiene especialidad asignada
- [x] Mostrar defectos de la especialidad de la empresa
- [x] Permitir agregar defectos personalizados (admin/supervisor/usuario)

### Estadísticas por Defecto
- [x] Contabilizar ítems por tipo de defecto
- [x] Gráficos de defectos más frecuentes


## Mejoras Stacking Avanzadas (Enero 27)

### Alta de Unidades en Stacking
- [x] Botón "+ Agregar" por nivel para crear unidades nuevas
- [x] Formulario rápido de alta de unidad (nombre, nivel)
- [x] Actualizar base de datos al crear

### Drag & Drop Completo
- [x] Arrastrar unidades entre niveles diferentes
- [x] Arrastrar unidades dentro del mismo nivel (reordenar)
- [x] Todos los roles pueden arrastrar
- [x] Actualizar nivel y orden en base de datos al soltar

### Edición de Fechas
- [x] Editar fecha de inicio de cada unidad
- [x] Editar fecha de fin de cada unidad
- [x] Modal de edición rápida desde Stacking

### PDF Mejorado
- [x] Separar detalle de stacking y listado en hojas diferentes
- [x] Encabezados (logo, proyecto, paginación) en TODAS las hojas
- [x] Mantener formato profesional actual


## Ordenamiento Numérico Natural (Enero 27)

- [x] Implementar ordenamiento numérico natural en lista de unidades (1, 2, 3... 101, 102... 201, 202...)
- [x] Aplicar en todas las consultas: lista, stacking, selectores


## Navegación con Iconos en Header (Enero 27)

- [x] Eliminar sidebar con menú hamburguesa
- [x] Poner todos los módulos como iconos en el header
- [x] Solo iconos visibles, sin texto
- [x] Tooltip al pasar mouse con nombre del módulo
- [x] Iconos intuitivos y amigables


## Corrección Móvil (Enero 27)

- [x] Eliminar icono de Aprobación duplicado en barra inferior móvil


## Multifiltros en Estadísticas (Enero 27)

- [x] Agregar barra de multifiltros con botones
- [x] Filtro por Empresa
- [x] Filtro por Usuario
- [x] Filtro por Nivel
- [x] Filtro por Unidad
- [x] Filtro por Espacio
- [x] Filtro por Defecto
- [x] Filtro por Estatus (Rechazado, Aprobado, Alta, Tiempo de respuesta)
- [x] Eliminar botón general de Filtros


## Campos Empresa y Rol Desarrollador (Enero 27)

### Campos en Empresas
- [x] Agregar campo residenteId en tabla empresas
- [x] Agregar campo jefeResidenteId en tabla empresas
- [x] Selector de Residente en formulario de Empresas
- [x] Selector de Jefe de Residente en formulario de Empresas

### Rol Desarrollador
- [x] Agregar rol "desarrollador" al enum de roles
- [x] Desarrollador puede ver y crear ítems
- [x] Desarrollador NO puede acceder a Configuración
- [x] Restringir menú de Configuración según rol


## Mejoras Empresas y Stacking (Enero 27)

### Ordenamiento en Empresas
- [ ] Agregar selector de ordenamiento
- [ ] Ordenar por Empresa (nombre)
- [ ] Ordenar por Especialidad
- [ ] Ordenar por Contacto
- [ ] Ordenar por Residente

### Stacking - Botón Guardar
- [ ] Agregar botón "Guardar" para confirmar orden de unidades
- [ ] No desacomodar unidades hasta que se presione Guardar
- [ ] Indicador visual de cambios pendientes

### Fechas Visibles en Unidades
- [ ] Mostrar fechas en cada tarjeta de unidad
- [ ] Formato: i:dd-mm-aa, f:dd-mm-aa


## Mejoras Formulario Nuevo Ítem y Bitácora (Enero 27)

### Formulario Nuevo Ítem en Cascada
- [ ] Selector de Residente
- [ ] Selector de Empresa (filtrado por residente)
- [ ] Mostrar Especialidad de la empresa
- [ ] Selector de Unidad
- [ ] Selector de Espacio
- [ ] Selector de Defecto (filtrado por especialidad)
- [ ] Fotos del ítem
- [ ] Mostrar clave del ítem con badges

### Bitácora
- [ ] Revisar y corregir módulo de Bitácora
- [ ] Mostrar historial de cambios del ítem

### Stacking Pendiente
- [ ] Botón Guardar para confirmar orden de unidades
- [ ] No desacomodar unidades hasta que se guarde


## Mejoras Estadísticas y Formulario (Enero 27 - Tarde)

### Estadísticas
- [ ] Agregar botón PDF separado (descargar, no imprimir)

### Formulario Nuevo Ítem - Cascada correcta
- [ ] Foto primero
- [ ] Usuario
- [ ] Empresa (relaciona especialidad)
- [ ] Especialidad (de la empresa)
- [ ] Nivel
- [ ] Unidad (filtrada por nivel)
- [ ] Espacio (filtrado por unidad)
- [ ] Defecto (de la especialidad)


## Mejoras de Formulario y PDF (Iteración 27 de Enero 2026)

### Botón PDF en Estadísticas
- [x] Agregar botón separado de descarga PDF en Estadísticas
- [x] PDF con formato profesional Objetiva (logo, fecha, paginación)
- [x] Incluir estadísticas de ítems por empresa en el PDF
- [x] Descarga directa del archivo PDF

### Reorganización del Formulario Nuevo Ítem
- [x] Reorganizar campos en orden específico:
  - [x] Foto (primer paso)
  - [x] Usuario (selector de residentes)
  - [x] Empresa (filtra por usuario seleccionado)
  - [x] Especialidad (de la empresa)
  - [x] Nivel (selector de niveles disponibles)
  - [x] Unidad (filtrada por nivel)
  - [x] Espacio (filtrado por unidad)
  - [x] Defecto (de la especialidad)
- [x] Mantener cascada de relaciones funcionando
- [x] Agregar selector de Nivel antes de Unidad
- [x] Filtrar unidades por nivel seleccionado


## Ordenamiento de Tablas y Defectos Sugeridos (Iteración 27 Enero 2026 - Parte 2)

### Ordenamiento en Todas las Tablas
- [x] Crear componente/hook de ordenamiento reutilizable
- [x] Aplicar ordenamiento a tabla de Espacios (por orden, nombre, código, descripción)
- [x] Aplicar ordenamiento a tabla de Especialidades (por color, código, nombre, descripción, residente)
- [x] Aplicar ordenamiento a tabla de Empresas (ya tenía ordenamiento por dropdown)
- [x] Aplicar ordenamiento a tabla de Unidades
- [x] Indicador visual de columna ordenada (flecha arriba/abajo)

### Defectos Sugeridos Editables
- [x] Mostrar defectos como badges con hover actions
- [x] Permitir eliminar defecto individual con X
- [x] Permitir editar defecto existente (inline editing)
- [x] Permitir añadir nuevo defecto personalizado
- [x] Marcar defectos como "sugeridos" con badge Sparkles


## Mejoras Formulario Nuevo Ítem (Iteración 27 Enero 2026 - Parte 3)

- [x] Eliminar campo de comentario/descripción del formulario
- [x] Hacer obligatorio el campo Usuario (selector de residentes)
- [x] Usuario debe mostrar solo residentes (usuarios asignados a empresas)


## Gestión Integrada de Empresas (Iteración 27 Enero 2026 - Parte 4)

### Rediseño UX - Todo en un solo lugar
- [x] Crear modal/drawer expandido para edición de empresa
- [x] Sección Datos Generales (nombre, teléfono, contacto)
- [x] Sección Especialidad con selector y opción de crear nueva inline
- [x] Sección Equipo: Residente (selector)
- [x] Sección Equipo: Jefe de Residente (selector)
- [x] Sección Defectos Típicos con edición inline y agregar personalizado
- [x] Acordeones para organizar secciones (4 secciones expandibles)
- [x] Guardar todo en una sola acción


## Corrección Navegación Móvil (27 Enero 2026)

- [x] Mostrar todos los iconos de navegación en móvil (sin límite de 6)
- [x] Navegación scrollable horizontal para acceder a todos los menús


## Navegación Inferior Móvil (27 Enero 2026)

- [x] Crear barra de navegación inferior fija para móvil
- [x] Distribuir todos los iconos equitativamente sin scroll (5 visibles + "Más")
- [x] Mantener header simplificado en móvil (solo logo, proyecto y usuario)
- [x] Iconos con labels para mejor UX en barra inferior


## Mejoras Formulario Empresa Integrado (27 Enero 2026)

### Creación Inline de Usuarios
- [x] Botón + junto a selector de Residente para crear nuevo
- [x] Botón + junto a selector de Jefe de Residente para crear nuevo
- [x] Formulario inline: nombre, teléfono, correo, contraseña, rol
- [x] Asignar rol automáticamente según el campo (residente o jefe_residente)

### Defectos Sugeridos por Especialidad
- [x] Sugerir 5 defectos automáticamente al seleccionar especialidad
- [x] Mostrar defectos como checkboxes seleccionables
- [x] Permitir añadir defectos personalizados
- [x] Catálogo de defectos por especialidad predefinido (10 especialidades)

### Reorganización de Secciones
- [x] Orden: Datos Generales → Especialidad → Equipo → Defectos
- [x] Cascada lógica: especialidad determina defectos sugeridos


## Mejoras Vista Ítem y Estadísticas (27 Enero 2026)

- [x] Mostrar nombre del defecto en lugar de "Defecto #X" en vista de ítem
- [x] Agregar ordenamiento a tabla de estadísticas por cualquier columna (click en encabezados)
- [x] Crear gráfica de mejores y peores residentes por nombre (Top 5 cada uno)


## Campo Compromiso y Fecha Término Unidad (27 Enero 2026)

- [x] Agregar campo fechaCompromiso al schema de items
- [x] Agregar selector de fecha Compromiso en formulario NuevoItem (después del defecto)
- [x] Mostrar fecha de término de unidad (del stacking) en vista de ítem
- [x] Mostrar fecha de compromiso en vista de ítem


## Correcciones UX Móvil (27 Enero 2026)

- [x] Reducir campanas de notificación a una sola (NotificationCenter unificado en móvil)
- [x] Arreglar header móvil para que no se tapen iconos
- [x] Mejorar layout de tarjetas de empresa en móvil (layout vertical responsive)
- [x] Optimizar espacio en móvil para mejor distribución


## Corrección Módulo Bitácora (27 Enero 2026)

- [x] Revisar y corregir funcionalidad de Bitácora
- [x] Mostrar trazabilidad de ítems por unidad (filtro por unidad)
- [x] Mostrar acciones de cada residente/usuario (usuarios agrupados por rol)
- [x] Agregar filtros por unidad, usuario y fecha


## Mejoras PDFs y Bitácora (27 Enero 2026)

### PDFs Descargables
- [ ] Verificar que PDF de Estadísticas se descargue como PDF (no HTML)
- [ ] Verificar PDF de Empresas
- [ ] Agregar línea de firmas en todos los PDFs (Residente, Supervisión, Desarrollador, Fechas)

### Bitácora Completa
- [ ] Agregar ordenamiento por cualquier columna en Bitácora
- [ ] Mejorar multifiltros en Bitácora
- [ ] Agregar descarga PDF de Bitácora con firmas
- [ ] Mejorar estética de la Bitácora

### Tiempo Real y Multiusuario
- [ ] Verificar sincronización en tiempo real
- [ ] Verificar funcionamiento multiusuario simultáneo


## Mejoras PDFs y Bitácora Completadas (27 Enero 2026)

### PDFs Descargables
- [x] Estadísticas descarga PDF real con jsPDF (no HTML)
- [x] Línea de firmas en PDF de Estadísticas (Residente, Supervisión, Desarrollador, Fechas)
- [x] Línea de firmas en PDF de Bitácora

### Bitácora Completa
- [x] Ordenamiento por cualquier columna (click en encabezados con indicador ↑↓)
- [x] Multifiltros funcionales (usuario, unidad, categoría, acción, fechas, búsqueda)
- [x] Diseño estético mejorado
- [x] Descarga PDF con línea de firmas

### Tiempo Real y Multiusuario
- [x] Socket.IO configurado para sincronización
- [x] 173 tests pasando correctamente


## Correcciones Urgentes (27 Enero 2026)

### Error Bitácora
- [x] Corregir error de Select.Item con valor vacío que causa crash (filtro de unidades vacías)

### Fotos A/B en Tarjetas
- [x] Agregar miniatura de foto Antes (A) en tarjeta de ítem con badge amarillo
- [x] Agregar miniatura de foto Después (B) en tarjeta de ítem con badge verde

### Bitácora Completa
- [x] Trazabilidad completa de acciones por usuario (nombre y rol incluidos)
- [x] Fechas concretas de cada acción (formato dd/MM/yy HH:mm)
- [x] Multifiltros funcionales sin errores (usuario, unidad, categoría, fechas)


## Mejoras de UI Empresas (27 Enero 2026)

### Formulario Nuevo Ítem
- [x] Eliminar botón "Rápido" del formulario

### Vista de Empresas
- [x] Mostrar nombres completos de usuarios (Residente, Jefe Residente) con roles claros
- [x] Reducir espacio vacío en tarjetas de empresa
- [x] Organizar mejor la información de usuarios en cada empresa

### Navegación
- [x] Eliminar página de Catálogo de Defectos separada (defectos se gestionan en empresas)


## Correcciones Reportes PDF (27 Enero 2026)

### Problemas de Formato PDF
- [x] Corregir encabezados encimados en páginas de continuación (ajustados márgenes y estilos print)
- [x] Ajustar márgenes para evitar superposición de contenido

### Ordenamiento de Unidades
- [x] Ordenar unidades numéricamente dentro de cada nivel (extracción de números del código)
- [x] Incluir todas las unidades faltantes en el reporte

### Nombres de Archivos Descriptivos
- [x] Cambiar nombre de archivo a formato: [Modulo]-dd-mm-aa-HHmm.pdf
- [x] Aplicar formato de nombre en Bitácora, ReporteFotográfico y pdfTemplate


## Mejoras Finales Pre-Publicación (27 Enero 2026)

### Miniaturas de Fotos A/B
- [x] Mostrar miniaturas reales de fotos A/B en tarjetas de ítems pendientes (fotoAntes y fotoDespues incluidos en query)

### Fechas y Nombres en Reportes
- [x] Agregar fecha de alta en reportes de unidad (Fecha Alta)
- [x] Agregar fecha de aprobación en reportes de unidad (Fecha Aprobación)
- [x] Agregar nombres de responsables en reportes (Aprobado por)
- [x] Verificar que Bitácora incluya fechas y nombres completos (Usuario, Rol, Fecha/Hora)

### Publicación en Tiendas
- [ ] Preparar guía de publicación en App Store (iOS)
- [ ] Preparar guía de publicación en Play Store (Android)
