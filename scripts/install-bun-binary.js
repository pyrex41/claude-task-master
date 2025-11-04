#!/usr/bin/env node

/**
 * Installation script for Bun binary
 * Installs the pre-built Bun binary globally for better performance
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function question(query) {
	return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
	console.log('⚡ Task Master - Bun Binary Installer\n');
	console.log('This will install a pre-compiled Bun binary for ~45% better performance.\n');

	// Check if binary exists
	const binaryPath = path.join(projectRoot, 'dist', 'bin', 'task-master-bun');
	if (!fs.existsSync(binaryPath)) {
		console.error('❌ Binary not found. Building it now...\n');
		try {
			execSync('npm run build:bun', { stdio: 'inherit', cwd: projectRoot });
		} catch (error) {
			console.error('\n❌ Failed to build binary. Exiting.');
			process.exit(1);
		}
	}

	// Check file size
	const stats = fs.statSync(binaryPath);
	const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
	console.log(`📦 Binary size: ${sizeMB} MB`);
	console.log(`📍 Binary location: ${binaryPath}\n`);

	// Determine installation directory
	let installDir;
	const platform = process.platform;

	if (platform === 'darwin' || platform === 'linux') {
		// Try to find a directory in PATH
		const pathDirs = process.env.PATH.split(':');
		const candidateDirs = [
			'/usr/local/bin',
			path.join(process.env.HOME, '.local', 'bin'),
			'/opt/homebrew/bin'
		].filter((dir) => pathDirs.includes(dir) && fs.existsSync(dir));

		if (candidateDirs.length > 0) {
			installDir = candidateDirs[0];
		} else {
			installDir = '/usr/local/bin';
		}
	} else if (platform === 'win32') {
		installDir = path.join(process.env.APPDATA, 'npm');
	} else {
		console.error('❌ Unsupported platform:', platform);
		process.exit(1);
	}

	console.log(`📥 Will install to: ${installDir}`);
	console.log(`\nThis will:`);
	console.log(`  1. Copy the binary to ${installDir}/task-master-bun`);
	console.log(`  2. Make it executable`);
	console.log(`  3. Keep the existing task-master (Node.js version) intact\n`);

	const answer = await question('Continue? (y/N): ');
	rl.close();

	if (answer.toLowerCase() !== 'y') {
		console.log('Installation cancelled.');
		return;
	}

	const targetPath = path.join(installDir, 'task-master-bun');

	try {
		// Check if we need sudo
		const needsSudo = !fs.existsSync(installDir) || !isWritable(installDir);

		if (needsSudo && (platform === 'darwin' || platform === 'linux')) {
			console.log('\n🔐 Installation requires sudo privileges...');
			execSync(`sudo cp "${binaryPath}" "${targetPath}"`, { stdio: 'inherit' });
			execSync(`sudo chmod 755 "${targetPath}"`, { stdio: 'inherit' });
		} else {
			fs.copyFileSync(binaryPath, targetPath);
			fs.chmodSync(targetPath, 0o755);
		}

		console.log(`\n✅ Successfully installed!`);
		console.log(`\n📍 Binary location: ${targetPath}`);
		console.log(`\n💡 Usage:`);
		console.log(`   task-master-bun list          # Use Bun version (~45% faster)`);
		console.log(`   task-master list              # Use Node.js version (default)`);
		console.log(`\n⚡ Tip: Create an alias in your shell:`);
		console.log(`   alias tm='task-master-bun'`);
		console.log(`\n   Then use: tm list, tm next, etc.`);
	} catch (error) {
		console.error('\n❌ Installation failed:');
		console.error(error.message);
		console.error('\n💡 Try manual installation:');
		console.error(`   sudo cp "${binaryPath}" "${targetPath}"`);
		console.error(`   sudo chmod 755 "${targetPath}"`);
		process.exit(1);
	}
}

function isWritable(dir) {
	try {
		fs.accessSync(dir, fs.constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

main().catch((error) => {
	console.error('❌ Error:', error.message);
	process.exit(1);
});
