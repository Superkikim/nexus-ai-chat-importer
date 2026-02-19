#!/bin/bash

# Build script for Nexus Gemini Indexer Firefox Extension

set -e

echo "🔨 Building Nexus Gemini Indexer..."

# Clean build directory
rm -rf build/
mkdir -p build/

# Copy files
echo "📦 Copying files..."
cp manifest.json build/
cp -r src/ build/
cp -r icons/ build/

# Create ZIP for distribution
echo "📦 Creating distribution package..."
cd build
zip -r ../nexus-gemini-indexer-firefox.xpi .
cd ..

echo "✅ Build complete!"
echo "📦 Package: nexus-gemini-indexer-firefox.xpi"
echo ""
echo "To install in Firefox:"
echo "1. Open about:debugging#/runtime/this-firefox"
echo "2. Click 'Load Temporary Add-on'"
echo "3. Select manifest.json from the build/ directory"

