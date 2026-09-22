# Monetizar VistaViva con Google AdSense

Todo está **preparado y desactivado por defecto**. La app sigue funcionando
100 % offline y sin scripts externos hasta que tú actives los anuncios con tu
propia cuenta. Los anuncios **nunca** aparecen durante los ejercicios: solo en
la pantalla de inicio y en la de «rutina completada».

---

## Resumen de piezas ya incluidas

| Archivo | Para qué sirve |
|---|---|
| `app.js` | Lógica de anuncios (bloque `ADS`), consentimiento de cookies y carga diferida. |
| `index.html` | Huecos de anuncio (`#ad-home`, `#ad-done`), banner de consentimiento y enlace a privacidad. |
| `styles.css` | Estilos del hueco de anuncio y del banner de cookies. |
| `privacidad.html` | Página de política de privacidad (exigida por AdSense). |
| `ads.txt` | Autoriza a Google a vender tu inventario (va en la raíz del dominio). |
| `vistaviva-wordpress.xml` | Importa a WordPress dos páginas: landing + privacidad. |

---

## Paso 1 — Publica la app con un dominio propio

AdSense **exige un dominio real** (no vale `file://` ni un subdominio gratis de
pruebas). Sube los archivos de la app a tu hosting o a Netlify/Vercel/Cloudflare
Pages y apunta tu dominio.

## Paso 2 — Crea tu cuenta de AdSense y pide aprobación

1. Entra en <https://adsense.google.com> y date de alta con tu dominio.
2. Copia tu **ID de editor**: tiene la forma `ca-pub-XXXXXXXXXXXXXXXX`.
3. Espera la aprobación (Google revisa que haya contenido y política de privacidad).

## Paso 3 — Sube el `ads.txt`

Edita `ads.txt` y cambia `pub-XXXXXXXXXXXXXXXX` por tu número real (sin el
prefijo `ca-`). Súbelo a la **raíz** del dominio, de modo que sea accesible en
`https://tudominio.com/ads.txt`.

## Paso 4 — Crea tus bloques de anuncio

En AdSense → **Anuncios → Por bloque de anuncios**, crea dos bloques
«display» y copia el **ID de slot** (10 dígitos) de cada uno.

## Paso 5 — Activa los anuncios en el código

Abre `app.js` y busca el bloque `const ADS = {`:

```js
const ADS = {
  enabled: true,                       // 1) pásalo a true
  client: 'ca-pub-1234567890123456',   // 2) tu ID de editor
  slots: { home: '1122334455', done: '6677889900' }, // 3) tus dos slots
};
```

Guarda y vuelve a subir. A partir de ahí:

- Al usuario le aparece **una sola vez** el banner de cookies.
- Si acepta, se carga el script de AdSense y se rellenan los huecos.
- Si rechaza, no se carga ningún script de anuncios.
- Sin conexión, no se intenta cargar nada; se reintenta al recuperar la red.

## Paso 6 — Rellena tus datos en la privacidad

En `privacidad.html` (y en la página importada a WordPress) sustituye
`[TU NOMBRE O MARCA]` y `[TU-EMAIL]` por los tuyos.

---

## Europa (RGPD) — importante

Para mostrar anuncios **personalizados** a usuarios de la UE, Reino Unido o
Suiza, Google exige una **CMP certificada** (plataforma de consentimiento).
La más sencilla es el **mensaje de consentimiento de Google** (Funding Choices),
que se activa gratis desde tu cuenta de AdSense en **Privacidad y mensajes**.
El banner incluido en la app cubre el consentimiento básico, pero **no**
sustituye a la CMP certificada si tu público es europeo.

---

## WordPress (tu host)

1. En tu WordPress: **Herramientas → Importar → Importador de WordPress**.
2. Sube `vistaviva-wordpress.xml` y pulsa **Subir archivo e importar**.
3. Se crean dos páginas: **VistaViva** (landing) y **Política de privacidad**.
4. Edita la página «VistaViva» y cambia `https://TU-APP.netlify.app` por la URL
   real de tu app.

> El `ads.txt` va en la raíz del dominio de WordPress. En muchos hosts se sube
> por FTP/administrador de archivos, o con un plugin tipo «Ads.txt Manager».

---

## Comprobación rápida

- [ ] La app abre y funciona con `enabled: false` (estado por defecto).
- [ ] Con `enabled: true` y tus IDs, aparece el banner de cookies una vez.
- [ ] Al aceptar, se ve el hueco «Publicidad» en inicio y al terminar.
- [ ] `https://tudominio.com/ads.txt` responde con tu línea de editor.
- [ ] `privacidad.html` es accesible y tiene tus datos.
