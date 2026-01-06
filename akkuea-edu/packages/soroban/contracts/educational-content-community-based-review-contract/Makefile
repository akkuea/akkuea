default: build

all: test

test: build
	cargo test

build:
	cargo build --target wasm32-unknown-unknown --release
	/home/zarcc/.cargo/bin/soroban contract build
	@ls -l target/wasm32-unknown-unknown/release/*.wasm

fmt:
	cargo fmt --all

clean:

	cargo clean

check-snapshots:
	cargo test -- --nocapture

build-optimized:
	CARGO_TARGET_DIR=target/optimized cargo build \
		--target wasm32-unknown-unknown \
		--release \
		-Z build-std=std,panic_abort \
		-Z build-std-features=panic_immediate_abort
