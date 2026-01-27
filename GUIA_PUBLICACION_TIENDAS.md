# Guía de Publicación en App Store y Play Store

## Introducción

ObjetivaOQC es una **Progressive Web App (PWA)** que funciona directamente desde el navegador. Para publicarla en las tiendas de aplicaciones, necesitas convertirla en una aplicación nativa usando herramientas como **PWABuilder** o **Capacitor**.

---

## Opción 1: PWABuilder (Recomendado - Más Rápido)

PWABuilder es una herramienta gratuita de Microsoft que convierte tu PWA en aplicaciones nativas.

### Pasos:

1. **Visita** [https://www.pwabuilder.com](https://www.pwabuilder.com)
2. **Ingresa la URL** de tu aplicación publicada (ej: `https://objetivaoqc.cc`)
3. **Analiza** tu PWA - PWABuilder verificará que cumple los requisitos
4. **Genera paquetes** para Android (APK/AAB) e iOS (IPA)
5. **Descarga** los archivos generados

---

## Publicación en Google Play Store (Android)

### Requisitos Previos:

| Requisito | Detalle |
|-----------|---------|
| Cuenta de desarrollador | $25 USD (pago único) |
| Registro | [https://play.google.com/console](https://play.google.com/console) |
| Tiempo de aprobación | 1-7 días |

### Pasos de Registro:

1. **Crear cuenta** en Google Play Console con tu cuenta de Google
2. **Pagar** la cuota de registro de $25 USD
3. **Completar** la información del desarrollador (nombre, dirección, teléfono)
4. **Verificar** tu identidad con documento oficial

### Subir la Aplicación:

1. **Crear nueva aplicación** en Play Console
2. **Completar ficha de tienda**:
   - Nombre: ObjetivaOQC - Control de Calidad de Obra
   - Descripción corta (80 caracteres)
   - Descripción completa (4000 caracteres)
   - Capturas de pantalla (mínimo 2 por tipo de dispositivo)
   - Icono de la app (512x512 px)
   - Gráfico de funciones (1024x500 px)
3. **Clasificación de contenido**: Completar cuestionario
4. **Configurar precios**: Gratis o de pago
5. **Subir AAB/APK** generado por PWABuilder
6. **Enviar a revisión**

### Documentos Necesarios:

- Política de privacidad (URL pública)
- Términos y condiciones (URL pública)
- Capturas de pantalla de la app

---

## Publicación en Apple App Store (iOS)

### Requisitos Previos:

| Requisito | Detalle |
|-----------|---------|
| Cuenta de desarrollador | $99 USD/año |
| Registro | [https://developer.apple.com](https://developer.apple.com) |
| Computadora | Mac con Xcode (obligatorio) |
| Tiempo de aprobación | 1-3 días |

### Pasos de Registro:

1. **Crear Apple ID** si no tienes uno
2. **Inscribirse** en Apple Developer Program ($99 USD/año)
3. **Verificar identidad** (puede tomar 24-48 horas)
4. **Aceptar** los acuerdos de desarrollador

### Subir la Aplicación:

1. **Abrir Xcode** en tu Mac
2. **Importar proyecto** generado por PWABuilder
3. **Configurar certificados** de firma en Apple Developer Portal
4. **Crear App Store Connect** record para tu app
5. **Completar información**:
   - Nombre: ObjetivaOQC
   - Subtítulo
   - Descripción
   - Palabras clave
   - Capturas de pantalla (iPhone, iPad)
   - Icono (1024x1024 px)
6. **Subir build** desde Xcode usando Archive
7. **Enviar a revisión**

### Documentos Necesarios:

- Política de privacidad (URL pública)
- Información de contacto de soporte
- Capturas de pantalla para cada tamaño de dispositivo

---

## Opción 2: Capacitor (Para Desarrolladores)

Si prefieres más control, puedes usar Capacitor de Ionic.

### Instalación:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init ObjetivaOQC cc.objetivaoqc.app
```

### Agregar plataformas:

```bash
npx cap add android
npx cap add ios
```

### Compilar:

```bash
npm run build
npx cap sync
npx cap open android  # Abre Android Studio
npx cap open ios      # Abre Xcode (solo Mac)
```

---

## Resumen de Costos

| Plataforma | Costo Inicial | Costo Anual |
|------------|---------------|-------------|
| Google Play | $25 USD | $0 |
| Apple App Store | $99 USD | $99 USD |
| **Total** | **$124 USD** | **$99 USD** |

---

## Checklist Pre-Publicación

- [ ] Política de privacidad publicada
- [ ] Términos y condiciones publicados
- [ ] Icono de app en alta resolución (1024x1024)
- [ ] Capturas de pantalla de todas las secciones principales
- [ ] Descripción corta y larga redactadas
- [ ] Categoría de la app definida (Productividad/Negocios)
- [ ] Clasificación de edad completada
- [ ] Información de contacto de soporte

---

## Soporte

Para dudas sobre el proceso de publicación:
- Google Play: [https://support.google.com/googleplay/android-developer](https://support.google.com/googleplay/android-developer)
- Apple: [https://developer.apple.com/support](https://developer.apple.com/support)
