import studioApp from './studioApp.js';

let scriptEditor = null;
let currentScript = null;

const scriptEditorEl = document.getElementById('script-editor');
const cmHostEl = document.getElementById('cm-host');
const scriptTitleEl = document.getElementById('script-title');

function openScriptEditor(name) {
  studioApp.createScript(name);
  currentScript = name;
  if (scriptTitleEl) scriptTitleEl.textContent = name;

  if (!scriptEditor) {
    scriptEditor = window.CodeMirror(cmHostEl, {
      value: studioApp.scripts.get(name),
      mode: 'javascript',
      lineNumbers: true,
      tabSize: 2,
      indentUnit: 2,
      theme: 'dracula',
      autoCloseBrackets: true,
      matchBrackets: true,
      styleActiveLine: true
    });
  } else {
    scriptEditor.setValue(studioApp.scripts.get(name));
  }

  if (scriptEditorEl) {
    scriptEditorEl.style.display = '';
    scriptEditorEl.classList.add('visible');
  }
  if (studioApp.rendererDom) studioApp.rendererDom.style.display = 'none';
  document.getElementById('viewport')?.classList.add('script-mode');
  setTimeout(() => scriptEditor?.refresh(), 10);
}

function closeScriptEditor() {
  if (currentScript && scriptEditor) {
    studioApp.scripts.set(currentScript, scriptEditor.getValue());
  }
  scriptEditorEl?.classList.remove('visible');
  if (scriptEditorEl) scriptEditorEl.style.display = 'none';
  if (studioApp.rendererDom) studioApp.rendererDom.style.display = '';
  currentScript = null;
  document.getElementById('viewport')?.classList.remove('script-mode');
}

document.getElementById('close-editor')?.addEventListener('click', closeScriptEditor);
studioApp.openScript = openScriptEditor;

export { openScriptEditor, closeScriptEditor };

