### Akkuea Development Environment Setup Script

This script automates the setup of the development environment for the Akkuea project, which includes a Next.js application using Bun as the package manager. It features comprehensive OS compatibility checks and enhanced error handling.

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



**Core Installation**:

- Installs Bun package manager with OS and architecture validation
- Installs dependencies with OS-specific optimizations
- Sets up the Next.js application in the packages/nextjs directory



**Development Tools Setup**:

- Sets up Git hooks using Husky with OS-specific handling
- Configures environment variables



**Package.json Fixes**:

- Fixes incorrect React and Next.js versions with OS-compatible sed commands
- Identifies duplicate dependencies
- Creates backups before making changes



**Enhanced Error Handling**:

- Provides detailed, OS-specific error messages and troubleshooting steps
- Identifies processes using required ports
- Gracefully handles command failures with helpful suggestions





## Prerequisites

- Node.js v20.11.0 or higher
- Git
- Supported operating systems:

**Linux**: Most major distributions (Ubuntu, Debian, Fedora, CentOS, Arch)
**macOS**: 10.15 Catalina or newer
**Windows**: Via Git Bash, MSYS2, or WSL (Windows Subsystem for Linux)





## Usage

1. Make the script executable (if not already):

```shellscript
chmod +x setup-dev-env.sh
```


2. Run the script from the Akkuea project root directory:

```shellscript
./setup-dev-env.sh
```


3. Optional flags:

```shellscript
# Skip system requirement checks
./setup-dev-env.sh --skip-checks

# Fix common package.json issues
./setup-dev-env.sh --fix-dependencies

# Display help information
./setup-dev-env.sh --help
```




## What the Script Does

**OS Detection**:

1. Identifies your operating system, distribution, version, and architecture
2. Adapts subsequent operations to be compatible with your environment
3. Logs OS information for troubleshooting purposes



**System Checks**:

1. Verifies that Node.js v20.11.0+ is installed with OS-specific upgrade suggestions
2. Confirms Git is installed
3. Checks if port 3000 is available using OS-appropriate commands (lsof, netstat, ss)
4. Identifies which process is using port 3000 if it's unavailable
5. Verifies sufficient disk space using OS-specific methods



**Bun Installation**:

1. Checks if Bun is already installed
2. Validates OS and architecture compatibility before installation
3. Installs Bun using the official installer with OS-specific adaptations
4. Provides warnings for experimental platforms (Windows) or unsupported architectures



**Project Setup**:

1. Optionally fixes package.json issues (with `--fix-dependencies`)
2. Uses OS-compatible sed commands for text replacements
3. Installs root dependencies with OS-specific timeout settings
4. Sets up the Next.js application with appropriate error handling



**Development Tools Setup**:

1. Sets up Git hooks using Husky with OS-specific handling
2. Creates environment variables from example files if needed





## After Setup

After running the setup script, you can:

1. Start the Next.js development server:

```shellscript
bun --cwd packages/nextjs dev
```


2. If port 3000 is already in use, you can specify a different port:

```shellscript
bun --cwd packages/nextjs dev -- -p 3001
```




## OS-Specific Considerations

### Linux

- Package installation suggestions use the appropriate package manager (apt, dnf, pacman)
- Architecture compatibility is verified for tools like Bun
- Port checking uses lsof, netstat, or ss depending on availability


### macOS

- Compatible with both Intel and Apple Silicon processors
- Uses Homebrew for package installation suggestions when available
- Handles macOS-specific sed command differences


### Windows

- Supported through Git Bash, MSYS2, or similar Unix-like environments
- Extended timeouts for package installation to accommodate slower file operations
- Alternative port checking methods when standard Unix tools aren't available
- Special handling for Windows-specific path issues


## Troubleshooting

**OS Compatibility Issues**: If you encounter OS-specific problems, check the script output for detailed information about your detected OS and any compatibility warnings.
**Bun Installation Issues**:

**Linux**: Ensure you're using a supported architecture (x86_64 or aarch64)
**macOS**: Ensure you're using a supported architecture (x86_64 or arm64)
**Windows**: Bun support is experimental on Windows; use Git Bash or MSYS2



**Port 3000 in Use**: The script will identify which process is using port 3000 if available. You can:

- Stop the conflicting process
- Use a different port as shown in the "After Setup" section



**Node.js Version Issues**: The script provides OS-specific upgrade suggestions if your Node.js version is too old.
**Permission Denied**: If you encounter a "Permission denied" error when running the script, make sure it has execution permissions with `chmod +x setup-dev-env.sh`.
**Not in Project Root**: The script must be run from the Akkuea project root directory (where the packages directory is located).
**Dependency Installation Errors**:

- If you encounter errors during dependency installation, try running the script with the `--fix-dependencies` option
- On Windows, try running with extended timeouts if installation times out



**Manual Package.json Fixes**: In some cases, you may need to manually edit package.json files if the script identifies duplicate dependencies but can't fix them automatically.
**Command Not Found Errors**: The script will suggest how to install missing required commands based on your OS.


## Script Implementation Details

### OS Detection

The script uses a combination of `uname`, `/etc/os-release`, and other system files to accurately detect:

- Operating system type (Linux, macOS, Windows)
- Distribution name and version (for Linux)
- System architecture (x86_64, arm64, etc.)


This information is used to tailor the setup process to your specific environment.

### Command Compatibility

The script checks for the availability of required commands and provides OS-specific installation instructions when they're missing:

- For Linux, it suggests the appropriate package manager command (apt, dnf, pacman)
- For macOS, it suggests Homebrew when available
- For Windows, it provides manual installation guidance


### Port Checking

The script uses different methods to check port availability based on your OS:

- On Linux/macOS: lsof, netstat, or ss (in order of preference)
- On Windows: netstat with appropriate flags
- When a port is in use, it attempts to identify the process name and PID


### Disk Space Verification

The script checks available disk space using OS-specific methods:

- On Linux/macOS: df command with appropriate flags
- Warns if available space is below the recommended 500MB


### Bun Installation

The script handles Bun installation with OS-specific considerations:

- Verifies architecture compatibility before attempting installation
- Provides clear warnings for experimental platforms
- Adds Bun to PATH using the appropriate method for your shell


### Package.json Fixes

The script handles differences in text processing commands:

- Uses OS-compatible sed syntax (macOS requires different flags)
- Creates backups before making any changes
- Provides detailed logs of all modifications


### Error Handling

The script includes comprehensive error handling:

- Provides OS-specific troubleshooting steps for common errors
- Attempts alternative approaches when standard methods fail
- Logs detailed information to help diagnose issues


## Security Considerations

- The script uses official installation methods for Bun
- No sudo/administrator privileges are required except for package installation (which is suggested but not performed automatically)
- All modifications are limited to the project directory
- Backups are created before modifying any files


## Performance Optimizations

- OS-specific timeout settings for Windows to accommodate slower file operations
- Conditional execution of commands based on OS to avoid unnecessary operations
- Fallback methods when primary commands are unavailable

## Contributing

Feel free to submit issues or pull requests to improve this setup script for the Akkuea project. When reporting issues, please include:

- Your operating system, distribution, and version
- The full script output including any error messages
- Steps to reproduce the issue