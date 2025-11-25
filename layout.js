import Split from 'split.js';
import { log } from './logger.js';

// Main split: Center (Viewport/Output) vs Right (Explorer/Properties)
const mainSplit = Split(["#center-col", "#right-col"], {
  sizes: [80, 20], 
  minSize: [300, 200], 
  gutterSize: 4,
  snapOffset: 0,
});

// Right column split: Explorer vs Properties
const rightSplit = Split(["#explorer", "#properties"], {
  direction: "vertical",
  sizes: [50, 50],
  minSize: [100, 100],
  gutterSize: 4,
});

// Center column split: Viewport vs Output
const centerSplit = Split(["#viewport", "#output"], { 
  direction: "vertical", 
  sizes: [85, 15], 
  minSize: [200, 30], 
  gutterSize: 4 
});

function togglePanel(panelId, visible) {
    // Simple toggle implementation for now, just hide/show
    const el = document.getElementById(panelId);
    if (el) el.style.display = visible ? '' : 'none';
}

document.querySelectorAll('.toggle input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => togglePanel(cb.dataset.panel, cb.checked));
});
document.getElementById("clear-output")?.addEventListener("click", () => document.getElementById("console")?.replaceChildren());

document.querySelectorAll(".ribbon .tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if (btn.classList.contains('file-tab')) return; // Skip file tab
    document.querySelectorAll(".ribbon .tab").forEach(b=>b.classList.toggle("active",b===btn));
    document.querySelectorAll(".ribbon-page").forEach(p=>p.classList.toggle("active",p.dataset.tab===btn.dataset.tab));
  });
});

document.querySelectorAll('.dropdown-toggle').forEach(button => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const content = button.nextElementSibling;
    const isVisible = content.classList.contains('show');
    
    document.querySelectorAll('.dropdown-content.show').forEach(openDropdown => {
        if (openDropdown !== content) {
            openDropdown.classList.remove('show');
        }
    });
    
    if (!isVisible) {
      content.classList.add('show');
    } else {
      content.classList.remove('show');
    }
  });
});

window.addEventListener('click', (event) => {
  if (!event.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-content.show').forEach(openDropdown => {
      openDropdown.classList.remove('show');
    });
  }
});

let resizeRaf = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    // Force Split.js to recalculate if needed, though it usually handles resize well
  });
});

log("[Studio] UI Layout Initialized.");