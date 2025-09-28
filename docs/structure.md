# Akkuea Project Structure Documentation

This document describes the folder structure and key files of the **Akkuea** project. Its goal is to facilitate understanding and collaboration within the team.

## Table of Contents

- [Overall Project Structure](#overall-project-structure)
- [Key Files and Folders](#key-files-and-folders)
  - [package.json](#packagejson)
  - [tsconfig.json](#tsconfigjson)
  - [README.md](#readmemd)
  - [User Interface Components](#user-interface-components)
  - [Database Schema](#database-schema)
  - [Hooks, Utils, and Libraries (lib)](#hooks-utils-and-libraries-lib)
- [References](#references)

---

## Overall Project Structure

```text
akkuea/
├── package.json
├── README.md
├── docs/
│   ├── README.md
│   └── structure.md
├── packages/
│   ├── agent/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── README.md
│   │   ├── public/
│   │   │   └── json/
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       │   └── ui/
│   │       └── lib/
│   ├── assistant/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── app/
│   │   ├── components/
│   │   │   └── ui/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── public/
│   ├── gin/
│   │   ├── go.mod
│   │   └── akkuea/
│   │       └── main.go
│   ├── nextjs/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── store/
│   └── soroban/
│       ├── README.md
│       └── contracts/
│           ├── content-search-contract/
│           ├── contributor-reputation-contract/
│           └── ...
```

> **Note:** Each subfolder in `packages/` represents a module or microservice of the project. The structure above is simplified; see each package for more details.

## Key Files and Folders

### package.json

The `package.json` file at the root defines the main project metadata, scripts, dependencies, and engines for the monorepo. Each package (e.g., `agent`, `assistant`, `nextjs`) also contains its own `package.json` to manage local dependencies and scripts.

- **Root `package.json`**: Manages workspace-wide scripts (format, lint, test, build), shared dev dependencies, and monorepo settings.
- **Package-level `package.json`**: Handles dependencies and scripts specific to each module (frontend, backend, etc.).

### tsconfig.json

Each TypeScript-based package contains a `tsconfig.json` file that configures the TypeScript compiler options for that module. These files define strictness, module resolution, JSX support, and path aliases, ensuring consistent type checking and build behavior across the monorepo.

- **Common options**: `strict`, `noEmit`, `esModuleInterop`, `moduleResolution`, `paths`, etc.
- **Customization**: Each package can extend or override settings as needed for its context (e.g., frontend vs. backend).

### README.md

The root `README.md` provides an overview of the Akkuea project, its mission, features, and high-level structure. Each package and contract may also include its own `README.md` with specific setup, usage, and development instructions.

- **Root README**: Project vision, getting started, monorepo structure, and contribution guidelines.
- **Package/contract README**: Local setup, scripts, and technical notes.

### User Interface Components

UI components are mainly located in:

- `packages/assistant/components/`
- `packages/nextjs/src/components/`

These folders contain reusable React components, UI primitives (e.g., `ui/`), and feature-specific components. Components are organized by domain and type, supporting modular and scalable UI development.

### Database Schema

Database-related code and schema definitions are primarily found in:

- `packages/gin/akkuea/` (Go backend, may define models and migrations)
- `packages/soroban/contracts/` (Smart contracts for blockchain-based data)

Each contract folder may contain schema definitions, logic, and documentation for on-chain data structures.

### Hooks, Utils, and Libraries (lib)

Custom React hooks and utility functions are organized in:

- `packages/assistant/hooks/` and `packages/assistant/lib/`
- `packages/nextjs/src/hooks/` and `packages/nextjs/src/lib/`

These provide reusable logic, helpers, and abstractions for both UI and business logic across the project.

## References

- [Main README](../README.md)
- [Cursor](https://www.cursor.com/)
- [Integrate Cursor AI into Existing Projects](https://www.arsturn.com/blog/integrate-cursor-ai-existing-projects)
- [Cursor AI Code Editor Tutorial - DataCamp](https://www.datacamp.com/tutorial/cursor-ai-code-editor)
