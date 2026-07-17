# Licencias de terceros — ARTiFACTS FX-404

Esta aplicación incorpora, de forma embebida y **sin modificar**, las siguientes bibliotecas de código
abierto. Se reproducen aquí sus avisos de copyright y licencia. Este documento se distribuye junto con la
app (raíz del repositorio y `android/app/src/main/assets/THIRD_PARTY_LICENSES.md`, incluido en el APK/AAB).

---

## JSZip 3.10.1
© 2009-2016 Stuart Knightley y colaboradores. <http://stuartk.com/jszip>
Licencia dual **MIT o GPLv3**; se usa aquí bajo los términos de la **licencia MIT**.
Incluye la biblioteca **pako** (© 2014-2017 Vitaly Puzrin y Andrey Tupitsin), bajo **licencia MIT**.

### Texto de la licencia MIT (aplica a JSZip y a pako)
```
Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

---

## lamejs
Codificador MP3 en JavaScript puro, por Zhu Kai (zhuker). <https://github.com/zhuker/lamejs>
Publicado bajo la **GNU Lesser General Public License, versión 3 (LGPL-3.0)**.

**Cumplimiento de la LGPL-3.0** (esta app cumple las condiciones de la §4 "Combined Works"):

1. **Aviso destacado:** esta aplicación utiliza la biblioteca lamejs, cubierta por la LGPL-3.0, para la
   exportación de audio a MP3.
2. **Sin modificaciones:** lamejs se incorpora **verbatim y sin modificar**. Cualquier persona puede
   sustituirla por otra versión de la biblioteca reemplazando el bloque `<script>` correspondiente del
   fichero HTML (distribución de fichero único), o el `assets/index.html` del wrapper Android.
3. **Código fuente correspondiente:** el fuente exacto de lamejs está disponible públicamente en
   <https://github.com/zhuker/lamejs>. **Oferta escrita:** los titulares de esta app entregarán, previa
   solicitud a `eddierealting@gmail.com`, una copia del código fuente correspondiente de lamejs tal como
   se distribuye en esta app.
4. **Texto completo de la licencia:** los textos íntegros de la LGPL-3.0 y de la GPL-3.0 (a la que la
   LGPL-3.0 se remite) están disponibles en:
   - LGPL-3.0: <https://www.gnu.org/licenses/lgpl-3.0.txt>
   - GPL-3.0:  <https://www.gnu.org/licenses/gpl-3.0.txt>

---

## Fuentes tipográficas
Las fuentes embebidas (`data:` WOFF2) se incluyen bajo licencias que permiten su incrustación y
redistribución (SIL Open Font License / Apache-2.0 según la familia). Sus avisos de copyright originales
se conservan en los metadatos de cada fichero de fuente.
