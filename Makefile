# Run the same checks as pull-request CI before you push.
# Details and the per-workflow mapping live in scripts/check.sh.

.PHONY: check check-all fix help

help:
	@echo "make check      run the CI checks for what this branch changes"
	@echo "make check-all  run every CI check"
	@echo "make fix        apply automatic fixes (prettier, cargo fmt)"

check:
	@bash scripts/check.sh

check-all:
	@bash scripts/check.sh --all

fix:
	@bash scripts/check.sh --fix
