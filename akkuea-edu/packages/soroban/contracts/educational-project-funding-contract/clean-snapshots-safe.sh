#!/bin/bash

echo "🧹 Cleaning test snapshots safely..."

# Backup current snapshots (just in case)
if [ -d "test_snapshots" ]; then
    echo "📦 Creating backup..."
    cp -r test_snapshots test_snapshots.backup.$(date +%Y%m%d_%H%M%S)
fi

# Clean snapshots but keep directory structure
find . -name "test_snapshots" -type d | while read dir; do
    echo "🗑️  Cleaning: $dir"
    # Remove files but keep directories
    find "$dir" -type f -delete 2>/dev/null || true
done

echo "✅ Cleanup complete!"
echo ""
echo "🧪 Running tests to verify functionality..."
cargo test --quiet

if [ $? -eq 0 ]; then
    echo "✅ Tests still pass! Cleanup was successful."
    echo "📊 New snapshot file count:"
    find . -path "*/test_snapshots/*" -type f | wc -l
else
    echo "❌ Tests failed! You may need to restore from backup."
    echo "🔧 To restore: find . -name 'test_snapshots.backup.*' -type d"
fi
