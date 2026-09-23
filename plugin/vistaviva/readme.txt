=== VistaViva ===
Contributors: vistaviva
Tags: salud visual, ejercicios oculares, gimnasia visual, offline, adsense
Requires at least: 5.6
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Entrenador de gimnasia visual (ejercicios oculares), sin conexión y sin terceros, con anuncios opcionales de AdSense.

== Description ==

VistaViva añade a tu WordPress una aplicación web de ejercicios oculares que
funciona offline, junto con las páginas de contenido y legales que necesita un
sitio con publicidad.

Al activarlo:

* Crea 8 páginas (VistaViva/app, Artículos, Acerca de, Privacidad, Aviso legal,
  Cookies, Términos y Contacto) y 5 artículos, sin duplicar si ya existen.
* Conserva la cabecera y el pie de tu tema; añade su propia barra de menú sticky.
* Marca la página de privacidad en Ajustes → Privacidad.

Shortcodes:

* `[vistaviva]` — la aplicación completa (menú + anuncios + marco + texto).
* `[vistaviva_menu]` — solo la barra de navegación.
* `[vistaviva_articles]` — el índice de artículos.

Los anuncios están desactivados por defecto. Actívalos y pon tus IDs en
Ajustes → VistaViva cuando AdSense te apruebe.

== Frequently Asked Questions ==

= ¿Envía datos a terceros? =
No, salvo que actives los anuncios de AdSense. La app en sí funciona 100% en el
navegador y no requiere conexión.

= ¿Cómo pongo mis anuncios? =
Ajustes → VistaViva: activa los anuncios y pega tu ID de editor (ca-pub-…) y los
IDs de los dos bloques (superior e inferior). Sube también tu ads.txt a la raíz
del dominio y, si tu público es europeo, activa una CMP de consentimiento.

== Changelog ==

= 1.0.0 =
* Versión inicial: app en shortcode, ajustes de AdSense y creación automática de
  páginas y artículos.
