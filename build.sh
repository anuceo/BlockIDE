#!/bin/bash
# build.sh

set -euo pipefail

echo "🚀 Building Blockchain IDE..."

# Install frontend dependencies
echo "📦 Installing dependencies..."
npm install

# Type check
echo "🔍 Type checking..."
npm run type-check

# Build frontend
echo "⚡ Building frontend..."
npm run build

# Build Tauri backend
echo "🦀 Building Tauri backend..."
cd src-tauri
cargo build --release

echo "✅ Build complete!"
echo "📁 Output:"
echo "   - Frontend: dist/"
echo "   - Tauri: src-tauri/target/release/"
echo ""
echo "🚀 To run development:"
echo "   npm run tauri dev"
echo ""
echo "📦 To create installers:"
echo "   npm run tauri build"

