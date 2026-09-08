const fs = require('fs');
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

/**
 * Cross-platform file copy script for building the browser extension
 */

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
  } catch (error) {
    console.error(`Error copying ${src}:`, error.message);
    throw error;
  }
}
function copyDirectory(src, dest) {
  try {
    ensureDirectoryExists(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      // Skip pagemind icons (only icon files are used)
      if (entry.name.startsWith('pagemind')) continue;

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    console.error(`Error copying directory ${src}:`, error.message);
    throw error;
  }
}

function copyAssets() {
  console.log('Copying assets and manifest to dist folder...');

  // Ensure dist directory exists
  const distDir = path.join(projectRoot, 'dist');
  ensureDirectoryExists(distDir);

  // Copy manifest.json
  copyFile(path.join(projectRoot, 'manifest.json'), path.join(distDir, 'manifest.json'));

  // Copy assets directory
  const assetsDir = path.join(projectRoot, 'assets');
  if (fs.existsSync(assetsDir)) {
    copyDirectory(assetsDir, path.join(distDir, 'assets'));
  }

  // Copy non-TypeScript files from src to dist
  copyNonTSFiles(path.join(projectRoot, 'src'), distDir);

  console.log('Assets copied successfully!');
}

function copyNonTSFiles(src, dest) {
  try {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy non-TS files in subdirectories
        copyNonTSFiles(srcPath, destPath);
      } else if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        // Copy non-TypeScript files (HTML, CSS, etc.)
        ensureDirectoryExists(dest);
        copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    console.error(`Error copying from ${src}:`, error.message);
    throw error;
  }
}

// Run the copy operation
copyAssets();
