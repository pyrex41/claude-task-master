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
		// First, try to find where task-master is currently installed
		try {
			const currentPath = execSync('which task-master', { encoding: 'utf8' }).trim();
			if (currentPath) {
				installDir = path.dirname(currentPath);
				console.log(`📍 Found existing task-master at: ${currentPath}`);
			}
		} catch {
			// task-master not found, use default locations
		}

		// If not found, try to find a directory in PATH
		if (!installDir) {
			const pathDirs = process.env.PATH.split(':');
			const candidateDirs = [
				'/opt/homebrew/bin',
				'/usr/local/bin',
				path.join(process.env.HOME, '.local', 'bin')
			].filter((dir) => pathDirs.includes(dir) && fs.existsSync(dir));

			if (candidateDirs.length > 0) {
				installDir = candidateDirs[0];
			} else {
				installDir = '/usr/local/bin';
			}
		}
	} else if (platform === 'win32') {
		installDir = path.join(process.env.APPDATA, 'npm');
	} else {
		console.error('❌ Unsupported platform:', platform);
		process.exit(1);
	}

	console.log(`📥 Will install to: ${installDir}`);
	console.log(`\nThis will:`);
	console.log(`  1. Backup existing task-master to task-master.node`);
	console.log(`  2. Replace task-master with Bun binary`);
	console.log(`  3. Make it executable\n`);
	console.log(`⚠️  You can restore the Node.js version anytime with:`);
	console.log(`   mv ${installDir}/task-master.node ${installDir}/task-master\n`);

	const answer = await question('Continue? (y/N): ');
	rl.close();

	if (answer.toLowerCase() !== 'y') {
		console.log('Installation cancelled.');
		return;
	}

	const targetPath = path.join(installDir, 'task-master');
	const backupPath = path.join(installDir, 'task-master.node');

	try {
		// Check if we need sudo
		const needsSudo = !fs.existsSync(installDir) || !isWritable(installDir);

		if (needsSudo && (platform === 'darwin' || platform === 'linux')) {
			console.log('\n🔐 Installation requires sudo privileges...');

			// Backup existing task-master if it exists
			if (fs.existsSync(targetPath)) {
				console.log('📦 Backing up Node.js version...');
				execSync(`sudo mv "${targetPath}" "${backupPath}"`, { stdio: 'inherit' });
			}

			// Install Bun binary
			execSync(`sudo cp "${binaryPath}" "${targetPath}"`, { stdio: 'inherit' });
			execSync(`sudo chmod 755 "${targetPath}"`, { stdio: 'inherit' });
		} else {
			// Backup existing task-master if it exists
			if (fs.existsSync(targetPath)) {
				console.log('📦 Backing up Node.js version...');
				fs.renameSync(targetPath, backupPath);
			}

			// Install Bun binary
			fs.copyFileSync(binaryPath, targetPath);
			fs.chmodSync(targetPath, 0o755);
		}

		console.log(`\n✅ Successfully installed!`);
		console.log(`\n📍 Bun binary: ${targetPath}`);
		if (fs.existsSync(backupPath)) {
			console.log(`📍 Node.js backup: ${backupPath}`);
		}
		console.log(`\n💡 Usage:`);
		console.log(`   task-master list              # Now uses Bun (~45% faster)`);
		console.log(`   task-master next              # ~45% faster`);
		console.log(`\n⚡ To restore Node.js version:`);
		if (needsSudo && (platform === 'darwin' || platform === 'linux')) {
			console.log(`   sudo mv "${backupPath}" "${targetPath}"`);
		} else {
			console.log(`   mv "${backupPath}" "${targetPath}"`);
		}
	} catch (error) {
		console.error('\n❌ Installation failed:');
		console.error(error.message);
		console.error('\n💡 Try manual installation:');
		console.error(`   # Backup Node.js version`);
		console.error(`   sudo mv "${targetPath}" "${backupPath}"`);
		console.error(`   # Install Bun binary`);
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
