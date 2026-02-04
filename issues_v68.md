# Issues v68

## Problemas identificados de las imágenes:

### Imagen 1 - Seleccionar Residente
- Modal de selección de residente con campo de búsqueda
- El texto "Saul Tovar" se encima con el placeholder del campo de búsqueda
- Necesita ajustar el z-index o posicionamiento del campo de búsqueda

### Imagen 2 - Estadísticas (Ítems por Empresa)
- Muestra "Empresa 660002" - esto parece ser un ID en lugar de nombre
- También muestra "Waller" como empresa
- Necesita verificar si hay empresa "se prueba" en la BD

### Imagen 3 - Estadísticas (Ítems por Especialidad)
- Muestra "Esp null" - esto indica especialidad sin nombre o null
- También muestra "Waller" como especialidad
- Necesita verificar si hay especialidad "núcleo" en la BD

### Imagen 4 - Menú móvil
- Muestra "Notificaciones Activadas" con checkbox verde
- El menú de Configuración está abierto correctamente
- Versión v2.17 visible en header

## Acciones a tomar:

1. **Layout containers**: Revisar el modal de selección de residente para evitar encimamiento
2. **Eliminar empresa**: Buscar y eliminar empresa "se prueba" de la BD
3. **Eliminar especialidad**: Buscar y eliminar especialidad "núcleo" de la BD
4. **Notificaciones push**: Implementar solicitud más agresiva de permisos
