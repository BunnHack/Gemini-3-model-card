import { log } from './logger.js';
import studioApp from './studioApp.js';

function generateUUID() {
  return 'RBX' + 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
}

function generateUniqueId() {
    return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[x]/g, function() {
        return (Math.random() * 16 | 0).toString(16);
    });
}

function generateItemXml(itemId, treeItems) {
    const item = treeItems[itemId];
    if (!item) return '';

    const referent = generateUUID();
    let propertiesXml = '';
    let childrenXml = '';
    let className = item.isFolder ? 'Folder' : item.kind || 'Part';

    const uniqueId = generateUniqueId();

    if (itemId === 'Workspace' || itemId === 'Lighting' || itemId === 'Players' || itemId === 'ReplicatedStorage' || itemId === 'ServerScriptService' || itemId === 'ServerStorage' || itemId === 'StarterGui' || itemId === 'StarterPack' || itemId === 'Teams' || itemId === 'SoundService' || itemId === 'Chat' || itemId === 'ReplicatedFirst') {
        className = itemId; // Default to itemId for most services
        
        // Specific mapping if needed (though most match)
        if (itemId === 'ReplicatedStorage') className = 'ReplicatedStorage'; // Explicit check not strictly needed but safe
        
        propertiesXml = `<string name="Name">${itemId}</string>`;
        
        if (itemId === 'Lighting') {
             propertiesXml += `
                <Color3 name="Ambient"><R>0.2745</R><G>0.2745</G><B>0.2745</B></Color3>
                <float name="Brightness">3</float>
                <Color3 name="OutdoorAmbient"><R>0.2745</R><G>0.2745</G><B>0.2745</B></Color3>
                <bool name="GlobalShadows">true</bool>
                <string name="TimeOfDay">14:30:00</string>
                <token name="Technology">3</token>`;
        }
        
        if (itemId === 'StarterGui') {
             propertiesXml += `
                <bool name="ResetPlayerGuiOnSpawn">true</bool>
                <bool name="ShowDevelopmentGui">true</bool>
                <token name="ScreenOrientation">2</token>`;
        }
        
        if (itemId === 'Players') {
             propertiesXml += `<bool name="CharacterAutoLoads">true</bool>`;
        }
    }

    if (className === 'Part' || className === 'SpawnLocation') {
        const object = studioApp.scene.getObjectByName(item.data);
        if (!object) return '';

        const matrix = object.matrixWorld;
        const elements = matrix.elements;
        const pos = object.position;
        const size = object.userData.size.clone().multiply(object.scale);
        const color = object.material.color;
        const transparency = 1.0 - object.material.opacity;

        const r = Math.round(color.r * 255);
        const g = Math.round(color.g * 255);
        const b = Math.round(color.b * 255);
        const color3uint8 = 0xFF000000 + (r << 16) + (g << 8) + b;

        let shapeToken = 1; // Block
        if (object.userData.shape === 'Ball') shapeToken = 0;
        if (object.userData.shape === 'Cylinder') shapeToken = 2;
        if (object.userData.shape === 'Wedge') shapeToken = 3;

        propertiesXml = `
        <string name="Name">${object.name}</string>
        <bool name="Anchored">${object.userData.anchored || false}</bool>
        <CoordinateFrame name="CFrame">
          <X>${pos.x}</X><Y>${pos.y}</Y><Z>${pos.z}</Z>
          <R00>${elements[0]}</R00><R01>${elements[4]}</R01><R02>${elements[8]}</R02>
          <R10>${elements[1]}</R10><R11>${elements[5]}</R11><R12>${elements[9]}</R12>
          <R20>${elements[2]}</R20><R21>${elements[6]}</R21><R22>${elements[10]}</R22>
        </CoordinateFrame>
        <Vector3 name="size">
          <X>${size.x}</X><Y>${size.y}</Y><Z>${size.z}</Z>
        </Vector3>
        <Color3uint8 name="Color3uint8">${color3uint8 >>> 0}</Color3uint8>
        <bool name="CanCollide">${object.userData.canCollide !== undefined ? object.userData.canCollide : true}</bool>
        <bool name="Locked">${object.userData.locked || false}</bool>
        <float name="Transparency">${transparency}</float>
        <token name="shape">${shapeToken}</token>
        <token name="Material">256</token>
        `;
    } else if (className === 'Script') {
        const scriptContent = studioApp.scripts.get(item.data) || '';
        propertiesXml = `
        <string name="Name">${item.data}</string>
        <ProtectedString name="Source"><![CDATA[${scriptContent}]]></ProtectedString>`;
    } else {
        propertiesXml = `<string name="Name">${item.data}</string>`;
    }

    if (item.children && item.children.length > 0) {
        childrenXml = item.children.map(childId => generateItemXml(childId, treeItems)).join('');
    }

    return `
    <Item class="${className}" referent="${referent}">
      <Properties>
        ${propertiesXml}
        <UniqueId name="UniqueId">${uniqueId}</UniqueId>
      </Properties>
      ${childrenXml}
    </Item>`;
}

function getStaticServicesXml() {
    const services = {
        "StarterPlayer": {},
        "HttpService": { "HttpEnabled": "bool" },
        "TestService": { "Is30FpsThrottleEnabled": "bool" }
    };
    return Object.entries(services).map(([name, props]) => {
        let propsXml = `<string name="Name">${name}</string><UniqueId name="UniqueId">${generateUniqueId()}</UniqueId>`;
        if(name === 'HttpService') propsXml += `<bool name="HttpEnabled">false</bool>`;
        if(name === 'TestService') propsXml += `<bool name="Is30FpsThrottleEnabled">true</bool>`;
        
        return `<Item class="${name}" referent="${generateUUID()}"><Properties>${propsXml}</Properties></Item>`;
    }).join('');
}


export function generateRbxlxContent() {
    const treeItems = studioApp.treeItems;
    const rootItem = treeItems['root'];
    
    if (!rootItem || !rootItem.children) {
        return '';
    }

    let itemsXml = rootItem.children.map(serviceId => generateItemXml(serviceId, treeItems)).join('');
    const staticServicesXml = getStaticServicesXml();

    return `
<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
  <External>null</External>
  <External>nil</External>
  ${itemsXml}
  ${staticServicesXml}
</roblox>`.trim();
}

export function exportToRbxlx() {
    const xmlContent = generateRbxlxContent();
    const blob = new Blob([xmlContent], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scene.rbxlx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    log('[Studio] Exported scene to scene.rbxlx');
}