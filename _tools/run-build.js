const { spawnSync } = require('child_process');
const fs = require('fs');

let bashCmd = 'bash';
if (process.platform === 'win32') {
  const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
  const gitBash86 = 'C:\\Program Files (x86)\\Git\\bin\\bash.exe';
  if (fs.existsSync(gitBash)) {
    bashCmd = gitBash;
  } else if (fs.existsSync(gitBash86)) {
    bashCmd = gitBash86;
  }
}

const res = spawnSync(bashCmd, ['build.sh'], { stdio: 'inherit' });
process.exit(res.status ?? (res.error ? 1 : 0));
