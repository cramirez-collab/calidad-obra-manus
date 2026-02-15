# Diagnóstico: Fotos no aparecen en reportes IA

## Flujo completo:
1. **DB**: `getFotosEvidenciaParaReporte` - filtra items con fotoAntesUrl OR fotoDespuesUrl NOT NULL
2. **Router**: `generarAnalisis` y `generarResumen` llaman a getFotosEvidenciaParaReporte(proyectoId, 3)
3. **Frontend state**: `setFotosEvidenciaIA(data.fotosEvidencia)` - condicional con `if (data.fotosEvidencia)`
4. **Frontend render**: `{fotosEvidenciaIA.length > 0 && (` - condicional
5. **PDF**: `if (fotosEvidenciaIA.length > 0)` - condicional

## Posibles causas:
1. **DB query devuelve vacío**: Si no hay items con fotos en el proyecto → no hay fotos
2. **CORS en imágenes**: `img.crossOrigin = 'anonymous'` puede fallar si el servidor de imágenes no permite CORS
3. **getImageUrl**: Puede no estar construyendo la URL correcta
4. **Auto-gen effect**: El auto-gen se dispara pero los datos de fotosEvidencia pueden no llegar si la mutación falla parcialmente

## Solución:
- Si no hay fotos reales, mostrar placeholder con mensaje "Sin evidencia fotográfica disponible"
- Mejorar el fallback en drawPhotosOnPDF para siempre mostrar algo
- Asegurar que getImageUrl funciona correctamente
- Agregar log para depurar
