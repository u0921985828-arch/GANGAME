<?php
/**
 * Página de ajustes: Ajustes → VistaViva.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function vv_admin_menu() {
	add_options_page(
		'VistaViva',
		'VistaViva',
		'manage_options',
		'vistaviva',
		'vv_settings_page'
	);
}
add_action( 'admin_menu', 'vv_admin_menu' );

function vv_register_settings() {
	register_setting( 'vistaviva_group', 'vistaviva_settings', 'vv_sanitize_settings' );
}
add_action( 'admin_init', 'vv_register_settings' );

/**
 * Saneado de los ajustes antes de guardar.
 */
function vv_sanitize_settings( $in ) {
	$out                 = vv_defaults();
	$out['ads_enabled']  = ! empty( $in['ads_enabled'] ) ? 1 : 0;
	$out['ads_client']   = isset( $in['ads_client'] ) ? sanitize_text_field( $in['ads_client'] ) : '';
	$out['slot_top']     = isset( $in['slot_top'] ) ? sanitize_text_field( $in['slot_top'] ) : '';
	$out['slot_bottom']  = isset( $in['slot_bottom'] ) ? sanitize_text_field( $in['slot_bottom'] ) : '';
	$fh                  = isset( $in['frame_height'] ) ? intval( $in['frame_height'] ) : 82;
	$out['frame_height'] = max( 50, min( 95, $fh ) );
	return $out;
}

/**
 * Render de la página de ajustes.
 */
function vv_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$o        = vv_opts();
	$app_page = get_page_by_path( 'vistaviva', OBJECT, 'page' );
	?>
	<div class="wrap">
		<h1>VistaViva</h1>
		<p>La aplicación funciona sin anuncios por defecto. Rellena estos campos
		cuando Google AdSense te apruebe para empezar a mostrar publicidad
		<strong>alrededor</strong> de la app (nunca durante los ejercicios).</p>

		<form action="options.php" method="post">
			<?php settings_fields( 'vistaviva_group' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">Mostrar anuncios</th>
					<td>
						<label>
							<input type="checkbox" name="vistaviva_settings[ads_enabled]" value="1" <?php checked( $o['ads_enabled'], 1 ); ?> />
							Activar los anuncios de AdSense
						</label>
						<p class="description">Si está desactivado, no se carga ningún script de Google.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="vv_client">ID de editor</label></th>
					<td>
						<input type="text" id="vv_client" class="regular-text" name="vistaviva_settings[ads_client]"
							value="<?php echo esc_attr( $o['ads_client'] ); ?>" placeholder="ca-pub-XXXXXXXXXXXXXXXX" />
						<p class="description">Tu identificador de AdSense (empieza por <code>ca-pub-</code>).</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="vv_slot_top">Slot superior</label></th>
					<td>
						<input type="text" id="vv_slot_top" class="regular-text" name="vistaviva_settings[slot_top]"
							value="<?php echo esc_attr( $o['slot_top'] ); ?>" placeholder="1234567890" />
						<p class="description">ID del bloque de anuncio que aparece encima de la app.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="vv_slot_bottom">Slot inferior</label></th>
					<td>
						<input type="text" id="vv_slot_bottom" class="regular-text" name="vistaviva_settings[slot_bottom]"
							value="<?php echo esc_attr( $o['slot_bottom'] ); ?>" placeholder="0987654321" />
						<p class="description">ID del bloque de anuncio que aparece debajo de la app.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="vv_fh">Alto del marco</label></th>
					<td>
						<input type="number" id="vv_fh" name="vistaviva_settings[frame_height]" min="50" max="95" step="1"
							value="<?php echo esc_attr( $o['frame_height'] ); ?>" /> % de la pantalla (svh)
						<p class="description">Alto del marco de la app en pantallas grandes (se limita a 980&nbsp;px). Por defecto 82.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<hr />
		<h2>Cómo se usa</h2>
		<ul style="list-style:disc;padding-left:22px;max-width:720px">
			<li>Al activar el plugin se crean 8 páginas y 5 artículos ya enlazados.
				La página de inicio de la app es
				<?php if ( $app_page ) : ?>
					<a href="<?php echo esc_url( get_permalink( $app_page->ID ) ); ?>" target="_blank" rel="noreferrer"><strong>VistaViva</strong></a>.
				<?php else : ?>
					<strong>VistaViva</strong> (vuelve a activar el plugin si no aparece).
				<?php endif; ?>
			</li>
			<li>Para poner la app en cualquier otra página, usa el shortcode
				<code>[vistaviva]</code>. Para la barra de menú, <code>[vistaviva_menu]</code>.</li>
			<li>Sube tu <code>ads.txt</code> a la raíz del dominio
				(<code>https://tudominio.com/ads.txt</code>) con tu línea de editor.</li>
			<li>Si tu público es europeo, activa una CMP de consentimiento
				(mensaje de Google en AdSense → Privacidad y mensajes, o un plugin
				como Complianz/CookieYes).</li>
			<li>Revisa y rellena tus datos reales (titular, NIF, dirección, email)
				en las páginas legales.</li>
		</ul>
	</div>
	<?php
}
