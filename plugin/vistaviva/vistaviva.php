<?php
/**
 * Plugin Name:       VistaViva
 * Plugin URI:        https://vistaviva.app
 * Description:       Entrenador de gimnasia visual (ejercicios oculares), offline y sin terceros. Aporta el shortcode [vistaviva], crea todas las páginas del sitio al activarse y gestiona los anuncios de AdSense desde Ajustes → VistaViva.
 * Version:           1.0.0
 * Requires at least: 5.6
 * Requires PHP:      7.2
 * Author:            VistaViva
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       vistaviva
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Acceso directo no permitido.
}

define( 'VV_VERSION', '1.0.0' );
define( 'VV_FILE', __FILE__ );
define( 'VV_DIR', plugin_dir_path( __FILE__ ) );
define( 'VV_URL', plugin_dir_url( __FILE__ ) );

require_once VV_DIR . 'includes/settings.php';
require_once VV_DIR . 'includes/shortcodes.php';
require_once VV_DIR . 'includes/activator.php';

/**
 * Valores por defecto de los ajustes.
 */
function vv_defaults() {
	return array(
		'ads_enabled'  => 0,
		'ads_client'   => '',
		'slot_top'     => '',
		'slot_bottom'  => '',
		'frame_height' => 82, // en unidades svh
	);
}

/**
 * Ajustes actuales, combinados con los valores por defecto.
 */
function vv_opts() {
	return wp_parse_args( get_option( 'vistaviva_settings', array() ), vv_defaults() );
}

/**
 * Lee un fragmento HTML incluido en el plugin (carpeta assets/).
 */
function vv_read_asset( $rel ) {
	$path = VV_DIR . 'assets/' . ltrim( $rel, '/' );
	if ( ! file_exists( $path ) ) {
		return '';
	}
	return file_get_contents( $path );
}

/**
 * Definición de los artículos (categoría "Salud visual").
 * El archivo de cada uno es assets/articles/{slug}.html
 */
function vv_articles_def() {
	return array(
		array(
			'slug'    => 'regla-20-20-20',
			'title'   => 'La regla 20-20-20 para descansar la vista',
			'excerpt' => 'Cada 20 minutos, mira a 6 metros durante 20 segundos: por qué funciona y cómo aplicarla.',
		),
		array(
			'slug'    => 'fatiga-visual-pantallas',
			'title'   => 'Fatiga visual por pantallas: cómo aliviarla',
			'excerpt' => 'Hábitos y ejercicios sencillos contra el síndrome visual informático.',
		),
		array(
			'slug'    => 'insuficiencia-de-convergencia',
			'title'   => 'Insuficiencia de convergencia: qué es y cómo se entrena',
			'excerpt' => 'Uno de los problemas de visión binocular que mejor responde al entrenamiento.',
		),
		array(
			'slug'    => 'luz-natural-y-miopia',
			'title'   => 'Luz natural y prevención de la miopía',
			'excerpt' => 'Por qué el tiempo al aire libre protege la vista de niños y jóvenes.',
		),
		array(
			'slug'    => 'metodo-bates-mitos',
			'title'   => 'El método Bates y el mito de tirar las gafas',
			'excerpt' => 'Qué ayuda de verdad y qué es solo un mito en los ejercicios visuales.',
		),
	);
}

/**
 * Carga los estilos del frontend y registra el cargador de AdSense si procede.
 */
function vv_enqueue_assets() {
	wp_enqueue_style( 'vistaviva', VV_URL . 'assets/css/vistaviva.css', array(), VV_VERSION );

	$o = vv_opts();
	if ( $o['ads_enabled'] && $o['ads_client'] ) {
		wp_register_script(
			'vistaviva-adsense',
			'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' . rawurlencode( $o['ads_client'] ),
			array(),
			null,
			true
		);
	}
}
add_action( 'wp_enqueue_scripts', 'vv_enqueue_assets' );

/**
 * Añade async + crossorigin al cargador de AdSense, como exige Google.
 */
function vv_adsense_script_tag( $tag, $handle, $src ) {
	if ( 'vistaviva-adsense' === $handle ) {
		$tag = '<script async src="' . esc_url( $src ) . '" crossorigin="anonymous"></script>' . "\n";
	}
	return $tag;
}
add_filter( 'script_loader_tag', 'vv_adsense_script_tag', 10, 3 );

/**
 * Enlace "Ajustes" directo desde la lista de plugins.
 */
function vv_plugin_action_links( $links ) {
	$url = admin_url( 'options-general.php?page=vistaviva' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Ajustes', 'vistaviva' ) . '</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'vv_plugin_action_links' );
