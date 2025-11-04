#!/usr/bin/env node

/**
 * Build script for creating Bun binary
 * This compiles the CLI to a standalone Bun binary for ~45% better performance
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🔨 Building Bun binary...\n');

// Check if Bun is installed
try {
	execSync('bun --version', { stdio: 'pipe' });
} catch (error) {
	console.error('❌ Error: Bun is not installed.');
	console.error('Please install Bun first: https://bun.sh');
	console.error('\nOn macOS/Linux:');
	console.error('  curl -fsSL https://bun.sh/install | bash');
	process.exit(1);
}

// Check if dist/task-master.js exists
const cliPath = path.join(projectRoot, 'dist', 'task-master.js');
if (!fs.existsSync(cliPath)) {
	console.error('❌ Error: dist/task-master.js not found.');
	console.error('Please run `npm run build` first.');
	process.exit(1);
}

// Always use local dist build to avoid dependency issues with global install
const installedPath = cliPath;
console.log(`📦 Using local build: ${installedPath}`);

// Create dist/bin directory if it doesn't exist
const binDir = path.join(projectRoot, 'dist', 'bin');
if (!fs.existsSync(binDir)) {
	fs.mkdirSync(binDir, { recursive: true });
}

const outputPath = path.join(binDir, 'task-master-bun');

console.log(`\n🔧 Compiling ${installedPath}...`);
console.log(`📍 Output: ${outputPath}\n`);

try {
	// Run bun build with compile flag
	execSync(`bun build "${installedPath}" --compile --outfile "${outputPath}"`, {
		stdio: 'inherit',
		cwd: projectRoot
	});

	// Make it executable
	fs.chmodSync(outputPath, 0o755);

	// Get file size
	const stats = fs.statSync(outputPath);
	const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

	console.log(`\n✅ Successfully built Bun binary!`);
	console.log(`📦 Size: ${sizeMB} MB`);
	console.log(`📍 Location: ${outputPath}`);
	console.log(`\n💡 To install globally, run:`);
	console.log(`   npm run install:bun`);
	console.log(`\n⚡ Performance: ~45% faster than Node.js`);
} catch (error) {
	console.error('\n❌ Failed to build Bun binary');
	console.error(error.message);
	process.exit(1);
}
