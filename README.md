# GANGAME — Markdown/Git CMS

CMS modular donde los archivos `.md` son la base de datos, Git es la
infraestructura de versionado y los hooks son el motor de automatización/CI.

## Estructura

```
.
├── cms.config.json         # Fuente de verdad: colecciones, campos, enums, reglas
├── content/                # Base de datos (Markdown + Frontmatter YAML)
│   ├── posts/
│   └── pages/
├── templates/              # Plantillas de Frontmatter por colección
├── scripts/
│   ├── lib/
│   │   ├── frontmatter.js  # Parser/serializador YAML (subset, 0 deps)
│   │   └── cms.js          # Carga de config + lectura de documentos
│   ├── validate.js         # Validación + auto-fix de Frontmatter y enlaces
│   ├── build-index.js      # Reconstrucción de SEARCH_INDEX.json
│   └── install-hooks.sh    # Instala core.hooksPath=.hooks
├── .hooks/
│   ├── pre-commit          # valida + auto-fix + reindexa + re-stage
│   └── post-merge          # reindexa tras merge/pull
└── SEARCH_INDEX.json       # Índice de búsqueda (generado, determinista)
```

## Instalación

```bash
npm run hooks      # activa los git hooks versionados (idempotente)
```

## Uso

```bash
npm run validate   # valida Frontmatter + enlaces (exit 1 si hay error)
npm run fix        # auto-repara lo seguro y reporta el resto
npm run build      # reconstruye el índice de búsqueda
npm run check      # validate + build
```

## Frontmatter

Cada documento lleva Frontmatter YAML entre `---`. Campos por colección en
`cms.config.json`.

```yaml
---
title: Mi post
date: 2026-07-16          # YYYY-MM-DD
status: published         # draft | review | published | archived
tags:
  - ejemplo
slug: mi-post             # ^[a-z0-9]+(-[a-z0-9]+)*$, único
summary: Resumen corto.
---
```

**Auto-fix seguro** (en `--fix` / pre-commit): frontmatter ausente, `title`
(desde H1 o nombre de archivo), `date` (hoy), `status` (`draft`), `slug`
(desde el nombre), `tags` normalizado a lista.
**Reportado, nunca adivinado:** `status` inválido, `date` malformada, `slug`
que rompe el patrón o duplicado, y enlaces rotos.

## Relaciones

- Wikilinks: `[[slug-destino]]` o `[[slug|texto]]`.
- Enlaces relativos: `[texto](../pages/about.md)`.

Ambos se validan contra el contenido existente en cada commit.

## Colecciones

Definidas en `cms.config.json`. Añadir una nueva:

```json
"notes": {
  "dir": "content/notes",
  "template": "templates/note.md",
  "required": ["title", "status", "slug"],
  "optional": ["tags", "updated"]
}
```

## Automatización (hooks)

- **pre-commit** — `validate.js --fix` + `build-index.js`, re-stage de lo
  modificado. Bloquea el commit si queda algún error no auto-reparable.
- **post-merge** — reconstruye el índice tras `git pull` / `git merge`.

Hooks versionados vía `core.hooksPath=.hooks` (sin copiar a `.git/hooks`).
