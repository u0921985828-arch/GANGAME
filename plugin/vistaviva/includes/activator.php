<?php
/**
 * Al activar el plugin: crea las páginas, los artículos y la categoría.
 * Es idempotente: si una página ya existe (por slug) no la duplica.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Construye el contenido de una página a partir de su definición.
 */
function vv_build_page_content( $p ) {
	// Página de la app: solo el shortcode.
	if ( 'app' === $p['type'] ) {
		return '[vistaviva]';
	}
	// Índice de artículos: menú + tarjeta con el shortcode del índice.
	if ( 'articles_index' === $p['type'] ) {
		return "[vistaviva_menu]\n" . vv_wrap_card( 'Artículos de salud visual', '[vistaviva_articles]' );
	}
	// Página de contenido normal: menú + tarjeta con el fragmento HTML + volver.
	$frag = vv_read_asset( 'content/' . $p['file'] );
	return "[vistaviva_menu]\n" . vv_wrap_card( $p['title'], $frag . vv_back() );
}

/**
 * Inserta una entrada (página o artículo) si no existe ya por slug.
 * Devuelve el ID (nuevo o existente).
 */
function vv_upsert_post( $args, $post_type ) {
	$existing = get_page_by_path( $args['post_name'], OBJECT, $post_type );
	if ( $existing ) {
		return (int) $existing->ID;
	}
	$id = wp_insert_post(
		array_merge(
			array(
				'post_status' => 'publish',
				'post_type'   => $post_type,
			),
			$args
		)
	);
	return ( $id && ! is_wp_error( $id ) ) ? (int) $id : 0;
}

/**
 * Hook de activación.
 */
function vv_activate() {
	// 1) Categoría "Salud visual".
	$cat_id = 0;
	$term   = term_exists( 'salud-visual', 'category' );
	if ( ! $term ) {
		$term = wp_insert_term( 'Salud visual', 'category', array( 'slug' => 'salud-visual' ) );
	}
	if ( ! is_wp_error( $term ) && is_array( $term ) ) {
		$cat_id = (int) $term['term_id'];
	}

	// 2) Páginas.
	$pages = array(
		array( 'slug' => 'vistaviva', 'title' => 'VistaViva', 'type' => 'app' ),
		array( 'slug' => 'articulos', 'title' => 'Artículos', 'type' => 'articles_index' ),
		array( 'slug' => 'acerca-de', 'title' => 'Acerca de VistaViva', 'type' => 'content', 'file' => 'acerca.html' ),
		array( 'slug' => 'politica-de-privacidad', 'title' => 'Política de privacidad', 'type' => 'content', 'file' => 'privacidad.html' ),
		array( 'slug' => 'aviso-legal', 'title' => 'Aviso legal', 'type' => 'content', 'file' => 'aviso-legal.html' ),
		array( 'slug' => 'politica-de-cookies', 'title' => 'Política de cookies', 'type' => 'content', 'file' => 'cookies.html' ),
		array( 'slug' => 'terminos-y-condiciones', 'title' => 'Términos y condiciones', 'type' => 'content', 'file' => 'terminos.html' ),
		array( 'slug' => 'contacto', 'title' => 'Contacto', 'type' => 'content', 'file' => 'contacto.html' ),
	);

	$map = get_option( 'vistaviva_pages', array() );
	foreach ( $pages as $p ) {
		$id = vv_upsert_post(
			array(
				'post_title'   => $p['title'],
				'post_name'    => $p['slug'],
				'post_content' => vv_build_page_content( $p ),
			),
			'page'
		);
		if ( $id ) {
			$map[ $p['slug'] ] = $id;
		}
	}
	update_option( 'vistaviva_pages', $map );

	// 3) Artículos.
	foreach ( vv_articles_def() as $a ) {
		$frag    = vv_read_asset( 'articles/' . $a['slug'] . '.html' );
		$content = "[vistaviva_menu]\n" . vv_wrap_card( $a['title'], $frag . vv_cta() );
		$args    = array(
			'post_title'   => $a['title'],
			'post_name'    => $a['slug'],
			'post_content' => $content,
			'post_excerpt' => $a['excerpt'],
		);
		if ( $cat_id ) {
			$args['post_category'] = array( $cat_id );
		}
		vv_upsert_post( $args, 'post' );
	}

	// 4) Marca la página de privacidad en los ajustes de WordPress.
	if ( ! empty( $map['politica-de-privacidad'] ) ) {
		update_option( 'wp_page_for_privacy_policy', $map['politica-de-privacidad'] );
	}

	// 5) Refresca los enlaces permanentes.
	flush_rewrite_rules();
}
