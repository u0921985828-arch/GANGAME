# Monetizar VistaViva con Google AdSense

Todo está **preparado y desactivado por defecto**. La app sigue funcionando
100 % offline. Los anuncios van en la **página de WordPress**, **fuera** del
iframe de la app (uno arriba y otro abajo), nunca durante los ejercicios.
Mientras no pongas tus IDs de AdSense, los anuncios simplemente no se muestran.

---

## Resumen de piezas ya incluidas

| Archivo | Para qué sirve |
|---|---|
| `vistaviva-wordpress.xml` | Importa TODO a WordPress: 8 páginas + 5 artículos, con los huecos de anuncio ya puestos en la página de la app. |
| `articulos/*.html` | Los 5 artículos de salud visual (contenido que AdSense pide para aprobar). |
| `ads.txt` | Autoriza a Google a vender tu inventario (va en la raíz del dominio). |
| `app.js` / `index.html` / `styles.css` | Anuncios internos opcionales de la app (bloque `ADS`), desactivados; no hacen falta si usas los de la página. |

---

## Paso 0 — Todo va DENTRO de tu WordPress (sin terceros)

No hace falta Netlify ni ningún otro servicio. Al importar
`vistaviva-wordpress.xml` se crean:

- **8 páginas**: VistaViva (la app), Artículos, Acerca de, Política de privacidad,
  Aviso legal, Política de cookies, Términos y condiciones y Contacto.
- **5 artículos** (categoría «Salud visual»): la regla 20-20-20, fatiga por
  pantallas, insuficiencia de convergencia, luz natural y miopía, y el método
  Bates. Son el **contenido de texto** que AdSense necesita para aprobarte.

La página **VistaViva** conserva la cabecera de tu tema, muestra la app en su
marco y, **debajo, un texto propio** que explica qué es la app (más contenido
rastreable para la aprobación). Los anuncios van encima y debajo del iframe de la
app (fuera de él, para que Google pueda rastrearlos).

1. WordPress → **Herramientas → Importar → «Importador de WordPress»**.
2. Sube `vistaviva-wordpress.xml` → **Subir archivo e importar**.
3. Cuando pregunte el autor, **asigna a tu usuario admin** (así WordPress
   conserva los `<script>` y `<iframe>` del contenido).

> Si un plugin de seguridad elimina `<script>`/`<iframe>` del contenido,
> desactívalo mientras importas. Para los anuncios, alternativamente puedes
> pegar cada bloque de AdSense en un bloque **HTML personalizado** en la página.

## Paso 1 — Añade tu dominio

AdSense **exige un dominio real** (no vale `file://` ni un subdominio de pruebas
que caduque). Apunta tu dominio a tu WordPress; la app y los artículos ya viven ahí.

## Paso 2 — Crea tu cuenta de AdSense y pide aprobación

1. Entra en <https://adsense.google.com> y date de alta con tu dominio.
2. Copia tu **ID de editor**: tiene la forma `ca-pub-XXXXXXXXXXXXXXXX`.
3. Espera la aprobación. Google revisa que haya **contenido propio** (por eso los
   artículos) y **política de privacidad** (ya incluida).

## Paso 3 — Sube el `ads.txt`

Edita `ads.txt` y cambia `pub-XXXXXXXXXXXXXXXX` por tu número real (sin el
prefijo `ca-`). Súbelo a la **raíz** del dominio, accesible en
`https://tudominio.com/ads.txt`.

## Paso 4 — Crea tus bloques de anuncio

En AdSense → **Anuncios → Por bloque de anuncios**, crea dos bloques
«display» y copia el **ID de slot** (10 dígitos) de cada uno (superior e inferior).

## Paso 5 — Pon tus IDs en la página de la app

Edita la página **VistaViva** en WordPress (**Páginas → VistaViva → Editar**) y
sustituye en su HTML:

- `ca-pub-XXXXXXXXXXXXXXXX` → tu ID de editor (aparece 3 veces: el cargador y
  los dos `data-ad-client`).
- `data-ad-slot="0000000001"` → el ID del bloque **superior**.
- `data-ad-slot="0000000002"` → el ID del bloque **inferior**.

Guarda. A partir de ahí Google rellena los dos huecos «Publicidad» que rodean la
app. (El bloque `ADS` de `app.js` es una alternativa interna que puedes dejar
desactivada; con los anuncios de la página ya es suficiente.)

## Paso 6 — Rellena tus datos legales

Sustituye los textos entre `[corchetes]` en las páginas legales (ver `LEGAL.md`):
titular, NIF, dirección, correo y dominio.

---

## Europa (RGPD) — importante

Para mostrar anuncios a usuarios de la UE, Reino Unido o Suiza, Google exige una
**CMP certificada**. La más sencilla es el **mensaje de consentimiento de
Google**, gratis desde tu cuenta de AdSense en **Privacidad y mensajes**; o un
plugin como **Complianz**/**CookieYes**. Actívala antes de recibir tráfico europeo.

> El `ads.txt` va en la raíz del dominio. En muchos hosts se sube por
> administrador de archivos, o con un plugin tipo «Ads.txt Manager».

---

## Comprobación rápida

- [ ] Importado el `.xml`: se ven 8 páginas y 5 artículos.
- [ ] En la página VistaViva, la app abre dentro del marco y hay un hueco
      «Publicidad» arriba y otro abajo.
- [ ] Con tus IDs puestos, Google empieza a rellenar esos huecos (tras aprobación).
- [ ] `https://tudominio.com/ads.txt` responde con tu línea de editor.
- [ ] CMP de cookies activa si tienes público europeo.
