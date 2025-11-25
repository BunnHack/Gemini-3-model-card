const studioApp = window.studioApp || {};
studioApp.scripts = studioApp.scripts || new Map();
studioApp.createScript = (name, content) => {
  if (!studioApp.scripts.has(name)) studioApp.scripts.set(name, content || `// ${name}\nconsole.log("Hello from ${name}");`);
};
studioApp.openScript = (name) => console.warn('Editor not initialized yet:', name);
studioApp.selectObjectByName = (name) => console.warn('Viewport not initialized yet, cannot select:', name);
studioApp.createObject = (options) => console.warn('Viewport not initialized yet, cannot create:', options);
studioApp.scene = null;
studioApp.rendererDom = null;

const listeners = {};
studioApp.on = (event, callback) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
};
studioApp.emit = (event, data) => {
  if (listeners[event]) {
    listeners[event].forEach(callback => callback(data));
  }
};

window.studioApp = studioApp;
export default studioApp;