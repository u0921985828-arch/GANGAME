# Dejar VistaViva legalmente en regla (WordPress)

Objetivo: que el sitio tenga **todo lo necesario** para operar con anuncios sin
riesgo de reclamaciones: aviso legal, privacidad, cookies, términos con aviso de
salud y contacto, todo enlazado y visible.

> Aviso: estas páginas son **plantillas**, no asesoramiento jurídico. Rellena tus
> datos reales; si tu caso es delicado, consúltalo con un profesional.

## 1. Importa las páginas legales

Ya tienes importadas **VistaViva** y **Política de privacidad**. Ahora:

1. WordPress → **Herramientas → Importar → «Importador de WordPress»**.
2. Sube **`vistaviva-legal-wordpress.xml`** → asigna a **admin** → importar.
3. Se añaden 4 páginas: **Aviso legal**, **Política de cookies**,
   **Términos y condiciones** y **Contacto**.
   (No duplica lo que ya tenías.)

## 2. Rellena tus datos

Busca y sustituye en cada página los textos entre corchetes:

| Marcador | Qué poner |
|---|---|
| `[TU NOMBRE O RAZÓN SOCIAL]` | Tu nombre completo o el de tu empresa |
| `[TU NIF O DNI]` | Tu identificación fiscal (obligatorio en el Aviso legal en España) |
| `[TU DIRECCIÓN]` | Domicilio o dirección de contacto |
| `[TU-EMAIL]` | Tu correo de contacto |
| `[TU-DOMINIO]` | La URL de tu sitio |

> Editas cada página en **Páginas → (la página) → Editar**.

## 3. Enlázalas en el pie de página

Para que un sitio con publicidad esté en regla, los enlaces legales deben ser
accesibles desde cualquier página:

1. **Apariencia → Menús** → crea un menú «Legal» (o usa el de pie existente).
2. Añade: Aviso legal · Política de privacidad · Política de cookies ·
   Términos y condiciones · Contacto.
3. Asígnalo a la ubicación **«Pie de página»** (Footer) y guarda.

## 4. Banner de cookies del sitio (UE)

La app ya pide consentimiento para los anuncios. Pero, a nivel de **sitio
WordPress** y si tu público es europeo, Google exige una **CMP certificada**:

- Actívala gratis desde tu cuenta de **AdSense → Privacidad y mensajes**
  (mensaje de consentimiento de Google), **o**
- Instala un plugin gratuito de consentimiento: **Complianz** o **CookieYes**.

Cualquiera de las dos muestra el banner de cookies en todo el sitio y bloquea
los anuncios hasta que el usuario acepta.

## 5. Marca la privacidad en los ajustes de WordPress

**Ajustes → Privacidad** → selecciona la página **«Política de privacidad»**.
Así WordPress la reconoce oficialmente.

## 6. Repaso final (checklist antidenuncia)

- [ ] Aviso legal con tus datos reales (titular, NIF, contacto).
- [ ] Política de privacidad seleccionada en Ajustes → Privacidad.
- [ ] Política de cookies publicada y enlazada.
- [ ] Términos y condiciones con aviso de salud y fotosensibilidad.
- [ ] Contacto con un correo que funcione.
- [ ] Los 5 enlaces visibles en el pie de página.
- [ ] Banner/CMP de cookies activo si tienes público europeo.
- [ ] `ads.txt` en la raíz del dominio (cuando actives AdSense).
