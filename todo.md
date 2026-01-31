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


## Mejoras de Formulario Nuevo Ítem (27 de Enero 2026 - Noche)

### Simplificación del Formulario
- [x] Remover botón "Rápido" con icono de rayo del formulario
- [x] Hacer obligatorio el campo de Residente (con asterisco *)
- [x] Agregar validación de residente obligatorio en handleSubmit


## Reestructuración Formulario Nuevo Ítem (27 de Enero 2026 - Noche v2)

### Cambios Solicitados
- [x] Quitar campo de "Descripción breve (opcional)"
- [x] Asignación obligatoria: mostrar solo residentes registrados por empresa
- [x] Al seleccionar residente, auto-completar Empresa y Especialidad (no dropdown)
- [x] Ubicación: Nivel como selector + Unidad del módulo Stacking/Unidades
- [x] Quitar botón "Rápido" con icono de rayo (ya hecho)


## UI Formulario Nuevo Ítem (27 Enero 2026)
- [x] Poner Nivel y Unidad en la misma fila (lado a lado)


## Mejora Drag & Drop Stacking (27 Enero 2026)
- [x] Mejorar drag & drop para que sea más intuitivo
- [x] Agregar indicador visual de espacio donde se soltará la unidad
- [x] Animación suave cuando las unidades se mueven para abrir espacio
- [x] Feedback visual claro del área de destino


## Bug Drag & Drop Stacking (27 Enero 2026)
- [ ] Corregir: permite arrastrar unidad pero no soltarla
- [ ] Verificar handler onDragEnd
- [ ] Verificar configuración de DndContext y SortableContext


## Formulario Nueva Empresa Mejorado (27 Enero 2026)

### Datos de Empresa
- [x] Nombre de empresa
- [x] Datos de contacto (teléfono, email)
- [x] Dirección (opcional)

### Usuarios en Cascada
- [x] Sección para agregar Residentes (nombre, correo, móvil, contraseña, rol)
- [x] Sección para agregar Jefes de Residentes
- [x] Sección para agregar Supervisores
- [x] Sección para Desarrollador
- [x] Asignación automática de roles según tipo de usuario

### Especialidad en Cascada
- [x] Selector de especialidad al crear empresa
- [ ] Opción de crear nueva especialidad si no existe

### Defectos en Cascada
- [x] Al seleccionar especialidad, mostrar defectos propuestos
- [x] Defectos elegibles con checkbox
- [x] Permitir agregar defectos personalizados
- [x] Admin/Supervisor/Superadmin pueden agregar defectos


## Filtro Especialidad en Estadísticas (27 Enero 2026)
- [x] Agregar filtro de Especialidad después del filtro de Empresa en la página de Estadísticas


## Bug Drag & Drop Stacking - No Persiste (27 Enero 2026)
- [x] Corregir: al soltar la unidad en destino, se regresa a posición original
- [x] Verificar que onDragEnd actualice el estado correctamente
- [x] Verificar que la mutación de guardar orden funcione


## Modo Organización Stacking (27 Enero 2026)
- [x] Agregar botón "Organizar" visible solo para Admin y Superadmin
- [x] Implementar modo de organización que permite arrastrar y soltar
- [x] Permitir insertar espacios libres del mismo tamaño que las unidades
- [x] Botón "Guardar Orden" cuando hay cambios pendientes
- [x] Botón "Cancelar" para salir sin guardar
- [x] El modo se puede activar/desactivar repetidamente


## KPIs Mejores y Peores - Barras Horizontales (27 Enero 2026)

### Gráficas de Rendimiento por Categoría
- [x] Empresas: Top 5 mejores y Top 5 peores (barras horizontales)
- [x] Especialidades: Top 5 mejores y Top 5 peores (barras horizontales)
- [x] Residentes: Top 5 mejores y Top 5 peores (barras horizontales)
- [x] Jefes de Residentes: Top 5 mejores y Top 5 peores (barras horizontales)
- [x] Unidades: Top 5 mejores y Top 5 peores (barras horizontales)
- [x] Espacios: Top 5 mejores y Top 5 peores (barras horizontales)
- [x] Defectos: Top 5 más frecuentes y Top 5 menos frecuentes (barras horizontales)
- [x] Niveles: Top 5 mejores y Top 5 peores (barras horizontales)


## Corrección de Visualización de Defecto (27 Enero 2026)
- [x] Mostrar nombre del defecto en lugar de "Defecto #XX" en vista de detalle del ítem


## Mejora del Módulo de Bitácora (27 Enero 2026)

### Trazabilidad Completa
- [x] Registrar todos los movimientos del sistema (crear, editar, eliminar, aprobar, rechazar)
- [x] Capturar usuario, fecha/hora, acción, entidad afectada, valores antes/después
- [x] Registrar cambios en ítems, empresas, usuarios, unidades, niveles, espacios, defectos

### Ordenamiento Flexible
- [x] Permitir ordenar por fecha (ascendente/descendente)
- [x] Permitir ordenar por usuario
- [x] Permitir ordenar por tipo de acción
- [x] Permitir ordenar por entidad afectada
- [x] Indicador visual de columna ordenada actualmente


## Fecha de Terminación de Unidad en Detalle de Ítem (27 Enero 2026)
- [x] Mostrar fecha de terminación de la unidad (fechaFin del Stacking) en la sección de información del ítem


## Gestión de Defectos Individuales (27 Enero 2026)
- [x] Botón de editar para cada defecto individual (cambiar nombre, severidad)
- [x] Botón de eliminar para cada defecto individual
- [x] Diálogo de confirmación antes de eliminar defecto


## Drag & Drop y Unidades Vacías en Stacking (27 Enero 2026)

### Reordenamiento de Unidades
- [x] Agregar drag & drop para reordenar filas en la lista de Unidades
- [x] Guardar el nuevo orden en el Stacking
- [x] Indicador visual de arrastre (handle/grip)

### Unidades Vacías (Separadores)
- [x] Detectar unidades con código "-" (guión) como espacios vacíos
- [x] Mostrar caja vacía/separador en el Stacking para unidades con guión
- [x] Mantener el mismo tamaño que las unidades normales


## Fecha de Terminación en Detalle de Ítem (27 Enero 2026)
- [ ] Mostrar fecha de terminación de unidad ARRIBA de fecha de creación
- [ ] Usar color verde Objetiva para la fecha de terminación


## Múltiples Residentes por Empresa (Nueva Funcionalidad)

### Base de Datos
- [ ] Crear tabla de relación empresa_residentes (muchos a muchos)
- [ ] Migrar datos existentes de residenteId y jefeResidenteId

### Backend
- [ ] Actualizar router de empresas para manejar múltiples residentes
- [ ] Crear endpoints para agregar/eliminar residentes de empresa
- [ ] Actualizar queries de listado de residentes por empresa

### Frontend - Gestión de Empresas
- [ ] Modificar formulario de empresa para agregar múltiples residentes
- [ ] Lista de residentes asignados con opción de eliminar
- [ ] Selector de usuarios disponibles para agregar como residente

### Frontend - Nuevo Ítem
- [ ] Actualizar selector de residente para usar nueva estructura
- [ ] Mostrar todos los residentes de todas las empresas


## Múltiples Residentes por Empresa (Enero 2026)
- [x] Crear tabla empresa_residentes en la base de datos
- [x] Agregar funciones de base de datos para gestionar residentes por empresa
- [x] Agregar endpoints en el router para CRUD de residentes por empresa
- [x] Actualizar UI de Empresas para agregar/eliminar múltiples residentes
- [x] Actualizar NuevoItem para usar la nueva estructura de residentes
- [ ] Migrar datos existentes de residenteId/jefeResidenteId a la nueva tabla


## Permisos de Eliminación de Usuarios (Enero 2026)
- [x] Restringir eliminación de usuarios solo a Admin/Superadmin en backend
- [x] Ocultar botón de eliminar usuarios para roles sin permisos en frontend


## Bug: Usuarios no pueden ver proyectos asignados (Enero 2026)
- [x] Diagnosticar problema de acceso a proyectos
- [x] Asignar todos los usuarios activos al proyecto Hidalma
- [x] Agregar funcionalidad de asignación de proyectos en módulo Usuarios
- [x] Botón de asignar proyectos (icono carpeta) en cada usuario
- [x] Diálogo con checkboxes para asignar/remover de proyectos
- [x] Verificar que usuarios pueden acceder al proyecto asignado


## Login con Usuario y Contraseña (Enero 2026)
- [ ] Crear endpoint de login con email y contraseña
- [ ] Crear página de login con formulario
- [ ] Mantener opción de login con OAuth/Manus
- [ ] Permitir a usuarios existentes usar contraseña


## Menú Hamburguesa (Enero 2026)
- [x] Implementar menú hamburguesa para navegación móvil
- [x] Botón hamburguesa en header para móvil
- [x] Panel lateral deslizante con todos los módulos
- [x] Animación suave de apertura/cierre


## Corrección Login y Contraseñas (Enero 2026)
- [x] Corregir login con Google/OAuth que no funciona (redirige a página /login)
- [x] Agregar campo de contraseña en formulario de edición de usuarios
- [x] Permitir a admin/superadmin asignar contraseñas a usuarios existentes
- [x] Campo de contraseña en diálogo de edición de usuario


## Corrección OAuth Google/Manus (Enero 2026)
- [x] Diagnosticar error {"message":null} al hacer clic en Google/Manus
- [x] Revisar endpoint de OAuth callback
- [x] Mejorar manejo de errores en callback (redirige a /login con mensaje)
- [x] Mostrar mensaje de error claro en página de login


## Mejoras Login y Usuarios (Enero 2026)
- [x] Quitar botón de Google/Manus del login
- [x] Hacer contraseñas siempre visibles (tipo texto) en login
- [x] Hacer contraseñas siempre visibles en formulario de edición de usuarios
- [x] Contraseñas funcionan correctamente (bcrypt hash)
- [x] Restringir eliminación/desactivación de usuarios solo a Admin/Superadmin (ya implementado)


## Ajuste UI Móvil Usuarios (Enero 2026)
- [x] Ajustar textos cortados en tarjetas de estadísticas (Admin, Superv., Sin Emp.)
- [x] Mejorar encuadre de tarjetas para vista móvil (grid 2 columnas en móvil)
- [x] Reducir tamaño de fuente y padding en móvil


## Recordar Datos Login (Enero 2026)
- [x] Agregar checkbox "Recordar mis datos" en formulario de login
- [x] Guardar email y contraseña en localStorage cuando esté marcado
- [x] Cargar datos guardados al abrir la página de login



## Eliminación de Usuarios y Rol Superadmin (Enero 2026)
- [x] Actualizar rol de Carlos Ramirez a superadmin
- [x] Agregar endpoint de delete para usuarios (solo superadmin)
- [x] Agregar función deleteUser en db.ts
- [x] Agregar botón de eliminar permanentemente en vista móvil
- [x] Agregar botón de eliminar permanentemente en vista desktop
- [x] Confirmación antes de eliminar usuario
- [x] No permitir eliminarse a sí mismo


## Corrección Formulario Crear Ítem (Enero 2026)
- [x] Selector de Residente no despliega opciones - corregido para incluir usuarios con rol residente/jefe_residente
- [x] Campo "Espacio" ya existe en el formulario (se muestra cuando la unidad tiene espacios asignados)
- [x] Campo "Defecto" ya existe y funciona - muestra defectos de la especialidad del residente
- [x] Verificar estadísticas estén ligadas correctamente entre tablas (confirmado: usuarios, empresas, especialidades, defectos, unidades, espacios, niveles)


## Mejoras UI Detalle Ítem y Formulario Nuevo Ítem (Enero 2026)
- [x] Caja de código del ítem: reducir tamaño, fondo blanco, texto azul Objetiva (#002C63)
- [x] Formulario Nuevo Ítem: poner Nivel, Unidad y Defecto en la misma línea (grid 3 columnas)


## Corrección de Acceso de Usuarios (Enero 2026 - URGENTE LANZAMIENTO)
- [x] Verificar flujo de autenticación y vinculación por clave/correo
- [x] Asegurar persistencia de sesión para usuarios logueados (cookie de 1 año)
- [x] Verificar usuarios Stephanie y Julián en la base de datos
- [x] Corregir problemas de vinculación: Estefany actualizada a admin con empresaId correcto
- [x] Implementar herencia de rol/empresa desde usuario manual cuando login con Google/OAuth


## Fortalecimiento Autenticación (Enero 2026 - PRE-LANZAMIENTO)
- [x] Revisar flujo completo de OAuth callback - mejorado con logging detallado
- [x] Verificar manejo de errores en autenticación - fallback para crear usuario básico si falla OAuth
- [x] Asegurar que usuarios existentes no tengan problemas al re-ingresar - actualiza lastSignedIn sin fallar
- [x] Asegurar que usuarios nuevos se registren correctamente - hereda rol/empresa de usuario manual
- [x] Verificar persistencia de sesión y cookies - cookie de 1 año, name opcional en token
- [x] Validar que la cadena de datos no se rompa - busca todos los usuarios con email para login
- [x] Agregar endpoint /api/auth/status para debugging

## Corrección Definitiva de Usuarios (Enero 2026 - LANZAMIENTO)
- [x] Investigar problema de login de esanchez@objetiva.mx
- [x] Identificar causa raíz: contraseña era Objetiva2026, no 123456
- [x] Estandarizar TODAS las contraseñas a 123456 para todos los usuarios
- [x] Verificar y corregir roles en proyecto_usuarios (Carlos y Daniel)
- [x] Verificar empresas asignadas a todos los usuarios
- [x] Verificar proyectos asignados a todos los usuarios
- [x] Confirmación final: 6 usuarios, todos con contraseña 123456, todos con empresa y proyecto


## Roles y Cambio de Contraseña (Enero 2026)
- [x] Cambiar rol de Carlos Ramirez a superadmin
- [x] Verificar si existe funcionalidad de cambio de contraseña
- [x] Crear sección de cambio de contraseña en Configuración
- [x] Permitir que cada usuario cambie su propia contraseña (ruta users.changePassword)


## Limpieza de Proyectos Duplicados (Enero 2026)
- [x] Investigar proyectos duplicados en la base de datos
- [x] Identificar el proyecto correcto (TRN-Hidalma, ID 1)
- [x] Eliminar proyectos duplicados (01, 02 - IDs 120001, 120002)
- [x] Eliminar usuario duplicado de Estefany (ID 1230002)
- [x] Verificar que no queden referencias rotas - BASE DE DATOS LIMPIA


## Rol Superadmin y Restricción de Eliminación (Enero 2026)
- [x] Verificar que Carlos tenga rol superadmin en la base de datos
- [x] Mostrar "Superadmin" en la interfaz para Carlos
- [x] Implementar restricción: solo superadmin puede eliminar usuarios
- [x] Implementar restricción: solo superadmin puede eliminar elementos del sistema (empresas, unidades, especialidades, espacios, atributos, ítems, defectos, proyectos, mensajes, metas)


## Pruebas Pre-Lanzamiento (Enero 2026)
- [x] Login con Estefany (admin) - funciona correctamente
- [x] Login con Carlos (superadmin) - funciona correctamente
- [x] Formulario Nuevo Ítem - carga residentes, defectos correctamente
- [x] Permisos superadmin - Carlos ve botón "Eliminar permanentemente", Estefany no lo ve
- [x] Carlos actualizado a superadmin en base de datos
- [x] Verificación de usuarios: 5 usuarios activos, todos con contraseña 123456
- [x] Verificación de proyectos: 1 proyecto (TRN-Hidalma), sin duplicados


## URGENTE: Rol Superadmin de Carlos (Enero 2026)
- [x] Investigar por qué el rol de Carlos se resetea a admin al iniciar sesión - upsertUser sobrescribía el rol
- [x] Corregir el código de autenticación para preservar el rol superadmin - ahora NUNCA sobrescribe rol de usuarios existentes
- [x] Verificar que Carlos sea superadmin permanentemente - confirmado en BD y UI


## Reorganización Formulario Nuevo Ítem (Enero 2026)
- [x] Agregar campo Espacio al contenedor de Ubicación y Defecto
- [x] Reorganizar campos: Nivel, Unidad en fila 1; Espacio, Defecto en fila 2
- [x] Optimizar para captura rápida y visión ordenada (campos más grandes h-10)


## Selector de Espacios desde Plantilla (Enero 2026)
- [x] Modificar selector de Espacio para cargar espacios de la plantilla del proyecto
- [x] Mostrar solo el nombre del espacio (sin código ni descripción)
- [x] Superadmin, admin, supervisor y jefe_residente pueden tomar fotos del después (residente NO)
- [x] Eliminar chat duplicado en detalle de ítem (eliminada sección Comentarios y Observaciones)
- [x] Ajustar botones de acción para responsividad en móvil
- [x] Mostrar foto después en Seguimiento QR cuando se sube
- [x] Abrir editor de marcado automáticamente con lápiz activo (ancho 2) al tomar foto antes
- [x] Simplificar editor de marcado: ancho fijo 4, eliminar slider, ajustar botón guardar
- [x] Sistema de defectos en cascada vinculados a especialidades
- [x] Crear 5 defectos típicos para cada especialidad existente
- [x] Auto-generar defectos al crear nueva especialidad
- [x] UI para que supervisor gestione defectos por especialidad
- [x] Corregir ciclo al mover unidades en módulo Unidades y reflejar orden en Stacking
- [ ] Modificar impresión QR a 30 etiquetas por hoja carta (3x10) vertical


## Mejoras de Impresión QR (Iteración Actual)

### Layout de Etiquetas QR
- [x] Modificar impresión a 30 etiquetas por hoja carta
- [x] Layout de 3 columnas x 10 filas
- [x] Orientación vertical (portrait)
- [x] Etiquetas compactas con QR + código + título + logo
- [x] Actualizar descripción en vista previa

### Etiquetas Office Depot 64413
- [x] Ajustar layout para etiquetas 6.7 x 2.5 cm
- [x] Configurar para plantilla Avery 5160 compatible
- [x] 30 etiquetas por hoja (3 columnas x 10 filas)
- [x] Márgenes y espaciado precisos para alineación

### Menú Curvas
- [x] Agregar elemento de menú "Curvas" con icono (Activity)
- [x] Ubicar antes de Secuencias en el menú lateral
- [x] Enlazar a bit.ly/49OgS7d (enlace externo)

### Ajuste de Márgenes Etiquetas
- [x] Aumentar margen superior 3mm adicionales para alineación exacta (15.7mm total)

### Visibilidad de Menú por Rol
- [x] Todos los usuarios ven todos los iconos excepto Configuración
- [x] Configuración solo visible para admin y superadmin

### Enlaces Externos por Proyecto
- [x] Agregar campos de enlaces al schema de proyectos (curvas, secuencias, visor, planos)
- [x] Crear página de configuración de enlaces en Configuración
- [x] Modificar menú para usar enlaces dinámicos del proyecto activo
- [x] Migrar enlaces actuales de Hidalma
- [x] Ocultar iconos si el enlace no está configurado

### Verificación y Ampliación de Enlaces Externos
- [x] Verificar que nuevos proyectos no muestren iconos de enlaces sin configurar
- [x] Verificar que enlaces migrados de Hidalma funcionen correctamente
- [x] Agregar campo linkManuales al schema
- [x] Agregar campo linkEspecificaciones al schema
- [x] Actualizar página de configuración de enlaces
- [x] Actualizar menú para mostrar nuevos enlaces


### Eliminación Permanente de Ítems por Superadmin
- [x] Superadmin puede borrar ítems permanentemente de la base de datos
- [x] Refrescar la vista automáticamente después de eliminar


### Corrección Pantalla Selección de Proyectos
- [x] Investigar por qué nuevos proyectos no aparecen en la pantalla de selección
- [x] Corregir sin afectar proyecto Hidalma
- [x] Asignar automáticamente al creador como admin del nuevo proyecto


### Edición de Proyectos
- [ ] Permitir editar nombre del proyecto
- [ ] Permitir editar/cambiar portada del proyecto


### Restricción de Edición de Proyectos
- [x] Solo superadmin puede editar proyectos (nombre, portada, etc.)
- [x] Ocultar botones de edición para otros roles


### Restricción de Acceso a Códigos QR
- [x] Solo usuarios registrados pueden leer códigos QR
- [x] Redirigir a login si no está autenticado


### Verificación de Caché en Búsqueda
- [ ] Verificar ítems reales en base de datos de Hidalma
- [ ] Revisar si búsqueda muestra datos eliminados por caché
- [ ] Corregir problemas de caché si existen


### Verificación de Vinculación de Datos en Stacking
- [x] Verificar que el ítem aprobado esté correctamente vinculado al proyecto/usuario
- [x] Corregir contadores en Stacking/Notificaciones para mostrar datos en tiempo real


### Mejoras Solicitadas (30/01/2026)
- [ ] Badges de notificación desaparecen cuando el usuario lee el ítem
- [x] Títulos de enlaces externos editables por superadmin (Curvas, Secuencias, etc.)
- [x] Eliminación en cascada: al eliminar ítem, borrar bitácora relacionada
- [x] Conteos de Stacking: al hacer clic, navegar a lista filtrada de ítems
- [x] Verificar que superadmin pueda borrar datos de bitácora


### Mejoras Solicitadas (31/01/2026)
- [x] Cambiar título de app de "ObjetivaOQC" a "OQC" en header y manifest
- [x] Verificar favicon correcto para descarga de app
- [x] Numeración secuencial automática de especialidades (1, 2, 3... sin importar orden alfabético)
- [x] Agregar submenú "Lista" en Especialidades que muestre todas con su número asignado


### Corrección Urgente - Título de App (30/01/2026)
- [x] Corregir título "ObjetivaOQC" a "OQC" en service workers y caches
- [x] Verificar que no haya residuales del título anterior en ningún lugar


### Limpieza de Datos Residuales (30/01/2026)
- [x] Investigar y eliminar ítems huérfanos que aparecen en estadísticas
- [ ] Agregar herramienta para superadmin para limpiar datos residuales

- [x] Click en celdas de Stacking navega a ítems filtrados por unidad (ya implementado)

- [x] Centrar el texto OQC en el header


### Mejoras UI (30/01/2026)
- [x] Asignar números secuenciales a especialidades existentes (migración)
- [x] Crear página separada de lista de especialidades (solo número y nombre, sin edición)
- [x] Centrar OQC en el header entre logo y usuario
- [x] Implementar foto de perfil para usuarios


### Correcciones UI (30/01/2026)
- [x] Eliminar campanas de notificación duplicadas (dejar solo 1)
- [x] Mover lista de especialidades fuera del menú de configuración
- [x] Renumerar especialidades empezando desde 1


### Mejoras Solicitadas (30/01/2026)
- [x] Limpiar especialidades duplicadas (consolidar por nombre)
- [x] Implementar badges de notificación con tracking por usuario (ya implementado - cada usuario tiene su propio contador)
- [x] Mostrar foto de perfil en lista de usuarios para administradores


### Foto de Perfil de Usuario (30/01/2026)
- [x] Agregar botón visible para subir foto de perfil en el menú de usuario
- [x] Mostrar foto de perfil en mensajería
- [x] Mostrar foto de perfil en comentarios de ítems
- [x] Mostrar foto de perfil en bitácora
- [x] Mostrar foto de perfil en cualquier lugar donde aparezca el nombre del usuario


### Términos y Condiciones + Fotos Admin (31/01/2026)
- [x] Superadmin puede editar fotos de todos los usuarios
- [x] Crear tabla para tracking de aceptación de términos (campos en users)
- [x] Modal de términos y condiciones al primer inicio de sesión
- [x] Aviso de privacidad conforme a LFPDPPP México
- [x] Link accesible para consultar términos en cualquier momento


### Foto de Perfil de Usuarios (30/01/2026)
- [x] Permitir que superadmin edite fotos de todos los usuarios
- [x] Botón de cámara visible en lista de usuarios para superadmin
- [x] Diálogo de editar foto con preview y subida



### Avatar y Bitácora Mejorada (31/01/2026)
- [x] Mostrar foto de perfil en el avatar del header (donde está "CR")
- [x] Mejorar bitácora para indicar nombre de fotografía subida (no solo "subió foto")
- [x] Agregar avatar miniatura junto al nombre en todos los lugares donde aparezca

### Lugares donde se agregó UserAvatar:
- Bitácora de auditoría (tabla y vista móvil)
- Lista de usuarios (tabla y vista móvil)
- Proyectos - lista de usuarios asignados
- Prioridades - nombre del residente
- ItemChat - mensajes de chat
- ItemDetail - información del residente


## Correcciones de Avatares y Nueva Sección Tiempos (31/01/2026)

### Corrección de Avatares Encimados
- [x] Corregir avatares que tapan texto en lista de usuarios móvil
- [x] Ajustar espaciado para que avatar y texto no se encimen

### Nueva Sección "Tiempos" en Configuración
- [ ] Crear sección "Tiempos" en página de Configuración
- [ ] Reportar cuántas veces ha capturado cada usuario
- [ ] Reportar cuántas veces ha leído mensajes cada usuario
- [ ] Mostrar quién ha capturado y quién no
- [ ] Fecha y hora de registro de cada actividad
- [ ] Resumen semanal de actividad

### Avatares Faltantes
- [ ] Agregar avatar en portada de selección de proyectos (junto al usuario)
- [ ] Agregar avatar en pantalla de bienvenida junto al nombre del usuario


## Correcciones de Avatares y Sección Tiempos (31 Enero 2026)

### Corrección de Avatares Encimados
- [x] Corregir avatares que tapan texto en lista de usuarios móvil
- [x] Ajustar espaciado para que avatar y texto no se encimen
- [x] Mejorar componente UserAvatar con mejor espaciado

### Sección Tiempos en Bitácora
- [x] Crear nueva sección "Tiempos" en Bitácora
- [x] Resumen semanal de actividad (acciones, ítems, mensajes, usuarios activos)
- [x] Tabla de actividad por usuario (capturas, mensajes, acciones)
- [x] Mostrar quién ha capturado y quién no
- [x] Fechas de registro y última actividad
- [x] Estadísticas semanales por usuario

### Avatares en Portada y Bienvenida
- [x] Agregar avatar en portada de selección de proyectos junto al nombre del usuario
- [x] Agregar avatar en pantalla de bienvenida junto al nombre

### Lugares donde se agregó UserAvatar:
- Bitácora de auditoría (tabla y vista móvil)
- Lista de usuarios (tabla y vista móvil)
- Proyectos - lista de usuarios asignados
- Prioridades - nombre del residente
- ItemChat - mensajes de chat
- ItemDetail - información del residente
- SeleccionProyecto - header del usuario
- Bienvenida - saludo con avatar


## PDF de Tiempos en Bitácora (31 Enero 2026)
- [x] Agregar botón de descarga PDF en sección Tiempos de Bitácora
- [x] PDF con resumen semanal y tabla de actividad por usuario
- [x] Formato profesional con colores Objetiva


## Reestructuración Formulario Empresas Unificado (31 Enero 2026)

### Formulario Unificado de Empresa
- [x] Crear formulario con pestañas: Datos, Especialidad, Usuarios, Defectos (ya existía, mejorado)
- [x] Pestaña Datos: nombre, contacto, RFC, teléfono, email, especialidad
- [x] Pestaña Especialidad: selector integrado en pestaña Datos
- [x] Pestaña Usuarios: agregar/editar usuarios con roles (Residente, Jefe Residente, Supervisor, Desarrollador)
- [x] Pestaña Defectos: lista editable con botones de agregar, editar y eliminar
- [x] Modo edición para empresas existentes con todas las pestañas

### Permisos Rol Desarrollador
- [x] Desarrollador puede ver ítems y estadísticas (protectedProcedure permite lectura)
- [x] Desarrollador puede comentar en mensajería (comentarios.create usa protectedProcedure)
- [x] Desarrollador NO puede crear/editar/eliminar ítems (items.create usa noDesarrolladorProcedure)
- [x] Desarrollador NO puede acceder a Configuración (DashboardLayout ya lo restringe)
- [x] Desarrollador NO puede modificar catálogos (adminProcedure ya lo restringe)

### Versión de respaldo: bd6f85fd


## Mejoras Adicionales Formulario Empresas (31 Enero 2026)

### Crear Especialidad desde Formulario
- [x] Agregar botón "+" junto al selector de especialidad
- [x] Diálogo inline para crear nueva especialidad sin salir del formulario
- [x] Auto-seleccionar la especialidad recién creada

### Importación Masiva de Usuarios
- [x] Agregar botón "Importar desde Excel/CSV" en pestaña Equipo
- [x] Parser de archivos Excel (.xlsx) y CSV
- [x] Validación de datos antes de importar
- [x] Mostrar preview de usuarios a importar
- [x] Asignar rol y empresa automáticamente

### Historial de Cambios por Empresa
- [x] Crear tabla de historial de cambios en base de datos (empresa_historial)
- [x] Registrar cambios en datos de empresa, usuarios y defectos
- [x] Mostrar log de cambios en pestaña "Historial" del formulario de empresa
- [x] Incluir quién hizo el cambio y cuándo


## Mejoras Formulario Empresas y Dictado por Voz (31 Enero 2026)

### Plantilla Excel Descargable
- [x] Agregar botón "Descargar Plantilla" en diálogo de importar usuarios
- [x] Generar archivo CSV con columnas: Nombre, Email, Rol
- [x] Incluir ejemplos de datos en la plantilla

### Registro Automático de Historial
- [x] Conectar mutation de crear empresa para registrar en historial
- [x] Conectar mutation de editar empresa para registrar cambios
- [x] Conectar mutation de agregar/eliminar usuario para registrar
- [ ] Conectar mutation de agregar/eliminar defecto para registrar (pendiente)

### Sistema de Dictado por Voz en Mensajería
- [x] Crear endpoint comentarios.transcribir para transcripción de audio
- [x] Integrar Speech-to-Text con alta precisión en español (Whisper)
- [x] Integrar LLM para generar resumen técnico en 5 bullets
- [x] Crear componente de botón de micrófono con estados (Idle, Escuchando, Transcribiendo, Resumiendo, Listo, Error)
- [x] Implementar grabación de audio con MediaRecorder (máximo 30 segundos)
- [x] Mostrar contador mientras graba
- [x] Pegar resumen en input de mensaje sin enviarlo automáticamente
- [x] No guardar audio en base de datos ni storage (solo memoria temporal para transcripción)
- [x] Funcionar en móvil y desktop sin romper diseño existente


## Correcciones Urgentes (31 Enero 2026)
### Error Micrófono en Mensajería
- [x] Crear endpoint /api/upload para subir archivos de audio
- [x] Corregir flujo de transcripción de voz

### Simplificar Alta de Empresas en Cascada
- [x] Crear wizard simple de alta: Empresa → Especialidad → Usuarios → Defectos
- [x] Todo en una sola pantalla sin entrar y salir
- [x] Enlace desde Configuración a Alta Rápida
- [ ] Flujo terriblemente simple sin romper nada existente


## Ajuste de Avatares (31 Enero 2026)
- [x] Aumentar tamaño de avatares un 30% en toda la aplicación (UserAvatar: xs=24px, sm=32px, md=40px, lg=48px, xl=56px)
- [x] Verificar avatares visibles en mensajería (ItemChat) - aumentados a lg
- [x] Mantener diseño estético sin encimar elementos (gap y flex-shrink)
- [x] Hacer avatares legibles e identificables (texto más grande en iniciales)


## Notificaciones Push Mejoradas (31 Enero 2026)
- [x] Mostrar notificaciones incluso con pantalla bloqueada (requireInteraction: true, urgency: high)
- [x] Incluir información del ítem: número, unidad, defecto (itemCodigo, unidadNombre, defectoNombre)
- [x] Al hacer clic en notificación, navegar directamente al ítem (url: /items/{itemId})
- [x] Configurar prioridad alta para notificaciones urgentes (vibración larga, renotify: true)


## Enlace WhatsApp por Proyecto (31 Enero 2026)
- [x] Agregar campo whatsappGrupoUrl en tabla de proyectos
- [x] Crear UI para editar enlace WhatsApp en Configuración
- [x] Mostrar enlace por proyecto para reportes automáticos


## Bug: Fotos Avatar no se Mantienen (31 Enero 2026)
- [ ] Verificar cómo se guardan las fotos de perfil en la base de datos
- [ ] Verificar que el componente UserAvatar cargue correctamente las fotos
- [ ] Corregir el problema de persistencia de fotos de avatar


## Bug: Fotos Avatar no se Mantienen (31 Enero 2026)
- [x] Identificar problema: URLs de CloudFront expiran (403 Forbidden)
- [x] Crear endpoint proxy /api/image/:path para generar URLs firmadas
- [x] Crear función helper getImageUrl() en /lib/imageUrl.ts
- [x] Actualizar UserAvatar para usar getImageUrl()
- [x] Actualizar DashboardLayout para usar getImageUrl()
- [x] Actualizar UserProfile para usar getImageUrl()
- [x] Actualizar Usuarios.tsx para usar getImageUrl()


## Bug: Fotos Portada de Proyectos no se Ven (31 Enero 2026)
- [x] Identificar dónde se muestran las fotos de portada de proyectos (SeleccionProyecto, Proyectos, NuevoProyecto)
- [x] Aplicar getImageUrl() a las imágenes de portada en los 3 archivos
- [x] Verificar que las fotos se muestren correctamente


## Notas sobre Imágenes y Almacenamiento (31 Enero 2026)

### Estado del Sistema de Imágenes
- [x] Sistema de imágenes base64 implementado como fallback
- [x] Colores de fondo generados automáticamente cuando no hay imagen
- [ ] URLs de CloudFront del servicio de almacenamiento de Manus devuelven error 403
- [x] Las nuevas imágenes subidas se guardarán correctamente como base64

### Transcripción de Voz
- [x] Código de transcripción implementado en servidor (routers.ts)
- [x] Componente ItemChat.tsx con botón de micrófono
- [x] Integración con API de Whisper para transcripción
- [x] 185 pruebas pasando correctamente



## Bugs Reportados (31 Enero 2026 - 13:10)
- [x] Error "Failed to download audio file" al usar transcripción de voz - CORREGIDO: Usa base64 directo
- [x] Fotos de proyectos no se muestran - CORREGIDO: Sistema base64 implementado
- [ ] No permite tomar fotos - Requiere verificación en dispositivo real



## Correcciones de Imágenes y Audio (31 Enero 2026)

### Transcripción de Voz
- [x] Error "Failed to download audio file" - CORREGIDO: Sistema ahora usa base64 directamente
- [x] Transcripción de audio funciona sin depender de S3/CloudFront

### Sistema de Imágenes Base64
- [x] Fotos de perfil de usuarios se guardan como base64
- [x] Imágenes de portada de proyectos se guardan como base64
- [x] Sistema evita problemas de URLs de CloudFront con error 403



## Bug: Fotos de Portada no se Guardan al Editar (31 Enero 2026)
- [ ] Investigar por qué las fotos de portada no se guardan al editar proyecto
- [ ] Verificar que el formulario de edición envíe la imagen base64 al servidor
- [ ] Verificar que el procedimiento de actualización guarde imagenPortadaBase64
- [ ] Probar que las fotos se persisten correctamente


## Mejoras UX Solicitadas (31 Enero 2026 - 15:00)
- [ ]- [x] Reducir resumen de chat a 3 bullets de 5 palabrasas
- [x] Corregir fotos antes/después que no se muestran (error de carga)
- [ ] Aumentar grosor del lápiz de marcado a 4 puntos
- [ ] Optimizar velocidad de carga, descarga y guardado

- [x] Corregir que no se guardan fotos de avatares de usuarios

- [x] Bug: Foto de avatar se guarda pero no se muestra en lista de usuarios - CORREGIDO: Agregado fotoBase64 a UserAvatar
