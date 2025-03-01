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

# Function to check if a port is available
is_port_available() {
  if command_exists lsof; then
    lsof -i:"$1" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
      return 1
    else
      return 0
    fi
  else
    # Fallback method if lsof is not available
    nc -z localhost "$1" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
      return 1
    else
      return 0
    fi
  fi
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
  echo "  --fix-dependencies Fix common package.json issues"
  echo ""
  echo "This script sets up the development environment for the Akkuea project."
  echo "It performs system checks, installs Bun package manager if needed,"
  echo "and installs all dependencies for the project."
  exit 0
}

# Function to fix common package.json issues
fix_package_json() {
  local package_file=$1
  print_info "Checking package.json for common issues in $package_file..."
  
  if [ ! -f "$package_file" ]; then
    print_warning "Package file $package_file not found"
    return 0  # Return success even if file not found to continue script
  fi
  
  # Create a backup
  cp "$package_file" "${package_file}.bak"
  print_info "Created backup at ${package_file}.bak"
  
  # Simple approach: use sed to fix common issues
  
  # Fix incorrect React version (if it's set to a future version)
  if grep -q '"react": "19' "$package_file" || grep -q '"react-dom": "19' "$package_file"; then
    print_info "Fixing incorrect React version..."
    sed -i.tmp 's/"react": "19/"react": "18/g' "$package_file"
    sed -i.tmp 's/"react-dom": "19/"react-dom": "18/g' "$package_file"
    rm -f "${package_file}.tmp"
  fi
  
  # Fix incorrect Next.js version (if it's set to a future version)
  if grep -q '"next": "15' "$package_file"; then
    print_info "Fixing incorrect Next.js version..."
    sed -i.tmp 's/"next": "15/"next": "14/g' "$package_file"
    rm -f "${package_file}.tmp"
  fi
  
  # For duplicate dependencies, we'll just notify the user
  print_info "Checking for duplicate dependencies (manual fix may be required)..."
  
  # Check for duplicate keys in dependencies
  if grep -q 'dependencies' "$package_file"; then
    DUPLICATES=$(grep -o '"@[^"]*"' "$package_file" | sort | uniq -d)
    if [ -n "$DUPLICATES" ]; then
      print_warning "Found duplicate dependencies in $package_file:"
      echo "$DUPLICATES"
      print_info "You may need to manually edit the file to remove duplicates."
    else
      print_info "No duplicate dependencies found."
    fi
  fi
  
  print_success "Completed package.json checks"
  return 0
}

# ========================================================
# Parse Arguments
# ========================================================

SKIP_CHECKS=false
FIX_DEPENDENCIES=false

for arg in "$@"; do
  case $arg in
    -h|--help)
      show_help
      ;;
    --skip-checks)
      SKIP_CHECKS=true
      shift
      ;;
    --fix-dependencies)
      FIX_DEPENDENCIES=true
      shift
      ;;
    *)
      # Unknown option
      print_warning "Unknown option: $arg"
      ;;
  esac
done

# ========================================================
# System Checks
# ========================================================

if [ "$SKIP_CHECKS" = false ]; then
  print_header "System Checks"

  # Check Node.js version
  if command_exists node; then
    NODE_VERSION=$(node -v | cut -d 'v' -f 2)
    NODE_MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d '.' -f 1)
    
    if [ "$NODE_MAJOR_VERSION" -lt 20 ]; then
      print_error "Node.js version 20.11.0 or higher is required. Current version: $NODE_VERSION"
    else
      print_success "Node.js version $NODE_VERSION is installed"
    fi
  else
    print_error "Node.js is not installed. Please install Node.js 20.11.0 or higher"
  fi

  # Check Git installation
  if command_exists git; then
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
  else
    print_success "Port 3000 is available for Next.js development server"
  fi
fi

# ========================================================
# Bun Installation
# ========================================================

print_header "Bun Installation"

if command_exists bun; then
  BUN_VERSION=$(bun -v)
  print_success "Bun version $BUN_VERSION is already installed"
else
  print_info "Installing Bun package manager..."
  curl -fsSL https://bun.sh/install | bash
  
  # Source the updated profile to make bun available in the current session
  if [ -f "$HOME/.bashrc" ]; then
    source "$HOME/.bashrc"
  elif [ -f "$HOME/.zshrc" ]; then
    source "$HOME/.zshrc"
  fi
  
  if command_exists bun; then
    print_success "Bun has been installed successfully"
  else
    print_error "Failed to install Bun. Please install it manually: https://bun.sh"
  fi
fi

# ========================================================
# Project Setup
# ========================================================

print_header "Akkuea Project Setup"

# Check if we're in the project root
if [ ! -d "packages" ] || [ ! -d "packages/nextjs" ]; then
  print_error "This script must be run from the Akkuea project root directory"
fi

# Fix package.json if requested
if [ "$FIX_DEPENDENCIES" = true ]; then
  print_info "Fixing package.json files..."
  fix_package_json "package.json"
  fix_package_json "packages/nextjs/package.json"
fi

# Continue with installation even if fixing dependencies failed
print_info "Installing root dependencies..."
bun install || {
  print_warning "Failed to install root dependencies with standard method"
  print_info "Trying alternative installation method..."
  
  # Try with --force if normal install fails
  bun install --force || {
    print_error "Failed to install root dependencies"
  }
}

print_success "Root dependencies installed successfully"

# ========================================================
# Next.js Setup
# ========================================================

print_header "Next.js Setup"

print_info "Setting up Next.js application..."
cd packages/nextjs

print_info "Installing Next.js dependencies..."
# Use --no-save to avoid modifying package.json during installation
bun install --no-save || {
  print_warning "Failed to install Next.js dependencies with standard method"
  print_info "Trying alternative installation method..."
  
  # Try with --force if normal install fails
  bun install --force --no-save || {
    if [ "$FIX_DEPENDENCIES" = false ]; then
      print_warning "Installation failed. Try running the script with --fix-dependencies option"
      print_error "Failed to install Next.js dependencies"
    else
      print_warning "Failed to install Next.js dependencies even after fixing package.json"
      print_info "You may need to manually fix the package.json file in packages/nextjs"
      print_info "Continuing with setup..."
    fi
  }
}

print_success "Next.js setup completed"

# Return to project root
cd ../..

# ========================================================
# Development Tools Setup
# ========================================================

print_header "Development Tools Setup"

# Set up Git hooks if .husky directory exists
if [ -d ".husky" ]; then
  print_info "Setting up Git hooks..."
  bun husky install || {
    print_warning "Failed to set up Git hooks. You may need to set them up manually."
  }
  
  print_success "Git hooks set up successfully"
fi

# ========================================================
# Environment Variables
# ========================================================

print_header "Environment Variables Setup"

# Check if .env.local exists in Next.js directory
if [ ! -f "packages/nextjs/.env.local" ] && [ -f "packages/nextjs/.env.example" ]; then
  print_info "Creating .env.local from .env.example..."
  cp packages/nextjs/.env.example packages/nextjs/.env.local
  print_success "Created .env.local file"
else
  print_info "Environment files already set up or no example file found"
fi

# ========================================================
# Final Steps
# ========================================================

print_header "Setup Complete"

print_success "Akkuea development environment has been set up successfully!"

print_info "To start the Next.js development server, run: bun --cwd packages/nextjs dev"

if [ "$PORT_3000_AVAILABLE" = false ]; then
  print_warning "Remember that port 3000 was detected as being in use. You may need to use a different port."
  print_info "To use a different port: bun --cwd packages/nextjs dev -- -p <port_number>"
fi

print_info "Happy coding with Akkuea! 🚀" 