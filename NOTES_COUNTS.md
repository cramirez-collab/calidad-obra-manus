# Inconsistencia de Conteos - Análisis

## Problema
El dashboard muestra "50 ÍTEMS" pero "46 PENDIENTES" - el usuario ve incongruencia.

## Causa raíz
Los conteos de "pendientes" en diferentes funciones usan criterios DIFERENTES:

### Definición 1 (más restrictiva - usada en pendientes):
```
pendientes = status IN ('pendiente_foto_despues', 'pendiente_aprobacion')
```
Esto EXCLUYE 'rechazado' y 'aprobado'.

### Definición 2 (total):
```
total = COUNT(*) de todos los ítems del proyecto
```
Esto incluye TODOS los status: pendiente_foto_despues, pendiente_aprobacion, rechazado, aprobado.

### Resultado:
- total = 50 (todos los ítems)
- pendientes = 46 (solo los que están en status pendiente_*)
- La diferencia (4) son ítems aprobados o rechazados

## NO es un bug - es una confusión de presentación
Los números son correctos pero la UI no explica bien qué incluye cada conteo.

## Solución
1. En el card del proyecto en Home, mostrar desglose completo: Total | Pendientes | Aprobados | Rechazados
2. En Bienvenida dashboard, usar los MISMOS conteos que en estadísticas
3. En los PDFs, usar siempre la misma fuente de datos (getDatosCompletosParaAnalisisIA)
4. Asegurar que chartData en reportes use los mismos números que el dashboard

## Funciones clave a unificar
- getAllProyectosEnriquecidos (Home) → usa pendientesStats query
- getDatosCompletosParaAnalisisIA (Reportes) → usa filtros propios
- getEstadisticasGeneral (Estadísticas) → usa SQL aggregates
- Bienvenida.tsx stats query → usa estadisticas.general
