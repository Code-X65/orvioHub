# Orviohub Admin Dashboard

Orviohub SaaS platform management and administration dashboard.

---

## Overview

This project is a React + TypeScript single-page application built with Vite and Tailwind CSS. It serves as the administrative interface for platform operations, tenant management, and system governance.

---

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript (Strict mode)
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS v3 + PostCSS + Autoprefixer
- **Build Tool**: Vite v6
- **Linting**: ESLint + TypeScript ESLint

---

## Project Structure

```
admin/
├── public/              Static public assets
├── src/
│   ├── assets/          Static assets and media
│   ├── components/      Reusable UI components
│   ├── pages/           Route pages
│   ├── layouts/         Dashboard & shell layouts
│   ├── hooks/           Custom React hooks
│   ├── utils/           Helper functions & utilities
│   ├── types/           TypeScript type definitions
│   ├── App.tsx          Root application component
│   ├── main.tsx         Application entry point
│   └── index.css        Global stylesheet with Tailwind directives
├── .env.example         Environment variable template
├── .env                 Local environment configuration
├── .eslintrc.cjs        ESLint configuration
├── .gitignore           Git ignore rules
├── .prettierrc          Prettier code formatting rules
├── index.html           HTML entry template
├── package.json         Project dependencies & scripts
├── postcss.config.js    PostCSS configuration
├── tailwind.config.js   Tailwind CSS theme configuration
├── tsconfig.json        TypeScript compiler configuration
├── tsconfig.node.json   Node/Vite TypeScript configuration
└── vite.config.ts       Vite bundler configuration
```

---

## Quick Start

### Install Dependencies
```bash
pnpm install
```

### Start Development Server
```bash
pnpm --filter admin dev
```
The admin dashboard runs locally at `http://localhost:3001`.

### Build for Production
```bash
pnpm --filter admin build
```

### Preview Production Build
```bash
pnpm --filter admin preview
```

### Run Linter
```bash
pnpm --filter admin lint
```
