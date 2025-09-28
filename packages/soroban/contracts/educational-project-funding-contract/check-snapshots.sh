#!/bin/bash

echo "=== Current snapshot file count ==="
find . -name "test_snapshots" -type d | while read dir; do
    count=$(find "$dir" -type f | wc -l)
    echo "$dir: $count files"
done

echo ""
echo "=== File types in snapshots ==="
find . -path "*/test_snapshots/*" -type f -name "*" | head -10

echo ""
echo "=== Total snapshot files ==="
find . -path "*/test_snapshots/*" -type f | wc -l