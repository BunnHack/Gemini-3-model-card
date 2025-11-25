import { log } from './logger.js';
import { generateRbxlxContent } from './rbxlxExporter.js';

const LS_API_KEY = 'roblox.publish.apiKey';
const LS_UNIVERSE_ID = 'roblox.publish.universeId';
const LS_PLACE_ID = 'roblox.publish.placeId';
const LS_REMEMBER_DETAILS = 'roblox.publish.rememberDetails';

let getScene;

function openPublishModal() {
  const modal = document.getElementById('publish-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('publish-status').style.display = 'none';
    document.getElementById('publish-modal-submit').disabled = false;

    const rememberDetailsCheckbox = document.getElementById('remember-details');
    rememberDetailsCheckbox.checked = localStorage.getItem(LS_REMEMBER_DETAILS) === 'true';

    const apiKeyInput = document.getElementById('api-key');
    const universeIdInput = document.getElementById('universe-id');
    const placeIdInput = document.getElementById('place-id');

    apiKeyInput.value = localStorage.getItem(LS_API_KEY) || '';
    universeIdInput.value = localStorage.getItem(LS_UNIVERSE_ID) || '';
    placeIdInput.value = localStorage.getItem(LS_PLACE_ID) || '';

    const saveDetails = () => {
        localStorage.setItem(LS_API_KEY, apiKeyInput.value);
        localStorage.setItem(LS_UNIVERSE_ID, universeIdInput.value);
        localStorage.setItem(LS_PLACE_ID, placeIdInput.value);
    };

    apiKeyInput.addEventListener('input', saveDetails);
    universeIdInput.addEventListener('input', saveDetails);
    placeIdInput.addEventListener('input', saveDetails);
    
    rememberDetailsCheckbox.addEventListener('change', () => {
        localStorage.setItem(LS_REMEMBER_DETAILS, rememberDetailsCheckbox.checked);
    });

    document.querySelector('input[name="publish-source"][value="current"]').checked = true;
    document.getElementById('publish-file-upload-group').style.display = 'none';
    document.getElementById('rbxlx-file-input').value = '';
  }
}

function closePublishModal() {
  const modal = document.getElementById('publish-modal');
  if (modal) {
    modal.style.display = 'none';
    
    if (localStorage.getItem(LS_REMEMBER_DETAILS) !== 'true') {
        localStorage.removeItem(LS_API_KEY);
        localStorage.removeItem(LS_UNIVERSE_ID);
        localStorage.removeItem(LS_PLACE_ID);
    }
  }
}

function setStatus(message, isError = false) {
    const statusEl = document.getElementById('publish-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message ${isError ? 'error' : 'success'}`;
    statusEl.style.display = 'block';
}

async function publishToRoblox() {
    const universeId = document.getElementById('universe-id').value;
    const placeId = document.getElementById('place-id').value;
    const apiKey = document.getElementById('api-key').value;
    const versionType = document.getElementById('version-type').value;
    const rememberDetails = document.getElementById('remember-details').checked;

    localStorage.setItem(LS_API_KEY, apiKey);
    localStorage.setItem(LS_UNIVERSE_ID, universeId);
    localStorage.setItem(LS_PLACE_ID, placeId);
    localStorage.setItem(LS_REMEMBER_DETAILS, rememberDetails);

    if (!universeId || !placeId || !apiKey) {
        setStatus('API Key, Universe ID, and Place ID are required.', true);
        return;
    }
    
    const publishSource = document.querySelector('input[name="publish-source"]:checked').value;
    
    const submitBtn = document.getElementById('publish-modal-submit');
    submitBtn.disabled = true;
    setStatus('Publishing...', false);

    let rbxlxContent = '';

    if (publishSource === 'file') {
        const fileInput = document.getElementById('rbxlx-file-input');
        const file = fileInput.files[0];
        if (!file) {
            setStatus('Please select an RBXLX file to upload.', true);
            submitBtn.disabled = false;
            return;
        }
        try {
            rbxlxContent = await file.text();
        } catch (err) {
            setStatus(`Error reading file: ${err.message}`, true);
            submitBtn.disabled = false;
            return;
        }

    } else {
        if (studioApp.scene) {
            rbxlxContent = generateRbxlxContent();
        } else {
            setStatus('Error: Scene not available.', true);
            submitBtn.disabled = false;
            return;
        }
    }

    const endpoint = `https://bunnhack-rwstudio-51.deno.dev/publish`;

    try {
        log(`[Studio] Publishing to Universe ${universeId}, Place ${placeId}...`);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                universeId,
                placeId,
                apiKey,
                versionType,
                rbxlxContent
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Server returned status ${response.status}` }));
            throw new Error(errorData.message || `Server returned status ${response.status}`);
        }
        const result = await response.json();
        
        log(`[Studio] Successfully published version ${result.versionNumber}.`, 'info');
        setStatus(`Successfully published! New version: ${result.versionNumber}`, false);

        setTimeout(() => {
            closePublishModal();
        }, 2000);

    } catch (error) {
        log(`[Studio] Publish failed: ${error.message}`, 'error');
        setStatus(`Publish failed: ${error.message}. Check console for details.`, true);
        submitBtn.disabled = false;
    }
}

export function initPublish(sceneGetter) {
    getScene = sceneGetter;
    const publishBtn = document.getElementById('publish-roblox');
    if (publishBtn) publishBtn.addEventListener('click', openPublishModal);

    const publishModal = document.getElementById('publish-modal');
    const publishModalClose = document.getElementById('publish-modal-close');
    const publishModalCancel = document.getElementById('publish-modal-cancel');
    const publishModalSubmit = document.getElementById('publish-modal-submit');

    if (publishModal) {
        publishModalClose.addEventListener('click', closePublishModal);
        publishModalCancel.addEventListener('click', closePublishModal);
        publishModalSubmit.addEventListener('click', publishToRoblox);

        document.querySelectorAll('input[name="publish-source"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const fileUploadGroup = document.getElementById('publish-file-upload-group');
                fileUploadGroup.style.display = (e.target.value === 'file') ? 'flex' : 'none';
            });
        });
    }
}