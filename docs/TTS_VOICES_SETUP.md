# TTS - Configuración de Voces

## Estado Actual

Tu Windows tiene instaladas **2 voces**:

| Idioma | Voz | ID |
|--------|-----|-----|
| 🇪🇸 Español | Microsoft Helena Desktop | `HKEY_LOCAL_MACHINE\...\TTS_MS_ES-ES_HELENA_11.0` |
| 🇺🇸 English | Microsoft Zira Desktop | `HKEY_LOCAL_MACHINE\...\TTS_MS_EN-US_ZIRA_11.0` |

**La app ahora detecta automáticamente qué voces tienes y las muestra.**

---

## Cómo Funciona

### Antes (INCORRECTO)

```
Usuario selecciona "Francés" → App envía "fr_male_0" al servidor
                                ↓
                        Servidor no reconoce "fr_male_0"
                                ↓
                        Fallback a voz por defecto (Spanish)
                                ↓
                        ❌ Audio en Spanish, aunque eligió Francés
```

### Ahora (CORRECTO)

```
1. App inicia → Llama a GET /voices
2. Servidor devuelve: Helena (es-ES), Zira (en-US)
3. App mapea: es → Helena, en → Zira
4. UI muestra solo: "Español", "English"
5. Usuario selecciona "English" → App envía ID de Zira
6. Servidor reconoce Zira → ✓ Audio en English
```

---

## Instalando Más Voces

Si quieres tener TTS en más idiomas:

### Windows 11/10 - Descargar Voces

1. **Abre Configuración**
   ```
   Inicio → Configuración
   ```

2. **Ve a Accesibilidad → Síntesis de Voz**
   ```
   Busca "Síntesis de voz" en la búsqueda
   ```

3. **Haz clic en "Voces disponibles"**
   - Verás un botón "Añadir voces"

4. **Selecciona idiomas que quieras**
   - Español, Français, Deutsch, 日本語, etc.
   - Descargarás los paquetes de voz

5. **Espera a que se descarguen**
   - Puede tardar unos minutos

6. **Reinicia la app**
   ```bash
   npm run dev
   ```

7. **Abre DevTools (F12) → Console**
   ```
   ✓ Voces TTS cargadas: 4 voces, 4 idiomas
   Idiomas disponibles: Deutsch, English, Français, Español
   ```

8. **¡Listo!** Modo Voz mostará los 4 idiomas

---

## Verificar Qué Voces Tienes

### Opción 1: Desde la App Console

```javascript
// Abrir DevTools (F12) → Console
// Pegar:
fetch('http://localhost:9000/voices')
  .then(r => r.json())
  .then(d => {
    console.log(`Total voces: ${d.voices.length}`);
    d.voices.forEach(v => console.log(`- ${v.name} (${v.languages})`));
  });
```

### Opción 2: Desde Terminal

```powershell
curl http://localhost:9000/voices | ConvertFrom-Json | Select-Object -ExpandProperty voices | Format-Table name, languages
```

Salida:
```
name                                  languages
----                                  ---------
Microsoft Helena Desktop - Spanish    es-ES
Microsoft Zira Desktop - English      en-US
```

---

## Qué Idiomas Puedes Instalar

| Código | Idioma | Patrón | Descargar |
|--------|--------|--------|-----------|
| `es` | Español | `es-ES` | Microsoft Helena (Spain) |
| `en` | English | `en-US` | Microsoft Zira (US) |
| `fr` | Français | `fr-FR` | Microsoft Paul (France) |
| `de` | Deutsch | `de-DE` | Microsoft Hedda (Germany) |
| `pt` | Portugués | `pt-BR`, `pt-PT` | Microsoft Maria (Brazil) |
| `it` | Italiano | `it-IT` | Microsoft Elsa (Italy) |
| `zh` | 中文 | `zh-CN` | Microsoft Huihui (China) |
| `ja` | 日本語 | `ja-JP` | Microsoft Haruka (Japan) |
| `ru` | Русский | `ru-RU` | Microsoft Irina (Russia) |
| `ar` | العربية | `ar-SA` | Microsoft Hana (Saudi Arabia) |

---

## Cómo la App Mapea Idiomas

La app tiene un mapeo de **patrones de idioma** a **códigos cortos**:

```javascript
const LANGUAGE_CODE_MAP = {
  es: ["es-ES", "es"],      // Cualquier voz que empiece con es-ES o es
  en: ["en-US", "en"],      // Cualquier voz que empiece con en-US o en
  fr: ["fr-FR", "fr"],      // Cualquier voz que empiece con fr-FR o fr
  // ... etc
};
```

Cuando la app inicia:
1. Obtiene todas las voces del servidor
2. Para cada voz, comprueba si coincide con algún patrón
3. Si coincide → La añade al idioma correspondiente
4. Si no coincide con nada → No la usa

**Ejemplo:**
```
Voz: "Microsoft Helena Desktop"
Idiomas: ["es-ES"]
        ↓
¿Coincide con algún patrón en LANGUAGE_CODE_MAP?
        ↓
Sí: "es-ES" empieza con "es-ES" (en LANGUAGE_CODE_MAP.es)
        ↓
Se añade a: ttsLanguageVoiceMap["es"] = [{ id: "...", label: "Helena" }]
```

---

## Multiples Voces del Mismo Idioma

Si instalas múltiples voces del mismo idioma, la app las mostrará todas:

```
ttsLanguageVoiceMap = {
  es: [
    { value: "Helena_ID", label: "Microsoft Helena Desktop - Spanish (Spain)" },
    { value: "Sabina_ID", label: "Microsoft Sabina Desktop - Spanish (Mexico)" }
  ]
}
```

En la UI verás un dropdown:
```
Selecciona la voz:
- Microsoft Helena Desktop - Spanish (Spain)
- Microsoft Sabina Desktop - Spanish (Mexico)
```

---

## API del Servidor TTS

### GET /voices

Obtiene todas las voces disponibles en el sistema.

**Respuesta:**
```json
{
  "platform": "Windows",
  "driver": "sapi5",
  "voices": [
    {
      "id": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech\\Voices\\Tokens\\TTS_MS_ES-ES_HELENA_11.0",
      "name": "Microsoft Helena Desktop - Spanish (Spain)",
      "languages": ["es-ES"]
    },
    {
      "id": "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Speech\\Voices\\Tokens\\TTS_MS_EN-US_ZIRA_11.0",
      "name": "Microsoft Zira Desktop - English (United States)",
      "languages": ["en-US"]
    }
  ]
}
```

El campo `id` es lo que se envía al endpoint `/tts` en `voice_preset`.

---

## Troubleshooting

### "Solo veo Español y English en la app"

**Causa:** Solo tienes esas 2 voces instaladas en Windows

**Solución:** Instala más voces (ver "Instalando Más Voces" arriba)

### "Instalé una voz pero no aparece"

**Solución 1:** Reinicia la app
```bash
npm run dev
```

**Solución 2:** Verifica que la voz está instalada
```powershell
curl http://localhost:9000/voices
```

**Solución 3:** Si aparece en `/voices` pero no en la app
- Puede que el código de idioma no coincida
- Abre un issue o revisa los logs de la consola

### "El audio está en idioma incorrecto"

**Verificar:**
1. ¿Seleccionaste el idioma correcto?
2. ¿La voz que seleccionaste es del idioma que esperas?
3. Abre DevTools console durante la generación
   ```
   🎙️ TTS Request: "Tu texto..." (X chars), preset: <VOICE_ID>
   ```
   Verifica que el `preset` es el ID correcto de la voz

---

## Resumen

| Acción | Resultado |
|--------|-----------|
| Instalar voces en Windows | App las detecta automáticamente |
| Seleccionar idioma en Voz mode | App envía el ID correcto de voz al servidor |
| Generar audio | Servidor usa la voz correcta |
| Descargar | Audio descargado en el idioma seleccionado |

**La app es totalmente automática y se adapta a las voces disponibles.**
