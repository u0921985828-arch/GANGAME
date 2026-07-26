---
description: Compila, firma y entrega el APK de FX-404 (web→WebView) vía CI
argument-hint: "[versionName opcional, p.ej. 1.46]"
---

Compila y **entrega el APK firmado** de FX-404 siguiendo el flujo probado de este
repo. La app (un `ARTiFACTSFX404_vN.html` autónomo) se empaqueta en un WebView; el
CI ofusca el asset, firma el release y lo publica en el tag `apk-latest`.

Contexto (no narres esto; ejecútalo):
- El obfuscador (`tools/obfuscate-build.mjs`) toma automáticamente el
  `ARTiFACTSFX404_v*.html` de número más alto → `android/app/src/main/assets/index.html`.
  Por tanto, para un APK nuevo basta con que el `_vN` más alto esté commiteado.
- El workflow `build-release.yml` (rama `claude/new-session-q3zb92`) firma con la clave
  de dev cacheada (o los secrets `RELEASE_*` si existen) y publica el APK firmado en el
  release de tag `apk-latest`. La barrera `apksigner verify` corta el build si sale sin firmar.
- No se puede bajar el artifact de Actions (blob de Azure bloqueado por el proxy): **baja
  siempre el APK desde el asset del Release** (`api.github.com/.../releases/assets/<id>` con
  `Accept: application/octet-stream`, que redirige a github.com → permitido).

Pasos:

1. **Versión.** En `android/app/build.gradle.kts`: sube `versionCode` en +1 y fija
   `versionName`. Si `$ARGUMENTS` trae un versionName úsalo; si no, incrementa el actual
   (p. ej. 1.45 → 1.46). Sincroniza también el asset con el `_vN` más alto
   (`cp ARTiFACTSFX404_v<N>.html android/app/src/main/assets/index.html`) para dejar el repo coherente.

2. **Commit + push** a `claude/new-session-q3zb92` (mensaje breve: qué versión y por qué).
   El push dispara `build-release.yml`.

3. **Espera** a que termine el último run de `build-release.yml` de la rama (usa las tools
   `mcp__github__actions_*`; para no bloquear, un `sleep` en background de ~230s y luego
   comprueba estado). Recuerda: el run puede terminar en *failure* solo por pasos posteriores,
   pero el APK firmado ya se publica en el asset — verifica el asset igualmente.

4. **Baja + verifica** el APK del release `apk-latest`:
   - `mcp__github__get_release_by_tag` → coge el `id` y `digest` del asset `.apk`.
   - `curl -sL -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/octet-stream" .../releases/assets/<id>`.
   - Comprueba: **sha256 == digest**; `apksigner verify` → esquema **v2** true; `aapt dump badging`
     → `versionName`/`application-label` correctos; y que el **certificado de firma (SHA-256) no
     cambia** respecto al APK anterior (misma clave → se instala encima sin desinstalar). Si el
     cert cambió, avísalo (el usuario tendría que desinstalar).
   - `aapt`/`apksigner` se instalan con `apt-get install -y aapt apksigner` si faltan.

5. **Entrega** el APK con `SendUserFile` (display: attach), indicando versión y que se instala
   encima del anterior sin desinstalar (misma firma).

Reglas: trabajo en silencio (no narres herramientas ni pasos intermedios); una sola respuesta
final con el APK + explicación breve. Si algo falla de verdad (build rojo por error real, firma
distinta, hash que no cuadra), párate e infórmalo con el detalle exacto.
