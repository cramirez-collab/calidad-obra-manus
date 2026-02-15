# Notas sobre estructura de reportes IA en Bienvenida.tsx

## Dialog structure (line ~1468)
- Dialog open={showReporteIA} max-w-4xl
- DialogHeader with icon "R" and title
- 3 tabs: analisis, resumen, historial
- Each tab has: pre-generation view (with mini charts), loading, result

## State variables (line ~196-204)
- showReporteIA, generandoAnalisis, analisisResultado, resumenResultado
- generandoResumen, generandoPDFIA, reporteTab
- NEW: chartDataIA, fotosEvidenciaIA

## Mutations (line ~286-308)
- analisisMut -> sets analisisResultado, chartDataIA, fotosEvidenciaIA
- resumenMut -> sets resumenResultado, chartDataIA, fotosEvidenciaIA

## PDF functions
- handleDescargarPDFIA (line 323): full analysis PDF with header, content parsing
- handleDescargarPDFResumen (line 443): compact 1-page PDF with KPI boxes

## Current mini charts (3 per tab, using statsData):
1. PieChart: por estado
2. BarChart: top 5 empresas
3. BarChart: top 5 especialidades

## CHANGES NEEDED:
1. Add logo Objetiva to dialog header and PDF
2. Improve interlineado (line-height) in result rendering
3. Replace 3 charts with 5 charts using chartDataIA (from backend):
   - Pie: por status
   - Bar: por empresa (stacked aprobados/rechazados)
   - Bar: por especialidad
   - Line/Area: tendencia semanal
   - Bar: defectos frecuentes
4. Add 3 fotos evidencia section after charts in result view
5. Improve PDF to include logo image
