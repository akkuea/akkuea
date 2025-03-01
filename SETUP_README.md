# Akkuea Development Environment Setup Script

This script automates the setup of the development environment for the Akkuea project, which includes a Next.js application using Bun as the package manager.

## Features

- **System Checks**:
  - Verifies Node.js version (requires v20.11.0+)
  - Checks Git installation
  - Ensures required ports are available (port 3000)

- **Core Installation**:
  - Installs Bun package manager (if not already installed)
  - Installs dependencies for the Akkuea project
  - Sets up the Next.js application in the packages/nextjs directory

- **Development Tools Setup**:
  - Sets up Git hooks using Husky
  - Configures environment variables

- **Package.json Fixes**:
  - Fixes incorrect React and Next.js versions
  - Identifies duplicate dependencies
  - Creates backups before making changes

## Prerequisites

- Node.js v20.11.0 or higher
- Git
- macOS, Linux, or WSL (Windows Subsystem for Linux)

## Usage

1. Make the script executable (if not already):
   ```bash
   chmod +x setup-dev-env.sh
   ```

2. Run the script from the Akkuea project root directory:
   ```bash
   ./setup-dev-env.sh
   ```

3. Optional flags:
   ```bash
   # Skip system requirement checks
   ./setup-dev-env.sh --skip-checks
   
   # Fix common package.json issues
   ./setup-dev-env.sh --fix-dependencies
   
   # Display help information
   ./setup-dev-env.sh --help
   ```

## What the Script Does

1. **System Checks**:
   - Verifies that Node.js v20.11.0+ is installed
   - Confirms Git is installed
   - Checks if port 3000 is available for the development server

2. **Bun Installation**:
   - Checks if Bun is already installed
   - If not, installs Bun using the official installer

3. **Project Setup**:
   - Optionally fixes package.json issues (with `--fix-dependencies`)
   - Installs root dependencies for the monorepo
   - Sets up the Next.js application in the packages/nextjs directory

4. **Development Tools Setup**:
   - Sets up Git hooks using Husky (if .husky directory exists)
   - Creates environment variables from example files if needed

## After Setup

After running the setup script, you can:

1. Start the Next.js development server:
   ```bash
   bun --cwd packages/nextjs dev
   ```

2. If port 3000 is already in use, you can specify a different port:
   ```bash
   bun --cwd packages/nextjs dev -- -p 3001
   ```

## Troubleshooting

- **Bun Installation Issues**: If Bun fails to install automatically, you can install it manually by following the instructions at [bun.sh](https://bun.sh).
- **Port 3000 in Use**: If port 3000 is already in use, the script will warn you. You can start the development server on a different port as shown above.
- **Permission Denied**: If you encounter a "Permission denied" error when running the script, make sure it has execution permissions with `chmod +x setup-dev-env.sh`.
- **Not in Project Root**: The script must be run from the Akkuea project root directory (where the packages directory is located).
- **Dependency Installation Errors**: If you encounter errors during dependency installation, try running the script with the `--fix-dependencies` option to fix common package.json issues.
- **Manual Package.json Fixes**: In some cases, you may need to manually edit package.json files if the script identifies duplicate dependencies but can't fix them automatically.

## Contributing

Feel free to submit issues or pull requests to improve this setup script for the Akkuea project. 