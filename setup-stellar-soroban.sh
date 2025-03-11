!/bin/bash
set -e  # Exit on error
set -o pipefail

# Check for OS
OS=$(uname -s)
if [[ "$OS" != "Darwin" && "$OS" != "Linux" ]]; then
  echo "Unsupported OS: $OS"
  exit 1
fi

# Usage function
usage() {
  echo "Usage: $0 [--rust <version>] [--soroban <version>]"
  echo "  --rust: Specify the version of Rust to install (default: latest stable)"
  echo "  --soroban: Specify the version of Soroban CLI to install (default: latest)"
  exit 1
}

# Default versions
RUST_VERSION="stable"
SOROBAN_VERSION="latest"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --rust)
      RUST_VERSION="$2"
      shift 2
      ;;
    --soroban)
      SOROBAN_VERSION="$2"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

# Install system dependencies
install_dependencies() {
  echo "Installing system dependencies..."
  if [[ "$OS" == "Linux" ]]; then
    sudo apt update
    sudo apt install -y curl git build-essential pkg-config libssl-dev clang llvm
  elif [[ "$OS" == "Darwin" ]]; then
    if ! command -v brew &>/dev/null; then
      echo "Homebrew is not installed. Installing Homebrew..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew update
    brew install curl git pkg-config openssl@3 llvm wasm-pack binaryen
  fi
  echo "System dependencies installed successfully!"
}

# Install Rust
install_rust() {
  echo "Installing Rust ($RUST_VERSION)..."
  if ! command -v rustup &>/dev/null; then
    echo "rustup is not installed. Installing rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain "$RUST_VERSION"
    source "$HOME/.cargo/env"
  else
    echo "Rust is already installed. Updating to the specified version..."
    rustup toolchain install "$RUST_VERSION"
    rustup default "$RUST_VERSION"
  fi
  echo "Rust ($RUST_VERSION) installed successfully!"
}

# Add wasm32-unknown-unknown target
add_wasm_target() {
  echo "Adding Rust target: wasm32-unknown-unknown..."
  rustup target add wasm32-unknown-unknown
  echo "wasm32-unknown-unknown target added successfully!"
}

# Install Soroban CLI
install_soroban() {
  echo "Installing Soroban CLI ($SOROBAN_VERSION)..."
  if [[ "$SOROBAN_VERSION" == "latest" ]]; then
    cargo install --locked soroban-cli
  else
    cargo install --locked soroban-cli --version "$SOROBAN_VERSION"
  fi
  echo "Soroban CLI ($SOROBAN_VERSION) installed successfully!"
}

# Install additional tools
install_additional_tools() {
  echo "Installing additional tools: wasm-pack, binaryen, and cargo-wasi..."

  if [[ "$OS" == "Darwin" ]]; then
    echo "Ensuring wasm-pack and binaryen are installed via Homebrew..."
    brew install wasm-pack binaryen
  else
    echo "wasm-pack and binaryen are only installed automatically on macOS. Please install them manually on Linux."
  fi

  echo "Installing cargo-wasi via cargo..."
  cargo install cargo-wasi

  echo "Additional tools installed successfully!"
}

# Main function
main() {
  install_dependencies
  install_rust
  add_wasm_target
  install_soroban
  install_additional_tools
  echo "All tools have been installed successfully!"
}

main