const consoleEl = document.getElementById('console');
export function log(msg, cls = 'info') {
  if (!consoleEl) return;
  const line = document.createElement('div');
  line.className = `line ${cls}`;
  line.textContent = msg;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}