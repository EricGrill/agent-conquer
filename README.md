# Agent Conquer

A TypeScript monorepo for building intelligent agent systems.

## Overview

Agent Conquer is a workspace-based TypeScript project designed for developing scalable agent applications. It uses a monorepo structure to organize packages and shared configurations.

## Features

- **Monorepo Structure**: Organized workspaces for modular development
- **TypeScript**: Full TypeScript support with strict type checking
- **Testing**: Vitest for unit and integration testing
- **Linting**: ESLint with TypeScript support
- **Workspace Scripts**: Shared development and build scripts

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/EricGrill/agent-conquer.git
cd agent-conquer

# Install dependencies
npm install

# Build all packages
npm run build
```

### Development

```bash
# Start development mode
npm run dev

# Run tests
npm test

# Run integration tests
npm run test:integration

# Lint code
npm run lint
```

## Project Structure

```
agent-conquer/
├── packages/          # Workspace packages
├── scripts/           # Development and build scripts
├── docs/             # Documentation
├── package.json      # Root package configuration
└── tsconfig.base.json # Shared TypeScript configuration
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

See `.env.example` for available configuration options.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](./CONTRIBUTING.md) for details on how to get started.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
