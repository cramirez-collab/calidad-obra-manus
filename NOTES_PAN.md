# Paneo libre en captura por plano - Análisis

## Problema actual
En modo PIN (`isPinMode=true`), el paneo NO funciona. Solo se puede hacer tap para colocar pin.
El usuario necesita poder panear libremente el plano para navegar a la zona exacta y luego colocar el pin.

## Solución requerida
En modo PIN, permitir:
1. **Paneo con 1 dedo (touch) o click+drag (mouse)** para mover el plano
2. **Pinch zoom** para acercar/alejar
3. **Tap simple** para colocar el pin (solo si no hubo movimiento significativo)
4. **Drag del pin temporal** para ajustar posición

## Cambio clave
En `handlePlanoMouseDown` (línea 510): cuando `isPinMode=true`, actualmente solo trackea mouseDownPos para tap.
Necesita TAMBIÉN iniciar pan si el usuario arrastra.

En `handlePlanoMouseMove` (línea 521): cuando `isPinMode=true` y no está arrastrando tempPin,
necesita permitir pan si se movió más de 10px del inicio.

En `handleTouchStart` (línea 568): cuando `isPinMode=true` y 1 dedo,
necesita iniciar drag para pan también.

En `handleTouchMove` (línea 590): cuando `isPinMode=true` y no arrastra tempPin,
necesita hacer pan si se movió más de 10px.

## Archivos a modificar
- `/home/ubuntu/calidad-obra/client/src/pages/Planos.tsx` - handlers de mouse/touch

## Conteos inconsistentes
- Dashboard muestra 50 ítems, pero pendientes dice 46
- Verificar queries en db.ts y routers.ts
