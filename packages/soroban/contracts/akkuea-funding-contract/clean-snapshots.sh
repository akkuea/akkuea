#!/bin/bash

echo "Cleaning test snapshots..."
find . -path "*/test_snapshots/*" -name "*.json" -delete 2>/dev/null || true
find . -path "*/test_snapshots/*" -name "*.snap" -delete 2>/dev/null || true
echo "Test snapshots cleaned."
