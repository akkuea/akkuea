.PHONY: build test clean deploy check fmt

# Build the contract
build:
	cargo build --target wasm32-unknown-unknown --release

# Run tests
test:
	cargo test

# Run tests with output
test-verbose:
	cargo test -- --nocapture

# Clean build artifacts
clean:
	cargo clean
	rm -rf test_snapshots/

# Format code
fmt:
	cargo fmt

# Check code
check:
	cargo check
	cargo clippy -- -D warnings

# Build optimized WASM
build-optimized:
	soroban contract build

# Deploy to testnet (requires SOROBAN_NETWORK_PASSPHRASE and SOROBAN_RPC_URL)
deploy-testnet:
	soroban contract deploy \
		--wasm target/wasm32-unknown-unknown/release/greeting_system.wasm \
		--network testnet

# Run all checks before committing
pre-commit: fmt check test

# Generate documentation
docs:
	cargo doc --no-deps --open
