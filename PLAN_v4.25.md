# Plan Técnico v4.25 — Mejoras PDF + UI Planos

## A) Requisitos Funcionales y No Funcionales

### Funcionales

| # | Cambio | Requisito |
|---|--------|-----------|
| 1 | PDF: fuentes x2 | Duplicar el `fontSize` de todos los textos del PDF (resumen, títulos, etiquetas, leyendas, tabla, footer). Mantener jerarquía proporcional. Si un texto se corta, ajustar layout (wrap, columnas) sin reducir el x2. |
| 2 | PDF: mismos pines por nivel | El PDF debe mostrar EXACTAMENTE los mismos pines que la vista interactiva del plano. Source of truth: `getPinesByPlano()` que merge `items.pinPlanoId` + `plano_pines` deduplicando por `itemId`. |
| 3 | Items sin pin | Niveles/items sin pin no generan pin ficticio. En la tabla resumen, la columna "Sin Item" refleja pines sin ítem vinculado. Items sin pin simplemente no aparecen en el plano. |
| 4 | Eliminar leyenda flotante | Eliminar el FAB animado (bounce) "MANTÉN 2s = NUEVO PIN" que aparece en modo pin. Conservar SOLO el banner superior estable (bg-emerald-600). |
| 5 | Pinch zoom en modo pin | En Planos.tsx, cuando `isPinMode=true`, permitir zoom con 2 dedos (pinch). Coordenadas del pin se calculan relativas al plano (no a la pantalla). Pan con 1 dedo cuando zoom > 1. Límites: 0.5x–5x. Reset con botón existente. |
| 6 | Icono plano en item | En la lista de ítems (Bienvenida) y en ItemDetail, agregar icono de plano (Layers) que navega a `/planos` con query param del planoId correspondiente. Solo visible si el ítem tiene `pinPlanoId`. |
| 7 | Asignar pin desde inicio | En Bienvenida, el botón amber (MapPin punteado) que ya existe para ítems sin pin, al tocarlo navega a `/planos?assignPin={itemId}` para ir directo al flujo de asignación. |

### No Funcionales

- Rendimiento: el PDF con 14 niveles y 50+ pines debe generarse en < 15s.
- Responsividad: pinch zoom funciona en iOS Safari, Chrome Android, y desktop (scroll wheel).
- Accesibilidad: iconos con `title` descriptivo.
- Estabilidad: no romper funcionalidad existente (swipe aprobar/rechazar, filtros, etc.).

---

## B) Criterios de Aceptación (Given/When/Then)

### 1. PDF: fuentes x2

**Given** un proyecto con planos y pines configurados  
**When** el usuario genera el PDF de planos  
**Then** todos los textos del PDF tienen el doble del tamaño original (ej: 8pt → 16pt, 10pt → 20pt, 30pt → 60pt para nivel) y ningún texto se corta ni sale de márgenes.

### 2. PDF: mismos pines por nivel

**Given** un nivel N2 con 12 pines visibles en la app  
**When** el usuario genera el PDF  
**Then** N2 muestra exactamente 12 pines con las mismas coordenadas, colores y iniciales que la vista interactiva.

### 3. Items sin pin

**Given** un ítem creado sin asignar ubicación en plano  
**When** el PDF se genera  
**Then** ese ítem NO aparece como pin en ningún plano. La tabla resumen muestra el conteo correcto.

### 4. Eliminar leyenda flotante

**Given** el usuario activa modo pin en el visor de planos  
**When** el modo pin está activo  
**Then** NO aparece el FAB verde con bounce "MANTÉN 2s". SÍ aparece el banner superior fijo verde con el texto de instrucciones.

### 5. Pinch zoom en modo pin

**Given** el usuario está en modo pin en el visor de planos (móvil)  
**When** hace pinch con 2 dedos  
**Then** el plano hace zoom in/out. Al soltar y mantener presionado 2s con 1 dedo, el pin se coloca en las coordenadas correctas del plano (no de la pantalla). El pin persiste correctamente al cambiar zoom.

### 6. Icono plano en item

**Given** un ítem con `pinPlanoId` asignado  
**When** el usuario ve la lista en Bienvenida  
**Then** aparece un icono de plano (Layers) que al tocarlo navega al visor de planos mostrando el nivel correcto.

### 7. Asignar pin desde inicio

**Given** un ítem sin pin (indicador amber punteado visible)  
**When** el usuario toca el indicador amber  
**Then** navega a `/planos` con parámetro para iniciar asignación de pin para ese ítem específico.

---

## C) Plan Técnico

### Componentes/Pantallas Afectadas

| Archivo | Cambios |
|---------|---------|
| `client/src/lib/reportePlanosPDF.ts` | Cambios 1, 2, 3: duplicar todos los fontSize, ajustar layout |
| `client/src/pages/Planos.tsx` | Cambios 4, 5, 7: eliminar FAB bounce, agregar pinch zoom, recibir query param assignPin |
| `client/src/pages/Bienvenida.tsx` | Cambios 6, 7: icono plano en items con pin, CTA asignar pin navega a planos |

### Datos: "mismos pines por nivel"

- **Source of truth**: `getPinesByPlano(planoId)` en `server/db.ts`
- **Merge**: items.pinPlanoId (legacy) + plano_pines (standalone), deduplicando por itemId
- **Sincronización PDF**: `reportePines` endpoint llama `getPinesByPlano()` para cada plano — misma función que usa la vista interactiva
- **Ya implementado** en v4.20+. Solo verificar que no hay regresiones.

### Coordenadas para zoom/pinch

- Coordenadas de pin: `posX` y `posY` son porcentajes 0-100 relativos al plano
- Al hacer pinch zoom, el contenedor se escala con CSS `transform: scale(zoom)`
- Para colocar pin: se calcula la posición relativa al plano dividiendo por zoom y restando pan offset
- Fórmula: `pinX = ((clientX - rect.left - pan.x) / zoom) / imgWidth * 100`
- Persistencia: se guardan siempre como % del plano, independiente del zoom

---

## D) Checklist de Verificación (QA)

1. **PDF vs App**: Generar PDF, contar pines por nivel, comparar con vista interactiva de cada nivel. Deben coincidir exactamente.
2. **Nivel con muchos pines**: Verificar N2 (12+ pines) — todos visibles, sin solapamiento excesivo.
3. **Nivel con 0 pines**: Verificar que aparece en PDF con "0 pines" y sin pines dibujados.
4. **Fuentes x2**: Abrir PDF, verificar visualmente que textos son el doble de grandes. Verificar que no se cortan.
5. **FAB eliminado**: Activar modo pin, verificar que NO aparece el botón verde bounce en la parte inferior.
6. **Banner superior**: Verificar que SÍ aparece el banner verde fijo superior con instrucciones.
7. **Pinch zoom**: En móvil, activar modo pin, hacer pinch → zoom funciona. Colocar pin → coordenadas correctas.
8. **Zoom + pin**: Hacer zoom 3x, colocar pin, verificar que al volver a zoom 1x el pin está en la posición correcta.
9. **Icono plano**: En Bienvenida, verificar que ítems con pin muestran icono de plano. Tocar → navega al plano correcto.
10. **Asignar pin**: Tocar indicador amber en ítem sin pin → navega a planos con contexto de asignación.

---

## E) Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Layout roto por x2 en fuentes | Ajustar constantes de layout (PLANO_SLOT_H, STATS_H, etc.) proporcionalmente. Verificar con planos reales. |
| Coordenadas desajustadas por zoom | Usar fórmula que divide por zoom y resta pan. Testear en múltiples niveles de zoom. |
| Caching de PDF viejo | El PDF se genera on-demand, no hay cache. Cada generación consulta datos frescos. |
| Pinch interfiere con long-press | Detectar 2 dedos → cancelar long-press timer. Solo 1 dedo → long-press funciona. |
| Textos cortados en PDF | Usar sinAcentos() + verificar maxWidth. Reducir nombres largos con ellipsis si exceden. |
