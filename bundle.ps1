# PowerShell script to concatenate and clean up ES6 modules for game_bundle.js
$files = @(
  "src/world.js",
  "src/particles.js",
  "src/audio.js",
  "src/renderer.js",
  "src/game.js",
  "src/ui.js",
  "src/main.js"
)

$bundle = @"
// Detect environment
const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
let ipcRenderer = null;
if (isElectron) {
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (e) {
    console.warn("Running in Electron style but require('electron') failed:", e);
  }
}

"@

foreach ($file in $files) {
  if (Test-Path $file) {
    $content = Get-Content $file -Raw
    
    # Strip ES6 imports (e.g., import { ... } from './...';)
    $content = $content -replace 'import\s+[\s\S]*?\s+from\s+[''"].*?[''"];?\r?\n', ''
    
    # Strip ES6 exports (e.g., export class X -> class X)
    $content = $content -replace 'export\s+(class|const|let|function|default)', '$1'
    
    # Ensure there's a newline separation between modules
    $bundle += "`n// =========================================="
    $bundle += "`n// MODULE: $file"
    $bundle += "`n// =========================================="
    $bundle += "`n" + $content + "`n"
  } else {
    Write-Warning "File not found: $file"
  }
}

$bundle | Out-File -FilePath "game_bundle.js" -Encoding utf8
Write-Output "Successfully built game_bundle.js from src/ files!"
