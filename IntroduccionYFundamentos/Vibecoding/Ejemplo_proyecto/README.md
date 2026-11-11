# Plantilla del curso de vibecoding

Este repositorio es el punto de partida de tu proyecto. No trae código de aplicación, sino las instrucciones para que tu agente (Claude Code u OpenCode) trabaje con orden. Sirve para una página HTML, una app de Streamlit en Python u otra cosa.

## Cómo empezar

1. Pulsa **Use this template** en GitHub y clona tu nuevo repositorio.
2. Rellena `docs/project-info.md`.
3. Copia `.env.example` a `.env` (`cp .env.example .env`; en Windows, `copy .env.example .env`).
4. Abre Claude Code u OpenCode en la carpeta.

## Qué hace cada archivo

- `AGENTS.md`: las normas de trabajo del agente.
- `CLAUDE.md`: hace que Claude Code lea `AGENTS.md`.
- `PLAN.md`: las fases del proyecto y lo que falta por hacer.
- `README.md`: esta guía.
- `.env.example`: los nombres de las claves, sin valores.
- `.gitignore`: lo que git no debe subir, como `.env`.
- `docs/project-info.md`: la descripción de tu app.
- `e2e/README.md`: dónde van los tests de extremo a extremo.

## Los dos archivos de contexto

- `docs/project-info.md` dice **qué es la app** y cambia en cada proyecto.
- `AGENTS.md` dice **cómo se trabaja** y es igual en todos.

## Primer prompt sugerido

> Lee AGENTS.md, docs/project-info.md y PLAN.md, y propón el plan para la Fase 0. No escribas código todavía.

## Recuerda

El push lo haces tú, después de revisar con `git status` que `.env` no aparece.

Si usas GitHub, instala `gh` y haz `gh auth login` una vez. Así el agente podrá abrir pull requests, siempre pidiéndote permiso antes.
