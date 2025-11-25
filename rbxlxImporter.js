import * as THREE from 'three';
import studioApp from './studioApp.js';
import { log } from './logger.js';

function parseVector3(node) {
    if (!node) return new THREE.Vector3();
    const x = parseFloat(node.querySelector('X')?.textContent || 0);
    const y = parseFloat(node.querySelector('Y')?.textContent || 0);
    const z = parseFloat(node.querySelector('Z')?.textContent || 0);
    return new THREE.Vector3(x, y, z);
}

function parseColor3(node) {
    if (!node) return new THREE.Color(0.5, 0.5, 0.5);
    const r = parseFloat(node.querySelector('R')?.textContent || 0.5);
    const g = parseFloat(node.querySelector('G')?.textContent || 0.5);
    const b = parseFloat(node.querySelector('B')?.textContent || 0.5);
    return new THREE.Color(r, g, b);
}

function parseCFrame(node) {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    if (!node) return { position, quaternion };

    const x = parseFloat(node.querySelector('X')?.textContent || 0);
    const y = parseFloat(node.querySelector('Y')?.textContent || 0);
    const z = parseFloat(node.querySelector('Z')?.textContent || 0);
    const r00 = parseFloat(node.querySelector('R00')?.textContent || 1);
    const r01 = parseFloat(node.querySelector('R01')?.textContent || 0);
    const r02 = parseFloat(node.querySelector('R02')?.textContent || 0);
    const r10 = parseFloat(node.querySelector('R10')?.textContent || 0);
    const r11 = parseFloat(node.querySelector('R11')?.textContent || 1);
    const r12 = parseFloat(node.querySelector('R12')?.textContent || 0);
    const r20 = parseFloat(node.querySelector('R20')?.textContent || 0);
    const r21 = parseFloat(node.querySelector('R21')?.textContent || 0);
    const r22 = parseFloat(node.querySelector('R22')?.textContent || 1);

    const matrix = new THREE.Matrix4();
    matrix.set(
        r00, r01, r02, x,
        r10, r11, r12, y,
        r20, r21, r22, z,
        0,   0,   0,   1
    );

    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);

    return { position, quaternion };
}

function processItem(item, parentName) {
    const className = item.getAttribute('class');
    const props = item.querySelector(':scope > Properties');
    if (!props) return;

    const name = props.querySelector('string[name="Name"]')?.textContent || className;

    if (className === 'Part' || className === 'SpawnLocation') {
        const cframeNode = props.querySelector('CoordinateFrame[name="CFrame"]');
        const { position, quaternion } = parseCFrame(cframeNode);

        const sizeNode = props.querySelector('Vector3[name="size"]');
        const size = parseVector3(sizeNode);

        const colorNode = props.querySelector('Color3[name="Color"]');
        const color = parseColor3(colorNode);

        const anchoredNode = props.querySelector('bool[name="Anchored"]');
        const anchored = anchoredNode ? anchoredNode.textContent.toLowerCase() === 'true' : false;

        const canCollideNode = props.querySelector('bool[name="CanCollide"]');
        const canCollide = canCollideNode ? canCollideNode.textContent.toLowerCase() === 'true' : true;

        const lockedNode = props.querySelector('bool[name="Locked"]');
        const locked = lockedNode ? lockedNode.textContent.toLowerCase() === 'true' : false;

        const options = {
            type: className,
            name: name,
            position: position,
            quaternion: quaternion,
            size: size,
            color: color,
            anchored: anchored,
            canCollide: canCollide,
            locked: locked,
            suppressLog: true
        };
        studioApp.createObject(options);
    } else if (className === 'Script') {
        const sourceNode = props.querySelector('ProtectedString[name="Source"]');
        const source = sourceNode?.textContent || '';
        studioApp.createScript(name, source);
        studioApp.emit('scriptAdded', { name, parentName });
    }

    const childItems = item.querySelectorAll(':scope > Item');
    childItems.forEach(child => processItem(child, name));
}

export function loadRbxlxContent(xmlContent, scene) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
        const errorMsg = parserError.textContent || "Unknown parsing error.";
        log(`Error parsing RBXLX file.`, "error");
        console.error("RBXLX Parser Error:", errorMsg);
        alert(`Failed to parse RBXLX file:\n${errorMsg}`);
        return;
    }

    const rootItems = xmlDoc.querySelectorAll('roblox > Item');
    if (rootItems.length === 0) {
      log("No items found in the file.", "warn");
      return;
    }

    let objectCount = 0;
    rootItems.forEach(item => {
        const className = item.getAttribute('class');
        const props = item.querySelector(':scope > Properties');
        const serviceName = props?.querySelector('string[name="Name"]')?.textContent;
        
        if(studioApp.treeItems[serviceName]) { // Check if it's a known service
            const childItems = item.querySelectorAll(':scope > Item');
            childItems.forEach(child => {
                processItem(child, serviceName);
                objectCount++;
            });
        }
    });

    log(`[Studio] Loaded ${objectCount} objects from file.`);
}