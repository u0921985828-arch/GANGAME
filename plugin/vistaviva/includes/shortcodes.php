<?php
/**
 * Shortcodes y utilidades de renderizado del frontend.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Definición del menú: [clave, etiqueta, slug].
 */
function vv_menu_def() {
	return array(
		array( 'app', 'Inicio', 'vistaviva' ),
		array( 'articulos', 'Artículos', 'articulos' ),
		array( 'acerca', 'Acerca de', 'acerca-de' ),
		array( 'privacidad', 'Privacidad', 'politica-de-privacidad' ),
		array( 'aviso', 'Aviso legal', 'aviso-legal' ),
		array( 'cookies', 'Cookies', 'politica-de-cookies' ),
		array( 'terminos', 'Términos', 'terminos-y-condiciones' ),
		array( 'contacto', 'Contacto', 'contacto' ),
	);
}

/**
 * Permalink de una PÁGINA por slug (usa el mapa guardado en la activación).
 */
function vv_permalink( $slug ) {
	$map = get_option( 'vistaviva_pages', array() );
	if ( ! empty( $map[ $slug ] ) ) {
		$url = get_permalink( $map[ $slug ] );
		if ( $url ) {
			return $url;
		}
	}
	$page = get_page_by_path( $slug, OBJECT, 'page' );
	if ( $page ) {
		return get_permalink( $page->ID );
	}
	return home_url( '/' . $slug . '/' );
}

/**
 * Permalink de un ARTÍCULO (post) por slug.
 */
function vv_post_permalink( $slug ) {
	$post = get_page_by_path( $slug, OBJECT, 'post' );
	return $post ? get_permalink( $post->ID ) : home_url( '/' . $slug . '/' );
}

/**
 * Detecta qué entrada de menú corresponde a la página actual.
 */
function vv_current_menukey() {
	if ( is_singular( 'post' ) ) {
		return 'articulos';
	}
	$id  = get_queried_object_id();
	$map = get_option( 'vistaviva_pages', array() );
	$slug = array_search( $id, $map, true );
	if ( $slug ) {
		foreach ( vv_menu_def() as $m ) {
			if ( $m[2] === $slug ) {
				return $m[0];
			}
		}
	}
	return '';
}

/**
 * HTML de la barra de menú (sin envoltorio de shell).
 */
function vv_bar_html( $active ) {
	$links = '';
	foreach ( vv_menu_def() as $m ) {
		list( $k, $label, $slug ) = $m;
		$cur     = ( $k === $active ) ? ' aria-current="page"' : '';
		$links  .= '<a href="' . esc_url( vv_permalink( $slug ) ) . '"' . $cur . '>' . esc_html( $label ) . '</a>';
	}
	return '<header class="vv-bar">'
		. '<a class="vv-bar__brand" href="' . esc_url( vv_permalink( 'vistaviva' ) ) . '">'
		. '<span class="vv-bar__logo">V</span><span>VistaViva</span></a>'
		. '<nav class="vv-menu" aria-label="Secciones">' . $links . '</nav>'
		. '</header>';
}

/**
 * Menú envuelto en su propio shell a todo el ancho (para páginas de contenido).
 */
function vv_render_menu( $active = null ) {
	if ( null === $active ) {
		$active = vv_current_menukey();
	}
	return '<div class="vv-shell vv-shell--bar">' . vv_bar_html( $active ) . '</div>';
}

/**
 * Shortcode [vistaviva_menu]: barra de navegación de VistaViva.
 */
function vv_sc_menu() {
	return vv_render_menu();
}
add_shortcode( 'vistaviva_menu', 'vv_sc_menu' );

/**
 * Bloque de anuncio (arriba o abajo). Vacío si los anuncios están desactivados.
 */
function vv_ad_slot( $o, $which ) {
	if ( ! $o['ads_enabled'] || ! $o['ads_client'] ) {
		return '';
	}
	$slot = ( 'top' === $which ) ? $o['slot_top'] : $o['slot_bottom'];
	if ( ! $slot ) {
		return '';
	}
	$client = esc_attr( $o['ads_client'] );
	$slot   = esc_attr( $slot );
	return '<div class="vv-ad"><span class="vv-ad__tag">Publicidad</span>'
		. '<ins class="adsbygoogle" style="display:block" data-ad-client="' . $client . '" '
		. 'data-ad-slot="' . $slot . '" data-ad-format="auto" data-full-width-responsive="true"></ins>'
		. '<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>';
}

/**
 * Shortcode [vistaviva]: la aplicación completa (menú + anuncios + marco + texto).
 */
function vv_sc_app() {
	$o  = vv_opts();
	$fh = intval( $o['frame_height'] );
	if ( $fh < 50 ) {
		$fh = 50;
	}
	if ( $fh > 95 ) {
		$fh = 95;
	}

	if ( $o['ads_enabled'] && $o['ads_client'] ) {
		wp_enqueue_script( 'vistaviva-adsense' );
	}

	$app_url = esc_url( VV_URL . 'assets/app/index.html' );
	$top     = vv_ad_slot( $o, 'top' );
	$bottom  = vv_ad_slot( $o, 'bottom' );
	$intro   = vv_read_asset( 'content/intro.html' );

	$html  = '<div class="vv-shell">';
	$html .= vv_bar_html( 'app' );
	$html .= '<div class="vv-body">';
	$html .= '<div class="vv-app">';
	$html .= $top;
	$html .= '<div class="vv-frame" style="--vv-frame-h:' . $fh . 'svh">'
		. '<iframe src="' . $app_url . '" title="VistaViva" loading="lazy" referrerpolicy="no-referrer"></iframe></div>';
	$html .= $bottom;
	$html .= '</div>'; // .vv-app
	$html .= $intro;
	$html .= '</div>'; // .vv-body
	$html .= '</div>'; // .vv-shell
	return $html;
}
add_shortcode( 'vistaviva', 'vv_sc_app' );

/**
 * Shortcode [vistaviva_articles]: índice de artículos (permalinks en vivo).
 */
function vv_sc_articles() {
	$out = '<p>Guías honestas sobre salud visual, fatiga por pantallas y qué esperar '
		. '(y qué no) de los ejercicios oculares.</p><div class="vv-list">';
	foreach ( vv_articles_def() as $a ) {
		$out .= '<a class="vv-item" href="' . esc_url( vv_post_permalink( $a['slug'] ) ) . '">'
			. '<h3>' . esc_html( $a['title'] ) . '</h3>'
			. '<p>' . esc_html( $a['excerpt'] ) . '</p></a>';
	}
	return $out . '</div>';
}
add_shortcode( 'vistaviva_articles', 'vv_sc_articles' );

/**
 * Envuelve contenido en la tarjeta oscura a todo el ancho.
 */
function vv_wrap_card( $title, $inner ) {
	return '<div class="vv-shell vv-shell--content"><div class="vv-page"><div class="vv-card">'
		. '<h1>' . esc_html( $title ) . '</h1>' . $inner . '</div></div></div>';
}

/**
 * Botón "volver a la app".
 */
function vv_back() {
	return '<p><a class="vv-back" href="' . esc_url( vv_permalink( 'vistaviva' ) ) . '">← Volver a la app</a></p>';
}

/**
 * Botón CTA "probar los ejercicios".
 */
function vv_cta() {
	return '<p><a class="vv-cta" href="' . esc_url( vv_permalink( 'vistaviva' ) ) . '">▶ Probar los ejercicios en VistaViva</a></p>';
}
