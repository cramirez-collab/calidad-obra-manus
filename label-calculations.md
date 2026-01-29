# Cálculos de Layout para Etiquetas Office Depot 64413

## Especificaciones del Producto
- **SKU:** 64413
- **Marca:** Office Depot
- **Medidas etiqueta:** 2.5 x 6.7 cm (equivalente a 1" x 2-5/8")
- **Compatible con:** Avery 5160
- **Cantidad por hoja:** 30 etiquetas (3 columnas x 10 filas)
- **Cantidad total:** 750 etiquetas (25 hojas)

## Conversiones
- 1 pulgada = 25.4 mm = 2.54 cm
- Etiqueta: 1" x 2-5/8" = 25.4mm x 66.675mm = 2.54cm x 6.67cm

## Especificaciones Avery 5160 (estándar)
- **Tamaño de hoja:** Letter (8.5" x 11" = 215.9mm x 279.4mm)
- **Tamaño etiqueta:** 1" x 2-5/8" (25.4mm x 66.675mm)
- **Margen superior:** 0.5" (12.7mm)
- **Margen izquierdo:** 0.1875" (4.76mm) - aproximadamente 3/16"
- **Espacio horizontal entre etiquetas:** 0.125" (3.175mm) - 1/8"
- **Espacio vertical entre etiquetas:** 0" (sin espacio)
- **Columnas:** 3
- **Filas:** 10

## Cálculo de Layout CSS
```
Hoja carta: 215.9mm x 279.4mm

Margen superior: 12.7mm (0.5")
Margen izquierdo: 4.76mm (~0.1875")

Ancho etiqueta: 66.675mm (2.625")
Alto etiqueta: 25.4mm (1")

Espacio horizontal (gutter): 3.175mm (0.125")
Espacio vertical: 0mm

Verificación horizontal:
- Margen izquierdo: 4.76mm
- 3 etiquetas x 66.675mm = 200.025mm
- 2 gutters x 3.175mm = 6.35mm
- Total: 4.76 + 200.025 + 6.35 = 211.135mm
- Margen derecho: 215.9 - 211.135 = 4.765mm ✓

Verificación vertical:
- Margen superior: 12.7mm
- 10 etiquetas x 25.4mm = 254mm
- Total: 12.7 + 254 = 266.7mm
- Margen inferior: 279.4 - 266.7 = 12.7mm ✓
```

## Valores para CSS (en mm)
```css
@page {
  size: letter portrait;
  margin: 0;
}

.page {
  width: 215.9mm;
  height: 279.4mm;
  padding-top: 12.7mm;
  padding-left: 4.76mm;
  padding-right: 4.76mm;
  padding-bottom: 12.7mm;
}

.label {
  width: 66.675mm;
  height: 25.4mm;
  margin-right: 3.175mm; /* excepto última columna */
  margin-bottom: 0;
}
```
