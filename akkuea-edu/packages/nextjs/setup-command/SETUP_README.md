# Akkuea Development Environment Setup Script

This script automates the setup of essential development tools required to work on the Akkuea project. It features comprehensive OS compatibility checks and enhanced error handling.

## Features

**OS Detection and Compatibility**:

- Automatically detects operating system type (Linux, macOS, Windows)
- Identifies specific Linux distributions (Ubuntu, Debian, Fedora, etc.)
- Adapts commands and processes based on the detected OS
- Provides OS-specific installation suggestions and troubleshooting

**System Checks**:

- Verifies Node.js version (requires v20.11.0+) with OS-specific upgrade paths
- Checks Git installation
- Ensures required ports are available (port 3000) using OS-appropriate methods
- Verifies sufficient disk space (minimum 500MB)

**Development Tools Installation**:

- Installs Bun package manager with OS and architecture validation
- Provides OS-specific installation paths for all required tools
- Validates tool compatibility with your system

**Enhanced Error Handling**:

- Provides detailed, OS-specific error messages and troubleshooting steps
- Identifies processes using required ports
- Gracefully handles command failures with helpful suggestions

## Prerequisites

- Supported operating systems:
  - **Linux**: Most major distributions (Ubuntu, Debian, Fedora, CentOS, Arch)
  - **macOS**: 10.15 Catalina or newer
  - **Windows**: Via Git Bash, MSYS2, or WSL (Windows Subsystem for Linux)

## Usage

1. Make the script executable (if not already):
   ```bash
   chmod +x setup-dev-env.sh
   ```
