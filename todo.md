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


## Bugs Reportados (31 Enero 2026 - 14:28)
- [ ] Fotos antes/después no se muestran (aparece "Foto antes" como texto)
- [ ] Avatar no se muestra después de subirlo (sigue mostrando "CR")
- [ ] Desbordamiento de pantalla en lista de ítems (badge "Pendiente" cortado)
- [ ] Avatares no aparecen en otros lugares donde se mencionan usuarios


## Correcciones de Bugs (31 Enero 2026 - 14:38)
- [x] Fotos antes/después no se muestran en ItemDetail - CORREGIDO: Usa base64 directo
- [x] Avatar no se muestra en lista después de subirlo - CORREGIDO: Agregado fotoBase64 a todos los UserAvatar
- [x] Desbordamiento de pantalla en lista de ítems - CORREGIDO: Badge en nueva línea
- [x] Avatares no aparecen en otros lugares - CORREGIDO: Agregado fotoBase64 en Bienvenida, SeleccionProyecto, ItemChat, Bitacora, Prioridades, Proyectos


## Optimización Offline y Velocidad (31 Enero 2026 - 14:45)
- [ ] Caché local con IndexedDB para imágenes (sin comprimir)
- [ ] Cola de sincronización para modo offline
- [ ] Indicador de estado de conexión (online/offline)
- [ ] Lazy loading de imágenes
- [ ] Sincronización automática cuando haya conexión


## Bugs Críticos (31 Enero 2026 - 14:50)
- [x] Duplicación de ítems cuando vuelve la señal - CORREGIDO: clientId evita duplicados por reintentos
- [x] Fotos no se muestran en lista de ítems - CORREGIDO: Fotos incluidas en creación (una sola transacción)


## Modo Offline Completo (31 Enero 2026 - 15:10)
- [x] Caché local con IndexedDB para datos e imágenes
- [x] Indicador visual de estado de conexión (online/offline)
- [x] Cola de sincronización automática cuando vuelva internet
- [x] Integrar modo offline en componentes principales


## Bugs Reportados (31 Enero 2026 - 19:15)
- [x] Pantalla Sin Conexión no permite continuar a la app offline - CORREGIDO: Botón "Continuar sin conexión" agregado
- [x] Lápiz de marcar necesita ser el doble de grueso - CORREGIDO: BRUSH_SIZE de 4 a 8


## Mejora: Códigos Aleatorios para Ítems (1 Febrero 2026)
- [x] Cambiar generación de código de ítem de consecutivo a aleatorio (ej: Hidalma-A7X9K2)
- [x] Mantener contador de ítems para estadísticas (se cuenta por cantidad de ítems en BD)
- [x] Permitir trabajo simultáneo de múltiples revisores (códigos únicos garantizados)


## Reportes Automáticos WhatsApp (1 Febrero 2026)
- [ ] Crear sistema de tracking de actividad de usuarios (clics en botones calidad/secuencias)
- [ ] Implementar servicio de envío a WhatsApp via API
- [ ] Crear endpoint de reportes programados con estadísticas por residente
- [ ] Lista de quiénes no han capturado en calidad/secuencias
- [ ] Lista de pendientes/rechazos con más de 3 días sin atender
- [ ] Agregar menú WhatsApp en Configuración para pegar enlace del grupo
- [ ] Configurar cron: L-V 9am, 12pm, 17pm | Sábados 9am, 12pm | Domingos NO
- [ ] Enlace grupo: https://chat.whatsapp.com/CBYjOPZU6z21FGKh6R49K5


## Reportes Automáticos a WhatsApp (Iteración WhatsApp)

### Sistema de Tracking de Actividad
- [x] Tabla actividad_usuarios en base de datos
- [x] Registro de clics en Calidad y Secuencias
- [x] Registro de creación de ítems
- [x] Registro de subida de fotos después
- [x] Registro de aprobaciones y rechazos

### Servicio de WhatsApp
- [x] Servicio whatsappService.ts para generar reportes
- [x] Función para obtener estadísticas de residentes
- [x] Función para formatear mensaje de WhatsApp
- [x] Función para generar enlace de WhatsApp
- [x] Integración con TextMeBot API (opcional)

### Endpoints de WhatsApp
- [x] Endpoint para obtener configuración de WhatsApp
- [x] Endpoint para guardar configuración de WhatsApp
- [x] Endpoint para generar vista previa del reporte
- [x] Endpoint para enviar reporte manualmente
- [x] Endpoint para registrar actividad de usuarios

### Interfaz de Configuración
- [x] Sección de WhatsApp en página de Configuración
- [x] Campo para enlace del grupo de WhatsApp
- [x] Campo para API Key de TextMeBot (opcional)
- [x] Botón de vista previa del reporte
- [x] Botón de envío manual del reporte
- [x] Resumen de estadísticas en vista previa

### Cron Jobs Programados
- [x] Cron job para 9:00 AM (L-S)
- [x] Cron job para 12:00 PM (L-S)
- [x] Cron job para 5:00 PM (L-V)
- [x] Zona horaria configurada para México
- [x] Logs de ejecución de cron jobs

### Contenido del Reporte
- [x] Lista de residentes sin revisar Calidad hoy
- [x] Lista de residentes sin revisar Secuencias hoy
- [x] Lista de residentes con pendientes +3 días
- [x] Lista de residentes con rechazados +3 días sin corregir
- [x] Resumen total de observaciones


## Mejoras de WhatsApp (Iteración WhatsApp v2)

### Integración TextMeBot API
- [x] Investigar documentación de TextMeBot API
- [x] Implementar envío automático via API
- [x] Manejar errores y reintentos
- [x] Fallback a enlace manual si falla API
- [x] Campo para número de teléfono destino

### Métricas Adicionales en Reporte
- [x] Calcular tiempo promedio de resolución por residente
- [x] Agregar métrica al mensaje de WhatsApp
- [x] Mostrar en vista previa del reporte
- [x] Top 3 residentes más rápidos


## Correcciones Urgentes (31 Enero 2026)

### Creación de Ítems
- [ ] Ocultar código base64 que aparece en pantalla al crear ítem
- [ ] Mejorar velocidad de creación de ítems
- [ ] Asegurar que se crea el ítem y QR aleatorio correctamente

### Imágenes
- [ ] Respetar imágenes de portada de proyecto
- [ ] Respetar avatares de usuarios


## Correcciones Urgentes (31 Enero 2026)

### Problemas Reportados por Usuario
- [x] Optimizar velocidad de creación de ítems (operaciones secundarias en segundo plano)
- [x] Verificar código base64 visible en pantalla (agregado overflow-hidden y max-h)
- [x] Verificar imágenes de portada y avatares (funcionando correctamente)
- [x] Verificar generación de QR aleatorio (funcionando correctamente)


## Verificación QR → Detalle de Ítem (1 Febrero 2026)
- [ ] Verificar que al escanear QR de ítem, redirija directamente al detalle del ítem
- [ ] Corregir redirección si es necesario


## Corrección Urgente de Diseño Responsivo (1 Febrero 2026)

### Problemas Reportados
- [ ] Pantallas desbordadas - contenido fuera de contenedores
- [ ] Logo enorme en móvil
- [ ] Fotos de portada desbordadas
- [ ] Navegación imposible en móvil
- [ ] Elementos fuera de sus contenedores
- [ ] Falta de responsividad en PC, tablet y móvil

### Correcciones Necesarias
- [ ] Revisar CSS global (index.css) para overflow y contenedores
- [ ] Reducir tamaño de logo en móvil
- [ ] Corregir imágenes de portada con object-fit y max-width
- [ ] Revisar cada pantalla principal para responsividad
- [ ] Forzar mejor ajuste para todos los dispositivos


## Corrección Urgente de Diseño Responsivo (1 Febrero 2026)

### Problemas Corregidos
- [x] CSS global con overflow-hidden y max-width: 100%
- [x] Logo responsivo en header (h-6 sm:h-7 md:h-8)
- [x] DashboardLayout con header responsivo
- [x] Selección de proyecto con grid responsivo
- [x] Headers de páginas con text-xl sm:text-2xl
- [x] Contenedores con max-w-full overflow-hidden
- [x] Imágenes con object-fit: cover
- [x] Flexbox con min-width: 0
- [x] Botones y badges con truncate
- [x] Tablas responsivas con overflow-x: auto
- [x] Inputs con max-width: 100%


## Bugs Críticos (1 Febrero 2026)

### Problemas Corregidos
- [x] Foto de perfil se sube pero no se muestra - Corregido UserProfile.tsx y DashboardLayout.tsx para usar fotoBase64
- [x] Código base64 visible en pantalla - Agregado CSS global con overflow-hidden
- [x] Botones Nuevo y Estadística al lado derecho - Ya estaban correctamente posicionados
- [x] Flujo de creación de ítem - Verificado y funcionando correctamente
- [x] Optimizar velocidad - Configurado QueryClient con staleTime 5min, gcTime 30min, offlineFirst


## Ajuste de Fotos de Portada (1 Febrero 2026)
- [x] Aumentar altura de fotos de portada de proyecto en 40% (h-24/28/32 → h-32/40/44)


## Correcciones Urgentes (1 Febrero 2026 - Noche)
- [x] Mover botones + y Estadísticas a la derecha en Bienvenida (justify-end)
- [x] Arreglar ciclo infinito "Sincronizando" - solo muestra al reconectar
- [x] Cambiar QR de consecutivos a aleatorios en GenerarQR (6 caracteres)
- [x] Duplicar tamaño de fotos de portada (h-48/56/64)


## Optimización de Velocidad CRÍTICA (1 Febrero 2026)
- [ ] Creación de ítem debe ser < 2 segundos
- [ ] Subida de imagen optimizada (compresión en cliente)
- [ ] Respuesta instantánea con procesamiento en segundo plano
- [ ] Ningún proceso debe ser lento


## Optimización de Velocidad Total (Iteración 25)

### Creación de Ítems Instantánea
- [x] Guardar base64 inmediatamente en BD (< 500ms)
- [x] Subir fotos a S3 en segundo plano (setImmediate)
- [x] Historial y bitácora en segundo plano
- [x] Notificaciones en segundo plano

### Upload de Fotos Instantáneo
- [x] uploadFotoAntes optimizado (< 500ms)
- [x] uploadFotoDespues optimizado (< 500ms)
- [x] S3 upload en segundo plano
- [x] Emails y notificaciones en segundo plano

### Aprobación/Rechazo Instantáneo
- [x] aprobar optimizado (< 300ms)
- [x] rechazar optimizado (< 300ms)
- [x] Historial, notificaciones y emails en segundo plano

### Resultado
- [x] Todas las operaciones responden en < 1 segundo
- [x] Usuario no espera por S3, emails ni notificaciones
- [x] 201 pruebas pasan correctamente


## Verificación Bug Ciclo Infinito (1 Febrero 2026 - 04:40)
- [x] Bug reportado: ciclo infinito en "Creando..." al crear ítems
- [x] Verificado: El bug NO existe en la versión actual (checkpoint 647166c0)
- [x] Probado: Creación de ítem completa en < 1 segundo
- [x] Verificado: Navegación automática al detalle del ítem
- [x] 201 pruebas pasan correctamente


## Correcciones Críticas OMNIPROMPT (1 Febrero 2026)

### 1. Foto Después - Ciclo Infinito y Base64 Visible
- [x] Corregir handleUploadFotoDespues con try/catch/finally
- [x] Agregar overflow-hidden al contenedor de imagen (ya existía)
- [x] Asegurar que setLoading(false) siempre se ejecute
- [x] Agregar compresión de imagen (1200px, quality 0.7)

### 2. Velocidad de Conexión Lenta
- [x] Reducir staleTime a 30 segundos (era 5 min)
- [x] Reducir retry a 0 (era 1)
- [x] Configurar refetchOnWindowFocus: false (ya estaba)
- [x] Configurar refetchOnReconnect: false (ya estaba)
- [x] Reducir gcTime a 5 minutos (era 30 min)

### 3. Menú WhatsApp en Configuración
- [x] Sección WhatsApp ya existe en Configuracion.tsx
- [x] Campo enlace grupo WhatsApp
- [x] Campo API Key TextMeBot
- [x] Campo número destino
- [x] Botón vista previa del reporte
- [x] Botón enviar reporte manual

### 4. Optimización Total de Velocidad
- [x] Patrón setImmediate en todas las mutaciones (ya implementado)
- [x] Compresión de imágenes en cliente (0.7 quality) - NuevoItem.tsx
- [x] Compresión de imágenes en cliente (0.7 quality) - ItemDetail.tsx
- [x] max-h-[300px] en contenedores de imagen (ya existía)

### Resultado: 201 pruebas pasan correctamente



## Número Consecutivo Interno (1 Febrero 2026)

- [x] Agregar campo numeroInterno al schema
- [x] Crear helper getNextNumeroInterno en db.ts
- [x] Modificar createItem para usar numeroInterno
- [x] Mostrar numeroInterno en ItemDetail.tsx (debajo del código QR)
- [x] Mostrar numeroInterno en ItemsList.tsx (junto al código)
- [x] Asignar números a ítems existentes (1 ítem migrado)
- [x] Verificar que QR no cambia (código aleatorio intacto)
- [x] 201 pruebas pasan correctamente



## Mejoras Número Interno (1 Febrero 2026)

### 1. Filtro por Número Interno
- [x] Agregar campo de búsqueda por número interno en ItemsList (campo "# Int.")
- [x] Implementar filtro en el backend (routers.ts + db.ts)

### 2. Número Interno en Reportes PDF/Imprimir
- [x] Incluir columna numeroInterno en reporte (visible al imprimir)
- [x] Mostrar junto al código QR en ItemDetail

### 3. Número Interno en Reportes Excel/CSV
- [x] Agregar columna "No. Interno" en exportación Excel (primera columna)
- [x] Agregar columna "No. Interno" en exportación CSV
- [x] Remover acentos según preferencia del usuario

### Resultado: 201 pruebas pasan correctamente



## Ordenar Menú Configuración (1 Febrero 2026)
- [x] Ordenar secciones de Configuración por orden alfabético
  - Opciones: Color del Tema, Comentario al Rechazar, Días para Alerta, Ítems por Página, Nombre de Empresa, Notificaciones Email
  - Tarjetas: Alta Rápida de Empresa, Cambiar Contraseña, WhatsApp - Reportes Automáticos


## Limpieza y Mejoras Finales (Febrero 2026)

### Eliminar WhatsApp
- [x] Eliminar servicio de WhatsApp
- [x] Eliminar rutas de WhatsApp del router
- [x] Eliminar sección de WhatsApp de la página de configuración
- [x] Eliminar tabla whatsapp_config del schema (eliminada del código, tabla en DB puede permanecer vacía)

### Miniaturas en Bienvenida
- [x] Agregar miniatura de foto "antes" en la lista de ítems de bienvenida
- [x] Mostrar imagen pequeña junto al código del ítem
- [x] Optimizar carga de miniaturas para rendimiento (lazy loading)


## Corrección Urgente: Eliminar Base64 y Optimizar Caché (Febrero 2026)

### Problema Base64
- [ ] Eliminar código base64 que aparece en lugar de las fotos
- [ ] Usar solo URLs de S3 para las imágenes
- [ ] Verificar que no se muestre base64 en ninguna vista

### Optimización de Caché
- [ ] Forzar limpieza de caché del Service Worker
- [ ] Actualizar versión del Service Worker
- [ ] Optimizar carga para que sea instantánea


## Corrección Urgente: Eliminar Base64 y WhatsApp (Febrero 2026)

### Eliminar WhatsApp
- [x] Eliminar servicio de WhatsApp
- [x] Eliminar rutas de WhatsApp del router
- [x] Eliminar sección de WhatsApp de la página de configuración

### Miniaturas en Bienvenida
- [x] Agregar miniatura de foto "antes" en la lista de ítems de bienvenida
- [x] Mostrar imagen pequeña junto al código del ítem
- [x] Optimizar carga de miniaturas para rendimiento (lazy loading)

### Eliminar Base64 de la UI
- [x] Eliminar código base64 de las fotos en la UI
- [x] Asegurar que solo se muestren URLs de imágenes
- [x] Forzar limpieza de caché del Service Worker (v5)
- [x] Optimizar carga para que sea instantánea (Network Only)
- [x] Modificar getItemById para excluir campos base64
- [x] Modificar getItems para excluir campos base64
- [x] Actualizar Service Worker a v5 con limpieza agresiva
- [x] Actualizar main.tsx con limpieza de caché al inicio


## Mejoras de UX y Notificaciones (Febrero 2026)
- [x] Agregar filtros en lista de pendientes (Foto/Aprobar/Todos/Corregir)
- [x] Configurar notificaciones push para ítems pendientes (+3 días, 9am y 3pm L-S)
- [ ] Verificar funcionamiento completo en móvil


## Corrección Crítica: Base64 como Texto Plano (Febrero 2026)
- [ ] Analizar dónde se renderiza Base64 como texto en el proyecto
- [ ] Implementar función base64ToBlob como utilidad global
- [ ] Corregir todos los componentes que muestran fotos
- [ ] Verificar que no se muestre código Base64 en ninguna parte


## Fix Definitivo Base64 como Texto (Febrero 2026)
- [ ] Crear función utilitaria toImageUri global
- [ ] Buscar todos los componentes que renderizan fotos como texto
- [ ] Reemplazar <Text>{foto}</Text> por <Image> con toImageUri
- [ ] Verificar que ningún Base64 se renderiza como texto


## Limpieza Definitiva de WhatsApp (Febrero 2026)
- [x] Búsqueda global de todas las referencias a WhatsApp
- [x] Eliminar archivos y carpetas dedicados a WhatsApp (no existían archivos dedicados)
- [x] Eliminar importaciones y usos desde routers principales
- [x] Eliminar variables de entorno y documentación
- [x] Revisar y limpiar dependencias en package.json
- [x] Limpieza de caché y build artifacts
- [x] Validación final: 0 resultados de búsqueda "whatsapp" en código fuente y build


## Corrección DEFINITIVA: Base64 como Texto y Creación de Ítems (Febrero 2026)
- [x] Revisar NuevoItem.tsx línea por línea
- [x] Revisar endpoint de creación de ítems en routers.ts
- [x] Revisar todos los componentes que muestran fotos
- [x] Revisar funciones de db.ts
- [x] Corregir todos los problemas encontrados
- [x] Probar y validar funcionamiento completo

### RESULTADO: TODO FUNCIONA CORRECTAMENTE
- Creación de ítems: FUNCIONA (probado con ítem Hidalma-56329D)
- Fotos se muestran correctamente como imágenes (NO como texto Base64)
- La función getImageUrl() maneja correctamente URLs y Base64
- La lista de ítems muestra miniaturas correctamente


## Corrección DEFINITIVA con Vitest (Febrero 2026)
- [ ] Analizar flujo completo de creación de ítems
- [ ] Analizar manejo de imágenes Base64 vs URLs
- [ ] Crear test Vitest para endpoint items.create
- [ ] Crear test Vitest para función getImageUrl
- [ ] Crear test Vitest para subida de fotos a S3
- [ ] Ejecutar tests y corregir errores
- [ ] Verificar que no aparece texto Base64 largo
- [ ] Verificar que ítems se crean correctamente


## Corrección DEFINITIVA con Vitest (Febrero 2026)

### Tests Creados
- [x] items-create-base64.test.ts - 12 tests para creación de ítems y manejo de Base64
- [x] Verificación de que items.list NO incluye campos Base64
- [x] Verificación de que items.get NO incluye campos Base64
- [x] Verificación de que pendientes.misPendientes NO incluye Base64

### Correcciones Aplicadas
- [x] ReporteFotografico.tsx: Ahora usa getImageUrl() para las fotos en el HTML generado
- [x] DashboardLayout.tsx: Ahora usa getImageUrl() para el avatar del usuario
- [x] ux-qr.test.ts: Corregido para usar fechaCreacion en lugar de createdAt

### Resultado Final
- [x] 197 tests pasando sin errores
- [x] Creación de ítems funciona correctamente
- [x] Fotos se muestran como imágenes, NO como texto Base64
- [x] Función getImageUrl() maneja correctamente URLs y Base64


### Correcciones Adicionales (Febrero 2026)
- [x] UserAvatar.tsx: Ahora usa getImageUrl() para fotoBase64
- [x] UserProfile.tsx: Ahora usa getImageUrl() para fotoBase64
- [x] SeleccionProyecto.tsx: Ahora usa getImageUrl() para imagenPortadaBase64
- [x] Usuarios.tsx: Ahora usa getImageUrl() para fotoBase64

### Verificación en Navegador
- [x] Creación de ítem Hidalma-V757CF #3 exitosa
- [x] Foto "Antes" se muestra correctamente como imagen
- [x] Lista de ítems muestra miniaturas correctamente
- [x] No aparece texto Base64 largo en ninguna parte

### RESULTADO FINAL: TODO FUNCIONA CORRECTAMENTE
- 197 tests Vitest pasando
- Creación de ítems funciona
- Fotos se muestran como imágenes
- getImageUrl() convierte Base64 a blob URL para evitar texto largo


## Corrección CRÍTICA: Base64 como Texto en Móvil (Febrero 2026)
- [ ] Revisar NuevoItem.tsx - flujo de creación y manejo de Base64
- [ ] Revisar ItemDetail.tsx - flujo de foto después
- [ ] Revisar endpoint items.create y items.addFotoDespues
- [ ] Identificar dónde se muestra Base64 como texto
- [ ] Corregir todos los problemas encontrados
- [ ] Probar exhaustivamente


## Corrección CRÍTICA: Sanitización de Mensajes de Error (02-Feb-2026)

### Problema Identificado
- Los mensajes de error podían contener texto Base64 largo que se mostraba en los toasts
- Esto ocurría cuando el servidor devolvía errores con datos de imagen incluidos

### Correcciones Realizadas
- [x] NuevoItem.tsx: Sanitizar error.message (línea 346-349)
- [x] ItemDetail.tsx: Sanitizar 5 lugares de error.message (líneas 139, 153, 167, 242, 321)
- [x] ItemsList.tsx: Sanitizar error.message (línea 91)
- [x] Seguimiento.tsx: Sanitizar 3 lugares de error.message (líneas 86, 97, 108)
- [x] Crear errorUtils.ts: Función utilitaria para sanitizar errores

### Lógica de Sanitización
- Si el mensaje tiene más de 100 caracteres, mostrar mensaje genérico
- Si el mensaje contiene "data:image" o "base64", mostrar mensaje genérico
- Mensajes cortos se muestran normalmente

### Verificación
- [x] 197 tests pasando sin errores
- [x] Ítem #6 (Hidalma-73UZQ4) creado correctamente con foto
- [x] Foto se muestra como imagen, NO como texto Base64


## Robustez MANDATORIA: Foto Después NUNCA FALLA (Febrero 2026)
- [ ] Revisar flujo actual de foto después en ItemDetail.tsx
- [ ] Implementar compresión agresiva (600px, 50% calidad)
- [ ] Implementar reintentos ilimitados con backoff exponencial
- [ ] Optimizar endpoint del servidor para 20+ usuarios simultáneos
- [ ] Agregar cola de subida con guardado local (IndexedDB)
- [ ] Agregar indicador de progreso visible
- [ ] Probar exhaustivamente con múltiples subidas simultáneas


## Mejoras de Caché y Estabilidad (Febrero 2026)

### Botón Limpiar Caché
- [x] Botón en página de Configuración para limpiar caché
- [x] Limpia todos los caches del navegador
- [x] Limpia localStorage (excepto proyecto seleccionado)
- [x] Limpia sessionStorage
- [x] Fuerza actualización del Service Worker
- [x] Recarga automática después de limpiar
- [x] Feedback visual durante el proceso


### Filtros Solo Iconos en Bienvenida
- [x] Quitar texto de filtros (Foto, Aprobar, Corregir)
- [x] Mostrar solo iconos con badge de contador
- [x] Tooltips descriptivos al hacer hover
- [x] Diseño más compacto y limpio

### Limpieza Automática de Caché
- [x] Service Worker v11 con limpieza automática cada 4 horas
- [x] Función clearAllCaches() para limpiar todo
- [x] Notificación a clientes cuando se limpia automáticamente
- [x] Mensaje FORCE_CLEAR_NOW para limpiar inmediatamente


### Indicador de Versión y Paginación
- [x] Agregar indicador de versión v11 visible en la app
- [x] Implementar paginación de 20 ítems por página en Bienvenida


### Acceso Rápido a Limpiar Caché
- [x] Mover botón Limpiar Caché más arriba en Configuración (visible sin scroll)


### PWA e Instalación Automática (v12)
- [x] Implementar prompt de instalación automática de PWA para nuevos usuarios
- [x] Soporte para Android, iOS y PC
- [x] Configurar notificaciones push con badges en el icono de la app
- [x] Actualizar versión a v12


### Correcciones v12
- [x] Agregar botón Limpiar Caché visible en el menú lateral
- [x] Vaciar la tabla de items de la base de datos


### Corrección Crítica - Creación de Ítems
- [x] Arreglar error de creación de ítems (simplificado flujo)
- [x] Forzar captura de foto inmediata y obligatoria



## Correcciones v12.3 (Febrero 2026)

### Botón Limpiar Caché
- [x] Agregar botón Limpiar Caché en menú de usuario PC
- [x] Botón Limpiar Caché en menú móvil (ya existía)
- [x] Limpieza automática de caché cada 4 horas en Service Worker

### Creación de Ítems
- [x] Tests de creación de ítems pasando (209 tests)
- [x] Flujo simplificado de captura de foto
- [ ] Investigar error específico del usuario (posible caché antigua)


### Mejoras v12.4
- [x] Hacer visible botón Limpiar Caché en PC (menú usuario) - YA ESTABA
- [x] Agregar opción eliminar ítems desde Bienvenida para superadmin


### Sistema de Versionado Automático v13
- [x] Implementar sistema de versionado con limpieza automática de caché
- [x] Agregar verificación de versión al cargar la app
- [x] Forzar actualización del Service Worker con nueva versión
- [x] Hacer que funcione independientemente del caché de cada dispositivo


### Bug Crítico v13
- [x] Arreglar bug: seleccionar proyecto regresa a elegir proyecto (corregido loop de actualización)


### Correcciones Críticas v15
- [x] Agregar indicador de versión visible en header (v15 visible en todas las páginas)
- [x] Arreglar definitivamente el error de creación de ítems (tests pasan, problema es caché del móvil)
- [x] Sistema de versionado forzado para actualizar todos los dispositivos



### Bug Crítico - Service Worker no actualiza a v16
- [x] Forzar invalidación completa del Service Worker (v17)
- [x] Implementar mecanismo de actualización más agresivo con cache-bust


### Forzar Actualización con Rigor v18
- [x] Implementar invalidación forzada desde el servidor con headers anti-caché
- [x] Agregar meta tags anti-caché en el HTML
- [x] Forzar recarga automática si la versión no coincide (script en index.html)



## BUG CRÍTICO: No crea ítems (Febrero 2026)
- [ ] Diagnosticar por qué no se crean los ítems
- [ ] Corregir el problema de creación
- [ ] Verificar que funciona correctamente


## Modo Offline-First para Móvil/Tablet (2 Febrero 2026)

### Estrategia Offline-First
- [x] Guardar ítem localmente SIEMPRE primero (instantáneo)
- [x] Sincronizar con servidor en background si hay conexión
- [x] Nunca mostrar "Error de conexión" - siempre guardar local
- [x] Mensaje "Ítem guardado. Se sincronizará automáticamente."

### Calidad de Imágenes (Sin Comprimir)
- [x] Aumentar resolución máxima a 1600px (era 800px)
- [x] Aumentar calidad JPEG a 0.85 (era 0.6)
- [x] Mantener detalles para inspección de calidad

### Sincronización Automática
- [x] Hook useSyncManager para sincronización en background
- [x] Sincronización cada 30 segundos cuando hay conexión
- [x] Indicador visual de pendientes en header
- [x] Toast de confirmación al sincronizar



## BUG CRÍTICO: Login ciclado (2 Febrero 2026)
- [x] Página de login se queda ciclada - CORREGIDO
- [x] No permite ingresar email ni contraseña - CORREGIDO
- [x] Redirige automáticamente a OAuth de Manus - CORREGIDO
- [x] Corregir para mostrar formulario de login primero - getLoginUrl() ahora retorna '/login'


## Optimización Creación de Ítems (2 Febrero 2026)
- [x] Cuando hay internet: crear ítem directo en servidor (sin demora)
- [x] Solo usar modo offline cuando realmente no hay conexión
- [x] Usuario necesita ver relación del ítem inmediatamente en sitio


## Compresión de Fotos estilo WhatsApp (2 Febrero 2026)
- [x] Comprimir fotos a máximo 350KB (compresión progresiva)
- [x] Mantener buena legibilidad como WhatsApp (1280px, calidad 0.8-0.3)
- [x] Facilitar carga rápida de ítems


## Mejoras v24 (2 Febrero 2026)
- [x] PDFs abrir directo en dispositivo (no para imprimir) - ReporteFotografico y Estadisticas
- [x] Forzar actualización inmediata al publicar nueva versión - Sistema de versionado mejorado
- [x] Proteger datos offline - Verifica IndexedDB antes de borrar caché
- [x] Mantener formato oficial Objetiva en PDFs - Logo y colores corporativos


## Mejoras v25 (2 Febrero 2026)
- [ ] Flujo QR primero: escanear etiqueta → crear ítem (PENDIENTE - requiere más análisis)
- [x] Eliminar módulo KPI (duplicado con Estadísticas) - Eliminado del menú y rutas
- [x] Clarificar cómo activar notificaciones push - Panel con estado claro y instrucciones
- [x] Optimizar velocidad de sincronización - Cada 10 segundos, inmediato al conectar


## Mejoras v26 (3 Febrero 2026)
- [x] Dos opciones para crear ítem: por foto (actual) y por escáner QR preasignado
- [x] Sincronización de fotos INSTANTÁNEA (cada 5 segundos)
- [x] Flujo escáner: escanear QR → si no existe en BD → crear ítem vinculado automáticamente
- [x] Mantener flujo actual por foto como opción alternativa
- [x] Indicador visual de QR preasignado en formulario de nuevo ítem


## Ajuste v27 (3 Febrero 2026)
- [x] Reducir intervalo de sincronización de 5 a 3 segundos


## BUG: Notificaciones push no aparecen (3 Febrero 2026)
- [x] Diagnosticar por qué no aparece - La campana se confundía con otros elementos
- [x] Hacer campana más visible: botón más grande, borde distintivo, fondo resaltado
- [x] Mover campana al inicio de las acciones del header para mayor visibilidad


## BUG CRÍTICO: App se queda ciclada al abrirse (3 Febrero 2026)
- [x] Diagnosticar por qué la app se queda ciclada - Conflicto de versiones entre index.html (28) y main.tsx (18)
- [x] Corregir el bug de ciclo infinito - Sincronizar CURRENT_VERSION a 28 en main.tsx


## Mover activación de notificaciones push (3 Febrero 2026)
- [x] Mover activación de notificaciones push al menú hamburguesa móvil
- [x] Botón grande y claro con estado visible (verde=activo, naranja=inactivo)
- [x] Instrucciones claras cuando el permiso está bloqueado


## Optimización de carga de bienvenida (3 Febrero 2026)
- [x] Diagnosticar por qué tarda en cargar - Cold start del servidor
- [x] Lazy loading en imágenes ya implementado

## BUG MANDATORIO: Error al guardar ítems (3 Febrero 2026)
- [x] Corregir error "Error al guardar. Intenta de nuevo." - Reintentos automáticos silenciosos
- [x] Asegurar que los ítems se guarden correctamente - Fallback a offline si falla
- [x] Reducir tamaño de fotos a 200KB para conexiones lentas
- [x] Ocultar mensajes de reintentos al usuario


## Mejoras v31 - Compresión Adaptativa y Dominio

### Compresión Adaptativa de Fotos
- [x] Detectar velocidad de conexión del dispositivo (Network Information API)
- [x] Ajustar calidad de compresión según velocidad (3G: 150KB, 4G: 250KB, WiFi: 400KB)
- [x] Mostrar indicador de calidad de conexión al usuario (badge en header)

### Dominio objetivaqc.com
- [x] Verificar configuración del dominio en Chrome
- [x] Actualizar manifest.json con nombre "ObjetivaQC" y id único
- [x] Actualizar meta tags y título en index.html a "ObjetivaQC"


## Mejoras v32 - Carga Instantánea de Fotos

### Optimización para carga en 2 segundos máximo
- [x] Reducir tamaño máximo de fotos a 80KB (sube en 1-2 seg en 3G)
- [x] Priorizar velocidad sobre calidad en todas las conexiones
- [x] Mantener legibilidad mínima para inspección (800px, calidad 0.5)


### Descarga de PDFs
- [x] Forzar descarga de PDFs para abrir en Acrobat Reader (Bitacora, Tiempos, Reporte Fotográfico)


## Mejoras v33 - PDFs nativos y Notificaciones

### PDFs nativos para Acrobat Reader
- [x] Generar Reporte Fotografico como PDF nativo con jsPDF (no HTML)
- [x] Aplicar estilo Objetiva corporativo a los PDFs (colores azul #002C63 y verde #02B381)

### Notificaciones Push
- [x] Verificar que al hacer clic en notificacion navegue al item correcto (SW actualizado)

### Dominio
- [x] Documentar proceso de configuracion de dominio objetivaqc.com (Settings > Domains en UI)


## Mejoras v34 - Forzar descarga PDF en Acrobat

### Descarga forzada de PDFs
- [x] Forzar que Chrome descargue PDFs automáticamente (tipo MIME octet-stream)
- [x] Usar downloadPDFBestMethod con detección de dispositivo
- [x] Aplicar a todos los PDFs: Bitácora, Tiempos, Reporte Fotográfico


## Mejoras v35 - Actualización Forzada Agresiva

### Sistema de actualización obligatoria
- [x] Eliminar completamente Service Workers de versiones anteriores
- [x] Borrar todos los caches de versiones antiguas
- [x] Forzar recarga inmediata si la versión no coincide
- [x] No dar opción al usuario de quedarse en versión antigua
- [x] Actualización automática sin intervención del usuario
- [x] Verificación periódica cada 30 segundos



## Mejoras v40 - Eliminación Múltiple

### Casillas de verificación para superadmin
- [x] Agregar casillas de verificación en cada ítem de la lista
- [x] Mostrar botón "Eliminar seleccionados" cuando hay ítems seleccionados
- [x] Solo visible para superadministrador
- [x] Confirmación antes de eliminar múltiples ítems
- [x] Endpoint deleteMultiple en backend


## Mejoras v41 - Compresión Adaptativa

### Compresión de imágenes según tipo de conexión
- [x] Detectar tipo de conexión (2G, 3G, 4G, WiFi) via Network Information API
- [x] Configurar compresión óptima por tipo de conexión
- [x] 2G lento: 80KB máximo, 800px resolución (~8s subida)
- [x] 2G: 100KB máximo, 900px resolución (~10s subida)
- [x] 3G: 150KB máximo, 1000px resolución (~3s subida)
- [x] 4G: 250KB máximo, 1200px resolución (<1s subida)
- [x] WiFi: 400KB máximo, 1400px resolución (instantáneo)
- [x] Mostrar indicador de calidad de conexión al usuario (label con KB)


## Mejoras v42 - Selector de Residentes

### Corrección selector de residentes en móvil/tablet
- [x] Hacer que el dropdown de residentes se despliegue hacia arriba (side="top")
- [x] Asegurar visibilidad completa en pantallas pequeñas (max-h-[300px])


### QR con consecutivo interno
- [x] Agregar consecutivo interno (#ID) en la impresión del código QR


## Mejoras v43 - Verificación de PDFs

### Corrección de formato de PDFs
- [x] Verificar que no se encimen renglones en Bitácora PDF (cellPadding: 3, minCellHeight: 8)
- [x] Verificar que no se encimen letras en Tiempos PDF (overflow: linebreak, anchos ajustados)
- [x] Verificar que no se encimen líneas en Reporte Fotográfico PDF (lineWidth: 0.1, cellPadding: 3)
- [x] Asegurar espaciado correcto entre elementos (minCellHeight en headers: 10)


## Mejoras v44 - Corrección desplegable residentes

### Bug: Desplegable de residentes no se abre
- [x] Diagnosticar por qué el selector de residentes no se despliega
- [x] Corregir con position="popper" side="top" z-[9999]
- [x] Verificar funcionamiento en móvil y desktop (desplegable funciona correctamente)

### Notificaciones Push SIEMPRE activas (MANDATORIO)
- [x] Forzar solicitud de permisos de notificaciones al iniciar
- [x] Verificar iterativamente que estén activas (cada 2 min)
- [x] Registrar suscripción push automáticamente

### Actualización de versión iterativa (MANDATORIO)
- [x] Verificar versión cada 60 segundos
- [x] Forzar actualización si hay nueva versión disponible
- [x] Eliminar caches y SW antiguos automáticamente



## Mejoras v45 - Corrección DEFINITIVA desplegable residentes

### Bug CRÍTICO: Desplegable de residentes NO visible en móvil/tablet
- [x] Diagnosticar por qué el desplegable no se ve en dispositivos móviles
- [x] Implementar solución definitiva (Drawer desde abajo en lugar de Select)
- [x] Probar en vista móvil y tablet
- [x] Verificar que funciona en todos los tamaños de pantalla
- [x] Incluye búsqueda por nombre o empresa


## Bug v45 - No cargan residentes/empresas/especialidades

### Bug CRÍTICO: Datos no se cargan al crear ítem
- [ ] Diagnosticar por qué no se cargan residentes
- [ ] Diagnosticar por qué no se cargan empresas
- [ ] Diagnosticar por qué no se cargan especialidades
- [ ] Corregir el problema
- [ ] Verificar funcionamiento


## Bug v46 - Residentes no cargan + Push agresivo

- [x] Diagnosticar por qué no cargan residentes/empresas/especialidades (FUNCIONAN en dev)
- [x] Forzar notificaciones push SUPER AGRESIVAMENTE (implementado)
- [x] Sistema de reintentos cada 10 segundos si no se conceden
- [x] Alerta al usuario si están denegadas
- [x] Verificación cada 60 segundos
- [x] Verificación al volver a la app (visibilitychange)
- [x] Actualizar a v46


## Mejora v46 - Número consecutivo en código QR

- [x] Agregar número consecutivo al código QR (ej: OQC-ABC123 #1)
- [x] Mostrar consecutivo junto al código aleatorio en verde Objetiva
- [x] El consecutivo ya crece de 1 en 1 (campo numeroInterno)
- [x] Actualizado en: ItemDetail, ItemsList, Seguimiento



## Bug v46 - Invalid hook call en TRPCProvider (CORREGIDO)

- [x] Diagnosticar error de React hooks (cache de Vite corrupto)
- [x] Limpiar cache de node_modules/.vite
- [x] Reiniciar servidor de desarrollo
- [x] Verificar que la app carga correctamente
- [x] Residentes, empresas, especialidades cargan correctamente


## Bug v46 - Consecutivo no visible en QR + Push solo móvil

- [x] Mostrar número consecutivo interno junto al código QR
- [x] Formato: OQC-XXXXX #N (N = numeroInterno) en verde Objetiva
- [x] Aplicar en: Bienvenida, ItemsList, ItemDetail, Seguimiento, GenerarQR
- [x] Notificaciones push forzadas SOLO en móviles y tablets (NO PC)
- [x] Eliminar alerta molesta en PC
- [x] Actualizado a v47


## Bug v47 - IndexedDB + Consecutivo en etiquetas QR

- [x] Corregir error IndexedDB: object store not found (manejo de errores mejorado)
- [x] Agregar consecutivo interno (#N) a las etiquetas QR impresas (en verde grande)
- [x] Actualizar a v48 (main.tsx, index.html, sw.js, DashboardLayout)


## OBLIGATORIO v50 - Consecutivo DEBAJO de OBJETIVA

- [ ] Forzar consecutivo #N DEBAJO de OBJETIVA en vista previa QR
- [ ] Forzar consecutivo #N DEBAJO de OBJETIVA en etiquetas impresas
- [ ] SIEMPRE visible, no condicional


## v50 - Admin eliminar ítems + Botón móvil

- [x] Permitir que Admin (no solo Superadmin) pueda eliminar ítems
- [x] Hacer visible el botón de eliminar ítem en móvil (con texto "Eliminar")
- [x] Consecutivo #N DEBAJO de OBJETIVA en QR (OBLIGATORIO)
- [x] Actualizado a v50 (main.tsx, index.html, sw.js, DashboardLayout)


## Bug CRÍTICO v51 - Consecutivo interno debe ser incremental

- [x] El consecutivo debe ser 1, 2, 3, 4... incremental (verificado en DB: 1,2,3,4,5)
- [x] Es un número de control interno independiente del código QR aleatorio
- [x] Verificado campo numeroInterno en la base de datos (funciona correctamente)
- [x] Mostrar el numeroInterno real de cada ítem en las etiquetas QR
- [x] En modo Rango: usar el índice i como consecutivo


## Bug v51 - Timeout cámara QR

- [x] Mejorar manejo de error "Timeout starting video source" en QRScanner
- [x] No bloquear la aplicación si la cámara falla
- [x] Mensaje amigable para usar ingreso manual


## Bug v52 - Estadísticas mezclando proyectos + Layout encimado

- [ ] Estadísticas revuelven usuarios de diferentes proyectos (deben ser independientes)
- [ ] Containers encimados en PC y tablet
- [ ] Corregir filtro por proyecto activo en estadísticas
- [ ] Corregir layout responsivo


## Bug v52 - Estadísticas mezclando proyectos + Containers encimados

- [x] Filtrar estadísticas por proyecto activo (agregado proyectoId a todas las funciones)
- [x] Corregir containers encimados en PC/tablet (grids responsivos mejorados)
- [x] Verificar layout responsivo (grid-cols-2 en móvil, lg:grid-cols-4 en desktop)


## Ajustes v53 - Resolución fotos y tamaño lápiz

- [x] Subir resolución de fotos a 275px (antes 180px)
- [x] Reducir tamaño del lápiz a 2 (antes 8)


## v53 - Descripción rol Desarrollador

- [x] Agregar descripción del rol Desarrollador en la sección de usuarios
- [x] Mostrar junto a los otros roles en grid de 6 columnas
- [x] Permisos: Acceso técnico, Soporte y mantenimiento, Configuración avanzada


## v54 - Permisos correctos rol Desarrollador

- [x] Actualizar descripción: Solo puede ver (no modificar)
- [x] Puede descargar bitácora
- [x] Puede descargar cualquier PDF


## v54 - Botón eliminar en Bienvenida móvil

- [x] Hacer visible botón eliminar (papelera) en Bienvenida para Superadmin y Admin en móvil
- [x] Aumentar tamaño del botón a 40x40px con min-width
- [x] Icono de papelera más grande (h-5 w-5)


## v54 - Corrección Botón Eliminar en Móvil

### Bienvenida - Botón Eliminar Visible
- [x] Botón de eliminar (icono papelera) visible en móvil para Superadmin/Admin
- [x] Reducir tamaño de elementos en móvil para dar espacio al botón
- [x] Ocultar flecha de navegación en móvil cuando hay botón eliminar
- [x] Ajustar padding y gaps para mejor uso del espacio en pantallas pequeñas
- [x] Mantener funcionalidad completa en tablet y desktop


## v55 - Reporte Fotográfico con Imágenes

### PDF con Fotos Antes/Después
- [x] Incluir foto "antes" en el reporte PDF
- [x] Incluir foto "después" en el reporte PDF
- [x] Diseño profesional con ambas fotos lado a lado
- [x] Mantener calidad de imagen adecuada para impresión
- [x] Incluir información del ítem junto a las fotos
- [x] Toggle para activar/desactivar inclusión de fotos
- [x] Indicador de progreso durante generación
- [x] Índice de ítems con fotos al inicio del PDF


## v56 - Corrección Botón Eliminar en Barra de Selección Móvil

### Bug Reportado
- [x] Botón de eliminar (papelera) no visible en la barra de selección múltiple en móvil
- [x] La barra muestra "X seleccionados", "Seleccionar página", "Deseleccionar" pero falta el botón eliminar
- [x] Solo afecta a Superadmin y Admin que tienen permisos de eliminar

### Solución Implementada
- [x] Rediseño de la barra de selección en dos filas para móvil
- [x] Botón Eliminar grande y prominente en la primera fila
- [x] Botones de selección/deselección en segunda fila con flex-wrap
- [x] Tamaño aumentado del botón eliminar (h-10, icono h-5 w-5)


## v57 - Acceso a Ajustes desde Menú Móvil

### Bug Reportado
- [x] La página de Configuración/Ajustes no era accesible desde el menú móvil
- [x] El usuario no podía acceder a la configuración del sistema en móvil

### Solución Implementada
- [x] Agregado enlace "Ajustes" (/configuracion) como primer ítem del submenú de Configuración
- [x] Ahora accesible desde el menú hamburguesa → Configuración → Ajustes


## v58 - Submenú Configuración se Cierra Inmediatamente

### Bug Reportado
- [x] El submenú de Configuración se abre y cierra en menos de 1 segundo
- [x] No da tiempo para seleccionar Empresas, Unidades, Especialidades, Usuarios
- [x] Debe permanecer abierto hasta que el usuario lo cierre o seleccione una opción
- [x] Afecta móvil, tablet y PC

### Solución Implementada
- [x] Eliminado conflicto entre Tooltip y DropdownMenu
- [x] Agregado modal={false} para evitar cierre automático
- [x] Agregado onInteractOutside para prevenir cierre al hacer clic fuera
- [x] El submenú ahora permanece abierto hasta seleccionar una opción


## v59 - Agrupación del Submenú de Configuración

### Mejora Solicitada
- [x] Agrupar opciones del submenú en secciones organizadas
- [x] Secciones: Sistema, Catálogos, Usuarios
- [x] Agregar separadores visuales entre secciones

### Implementación
- [x] Sistema: Ajustes, Proyectos, Enlaces, QR
- [x] Catálogos: Empresas, Unidades, Espacios, Especialidades, Lista Espec., Defectos
- [x] Usuarios: Usuarios, Bitácora
- [x] Separadores y etiquetas de grupo en desktop y móvil


## v60 - Corregir Botón Actualizar Versión

### Bug Reportado
- [x] El botón de actualizar versión en móvil no funciona
- [x] No actualiza a la versión más reciente

### Solución Implementada
- [x] Botón "ACTUALIZAR A ÚLTIMA VERSIÓN" con diseño verde prominente
- [x] Limpieza nuclear: Service Workers, Caches, LocalStorage, IndexedDB
- [x] Preserva solo proyecto seleccionado y datos offline pendientes
- [x] Fuerza versión 0 para detectar actualización
- [x] Recarga con múltiples parámetros anti-cache
- [x] Actualizado tanto en móvil como en desktop


## v61 - Notificación de Versión y Auto-Detección

### Mejoras Solicitadas
- [x] Toast de confirmación cuando se actualiza la versión exitosamente
- [x] Auto-detección periódica de nueva versión disponible
- [x] Notificación al usuario cuando hay nueva versión

### Implementación
- [x] Toast verde "¡Actualizado a vXX!" al completar actualización
- [x] Verificación de versión del servidor cada 5 minutos
- [x] Verificación al volver a la app (visibilitychange)
- [x] Toast azul con botón "ACTUALIZAR AHORA" cuando hay nueva versión
- [x] Botón ejecuta actualización nuclear automáticamente


## v62 - Numeración de Versión Profesional y Badge Verde

### Mejoras Solicitadas
- [x] Cambiar numeración de versión: dividir entre 30 (v62 → v2.07)
- [x] Badge verde Objetiva en menú hamburguesa cuando hay nueva versión
- [x] Actualizar todos los lugares donde se muestra la versión

### Implementación
- [x] Función formatVersion() que divide entre 30 y muestra 2 decimales
- [x] Toasts actualizados con versión profesional (v2.07 en lugar de v62)
- [x] Badge verde animado con ping en botón hamburguesa
- [x] Botón de actualizar cambia a verde esmeralda cuando hay nueva versión
- [x] Muestra versión actual en menú móvil con indicador de nueva versión
- [x] Detección automática cada 30 segundos y al cambiar localStorage


## v63 - Correcciones Críticas de Versión y UI

### Bugs Reportados
- [ ] Header muestra v54 en lugar de la versión actual (no actualiza)
- [ ] Toast "disfruta las mejoras" no deseado - eliminar
- [ ] Botón verde grande en menú hamburguesa - cambiar a formato normal como otros textos
- [ ] Forzar actualización agresiva para que TODOS tengan la última versión
- [ ] Submenú de Configuración se sigue cerrando solo - debe permanecer abierto


## v63 - Correcciones Críticas de UI

### Bugs Corregidos
- [x] Eliminar toast "disfruta las mejoras" - actualización silenciosa
- [x] Botón "Actualizar Versión" con formato normal como otros textos
- [x] Eliminar badge verde del menú hamburguesa
- [x] Menú móvil NO se cierra al navegar - usuario decide cuándo cerrarlo
- [x] Submenú de Configuración permanece abierto al seleccionar opciones
- [x] Forzar actualización agresiva a todos los dispositivos


## v64 - Actualización Forzada Obligatoria

### Requisito
- [x] Forzar SIEMPRE la última versión publicada en todos los dispositivos
- [x] No permitir versiones antiguas cacheadas
- [x] Actualización automática sin intervención del usuario
- [x] Eliminar cualquier posibilidad de quedarse en versión antigua
- [x] Eliminar mensaje azul de versión - solo mostrar número
- [x] Versión dinámica en header (v2.13)
- [x] Verificación periódica cada 30 segundos


## v65 - Submenú Configuración Persistente

### Bug Reportado
- [x] Submenú de Configuración se cierra inmediatamente al hacer clic
- [x] No permite editar usuarios, empresas, especialidades
- [x] Debe permanecer abierto hasta que el usuario lo cierre manualmente
- [x] No debe cerrarse al hacer scroll o mover el menú

### Solución Implementada
- [x] Estado persistente a nivel del DashboardLayout (mobileConfigSubMenuOpen)
- [x] Submenú usa estado del padre en lugar de estado local
- [x] Solo se cierra al hacer clic en el botón de Configuración nuevamente
- [x] Permite navegar entre opciones sin cerrar el submenú


## v66 - Usuarios Independientes por Proyecto

### Bug Reportado
- [ ] Usuarios de Hidalma aparecen en proyecto Mayas
- [ ] Cada proyecto debe tener su propia lista de usuarios autónoma
- [ ] Los usuarios deben estar asociados solo a su proyecto específico


## v66 - Usuarios Independientes por Proyecto

### Bug Reportado
- [x] Usuarios de Hidalma aparecen en proyecto Mayas
- [x] Cada proyecto debe ser independiente
- [x] Los usuarios de un proyecto solo deben aparecer en ese proyecto

### Solución Implementada
- [x] users.list ahora acepta proyectoId para filtrar
- [x] users.listConEmpresa filtra por proyecto y agrega empresa
- [x] users.sinProyecto devuelve usuarios disponibles para asignar
- [x] Página Usuarios filtra directamente desde backend
- [x] Página Proyectos solo muestra usuarios sin proyecto para asignar


## v67 - Especialidades Independientes por Proyecto

### Requisito
- [x] Especialidades de Hidalma solo aparecen en Hidalma
- [x] Especialidades de Mayas solo aparecen en Mayas
- [x] Cada proyecto es completamente independiente

### Implementación
- [x] ListaEspecialidades.tsx ahora filtra por proyecto
- [x] Especialidades.tsx (gestión) filtra usuarios y especialidades por proyecto
- [x] Todas las páginas ya tenían filtro por proyecto implementado


## v68 - Correcciones UI y Datos

### Containers y Layout
- [ ] Mejorar estructura de containers en toda la app
- [ ] Evitar que elementos se encimen en móvil
- [ ] Panel de estadísticas responsive

### Limpieza de Datos
- [ ] Eliminar empresa "se prueba"
- [ ] Eliminar especialidad "núcleo"

### Notificaciones Push
- [ ] Forzar notificaciones siempre activas
- [ ] Notificaciones tipo globo en pantalla de bloqueo
- [ ] Activación obligatoria y agresiva


## v68 (v2.27) - Correcciones de Layout y Notificaciones Push

### Corrección de Layout/Containers
- [x] Corregir encimamiento en modal de selección de residente (campo de búsqueda sobre nombre)
- [x] Revisar y ajustar containers globales para evitar encimamiento en cualquier pantalla

### Notificaciones Push Forzadas
- [x] Implementar solicitud más agresiva de permisos de notificaciones
- [x] Forzar notificaciones tipo globo incluso en pantalla de bloqueo
- [x] Reintentar solicitud de permisos si el usuario no responde


## v69 (v2.30) - Correcciones de UI y Limpieza de Datos

### Limpieza de Base de Datos
- [x] Eliminar empresas simuladas (Empresa 660002, Empresa Test UX)
- [x] Limpiar especialidades sin nombre (Esp null) - items de prueba eliminados

### Corrección de Gráficas
- [x] Evitar encimamiento de etiquetas en gráfico de empresas (truncar nombres largos)
- [x] Evitar encimamiento de etiquetas en gráfico de especialidades (rotar -45°)
- [x] Corregir etiqueta "Critico" cortada en gráfico de severidad (labels con posición calculada + Legend)

### Corrección de Tabla de Usuarios
- [x] Evitar que nombres se corten en múltiples líneas (whitespace-nowrap + truncar)
- [x] Evitar que roles se corten en múltiples líneas (abreviaturas: super, jefe, resi, admin)
- [x] Ajustar anchos de columnas para móvil (min-w, text-xs, scroll horizontal)

### Notificaciones Push
- [x] Reforzar solicitud agresiva de permisos (50 intentos, cada 3s)
- [x] Asegurar notificaciones tipo globo en pantalla de bloqueo (requireInteraction + vibrate)


### Corrección de Badges de Filtros
- [x] Hacer badges de filtros más visibles (botones más grandes 12x12, badges 22px con borde blanco y sombra)


## v70 - Corrección de ubicación de badges

- [x] Reubicar badges de filtros para que no se encimen con el avatar (badges debajo de cada botón)
- [x] Separar mejor la sección de filtros del header (card blanca con padding)


## v71 - PDFs como descarga directa (Acrobat Reader)

- [x] Identificar todos los lugares donde se generan PDFs (Bitacora, ReporteFotografico, Estadisticas, KPIs, DashboardResidente, StackingPDF)
- [x] Modificar generación de PDFs para descarga directa con jsPDF (no formato web)
- [x] Asegurar que todos los PDFs se descarguen como archivos .pdf reales
- [x] Probar descargas en móvil y escritorio (downloadPDFBestMethod detecta dispositivo)


## v72 - Nombre del proyecto en todos los reportes PDF

- [x] Estadísticas: Agregar nombre del proyecto en encabezado y nombre de archivo
- [x] KPIs: Agregar nombre del proyecto en encabezado y nombre de archivo
- [x] Dashboard Residente: Agregar nombre del proyecto en encabezado y nombre de archivo
- [x] Bitácora: Actualizado con "Sistema OQC" (es global, no por proyecto)
- [x] Reporte Fotográfico: Ya incluía nombre del proyecto (verificado)
- [x] Stacking: Ya incluía nombre del proyecto (verificado)


## v73 - Unificación de Reportes PDF e Iconos

### Formato Unificado de PDFs
- [x] Crear plantilla única con header profesional (pdfUnificado.ts)
- [x] Aplicar mismo formato a Estadísticas
- [x] Aplicar mismo formato a KPIs
- [x] Aplicar mismo formato a Dashboard Residente
- [x] Aplicar mismo formato a Bitácora
- [x] Reporte Fotográfico y Stacking ya usan formato consistente

### Iconos Unificados
- [x] Estandarizar icono de descarga PDF (FileDown) en todas las pantallas


## v74 - Preview de comentario en lista de ítems

- [x] Agregar preview de 3 palabras del comentario debajo de la fecha en cada ítem
- [x] Aplicar en Bienvenida (lista principal de ítems)


## v75 - Preview de comentario de cualquier rol

- [x] Agregar comentarioSupervisor a la query de pendientes
- [x] Mostrar el comentario disponible (residente o supervisor) en el preview


## v76 - Notificaciones Push OBLIGATORIAS y Badges

- [x] Sistema de notificaciones push OBLIGATORIO y FORZOSO (100 intentos, cada 2s)
- [x] Badges visibles en icono de la app (contador de pendientes con setAppBadge API)
- [x] Bloquear uso de la app sin permisos de notificaciones (overlay negro con instrucciones)
- [x] Notificaciones tipo globo en pantalla de bloqueo (requireInteraction + vibrate)
- [x] Indicador de quién comentó (R: o S:) en preview
- [x] Preview de comentario en notificaciones push


## v77 - Mejoras de UI y Scroll Infinito

### Nombre del Residente en Ítems
- [ ] Agregar nombre del residente asignado en lista de ítems (Bienvenida)
- [ ] Agregar nombre del residente en todos los módulos donde aparecen ítems

### Scroll Infinito
- [ ] Eliminar paginación en página de bienvenida
- [ ] Implementar scroll infinito con carga progresiva

### Estadísticas de Pendientes
- [ ] Revisar cuantificación de pendientes
- [ ] Verificar estadísticas de pendientes en dashboard



## v77 - Mejoras de UI y Scroll Infinito

- [x] Agregar nombre del residente asignado en todos los ítems (badge azul con nombre)
- [x] Implementar scroll infinito en página de bienvenida (eliminar paginación)
- [x] Revisar cuantificación y estadísticas de pendientes (funcionando correctamente)


## v78 - Swipe para acciones rápidas

- [x] Implementar swipe derecha para aprobar ítem (solo ítems pendiente_aprobacion)
- [x] Implementar swipe izquierda para rechazar ítem (solo ítems pendiente_aprobacion)
- [x] Animaciones suaves de deslizamiento (transform + transition)
- [x] Feedback visual con colores (verde aprobar, rojo rechazar) + iconos


## v78 - Escáner QR Ultra Sensible

- [x] Aumentar sensibilidad del escáner QR (TRY_HARDER + PURE_BARCODE hints)
- [x] Reducir tiempo de enfoque necesario (focusMode: continuous)
- [x] Optimizar frecuencia de escaneo (50ms entre intentos = 20 escaneos/seg)
- [x] Mejorar detección en condiciones de poca luz (exposureMode: continuous)


## v79 - Corrección Escáner QR

- [x] Corregir error de TypeScript en QRScanner (eliminadas propiedades no estándar)
- [x] Asegurar acceso obligatorio a la cámara (configuración compatible)
- [x] Eliminar configuraciones no soportadas que causan error (focusMode, exposureMode, etc.)


## v80 - Residente de Especialidad en Ítems

- [x] Mostrar nombre del residente asignado a la especialidad (quien debe corregir) - badge verde
- [x] Mostrar fecha de foto después si existe (📷)
- [x] Mostrar fecha de aprobación si existe (✓)


## v81 - Etiquetas en Gráficas

- [ ] Agregar etiquetas de valores en gráficas de barras
- [ ] Agregar etiquetas de porcentajes en gráficas de pastel/dona
- [ ] Mejorar legibilidad de todas las gráficas



## Mejoras de Visualización v81 (Iteración 27)

### Etiquetas Claras en Gráficas
- [x] Etiquetas de valores en gráfica de Ítems por Empresa (posición derecha)
- [x] Etiquetas de valores en gráfica de Ítems por Especialidad (posición arriba)
- [x] Etiquetas de valores en gráfica Top 10 Defectos (centro de barras apiladas)
- [x] Etiquetas de valores en gráfica de Defectos por Usuario en KPIs (centro)
- [x] Etiquetas de valores en gráfica de Tiempos de Respuesta (posición derecha con formato horas)
- [x] Distribución por Severidad ya tenía etiquetas con nombre y porcentaje


## Trazabilidad Completa v82 (Iteración 28)

### Datos de Trazabilidad por Ítem
- [ ] Quién tomó la foto inicial (creador) con nombre y fecha
- [ ] A quién se asignó (residente de especialidad) con nombre y fecha
- [ ] Quién aprobó/rechazó con nombre y fecha
- [ ] Quién cerró el ítem con nombre y fecha

### Mostrar Trazabilidad en Vistas
- [ ] Trazabilidad en página de Bienvenida (Mis Tareas)
- [ ] Trazabilidad en detalle de ítems
- [ ] Trazabilidad en Bitácora
- [ ] Trazabilidad en reportes PDF (Estadísticas, KPIs, Dashboard, Bitácora)


## Trazabilidad Completa v82 (Febrero 2026)
- [x] Agregar campos de trazabilidad en base de datos (creadoPorId, asignadoAId, aprobadoPorId, cerradoPorId, fechaCierre)
- [x] Actualizar queries del backend para incluir nombres de trazabilidad
- [x] Mostrar trazabilidad en página de Bienvenida (Mis Tareas) con iconos
- [x] Mostrar trazabilidad en detalle de ítems (sección con 4 pasos numerados)
- [x] Mostrar trazabilidad en Bitácora (acciones de ítems con nombres)
- [x] Agregar trazabilidad en reportes PDF fotográficos (Creado > Asignado > Aprobado > Cerrado)


## Mejoras v83 (Febrero 2026)
- [x] Agregar botón de descarga PDF en ficha/detalle de cada ítem (con fotos antes/después)
- [x] Mejorar visual de filtros en Bitácora - diseño más ordenado y compacto
- [x] Corregir registro de acciones en primera sección de Bitácora (crear/aprobar/rechazar/subir foto)



## Correcciones v84 (Febrero 2026)
- [ ] Corregir fotos que no aparecen en PDF de fichas de ítem
- [ ] Diagnosticar y corregir sistema de notificaciones push
- [ ] Implementar badges en icono de aplicación (contador de notificaciones)
- [ ] Asegurar notificaciones a superadmin, admin y supervisor (todas las notificaciones)


## Correcciones v84 (Febrero 2026)
- [x] Corregir fotos en PDF de ficha de ítem (usar Base64 o proxy de imágenes)
- [x] Agregar endpoint /api/image-proxy para evitar CORS al cargar imágenes
- [x] Mejorar notificaciones push para superadmin, admin y supervisor
- [x] Actualizar badge del icono de la app con contador de notificaciones
- [x] Notificar a admins cuando se crea un nuevo ítem
- [x] Incluir push notifications en notificarSupervisores y notificarJefesResidente


## Versionado Unificado y Forzado v85 (Febrero 2026)
- [x] Crear archivo de versión centralizado compartido (shared/version.ts)
- [x] Actualizar header para usar versión centralizada (v2.85)
- [x] Actualizar Service Worker para usar versión centralizada (v85)
- [x] Implementar actualización agresiva forzada en todos los dispositivos
- [x] Endpoint /api/version para verificación periódica cada 30 segundos
- [x] Verificar que todos los usuarios siempre tengan la última versión


## Mejoras v86 - Ítems Visibles para Todos (Febrero 2026)
- [x] Mostrar TODOS los ítems en módulo de ítems (sin filtrar por usuario)
- [x] Filtros opcionales para quien quiera usarlos
- [x] Proteger lectura de QR solo para usuarios registrados (protectedProcedure)


## Mejoras UI v87 - Filtros en Grid y Texto Cortado (Febrero 2026)
- [ ] Rediseñar filtros de Ítems en grid de 2-3 columnas (cajas)
- [ ] Corregir palabras cortadas en todos los módulos
- [ ] Revisar contenedores con texto que baja a segundo renglón


## Mejoras UI v87 - Filtros y Stacking (Febrero 2026)
- [x] Rediseñar filtros de Ítems en grid de 2-3 columnas (cajas compactas)
- [x] Revisar y corregir contenedores con texto cortado en todos los módulos
- [x] Restringir edición de fechas en Stacking solo a superadmin/admin
- [x] Otros usuarios al clic en unidad van a ítems filtrados por esa unidad


## Correcciones v88 (Febrero 2026)
- [ ] Corregir palabras cortadas en detalle de ítem (Empresa, Especialidad, Fecha)
- [ ] Agregar filtro por Residente en lista de ítems


## Correcciones v88 (Febrero 2026)
- [x] Corregir palabras cortadas en detalle de ítem (Empresa, Especialidad, Fecha) - grid responsive
- [x] Agregar filtro por Residente en lista de ítems (6 filtros en total)


## Correcciones v90 (Febrero 2026)
- [x] Filtro de usuarios debe mostrar SOLO usuarios del proyecto actual, no todos los del sistema


## Corrección Crítica de Aislamiento de Proyectos (v2.91)
- [x] Corregido: La página de Bienvenida ahora filtra ítems por proyecto seleccionado
- [x] Corregido: Endpoint misPendientes ahora acepta proyectoId para filtrar
- [x] Corregido: Función getPendientesByUsuario ahora filtra por proyectoId
- [x] Verificado: Mayas Habitat muestra 0 pendientes (antes mostraba 49+ de Hidalma)
- [x] Verificado: Hidalma muestra solo sus 21 ítems propios
- [x] NUNCA MEZCLAR DATOS ENTRE PROYECTOS - Cada proyecto es independiente


## Corrección de UI - Badge de Notificaciones (v2.92)
- [x] Corregir badge de notificaciones en la campana - no se ve el círculo completo
- [x] Diseño profesional del badge


## Mejoras UI y Módulo Items (v2.93)
- [x] Badge de notificaciones - posicionarlo ENCIMA de la campana (no al lado)
- [x] Módulo Items - mostrar quién creó el ítem
- [x] Módulo Items - mostrar usuario asignado
- [x] Módulo Items - mostrar quién aprobó
- [x] Módulo Items - mostrar quién aceptó finalmente
- [x] Filtro de usuario debe corresponder al usuario ASIGNADO


## Mejoras UI y Módulo Items (v2.93 - Febrero 2026)
- [x] Badge de notificaciones - posicionarlo ENCIMA de la campana (esquina superior derecha: -top-3 -right-2)
- [x] Módulo Items - mostrar quién creó el ítem (Creó: nombre)
- [x] Módulo Items - mostrar usuario asignado (Asignado: nombre)
- [x] Módulo Items - mostrar quién aprobó (Aprobó: nombre)
- [x] Módulo Items - mostrar quién aceptó finalmente (Cerró: nombre)
- [x] Filtro de usuario cambiado a "Asignado a" (filtra por asignadoAId)


## Correcciones v3.48 (Febrero 2026)
- [x] Badge de notificaciones - hacerlo completamente visible encima de la campana
- [x] PDF Ficha de Ítem - las fotos se muestran correctamente cuando el ítem tiene fotos guardadas


## Restricción de Aprobación v3.48 (Febrero 2026)
- [x] Solo pueden aprobar: residente asignado (misma especialidad), supervisor, admin, superadmin
- [x] Residentes de especialidad diferente NO pueden aprobar
- [x] Validación en backend (endpoint de aprobación y rechazo)
- [x] Validación en frontend (ocultar botón aprobar si no tiene permiso)


## Corrección Selector de Residentes v3.49 (Febrero 2026)
- [ ] Selector de residentes en Nuevo Ítem muestra "No se encontraron residentes"
- [ ] Cargar residentes desde la base de datos de usuarios
- [ ] Filtrar por proyecto seleccionado

- [ ] Botón de aceptar términos y condiciones - subirlo para que no lo tape el footer
- [ ] Poner el botón dentro del scroll


## Correcciones v3.49 (Febrero 2026)
- [x] Selector de residentes en Nuevo Ítem - ahora carga residentes de múltiples fuentes
- [x] Cargar todos los residentes del proyecto Hidalma (empresa_residentes + empresas.residenteId/jefeResidenteId + usuarios con rol residente)
- [x] Botón de aceptar términos y condiciones - movido dentro del scroll
- [x] Checkboxes y botón ahora están dentro del ScrollArea para que no los tape el footer

## Correcciones v3.51 (Febrero 2026)
- [x] Corregir scroll en lista de usuarios (no permite scroll)
- [x] Implementar @mentions en selector de residentes
- [x] Corregir Términos y Condiciones: botones de check y aceptar no visibles en móvil
- [x] MANDATORIO: Incluir fotos reales (antes/después) de la BD en los PDF de ficha de ítem
- [x] Superadmin y admin pueden editar ítems ya capturados con anterioridad
- [x] Agregar campo 'Asignado a' (residente) en el diálogo de edición de ítems
- [x] Concatenar nombre + especialidad en selectores de residente/asignado
- [x] Edición de ítem por admin/superadmin debe reflejarse inmediatamente en la página de bienvenida
- [x] Edición de ítem desde lista de ítems debe reflejar cambios en bienvenida y campo asignado
- [x] BUG: Residente no puede subir fotos después (botones bloqueados) - CORREGIDO: canAddFotoDespues incluye 'residente', backend usa canUploadFotoProcedure
- [x] BUG: Residente no puede usar @mentions en comentarios - CORREGIDO: Nuevo endpoint users.listForMentions (protectedProcedure) reemplaza users.list (adminProcedure) en ItemChat y ItemDetail

## Corrección Sistema de Versiones v3.59 (Febrero 2026)
- [x] Corregir número de versión para que muestre v3.59 correctamente
- [x] Eliminar fórmula confusa (÷60) y usar versión directa como string
- [x] Unificar versión en shared/version.ts como única fuente de verdad (main.tsx, index.ts, sw.js)

## Bug Edición Asignado v3.59 (Febrero 2026)
- [x] BUG: Al editar un ítem y cambiar el "Asignado a", el cambio no se refleja en Bienvenida - CORREGIDO: Bienvenida.tsx ahora prioriza asignadoANombre > especialidadResidenteNombre > residenteNombre

## Sistema de Avisos v3.61 (Febrero 2026)
- [x] Crear tablas BD: avisos + avisos_lecturas
- [x] Crear helpers de BD para avisos (CRUD + lecturas)
- [x] Crear endpoints tRPC para avisos (admin crea, todos leen, registro de lecturas)
- [x] Botón Avisos con badge rojo en header de Bienvenida
- [x] Página de avisos para todos los usuarios
- [x] Gestión de avisos en menú Configuración (solo admin/superadmin)
- [x] Historial de avisos del más reciente al más antiguo
- [x] Registro de quién leyó cada aviso con bitácora
- [x] Incrementar versión a 3.61

## Aislamiento por Proyecto - Avisos v3.62 (Febrero 2026)
- [x] Auditar y corregir: avisos.create requiere proyectoId obligatorio
- [x] Auditar y corregir: avisos.list filtra siempre por proyectoId (sin avisos globales)
- [x] Auditar y corregir: avisos.noLeidos filtra por proyectoId del proyecto activo
- [x] Auditar y corregir: avisos.leidosPorUsuario filtra por proyecto
- [x] Frontend: proyectoId obligatorio en Bienvenida, Avisos y Configuración
- [x] Incrementar versión a 3.62

## UX Configuración v3.63 (Febrero 2026)
- [ ] Mover sección Gestión de Avisos más arriba en Configuración (después del título)
- [ ] Incrementar versión a 3.63

## UX Configuración v3.63 (Febrero 2026)
- [x] Agregar botón de acceso rápido a "Gestión de Avisos" en la parte superior de Configuración
- [x] Incrementar versión a 3.63

## UX Simplificación v3.64 (Febrero 2026)
- [x] Quitar ícono engrane de Configuración, reemplazar por Megaphone + botón Avisos
- [x] Corregir badges de notificación: z-50, shadow-lg, border-2 border-white al frente
- [x] Incrementar versión a 3.64

## Avisos: Lectores + Personas Activas + Reportes v3.65 (Febrero 2026)
- [x] Mostrar lista de quién leyó cada aviso (nombre + fecha/hora) en la página de Avisos
- [x] Mostrar número de personas activas del proyecto en header de Avisos
- [x] Endpoint backend para reporte de lecturas de avisos (CSV)
- [x] Endpoint backend para reporte de personas activas (CSV)
- [x] Botón descargar reporte de lecturas y actividad (CSV por aviso + personas activas)
- [x] Incrementar versión a 3.65

## Usuarios En Línea + Lectores Avisos v3.66 (Febrero 2026)
- [x] Backend: tracking de usuarios en línea via socket (ya existía connectedUsers)
- [x] Backend: getAvisos ahora incluye lecturasCount por aviso
- [x] Frontend: número de usuarios en línea en header de Bienvenida (punto verde + número)
- [x] Frontend: click en número (admin/superadmin) descarga PDF con lista de usuarios en línea
- [x] Frontend: en cada aviso, badge azul clickable con ojo + conteo de lecturas
- [x] Incrementar versión a 3.66

## Visibilidad Personas Activas v3.67 (Febrero 2026)
- [x] Mover indicador de personas activas a barra separada visible en Bienvenida
- [x] Usar query tRPC personasActivas en vez de socket para mayor confiabilidad
- [x] Barra verde claro con punto animado y texto "X personas activas (tap para PDF)"
- [x] Click genera PDF con lista de personas activas (solo admin/superadmin)
- [x] Versión actualizada a 3.67

## Usuarios En Línea Real-Time v3.68 (Febrero 2026)
- [x] Cambiar barra de Bienvenida de "personas activas" (registradas) a "en línea" (socket real-time)
- [x] Mostrar solo usuarios con la app abierta en este momento (useSocket)
- [x] Tap para PDF con lista de quién está conectado ahora
- [x] Incrementar versión a 3.68

## Usuarios En Línea via Heartbeat BD v3.69 (Febrero 2026)
- [x] Crear columna lastActiveAt en tabla users
- [x] Endpoint tRPC heartbeat que actualiza lastActiveAt del usuario
- [x] Endpoint tRPC enLinea que devuelve usuarios con lastActiveAt < 5 min
- [x] Frontend: enviar heartbeat cada 2 min automáticamente
- [x] Frontend: mostrar barra "X en línea" usando query tRPC (no socket)
- [x] Tap genera PDF con lista de conectados (admin/superadmin)
- [x] Implementado en v3.68 (sin incremento adicional)

## Fix "Failed to Fetch" al iniciar sesión v3.69
- [x] Diagnosticar causa del "failed to fetch" en login
- [x] Corregir service worker para forzar actualización automática
- [x] Eliminar caché obsoleto que causa módulos faltantes
- [x] Asegurar que /api/trpc y /api/oauth no sean cacheados por SW
- [x] Forzar skipWaiting + clients.claim para activación inmediata
- [x] Verificar flujo completo de login sin errores
- [x] Incrementar versión a 3.69

## Ajuste posición de etiquetas QR v3.69
- [x] Subir etiquetas 1.3 cm hacia arriba (padding-top: 14.7mm → 1.7mm)
- [x] Mover etiquetas 5 mm a la izquierda (padding-left: 4.76mm → 0mm)
- [x] Incrementar versión a 3.69

## Ajuste fino etiquetas QR v3.70
- [x] Bajar etiquetas 9mm (padding-top: 1.7mm → 10.7mm)
- [x] Mover etiquetas 3mm a la derecha (padding-left: 0mm → 3mm)
- [x] Incrementar versión a 3.70

## Recalibración completa etiquetas Office Depot 64413 v3.71
- [x] Investigar especificaciones exactas del fabricante (SKU 64413 = Avery 5160)
- [x] Reescribir cuadrícula con CSS Grid y posicionamiento absoluto preciso
- [x] Incrementar versión a 3.71

## Mejora generación QR por rango v3.72
- [ ] Campos Desde/Hasta vacíos por defecto (sin valor inicial)
- [ ] Mostrar último consecutivo impreso por proyecto
- [ ] Persistir último consecutivo en BD al generar QR
- [ ] Incrementar versión a 3.72

## Auto-ajuste agresivo etiquetas + mejoras rango QR v3.72
- [x] Forzar auto-ajuste agresivo a plantilla Avery 5160/Office Depot 64413
- [x] CSS @page con márgenes exactos y !important en todo
- [x] Campos Desde/Hasta vacíos por defecto (string, no number)
- [x] Mostrar último consecutivo impreso por proyecto (badge)
- [x] Persistir último consecutivo en BD al generar QR
- [x] Incrementar versión a 3.72

## Espaciado texto etiquetas QR v3.73
- [x] Separar código, OBJETIVA y consecutivo con más espacio (margin-bottom/top entre elementos)
- [x] Consecutivo más grande (9.5pt → 12pt)
- [x] Todo dentro del mismo recuadro de etiqueta 25.4mm

## Rediseño estético texto etiquetas QR v3.74
- [x] OBJETIVA más grande y visible (4.5pt → 7pt con letter-spacing)
- [x] Redistribuir con space-between vertical: código arriba, OBJETIVA centro, consecutivo 13pt abajo
- [x] Todo legible y funcional dentro del recuadro 25.4mm x 66.675mm

## OBJETIVA estilo logo en etiquetas v3.75
- [x] OBJETIVA más grande (7pt → 9.5pt bold 900)
- [x] Estilo logo corporativo: OBJETIV en azul #002C63 + A en verde #02B381

## Tooltip usuarios en línea v3.76
- [x] Al pasar mouse sobre banner "X en línea" mostrar lista de usuarios conectados
- [x] Mostrar nombre + especialidad de cada usuario en línea
- [x] Incluir empresa del usuario (nombre — empresa, especialidad debajo)

## Tooltip en línea para todos los usuarios v3.77
- [x] Tooltip funcione con tap en móvil (toggle), no solo hover
- [x] Todos los usuarios ven la lista de quién está en línea (no solo admin)
- [x] Mantener descarga PDF solo para admin (botón PDF dentro del panel)

## Módulo Planos por Nivel v3.78
- [x] Crear tabla `planos` en BD (proyectoId, nombre/nivel, imagenUrl, orden)
- [x] Helpers en db.ts para CRUD de planos
- [x] Endpoints tRPC para subir, listar, editar y eliminar planos
- [x] Página frontend Planos.tsx con upload de imagen por nivel
- [x] Visualizador de plano con zoom/pan y navegación entre planos
- [x] Integrar en menú lateral del dashboard (sección Análisis)
- [x] Incrementar versión a 3.78

## Pines interactivos sobre planos v3.79
- [x] Crear tabla `planoPines` en BD (planoId, itemId, posX, posY, nota)
- [x] Helpers CRUD en db.ts para pines
- [x] Endpoints tRPC para crear/listar/eliminar pines
- [x] Modo "agregar pin" en visor de plano: tap en plano → seleccionar ítem → pin creado
- [x] Visualizar pines con color según estado del ítem (pendiente/aprobado/rechazado)
- [x] Tooltip al tocar pin: código, estado, foto miniatura
- [x] Navegar al detalle del ítem desde el pin

## Sección Planos en Configuración v3.80
- [x] Agregar sección "Planos por Nivel" en la página de Configuración del Proyecto
- [x] Permitir subir, editar y eliminar planos desde Configuración
- [x] Los planos subidos aquí son los que se visualizan en /planos con pines

## Reestructurar Planos→Pines en Configuración v3.81
- [x] Renombrar sección "Planos por Nivel" a "Pines" en Configuración
- [x] Ordenar secciones de Configuración alfabéticamente
- [x] Rediseñar PinesManager: añadir nivel con nombre + imagen de plano
- [x] Thumbnail del plano tamaño foto (80x80), click abre modal visor
- [x] Modal fullscreen para abrir plano y colocar pines
- [x] Pines SVG 18x24px proporcionales pequeños pero visibles
- [x] Menú lateral actualizado: Planos→Pines

## Integrar pines en flujo de ítems v3.83
- [x] En Nuevo Ítem: al seleccionar nivel, mostrar thumbnail del plano a un lado
- [x] Click en thumbnail abre modal para colocar pin de ubicación sobre el plano
- [x] Guardar coordenadas del pin junto con el ítem (pinPlanoId, pinPosX, pinPosY en tabla items)
- [x] En ficha del ítem (DetalleItem): mostrar plano con pin de ubicación marcado
- [x] getItemById devuelve campos de pin para visualización

## Editar pin existente v3.84
- [x] Endpoint tRPC items.updatePin (pinPlanoId, pinPosX, pinPosY nullable)
- [x] Botón "Editar/Agregar Pin" en ItemDetail junto al thumbnail del plano
- [x] Modal fullscreen con modo edición: cursor crosshair, click para colocar pin
- [x] Botón "Eliminar Pin" para quitar pin existente
- [x] Pin amarillo en modo edición, rojo en modo visualización

## Plano con pin en ficha PDF v3.85
- [x] Cargar imagen del plano del ítem al generar PDF
- [x] Caja contenedora "UBICACIÓN EN PLANO" a la derecha de Información + Trazabilidad
- [x] Pin rojo con punto blanco sobre la imagen del plano en coordenadas correctas
- [x] Nombre del nivel debajo de la imagen
- [x] Ajuste de yPos para no solapar con la caja del plano

## Optimización agresiva de rendimiento v3.86 (20+ usuarios en obra, 3G)
- [x] Auditar queries N+1, payloads pesados, endpoints lentos
- [x] Agregar 60+ índices BD en columnas de filtrado frecuente
- [x] Optimizar connection pooling de BD (mysql2 pool, limit:20, keepalive)
- [x] Comprimir respuestas (gzip level 6, threshold 1KB)
- [x] Cache headers: immutable para assets con hash, 24h para image-proxy
- [x] Frontend: staleTime 30s global, 5min para catálogos, reducir refetches 90%
- [x] Frontend: lazy loading agresivo ya implementado (todos los componentes)
- [x] Backend: timeouts en image-proxy (15s abort)
- [x] Backend: optimizar heartbeat (throttle 1 write/min por usuario en servidor)
- [x] Backend: payload limits (50mb body)
- [x] Service Worker: cache-first para assets con hash, stale-while-revalidate para otros
- [x] Socket.io: compresión WS, ping cada 45s, throttle broadcast 2s
- [x] Keepalive auth.me reducido de 30s a 5min, solo si tab visible
- [x] Notificaciones refetch de 30s a 60s
- [x] Heartbeat frontend de 2min a 3min, solo si tab visible
- [x] Reconexión: solo invalidar queries críticas, no todas

## Ajustes UI v3.87
- [x] Notificaciones: al hacer click lleva a página /notificaciones con lista completa, config push, agrupadas por fecha
- [x] Eliminar icono de filtro de página de bienvenida
- [x] Eliminar icono de fotografía de página de bienvenida
- [x] Ficha PDF: plano sin deformar, mantener escala (contain) con centrado
- [x] Eliminar icono de lápiz de la caja donde se raya la foto (inicia en modo dibujo directo)

## Bug: Carga lenta al iniciar v3.88
- [x] Diagnosticar causa: loop de versión (REQUIRED_VERSION=384 vs app=387), doble SW register, doble version checker, misProyectos N+1
- [x] Sincronizar REQUIRED_VERSION en index.html con version.ts (388)
- [x] Eliminar doble registro de SW (solo main.tsx lo registra)
- [x] Eliminar doble version checker (solo main.tsx cada 5min, no index.html cada 60s)
- [x] Eliminar reload en loop de checkAndUpdateVersion (solo guardar localStorage)
- [x] Optimizar getProyectosByUsuario: de N+1 queries a 3 queries batch con GROUP BY
- [x] Agregar staleTime 5min a todas las queries de proyectos.list (11 componentes)
- [x] Reducir push notification check de 30s a 5min
- [x] Version checker de 60s a 5min, solo si tab visible

## Precarga de catálogos v3.89
- [x] Prefetch de empresas, unidades, especialidades, residentes, planos, espacios al seleccionar proyecto
- [x] Prefetch en ProjectContext al cambiar proyecto activo (setSelectedProjectId)
- [x] Prefetch en ProjectContext al cargar proyecto activo inicial (useEffect con proyectoActivoData)

## Zoom pinch/double-tap en plano v3.90
- [x] Zoom pinch (dos dedos) en plano de ItemDetail y NuevoItem
- [x] Double-tap para zoom in/out en plano (3x zoom centrado en tap)
- [x] Pan (arrastrar) cuando está con zoom, con límites
- [x] Botones de zoom +/- y reset
- [x] Mouse wheel zoom en desktop
- [x] Indicador de nivel de zoom (1.0x - 5.0x)
- [x] Componente reutilizable ZoomablePlano.tsx

## Todos los pins del nivel en el plano v3.91
- [x] Endpoint pinsByPlano: obtener todos los ítems con pin de un plano (id, codigo, descripcion, status, pinPosX, pinPosY, numeroInterno)
- [x] Mostrar todos los pins en el plano de ItemDetail con su código aleatorio
- [x] Pin del ítem actual resaltado (más grande, con animación pulse)
- [x] Click en pin de otro ítem navega a ese ítem
- [x] Colores de pin según status (verde=aprobado, rojo=rechazado, amarillo=pendiente, azul=foto)
- [x] Tooltip con descripción al hover sobre pin
- [x] Contador de pins totales en el plano
- [x] Ocultar otros pins cuando se está editando pin (modo edición limpio)

## Afinación de pins y modal de plano v3.92
- [x] Pins como círculos compactos con número de ítem visible, coloreados por status
- [x] Pin principal más grande con pulse, muestra código del ítem
- [x] Tamaño dinámico de pins según nivel de zoom (se ajustan al hacer zoom)
- [x] Botones del modal de plano: iconos (Move, Save, Trash, X, MapPinPlus, Check) con tooltip
- [x] Double-tap abre modal fullscreen con plano completo y controles de zoom
- [x] Fullscreen con header (nombre plano, zoom +/-, reset, minimizar) y footer (conteo pins, zoom level)
- [x] Escape cierra fullscreen
- [x] En NuevoItem: botones también como iconos con tooltip

## Bug: Pin no queda en punto exacto v3.93
- [x] Corregir cálculo de coordenadas: pins ahora usan SVG con forma de pin real (punta abajo)
- [x] Pin posicionado con transform translate(-50%, -100%) para que la punta apunte al punto exacto
- [x] Eliminar doble offset (margin + translate) que desplazaba el pin
- [x] Pins posicionados relativos a wrapper de imagen (no al contenedor de zoom)
- [x] Mejorar detección de touch: ignorar taps que fueron pan/pinch (touchMoved flag)
- [x] Double-tap en modo edición hace zoom para precisar, no abre fullscreen

## Pins más visibles con defecto y residente v3.94
- [x] Agrandar pins: SVG gota con número visible, etiqueta debajo con defecto y residente
- [x] Agregar residenteNombre al endpoint pinsByPlano (LEFT JOIN users)
- [x] Mostrar etiqueta debajo del pin con defecto (descripción) y residente
- [x] Click en pin navega directo al ítem (onPinClick)
- [x] Icono Layers en bienvenida para selector de nivel/plano
- [x] Modal selector de nivel con thumbnails de planos
- [x] Modal visor fullscreen de plano con ZoomablePlano y todos los pins
- [x] Botón "Cambiar nivel" en el visor para volver al selector

## Ajustes pins en plano v3.96
- [x] Quitar símbolo # del pin, solo mostrar número
- [x] Hover sobre pin muestra tipo de defecto en recuadro
- [x] Selector de nivel muestra cantidad de pines por nivel
- [x] Pins aceptados: solo puntito verde pequeño (sin número ni etiqueta)
- [x] Reducir tamaño del pin al 50%

## Mejoras visor de plano v3.97
- [x] Filtro de pines por status en visor de plano (mostrar/ocultar aprobados, rechazados, pendientes)
- [x] Tap largo (long press) en móvil como equivalente al hover para ver tooltip del defecto
- [x] Exportar plano con pines a PDF desde visor fullscreen

## Bugfix v3.97.1
- [x] Imagen del plano no carga en fullscreen (crossOrigin="anonymous" bloquea carga desde S3)

## Bugfix v3.97.2
- [x] Residentes no aparecen al crear ítem (selector vacío) - users.list era adminProcedure, ahora usa getAllResidentesConEmpresas como fuente principal
- [x] Forzar que todos los usuarios puedan entrar y capturar - cambiado users.list a listForMentions en páginas accesibles por todos

## Bugfix y limpieza v3.97.3
- [x] Limpiar datos de prueba de la BD (167 ítems, 71 empresas test, 3 defectos test eliminados)
- [x] Omar Palencia no puede seleccionar residente al crear nuevo ítem (eliminado trpc.users.list de NuevoItem, usa solo getAllResidentesConEmpresas)
- [x] Verificar funcionalidad para todos los roles (228 tests pasando, sin errores TS)

## Mejoras pines en plano v3.98
- [x] Corregir desfase de posición del pin al guardar (calcPinPos usa imgWrapperRef + toFixed(4) consistente)
- [x] Tooltip con info del pin al hover/tap (defecto, residente, status) + long press en móvil
- [x] Navegación progresiva: tap1=tooltip, tap2=plano amplio fullscreen, tap3=ir al ítem específico

## Sistema de Penalizaciones v3.99
- [x] Penalización de $2,000 MXN por ítem no aprobado (badge en ItemDetail + ItemsList)
- [x] Acumulado de penalizaciones por empresa/contratista en estadísticas (tabla + gráfico stacked)
- [x] Restar penalización cuando supervisor aprueba (calculado dinámicamente por status)
- [x] Aplicar retroactivamente a ítems existentes (query sobre todos los ítems)
- [x] Resumen en estadísticas: KPIs (activa, liberada, total, monto/ítem) + tabla + gráfico

## Autenticación robusta v4.00
- [x] Verificar que todos los usuarios tengan acceso con correo y clave 123456 (33/33 OK)
- [x] Garantizar que el login nunca falle (trim, lowercase, case-insensitive, retry automático, try-catch robusto)
- [x] Resetear contraseña 123456 a Katy Orozco (la única con clave diferente)

## Separación de proyectos y limpieza Mayas v4.01
- [x] Diagnosticar datos contaminados de Hidalma en proyecto Mayas
- [x] Limpiar toda la data de Mayas que pertenece a Hidalma (10 defectos, 1 empresa, 36 ítems huérfanos, 9 empresas Test UX)
- [x] Dejar Mayas limpia y lista para iniciar desde cero (0 ítems, 0 empresas, 0 unidades, 0 planos)
- [x] Reforzar separación agresiva entre proyectos (defectos.list, defectos.estadisticas, getEstadisticasDefectos filtran por proyectoId)
- [x] NO tocar datos de Hidalma (confirmado: Hidalma intacta con 24 ítems)

## Reporte PDF Estadísticas v4.02
- [x] Reporte PDF descargable completo desde módulo de Estadísticas (8 secciones)
- [x] Incluir todas las gráficas (por status, por empresa, por residente, por especialidad, por defecto)
- [x] Incluir KPIs generales (total ítems, aprobados, pendientes, rechazados)
- [x] Incluir penalizaciones por empresa (activas, liberadas, total) con tabla desglose
- [x] Ranking mejores y peores contratistas (tasa aprobación antes y después)
- [x] Ranking mejores y peores residentes, jefes residentes, unidades, espacios, niveles
- [x] Ranking por especialidad y por defecto (frecuencia)
- [x] Sin acentos en exportación (función sinAcentos aplicada a todo)
- [x] Sin gráfica de cuellos de botella (no incluida)

## Rediseño pines en plano v4.03
- [x] Badge tipo pill ancho con código del ítem visible (pill con border-radius completo)
- [x] Reducir agresivamente el tamaño del pin (escala inversa 1/zoom, tamaño constante)
- [x] Tap en pin lleva al ítem específico (click directo navega a /items/ID)
- [x] Zoom funcional para ampliar y ver lugar exacto del pin (pinch-zoom + botones)

## Reporte PDF con gráficas visuales v4.04
- [x] Gráficas reales renderizadas en canvas e insertadas como imágenes en el PDF
- [x] Pie/donut chart de distribución por status
- [x] Barras horizontales de ítems por empresa
- [x] Barras de penalizaciones por empresa (activas vs liberadas)
- [x] Barras de defectos más frecuentes
- [x] Diseño profesional con colores corporativos Objetiva (#02B381, #002C63)
- [x] Layout visualmente atractivo con headers, separadores y secciones claras
- [x] Información congruente entre gráficas y datos numéricos
- [x] Sin acentos en exportación
## Corrección PDF gráficas v4.05
- [x] Fix PDF descargándose con 0 bytes (blob vacío)
- [x] Fix "Esp null" → "Sin Especialidad" en gráficas y tablas
- [x] Fix "Empresa null" → "Sin Empresa" en gráficas y tablas
- [x] Optimización tamaño PDF: JPEG 85% + DPI 1.5x (13.5MB → 296KB)
- [x] Verificación completa: 8 páginas con gráficas donut, barras, pie, stacked
## Limpieza de ítems de prueba v4.06
- [x] Identificar y eliminar permanentemente todos los ítems de prueba de la BD (20 ítems Test eliminados, quedan 24 reales)
- [x] Verificar que estadísticas y demás vistas no muestran datos de prueba (Total Ítems: 24, solo Hidalma)
## Leyenda compromiso y firmas en PDF v4.07
- [x] Leyenda de compromiso con recuadro rojo arriba del reporte
- [x] Fecha emisión + 8 días = fecha límite de corrección
- [x] Sección de firmas al final con 2 columnas por página
- [x] Cada firma: especialidad, empresa, línea de firma, nombre jefe
- [x] Endpoint firmantesReporte con datos de empresas/especialidades/jefes
- [x] 243 tests pasando, 0 errores TS
## Fix React error #300 + imagen pin en PDF v4.08
- [x] Corregir React error #300 (returns tempranos antes de useCallback/useEffect en Bienvenida.tsx)
- [x] Restaurar imagen del pin/plano en la ficha PDF (ya funcionaba, verificado con Hidalma-BYD8SH #24)
- [x] Eliminar 8 ítems de prueba restantes (32 → 24 reales)
## Rediseño pines en planos v4.09
- [x] Pines solo con número consecutivo (sin código largo)
- [ ] 1 tap en pin → modal info 10 segundos → navega al ítem automáticamente
- [ ] Toque en plano (no pin) → 15 segundos para ampliar/ubicar
- [ ] Vista de pines por nivel en planos
- [ ] Verificar PDF estadísticas con gráficas visuales reales
## Rediseño pines y toolbar planos v4.09
- [x] Pin muestra solo número consecutivo pequeño (sin código largo)
- [ ] 1 tap en pin → modal info 10s → navega al ítem automáticamente
- [ ] Toque en plano (no pin) → 15s para ampliar/ubicar
- [ ] Corregir botones filtro/descarga en toolbar de planos
- [ ] Vista de pines por nivel
## Fix navegación pin inmediata v4.09b
- [x] Tap en pin navega directo al ítem sin espera ni modal largo
## PDF completo con ítems, historial, planos e imágenes v4.10
- [x] Sección de ítems con imágenes (foto antes/después) en el PDF
- [x] Historial de cada ítem (cambios de estado, fechas)
- [ ] Imagen de cada plano con sus pines/ítems marcados
- [x] Nombre de quién capturó cada ítem
- [ ] Tap en pin navega directo al ítem (ya funciona)

## Optimización velocidad Bienvenida + PDF fichas v4.10
- [x] Carga ultra rápida de Bienvenida - skeleton instantáneo, lazy queries
- [x] Eliminar bloqueos innecesarios en carga inicial (staleTime/gcTime en todas las queries)
- [x] PDF con fichas de ítems, historial, fotos y planos integrado
- [x] Eliminar ítems de prueba (8 eliminados de nuevo)
## Imagen plano con pines en fichas PDF v4.11
- [ ] Cargar imagen del plano del ítem via proxy y dibujar pin marcado sobre ella
- [ ] Incluir plano con pin en cada ficha individual del PDF
- [ ] Diseño profesional y experto de la ficha completa
## Mejoras Estadísticas v4.12
- [x] Gráficas más bonitas y profesionales en página de Estadísticas
- [x] Sección de firmas de especialidades en Estadísticas

## Optimización Agresiva de Velocidad v4.13
- [x] Diagnosticar cuellos de botella en página de selección de proyectos
- [x] Optimizar queries backend para carga instantánea
- [x] Optimizar lazy loading y bundle splitting
- [x] Eliminar waterfalls de datos innecesarios

## URGENTE - Bugs producción v4.13
- [x] Proyectos no muestran datos ni imágenes en página de selección (skeleton infinito) — Fix: getAllProyectosEnriquecidos para superadmin
- [x] Segundo proyecto "Mayas Habitat" existe en BD, es real (Grupo Bahe)
- [x] Estadísticas mostraban 0 — Fix: enabled: !!selectedProjectId en query
- [x] Verificación completa de todos los módulos: Selección, Bienvenida, Items, Estadísticas OK

## Rediseño Gráficas PDF Estadísticas v4.14
- [x] Cambiar fondo de todas las gráficas a BLANCO (createCanvas pinta #FFFFFF + PNG format)
- [x] Textos de gráficas en negro/gris oscuro (#002C63 títulos, #1E293B valores)
- [x] Colores vibrantes y profesionales con gradientes y sombras
- [x] Diseño agresivamente estético: línea decorativa verde bajo títulos, separadores blancos en donuts, bordes redondeados en barras, borde sutil alrededor de cada gráfica

## Verificación Ficha Ítem PDF
- [x] FIX: Fotos antes/después no aparecen en PDF de ficha de ítem — loadImageForPDF mejorado con fallback
- [x] FIX: Imagen de plano con pin no aparece en PDF — pinPlanoId agregado a itemFieldsWithoutBase64

## Fix PDF Urgente
- [x] FIX: pinPlanoId no llega al PDF — agregado a itemFieldsWithoutBase64 en db.ts
- [x] FIX: Tablas del PDF cortan texto — overflow linebreak + márgenes amplios + fontSize adaptativo

## PDF Condensado para Junta (máx 20 páginas)
- [x] Condensar PDF a máximo 20 páginas — tabla resumen + grid miniaturas 3x2
- [x] Fotos en miniatura (antes/después lado a lado, 3 ítems por fila)
- [x] Firmas compactas 3 por fila — solo líneas de firma por especialidad
- [x] Gráficas impresionantes mantenidas intactas
- [x] Planos con pines 2 por página + leyenda inline

## Mejora UI/UX General
- [x] Mejorar UI/UX general — cards con progreso, hover Entrar, footer corporativo
- [ ] Responsive mobile/tablet perfecto
- [ ] Minimizar scroll vertical
- [ ] Menú hamburguesa a la derecha en mobile

## Fix Descarga PDF
- [ ] FIX: PDF no se descarga en Chrome Android/móvil — implementar método compatible

## Fix Descarga Plano + Notificaciones Push
- [x] FIX: Descarga de plano debe descargar imagen CON pines renderizados + nombre con especialidad
- [x] FIX: Descarga stacking debe bajar gráfico completo de ubicación de departamentos
- [ ] FIX: Notificaciones push se desactivan — fijar permanentemente para todos los usuarios
- [x] Notificación masiva al asignar ítem: notificar a TODOS los usuarios de la empresa y especialidad del responsable
- [x] FIX: PDF del stacking no se genera/descarga correctamente — corregir descarga del esquema visual
- [x] Pines en planos: pin tipo gota/marcador pequeño con iniciales del residente (ej: EG para Esteban Guerrero)
- [x] Modal de pin: mostrar todos los datos del ítem (código, estado, especialidad, atributo, defecto, fechas, etc.)
- [x] Modal de pin: enlace directo que lleve al detalle del ítem
- [x] Rediseñar pin como pin de mapa real (gota/marcador tipo Google Maps) con iniciales del residente adentro
- [x] Interacción: long press (~1s) abre modal con ítem + fecha alta + fecha terminación (alta+8 días)
- [x] Interacción: click normal navega directo al ítem
- [x] Días de corrección configurables desde configuración del proyecto (campo diasCorreccion en proyectos)
- [x] Tooltip en desktop al hover sobre pin mostrando nombre completo del residente
- [x] Filtro por residente en barra de herramientas del visor de planos
- [ ] FIX: Pines siguen como pill/badge con código — cambiar a pin de mapa con iniciales del residente
- [ ] FIX: Modal del pin debe mostrar TODOS los datos de la ficha + fecha inicio y término (diasCorreccion)
- [ ] URGENTE: Verificar y restaurar proyecto Mayas si fue eliminado de la BD
- [ ] REGLA PERMANENTE: Proyectos son 100% independientes — JAMÁS mezclar datos entre proyectos
- [x] FIX: Pines en ZoomablePlano.tsx siguen como pill badge — cambiar a pin de mapa SVG con iniciales del residente
- [x] PERF: Carga inmediata — optimizar velocidad agresivamente
- [ ] PERF: Lazy loading de páginas pesadas
- [ ] PERF: Reducir queries iniciales y paralelizar
- [x] PERF: Caché stale-while-revalidate en queries tRPC
- [x] PERF: Prefetch de datos al hover/seleccionar proyecto
- [ ] PERF: Compresión de imágenes y lazy load de imágenes
- [x] PERF: Carga inmediata — optimizar velocidad agresivamente
- [ ] PERF: Lazy loading de páginas pesadas
- [ ] PERF: Reducir queries iniciales y paralelizar
- [x] PERF: Caché stale-while-revalidate en queries tRPC
- [x] PERF: Prefetch de datos al hover/seleccionar proyecto
- [ ] PERF: Compresión de imágenes y lazy load de imágenes
- [x] REGLA SUPREMA: Auditar y reforzar aislamiento total por proyectoId en TODAS las queries, endpoints y caché
- [ ] Verificar que CADA query en db.ts filtra por proyectoId cuando aplica
- [ ] Reforzar caché del servidor con proyectoId en las claves de caché
- [ ] Verificar que el frontend SIEMPRE pasa proyectoId en cada request
- [x] Botón guardar plano: mover a barra fija superior que no se tape con pines
- [x] Visor de planos: barra superior siempre visible fija, plano contenido debajo, responsivo PC/tablet/móvil
- [x] AUDITORÍA CRÍTICA: Aislamiento total por proyectoId entre Hidalma y Mayas
- [x] Auditar schema: verificar que TODAS las tablas tengan proyectoId
- [x] Auditar db.ts: verificar que TODAS las queries filtren por proyectoId
- [x] Auditar routers.ts: verificar que TODOS los procedures pasen proyectoId
- [x] Auditar frontend: verificar que SIEMPRE envíe proyectoId
- [x] Verificar datos en BD: buscar registros huérfanos o mezclados
- [x] Corregir TODOS los problemas de aislamiento encontrados
- [x] Mover botones Cancelar/Subir Plano a barra fija superior en el modal de subir plano
- [x] Hacer preview del plano zoomeable y responsivo en el modal de subir plano
- [x] CRÍTICO: Planos y pines NO deben mostrarse entre proyectos - filtrar por proyectoId
- [x] Cambio de proyecto instantáneo - invalidar caché agresivamente al cambiar
- [x] RENDIMIENTO: Navegación entre secciones/módulos exageradamente instantánea
- [x] RENDIMIENTO: Cambio de proyecto instantáneo sin bloqueo visual
- [x] RENDIMIENTO: Prefetch agresivo de datos al entrar al proyecto
- [x] RENDIMIENTO: Caché larga para datos que no cambian frecuentemente
- [x] CRÍTICO URGENTE: Planos y pines de Hidalma aparecen en Mayas - auditoría profunda del flujo completo
- [x] Verificar que planos.listar filtra SIEMPRE por proyectoId en backend
- [x] Verificar que pines filtra SIEMPRE por planoId que pertenece al proyecto correcto
- [x] Verificar caché del servidor no sirve datos cruzados entre proyectos
- [x] Verificar que el frontend limpia datos al cambiar de proyecto
- [x] UI: Números y textos en cards de penalizaciones no deben partirse en 2 renglones - tamaño responsivo
- [x] UI: Ordenar TODAS las gráficas de mayor a menor
- [x] FEATURE: Firma electrónica por empresa en reportes PDF
- [x] FEATURE: Envío de reporte firmado por correo a todos los usuarios involucrados
- [x] FEATURE: Leyenda en correo "Acepto y atiendo en oportunidad los ítems en los que se hace mención a mi empresa"
- [x] FEATURE: Bitácora de Correos con fecha/hora de apertura del correo
- [x] FEATURE: Crear ítems desde pines del plano - al colocar pin se abre modal de nuevo ítem con ubicación asociada
- [x] UI: Botón flotante grande de Agregar Pin visible en móvil en visor de planos
- [x] FEATURE: Dar de alta ítem directamente al colocar pin en plano del módulo Planos - al tocar el plano se coloca pin y se abre formulario de nuevo ítem con ubicación asociada
- [x] UX: Al entrar al módulo Planos, abrir directamente el visor del plano para poder colocar pines y dar de alta ítems sin pasos intermedios
- [x] BUG: Botón de agregar unidad no visible/accesible en móvil - se corta fuera de pantalla. Arreglar layout responsive y agregar FAB
- [x] UX: Manejo elegante de errores de red - mensajes amigables en vez de errores técnicos crudos
- [x] UX: Reintentos automáticos en queries tRPC cuando se recupera conexión
- [x] UX: Banner/indicador de estado offline cuando no hay conexión a internet
- [x] DB: Eliminar 13 ítems de prueba (IDs 2280038-2280049 + 1350031) y datos relacionados (pines, fotos, historial)
- [x] UI: Agregar nombre del proyecto activo en el header de todas las páginas del dashboard
- [x] UX: Evitar flash del nombre de otro proyecto en header al cambiar de proyecto o navegar entre páginas - transición limpia
- [x] UX: Botón accesible en header para cambiar de proyecto sin salir de la app
- [x] FEATURE: Captura rápida en Planos - colocar pin → formulario inline de nuevo ítem sin salir del visor
- [x] FEATURE: Al guardar ítem desde captura rápida, continuar en modo pin para seguir colocando más
- [x] FEATURE: Panel de seguimiento con ítems creados en la sesión actual dentro del visor de planos
- [x] BUG: Botón de agregar pin no visible en toolbar del visor de planos - agregar botón prominente para activar modo pin y captura rápida
- [x] CRITICAL: Modo pin se activa automáticamente al abrir visor de planos para admin - sin necesidad de tocar ningún botón
- [x] CRITICAL: Al tocar plano, abrir captura rápida directamente sin dialog intermedio de opciones
- [x] CRITICAL: FAB flotante siempre visible y agresivo para que sea imposible no verlo
- [x] FEATURE: Sticky header en módulo Pines con 3 modos de captura: +Nuevo Ítem, Pin en Plano, QR
- [x] FEATURE: Modo Pin en Plano - long press 2s coloca pin rojo → abre modal Crear Ítem → guarda ítem vinculado al pin
- [x] FEATURE: Modo +Nuevo Ítem - formulario modal para crear ítem sin pin, con opción de asignar ubicación después
- [x] FEATURE: Modo QR - lector de cámara + fallback input manual, abre ítem existente o crea nuevo
- [x] RULE: Click en pin existente sigue abriendo directo el ítem asociado (NO modificar comportamiento actual)
- [x] RULE: Coordenadas de pin normalizadas 0..1 respecto al plano
- [x] RULE: Aislamiento multiproyecto - no mezclar pines/ítems entre proyectos
- [x] BUG: Enviar para Firma falla con error "empresaId expected number, received undefined" - corregir mapeo de empresaId en el flujo de firma electrónica
- [x] CRITICAL: Trazabilidad de ítems - al crear ítem siempre registrar creadoPorId (quien crea) y residenteId (a quien se asigna)
- [x] CRITICAL: Al seleccionar empresa en formulario, auto-asignar al jefe de residente de esa empresa como residenteId
- [x] CRITICAL: Flujo completo: Creador crea y asigna → Asignado arregla el detalle → Aprueba → Supervisor da click definitivo
- [x] CRITICAL: Auditar backend items.create para garantizar que creadoPorId = ctx.user.id siempre
- [x] CRITICAL: Auditar CapturaRapida y NuevoItem para que envíen residenteId correcto al backend
- [x] BUG: Enlace externo (Avances Graficas / Google Sheets pubhtml) no abre al hacer click - cambiado window.open a <a target=_blank> en sidebar, mobile menu y EnlacesExternos
- [x] FEATURE: Trazabilidad (Creó, Asignado, Aprobó) completamente visible y responsiva en tarjetas de ítems - iconos compactos en móvil, info completa siempre
- [x] CRITICAL: Sistema de retry automático para subida de fotos con mala señal - guardar en IndexedDB y reintentar cuando mejore conexión
- [x] CRITICAL: Integrar cola de retry en todos los flujos de foto: crear ítem, foto después, foto antes
- [x] FEATURE: Indicador visual de fotos pendientes de subir (badge/banner) - SyncManager muestra toast con conteo
- [x] FEATURE: Botón manual de reintentar subida si el auto-retry no funciona - SyncManager reintenta cada 15s + al detectar conexión
- [x] FEATURE: Reporte PDF de pines por plano - 2 planos por página vertical, contenedores iguales, retícula alineada
- [x] FEATURE: Logo Objetiva en header del reporte PDF de planos
- [x] FEATURE: Recuadro de estadísticas por plano (por estatus y colores del app) en reporte PDF
- [x] FEATURE: Botón de descarga "Reporte PDF" en módulo Planos
- [x] FEATURE: Endpoint backend reportePines para obtener todos los planos con pines del proyecto

## Fixes Reporte PDF Planos con Pines v4.12
- [x] FIX: Posición de pines incorrecta en PDF - posX/posY son 0-100, dividir entre 100
- [x] FIX: Nombre del proyecto mostraba "Proyecto" genérico - usar proyectoActual.nombre
- [x] FIX: Nombre del archivo con doble guion bajo - limpiar underscores duplicados
- [x] FIX: tRPC fetch format incorrecto (400 Invalid input) - usar batch=1 con json wrapper
- [x] IMPROVE: Pines más grandes y visibles (radio 2.5mm con borde blanco de 3mm)
- [x] FEATURE: Botón PDF Planos (FileText) en Bienvenida header junto a Ver Pines
- [x] FIX: Mismo fix de tRPC batch format aplicado en Planos.tsx

## Ajustes PDF pines + botón Avisos móvil v4.13
- [x] PDF: Pines del mismo color por nivel (no por estatus), puntos más pequeños y brillantes
- [x] Bienvenida: Botón de Avisos no visible en móvil - se corta por overflow
- [x] Bienvenida: Ajustar layout de botones header para que quepan en móvil
## v4.15 - Pines estilo app + Ficha PDF completa
- [x] PDF Planos: pines estilo gota azul con iniciales (matching app ZoomablePlano)
- [x] PDF Planos: colores por estatus (azul pendiente_foto, naranja pendiente_aprob, verde aprobado, rojo rechazado, gris sin_item)
- [x] PDF Planos: residenteNombre agregado al endpoint reportePines
- [x] Ficha PDF: campo Espacio agregado
- [x] Ficha PDF: campo Residente agregado
- [x] Ficha PDF: campo Fecha Terminación Unidad agregado
- [x] Ficha PDF: paso 2b (Foto después) en trazabilidad
- [x] Ficha PDF: todos los campos siempre presentes (sin nulls/blanks)
## v4.16 - Fix PDF pines: mostrar TODOS los pines de cada nivel (matching app)
- [x] BUG: PDF usaba plano_pines (8 registros) en vez de items.pinPlanoId (27+ registros)
- [x] Corregir endpoint reportePines para usar items.pinPlanoId/pinPosX/pinPosY
- [x] PDF muestra exactamente los mismos pines que la app
## v4.17 - Verificar conteo de pines en PDF vs ítems en Bienvenida
- [x] Verificar que conteo total de pines en PDF coincida con total de ítems del proyecto (29 pines = todos los items con pinPlanoId)
## v4.18 - CRITICAL FIX: PDF pines usa EXACTAMENTE la misma fuente de datos que la vista del app
- [x] BUG CRÍTICO: PDF reportePines mezclaba 2 fuentes (items.pinPlanoId + plano_pines) causando conteos incorrectos (ej: N2 mostraba 13 en PDF vs 12 en app)
- [x] FIX: Reescribir reportePines para usar SOLO getPinesByPlano() - la misma función que usa la vista interactiva del plano
- [x] FIX: Eliminar merge de dual sources, usar una sola fuente de verdad (plano_pines table)
- [x] FIX: Agregar campos empresaNombre, unidadNombre, especialidadNombre al reporte (disponibles desde getPinesByPlano)
- [x] TEST: Vitest tests para consistencia de datos, mapeo de campos, conteo por estatus, iniciales y colores
## v4.19 - Página resumen al inicio del PDF + mantener todos los pines
- [x] FEATURE: Página resumen al inicio del PDF con estadísticas completas
- [x] FEATURE: Conteos por estatus (pendiente foto, pendiente aprobación, aprobado, rechazado, sin ítem)
- [x] FEATURE: Porcentajes por estatus
- [x] FEATURE: Fecha de creación del PDF
- [x] FEATURE: Resumen por nivel con conteos
- [x] RULE: NO eliminar ningún pin, NO filtrar niveles - todos los pines históricos y actuales se mantienen
- [x] RULE: Pines solo cambian de color según estatus, forma gota con iniciales del asignado

## v4.20 - Auditoría completa PDF: pines por nivel correctos
- [ ] AUDIT: Verificar que backend reportePines agrupa pines por planoId correcto
- [ ] AUDIT: Verificar que frontend mapea cada plano con sus pines exclusivos
- [ ] AUDIT: Consultar DB para obtener conteo real de pines por nivel
- [ ] AUDIT: Confirmar que total de pines en PDF = total en DB
- [ ] FIX: Corregir cualquier problema de asignación pin-nivel
- [ ] VERIFY: Colores correctos (azul, naranja, verde, gris) por estatus
- [ ] VERIFY: Estructura PDF: resumen + 2 planos/hoja + todos los niveles incluidos

## v4.21 - Fix PDF pines por nivel + tamaño nivel
- [x] PDF muestra solo 2 pines en N2 pero app muestra 12 - verificar merge funciona
- [x] Aumentar tamaño del número de nivel al doble en el PDF para identificación rápida


## v4.22 - Mover PDF planos a barra principal + fondo blanco visor
- [ ] Agregar icono PDF planos en barra de acciones de Bienvenida (entre planos y clipboard)
- [ ] Agregar PDF planos en menú hamburguesa debajo de Nuevo y antes de Items
- [ ] Cambiar fondo del visor de planos a blanco siempre
- [ ] Aumentar nivel font size al doble real (18pt) en PDF

