<?php
/**
 * Desinstalación: borra solo los ajustes. NO borra páginas ni artículos
 * (para no perder tu contenido); si quieres eliminarlos, hazlo a mano.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'vistaviva_settings' );
delete_option( 'vistaviva_pages' );
