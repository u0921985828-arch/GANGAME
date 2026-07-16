---
title: "GDD — Memoria Infinita"
date: 2026-07-16
status: published
tags:
  - gamedev
  - gdd
  - memoria
slug: gdd-memoria-infinita
summary: Documento de diseño del juego de memoria endless anti-fatiga.
author: eddie
---

## Pilar de diseño

**No cansar nunca.** El objetivo no es maximizar el reto sino sostener el
*flow*: mantener al jugador en el canal donde la habilidad iguala a la
dificultad, eliminando las dos fuentes de fatiga —el aburrimiento (demasiado
fácil) y la frustración (demasiado difícil)— y la fatiga física (visual y de
presión temporal).

## Bucle central

1. Tablero de `N` parejas boca abajo.
2. Voltear dos cartas: pareja → permanecen; distinta → vuelven a girar.
3. Tablero completo → adaptación de nivel → nueva ronda (sin fin).

## Matriz de adaptación (flow-band)

| Rendimiento de la ronda | Condición (`fallos` vs `parejas`) | Efecto        |
| ----------------------- | --------------------------------- | ------------- |
| Impecable               | `fallos ≤ ⌈parejas·0.34⌉`         | Nivel +1, racha +1 |
| Normal                  | zona intermedia                   | Nivel =, racha +1  |
| Costoso                 | `fallos ≥ ⌈parejas·1.5⌉`          | Nivel −1, racha 0  |

- Rango de nivel: `2 … 8` parejas. Al llegar al techo se **estabiliza** y se
  rota la temática en lugar de crecer sin límite (crecer eterno cansa).
- La racha nunca castiga: es refuerzo positivo, no un recurso que se pierda
  con miedo.

## Sistemas anti-fatiga

- **Sin fail-state / sin cronómetro.** Cero presión; se para y se retoma.
- **Confort ocular.** Recordatorio 20-20-20 cada 5 min de juego activo
  (pausa no bloqueante) + botón de descanso manual.
- **Accesibilidad.** Jugable con teclado, `aria-live` para estado,
  `prefers-reduced-motion`, contraste WCAG-AA, glifos (no solo color).
- **Variedad temática.** 4 sets de símbolos rotan por ronda.
- **Persistencia.** `localStorage` guarda nivel, ronda y racha.

## Estética

Anti-arcade a propósito: paleta índigo-pizarra que "respira", acento jade
sereno, error en ámbar suave (nunca rojo punitivo), giro de carta lento. La
calma es una mecánica.

## Implementación

Un único `static/games/memory/index.html` autocontenido (0 dependencias),
servido por el CMS. Ver la [[memoria|página del juego]].
