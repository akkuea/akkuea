# Building Game Contracts on Windows

Complete guide to set up your Windows environment for building Soroban smart contracts.

## Prerequisites Check

Before starting, verify you have:

- [ ] Rust 1.70+ (check: `rustc --version`)
- [ ] Cargo (check: `cargo --version`)
- [ ] Windows 10/11 (64-bit)

## Step 1: Install Visual Studio Build Tools

The Rust compiler on Windows requires the MSVC (Microsoft Visual C++) toolchain.

### Option A: Install Visual Studio Community (Recommended)

1. Download [Visual Studio Community](https://visualstudio.microsoft.com/downloads/)
2. Run the installer
3. Select "Desktop development with C++" workload
4. In Installation Details, ensure these are selected:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows 11 SDK (or your Windows version)
   - CMake tools for Windows
5. Complete installation (~4-5 GB)

### Option B: Install Build Tools for Visual Studio

1. Download [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/)
2. Run the installer (lightweight, ~1-2 GB)
3. Select "Desktop development with C++"
4. Complete installation

### Verify Installation

```powershell
# Check if MSVC is available
where link.exe

# Should return: C:\Program Files\...\link.exe
```

If `link.exe` is not found, the build tools installation failed. Try reinstalling.

## Step 2: Install Rust WASM Target

```powershell
# Add the WASM target to Rust
rustup target add wasm32-unknown-unknown

# Verify
rustup target list | Select-String wasm32
# Should show: wasm32-unknown-unknown (installed)
```

## Step 3: Configure Environment (Optional)

If you still get linker errors, explicitly set the linker:

```powershell
# Set environment variable
$env:RUSTFLAGS="-C target-cpu=generic"

# Or in PowerShell profile for persistence
Add-Content $PROFILE 'export RUSTFLAGS="-C target-cpu=generic"'
```

## Step 4: Build Game Contracts

```powershell
# Navigate to contracts directory
cd c:\Users\delig\akkuea\apps\contracts

# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# This will take 2-5 minutes on first build
# Subsequent builds are faster
```

### Expected Output

```
Compiling game-land-token v0.0.0
Compiling game-property-nft v0.0.0
Compiling game-marketplace v0.0.0
Compiling game-engine v0.0.0
Finished `release` profile [optimized] target(s) in 124.23s
```

### Verify Build Success

```powershell
# Check built artifacts
ls .\target\wasm32-unknown-unknown\release\*.wasm

# Should show:
# game_land_token.wasm
# game_property_nft.wasm
# game_marketplace.wasm
# game_engine.wasm
```

## Troubleshooting

### Error: "linker `link.exe` not found"

**Solution:** Install Visual Studio Build Tools (see Step 1)

```powershell
# If already installed, try:
rustup install stable
rustup update
```

### Error: "cannot open file 'libcpmt.lib'"

**Solution:** Visual Studio installation incomplete

1. Open "Visual Studio Installer"
2. Click "Modify" on your Visual Studio installation
3. Select "Desktop development with C++"
4. Click "Modify" again
5. Wait for repair/reinstall to complete

### Error: "Windows SDK not found"

**Solution:** Install Windows SDK

```powershell
# Through Visual Studio Installer:
# - Open VS Installer
# - Click Modify
# - Go to "Installation Details"
# - Check "Windows 11 SDK" (or your Windows version)
# - Click Modify
```

### Build is Slow or Hangs

**Solution:** Reduce parallelism

```powershell
# Build with 2 jobs instead of default (CPU count)
cargo build --target wasm32-unknown-unknown --release -j 2
```

### "Out of Memory" During Build

**Solution:** Increase available RAM or use release mode with optimization

```powershell
# Already optimized in Cargo.toml profile.release
# Try building one contract at a time:
cargo build --target wasm32-unknown-unknown --release -p game-land-token
cargo build --target wasm32-unknown-unknown --release -p game-property-nft
cargo build --target wasm32-unknown-unknown --release -p game-marketplace
cargo build --target wasm32-unknown-unknown --release -p game-engine
```

## Running Tests

```powershell
# Run all contract tests
cargo test --all

# Run specific contract tests
cargo test -p game-land-token
cargo test -p game-property-nft
cargo test -p game-marketplace
cargo test -p game-engine

# Run with output
cargo test --all -- --nocapture
```

## Cleaning Build Artifacts

```powershell
# Remove build artifacts to free space
cargo clean

# Rebuild
cargo build --target wasm32-unknown-unknown --release
```

## Next Steps

Once contracts are built successfully:

1. Deploy to testnet: `./scripts/deploy-game-contracts.sh testnet`
2. Record contract IDs in `apps/shared/src/contracts/game-contracts.testnet.json`
3. Update `.env` with new contract IDs
4. Run verification tests

## Additional Resources

- [Rust Installation Guide](https://www.rust-lang.org/tools/install)
- [Soroban Build Documentation](https://soroban.stellar.org/docs/learn/storing-data#test-the-contract)
- [WASM Target Documentation](https://rustwasm.org/docs/book/introduction.html)

## Support

If you continue to have issues:

1. Check Rust compiler version: `rustc --version`
2. Update Rust: `rustup update`
3. Verify Visual Studio components via Visual Studio Installer
4. Clean and rebuild: `cargo clean && cargo build --target wasm32-unknown-unknown --release`
5. Check Soroban docs: https://soroban.stellar.org/
