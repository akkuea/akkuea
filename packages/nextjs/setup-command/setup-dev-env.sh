#!/bin/bash

# ========================================================
# Akkuea Development Environment Setup Script
# ========================================================

# Set strict mode
set -e

# Color codes for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================================
# Helper Functions
# ========================================================

# Function to print section headers
print_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Function to print success messages
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error messages and exit
print_error() {
  echo -e "${RED}✗ ERROR: $1${NC}"
  exit 1
}

# Function to print warning messages
print_warning() {
  echo -e "${YELLOW}⚠ WARNING: $1${NC}"
}

# Function to print info messages
print_info() {
  echo -e "ℹ $1"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to detect operating system and version
detect_os() {
  print_info "Detecting operating system..."
  
  # Initialize OS variables
  OS_NAME="Unknown"
  OS_VERSION="Unknown"
  OS_DISTRO="Unknown"
  OS_ARCH=$(uname -m)
  
  # Detect OS type
  case "$(uname -s)" in
    Linux*)
      OS_NAME="Linux"
      
      # Detect Linux distribution
      if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_DISTRO="$NAME"
        OS_VERSION="$VERSION_ID"
        print_success "Detected: $OS_DISTRO $OS_VERSION ($OS_ARCH)"
      else
        # Fallback detection methods
        if command_exists lsb_release; then
          OS_DISTRO=$(lsb_release -si)
          OS_VERSION=$(lsb_release -sr)
          print_success "Detected: $OS_DISTRO $OS_VERSION ($OS_ARCH)"
        elif [ -f /etc/redhat-release ]; then
          OS_DISTRO=$(cat /etc/redhat-release | cut -d ' ' -f 1)
          print_success "Detected: $OS_DISTRO ($OS_ARCH)"
        else
          print_warning "Unable to determine Linux distribution. Some compatibility checks may be skipped."
        fi
      fi
      ;;
      
    Darwin*)
      OS_NAME="macOS"
      OS_VERSION=$(sw_vers -productVersion)
      OS_DISTRO="macOS"
      print_success "Detected: macOS $OS_VERSION ($OS_ARCH)"
      ;;
      
    MINGW*|MSYS*|CYGWIN*)
      OS_NAME="Windows"
      OS_DISTRO="Windows ($(uname -s))"
      print_success "Detected: $OS_DISTRO ($OS_ARCH)"
      print_info "Running in a Unix-like environment on Windows"
      ;;
      
    *)
      print_warning "Unrecognized operating system: $(uname -s)"
      print_warning "Some features may not work correctly"
      ;;
  esac
  
  # Export OS variables for use in other functions
  export OS_NAME
  export OS_VERSION
  export OS_DISTRO
  export OS_ARCH
}

# Function to check command compatibility with current OS
check_command_compatibility() {
  local cmd=$1
  local required=$2
  local suggestion=$3
  
  if ! command_exists "$cmd"; then
    if [ "$required" = "true" ]; then
      print_warning "Required command '$cmd' is not available on $OS_DISTRO"
      
      # OS-specific installation suggestions
      case "$OS_NAME" in
        Linux)
          case "$OS_DISTRO" in
            *Ubuntu*|*Debian*)
              print_info "Try installing with: sudo apt update && sudo apt install $suggestion"
              ;;
            *Fedora*|*Red\ Hat*|*CentOS*)
              print_info "Try installing with: sudo dnf install $suggestion"
              ;;
            *Arch*)
              print_info "Try installing with: sudo pacman -S $suggestion"
              ;;
            *)
              print_info "Please install '$cmd' using your distribution's package manager"
              ;;
          esac
          ;;
        macOS)
          if command_exists brew; then
            print_info "Try installing with: brew install $suggestion"
          else
            print_info "Consider installing Homebrew (https://brew.sh) and then run: brew install $suggestion"
          fi
          ;;
        Windows)
          print_info "Please install '$cmd' manually for your Windows environment"
          ;;
      esac
      
      return 1
    else
      print_info "Optional command '$cmd' is not available. Some features may be limited."
      return 0
    fi
  fi
  
  # Check for known command compatibility issues
  case "$cmd" in
    curl)
      if [ "$OS_NAME" = "Windows" ]; then
        print_info "Using curl on Windows. SSL certificate verification might behave differently than on Unix systems."
      fi
      ;;
    lsof)
      if [ "$OS_NAME" = "Windows" ]; then
        print_warning "'lsof' on Windows may have limited functionality. Port checks might be unreliable."
      fi
      ;;
    bun)
      if [ "$OS_NAME" = "Windows" ] && [ "$OS_DISTRO" != "Windows (MSYS_NT"* ]; then
        print_warning "Bun support on Windows is experimental and may have issues."
      elif [ "$OS_NAME" = "Linux" ] && [ "$OS_ARCH" != "x86_64" ] && [ "$OS_ARCH" != "aarch64" ]; then
        print_warning "Bun may not be fully supported on $OS_ARCH architecture."
      fi
      ;;
  esac
  
  return 0
}

# Function to check if a port is available with OS-specific methods
is_port_available() {
  local port=$1
  
  # Check port availability based on OS
  case "$OS_NAME" in
    Linux|macOS)
      if command_exists lsof; then
        lsof -i:"$port" >/dev/null 2>&1
        if [ $? -eq 0 ]; then
          return 1
        else
          return 0
        fi
      elif command_exists nc; then
        # Fallback method if lsof is not available
        nc -z localhost "$port" >/dev/null 2>&1
        if [ $? -eq 0 ]; then
          return 1
        else
          return 0
        fi
      elif command_exists ss; then
        # Another fallback using ss command
        ss -tuln | grep ":$port " >/dev/null 2>&1
        if [ $? -eq 0 ]; then
          return 1
        else
          return 0
        fi
      else
        print_warning "Cannot check port availability: neither lsof, nc, nor ss is available"
        print_info "Assuming port $port is available"
        return 0
      fi
      ;;
    Windows)
      if command_exists netstat; then
        netstat -an | grep "LISTENING" | grep ":$port " >/dev/null 2>&1
        if [ $? -eq 0 ]; then
          return 1
        else
          return 0
        fi
      else
        print_warning "Cannot check port availability on Windows: netstat not available"
        print_info "Assuming port $port is available"
        return 0
      fi
      ;;
    *)
      print_warning "Port checking not supported on $OS_NAME"
      print_info "Assuming port $port is available"
      return 0
      ;;
  esac
}

# Function to check disk space with OS-specific methods
check_disk_space() {
  local required_mb=$1
  local available_mb=0
  
  print_info "Checking available disk space..."
  
  case "$OS_NAME" in
    Linux|macOS)
      if command_exists df; then
        # Get available space in KB and convert to MB
        available_mb=$(df -k . | awk 'NR==2 {print int($4/1024)}')
        print_info "Available disk space: ${available_mb}MB"
        
        if [ "$available_mb" -lt "$required_mb" ]; then
          print_warning "Low disk space: ${available_mb}MB available, ${required_mb}MB recommended"
          return 1
        fi
      else
        print_warning "Cannot check disk space: df command not available"
      fi
      ;;
    Windows)
      print_warning "Disk space check not implemented for Windows"
      ;;
    *)
      print_warning "Disk space check not supported on $OS_NAME"
      ;;
  esac
  
  return 0
}

# Function to prompt user for confirmation
confirm() {
  read -p "$1 (y/n): " response
  case "$response" in
    [yY][eE][sS]|[yY]) 
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Function to display help
show_help() {
  echo "Akkuea Development Environment Setup Script"
  echo ""
  echo "Usage: ./setup-dev-env.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -h, --help         Display this help message and exit"
  echo "  --skip-checks      Skip system requirement checks"
  echo ""
  echo "This script sets up the development tools for the Akkuea project."
  echo "It performs system checks and installs required tools like Node.js, Git, and Bun."
  exit 0
}

# Function to install Bun with OS-specific considerations
install_bun() {
  print_info "Installing Bun package manager..."
  
  # Check curl compatibility first
  if ! check_command_compatibility "curl" "true" "curl"; then
    print_error "curl is required to install Bun"
  fi
  
  # OS-specific installation methods
  case "$OS_NAME" in
    Linux)
      if [ "$OS_ARCH" = "x86_64" ] || [ "$OS_ARCH" = "aarch64" ]; then
        curl -fsSL https://bun.sh/install | bash
      else
        print_error "Bun is not officially supported on $OS_ARCH architecture"
      fi
      ;;
    macOS)
      if [ "$OS_ARCH" = "x86_64" ] || [ "$OS_ARCH" = "arm64" ]; then
        curl -fsSL https://bun.sh/install | bash
      else
        print_error "Bun is not officially supported on $OS_ARCH architecture"
      fi
      ;;
    Windows)
      if [ "$OS_DISTRO" = "Windows (MSYS_NT"* ] || [ "$OS_DISTRO" = "Windows (MINGW"* ]; then
        print_warning "Bun on Windows is experimental and may have issues"
        curl -fsSL https://bun.sh/install | bash
      else
        print_error "Bun installation via this script is only supported in MSYS/MINGW environments on Windows"
        print_info "Please follow the manual installation instructions at https://bun.sh/docs/installation"
      fi
      ;;
    *)
      print_error "Bun installation is not supported on $OS_NAME"
      ;;
  esac
  
  # Source the updated profile to make bun available in the current session
  if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
  elif [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc"
  fi
  
  # Add Bun to PATH for the current session if it's not already available
  if ! command_exists bun; then
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  
  if command_exists bun; then
    print_success "Bun has been installed successfully"
  else
    print_error "Failed to install Bun. Please install it manually: https://bun.sh"
  fi
}

# ========================================================
# Parse Arguments
# ========================================================

SKIP_CHECKS=false

for arg in "$@"; do
  case $arg in
    -h|--help)
      show_help
      ;;
    --skip-checks)
      SKIP_CHECKS=true
      shift
      ;;
    *)
      # Unknown option
      print_warning "Unknown option: $arg"
      ;;
  esac
done

# ========================================================
# OS Detection
# ========================================================

print_header "Operating System Detection"
detect_os

# ========================================================
# System Checks
# ========================================================

if [ "$SKIP_CHECKS" = false ]; then
  print_header "System Checks"

  # Check Node.js version with OS-specific considerations
  if check_command_compatibility "node" "true" "nodejs"; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d '.' -f 1)
    
    if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
      print_warning "Node.js version 20.11.0 or higher is required. Current version: $NODE_VERSION"
      
      # OS-specific upgrade suggestions
      case "$OS_NAME" in
        Linux)
          case "$OS_DISTRO" in
            *Ubuntu*|*Debian*)
              print_info "Consider upgrading Node.js using:"
              print_info "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
              print_info "sudo apt-get install -y nodejs"
              ;;
            *Fedora*|*Red\ Hat*|*CentOS*)
              print_info "Consider upgrading Node.js using:"
              print_info "curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -"
              ;;
            *)
              print_info "Consider upgrading Node.js using a version manager like nvm"
              print_info "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash"
              ;;
          esac
          ;;
        macOS)
          if command_exists brew; then
            print_info "Consider upgrading Node.js using: brew install node@20"
          else
            print_info "Consider installing Node.js from https://nodejs.org/en/download/"
          fi
          ;;
        Windows)
          print_info "Consider upgrading Node.js from https://nodejs.org/en/download/"
          ;;
      esac
      
      if ! confirm "Continue with Node.js $NODE_VERSION?"; then
        print_error "Setup aborted. Please upgrade Node.js and try again."
      fi
    else
      print_success "Node.js version $NODE_VERSION is installed"
    fi
  else
    print_error "Node.js is not installed. Please install Node.js 20.11.0 or higher"
  fi

  # Check Git installation
  if check_command_compatibility "git" "true" "git"; then
    GIT_VERSION=$(git --version | cut -d ' ' -f 3)
    print_success "Git version $GIT_VERSION is installed"
  else
    print_error "Git is not installed. Please install Git"
  fi

  # Check if required ports are available
  PORT_3000_AVAILABLE=true
  if ! is_port_available 3000; then
    PORT_3000_AVAILABLE=false
    print_warning "Port 3000 is already in use. Next.js development server might not start properly"
    
    # Suggest alternative ports based on OS
    case "$OS_NAME" in
      Linux|macOS)
        if command_exists lsof; then
          PROCESS=$(lsof -i:3000 -sTCP:LISTEN -t)
          if [ -n "$PROCESS" ]; then
            PROCESS_NAME=$(ps -p "$PROCESS" -o comm=)
            print_info "Port 3000 is being used by process: $PROCESS_NAME (PID: $PROCESS)"
          fi
        fi
        ;;
      Windows)
        if command_exists netstat && command_exists tasklist; then
          PID=$(netstat -ano | grep ":3000" | grep "LISTENING" | awk '{print $5}')
          if [ -n "$PID" ]; then
            PROCESS_NAME=$(tasklist | grep "$PID" | awk '{print $1}')
            print_info "Port 3000 is being used by process: $PROCESS_NAME (PID: $PID)"
          fi
        fi
        ;;
    esac
    
    print_info "You can use a different port with: bun --cwd packages/nextjs dev -- -p 3001"
  else
    print_success "Port 3000 is available for Next.js development server"
  fi
  
  # Check disk space (minimum 500MB free)
  check_disk_space 500
fi

# ========================================================
# Bun Installation
# ========================================================

print_header "Bun Installation"

if command_exists bun; then
  BUN_VERSION=$(bun -v)
  print_success "Bun version $BUN_VERSION is already installed"
  
  # Check Bun compatibility with current OS
  check_command_compatibility "bun" "true" "bun"
else
  install_bun
fi

# ========================================================
# Final Steps
# ========================================================

print_header "Setup Complete"

print_success "Akkuea development tools have been set up successfully!"

print_info "The following tools are now available:"
print_info "- Node.js: For JavaScript runtime"
print_info "- Git: For version control"
print_info "- Bun: For package management and running the application"

print_info "You can now work with the Akkuea project using these tools."
print_info "To start the development server, navigate to the project directory and run:"
print_info "bun --cwd packages/nextjs dev"

if [ "$PORT_3000_AVAILABLE" = false ]; then
  print_warning "Remember that port 3000 was detected as being in use. You may need to use a different port."
  print_info "To use a different port: bun --cwd packages/nextjs dev -- -p <port_number>"
fi

# Log OS information for troubleshooting
print_info "Setup completed on: $OS_DISTRO $OS_VERSION ($OS_ARCH)"
print_info "Happy coding with Akkuea! 🚀"

