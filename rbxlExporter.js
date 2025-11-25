import { log } from './logger.js';
import studioApp from './studioApp.js';
import * as THREE from 'three';

// --- Constants & Helpers ---

const kMagic = [0x3C, 0x72, 0x6F, 0x62, 0x6C, 0x6F, 0x78, 0x21]; // <roblox!
const kSignature = [0x89, 0xFF, 0x0D, 0x0A, 0x1A, 0x0A];
const kVersion = 0;

function transformInt(val) {
    return (val << 1) ^ (val >> 31);
}

function transformFloat(val) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, val, true); // Write LE (JS native usually)
    let u = view.getUint32(0, true); // Read LE
    // Roblox floats in binary format are stored as raw IEEE 754 (interleaved), 
    // not transformed/rotated like integers. 
    return u;
}

function stringToBytes(str) {
    return new TextEncoder().encode(str);
}

class BinaryWriter {
    constructor(size = 1024 * 1024) {
        this.buffer = new Uint8Array(size);
        this.view = new DataView(this.buffer.buffer);
        this.offset = 0;
    }

    ensureCapacity(bytes) {
        if (this.offset + bytes > this.buffer.length) {
            const newBuf = new Uint8Array(this.buffer.length * 2 + bytes);
            newBuf.set(this.buffer);
            this.buffer = newBuf;
            this.view = new DataView(this.buffer.buffer);
        }
    }

    writeBytes(bytes) {
        this.ensureCapacity(bytes.length);
        this.buffer.set(bytes, this.offset);
        this.offset += bytes.length;
    }

    writeUInt32LE(val) {
        this.ensureCapacity(4);
        this.view.setUint32(this.offset, val, true);
        this.offset += 4;
    }

    writeUInt32BE(val) {
        this.ensureCapacity(4);
        this.view.setUint32(this.offset, val, false);
        this.offset += 4;
    }

    writeInt32LE(val) {
        this.ensureCapacity(4);
        this.view.setInt32(this.offset, val, true);
        this.offset += 4;
    }

    writeUInt16LE(val) {
        this.ensureCapacity(2);
        this.view.setUint16(this.offset, val, true);
        this.offset += 2;
    }

    writeUInt8(val) {
        this.ensureCapacity(1);
        this.view.setUint8(this.offset, val);
        this.offset += 1;
    }

    writeString(str) {
        const bytes = stringToBytes(str);
        this.writeUInt32LE(bytes.length);
        this.writeBytes(bytes);
    }

    // Writes interleaved array of transformed 32-bit values (Ints or Floats)
    writeInterleaved(values) {
        if (values.length === 0) return;
        const count = values.length;
        this.ensureCapacity(count * 4);

        // Prepare big-endian bytes for each value
        const tempBuf = new Uint8Array(count * 4);
        const tempView = new DataView(tempBuf.buffer);

        for (let i = 0; i < count; i++) {
            tempView.setUint32(i * 4, values[i], false); // Write BE
        }

        // Interleave: Write all Byte 0s, then all Byte 1s...
        // Since we wrote BE, Byte 0 is MSB.
        for (let b = 0; b < 4; b++) {
            for (let i = 0; i < count; i++) {
                this.buffer[this.offset++] = tempBuf[i * 4 + b];
            }
        }
    }

    getResult() {
        return this.buffer.subarray(0, this.offset);
    }
}

// --- Entity Management ---

class InstanceRecord {
    constructor(id, className, name, props = {}) {
        this.id = id; // Referent
        this.className = className;
        this.name = name;
        this.props = props;
        this.children = [];
        this.parentId = -1;
    }
}

// --- Serializer ---

export function exportToRbxl() {
    try {
        const writer = new BinaryWriter();

        // 1. Gather Instances
        const instances = [];
        const instanceMap = new Map(); // id -> InstanceRecord
        let idCounter = 0;

        // Root "DataModel" is not explicit in RBXL usually, but we need to handle tree.
        // The items in treeItems['root'].children are the top-level services/objects.
        // We will treat them as having parent -1 (NULL).

        const processNode = (nodeId, parentRef) => {
            const node = studioApp.treeItems[nodeId];
            if (!node) return;

            const className = node.isFolder ? 'Folder' : (node.kind || node.index); 
            // Note: node.kind is 'Part', 'Script', etc. node.index is 'Workspace', 'Lighting' etc.

            // Resolve actual ClassName
            let actualClassName = className;
            if (['Workspace', 'Lighting', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage', 
                 'StarterGui', 'StarterPack', 'Teams', 'SoundService', 'Chat', 'Players', 'ReplicatedFirst'].includes(nodeId)) {
                actualClassName = nodeId;
            }

            const ref = idCounter++;
            const record = new InstanceRecord(ref, actualClassName, node.data);
            record.parentId = parentRef;

            // Gather properties from Scene object if applicable
            if (actualClassName === 'Part' || actualClassName === 'SpawnLocation') {
                const obj = studioApp.scene.getObjectByName(node.data);
                if (obj) {
                    record.props.CFrame = obj.matrixWorld;
                    record.props.Size = obj.userData.size.clone().multiply(obj.scale);
                    record.props.Color = obj.material.color; // Color3
                    record.props.Transparency = 1 - obj.material.opacity;
                    record.props.Anchored = !!obj.userData.anchored;
                    record.props.CanCollide = obj.userData.canCollide !== undefined ? !!obj.userData.canCollide : true;
                    record.props.Locked = !!obj.userData.locked;
                    // Shape is handled via Mesh type in ThreeJS but mapped to Shape enum in Roblox
                    let shapeVal = 1; // Block
                    if (obj.userData.shape === 'Ball') shapeVal = 0;
                    if (obj.userData.shape === 'Cylinder') shapeVal = 2;
                    if (obj.userData.shape === 'Wedge') shapeVal = 3;
                    record.props.Shape = shapeVal;
                }
            } else if (actualClassName === 'Script') {
                record.props.Source = studioApp.scripts.get(node.data) || '';
            } else if (actualClassName === 'Lighting') {
                record.props.Technology = 3; // ShadowMap
                record.props.GlobalShadows = true;
                record.props.Brightness = 3;
                record.props.TimeOfDay = "14:30:00";
            }

            instances.push(record);
            instanceMap.set(ref, record);

            if (node.children) {
                node.children.forEach(childId => processNode(childId, ref));
            }
        };

        // Start processing from root children
        studioApp.treeItems['root'].children.forEach(childId => processNode(childId, -1));

        // 2. Group by Class
        const classes = new Map(); // ClassName -> [InstanceRecord]
        const classIds = new Map(); // ClassName -> ClassID (0..N)

        instances.forEach(inst => {
            if (!classes.has(inst.className)) {
                classes.set(inst.className, []);
                classIds.set(inst.className, classIds.size);
            }
            classes.get(inst.className).push(inst);
        });

        // --- Write Header ---
        writer.writeBytes(new Uint8Array(kMagic));
        writer.writeBytes(new Uint8Array(kSignature));
        writer.writeUInt16LE(kVersion);
        writer.writeInt32LE(classes.size); // Class Count
        writer.writeInt32LE(instances.length); // Instance Count
        writer.writeBytes(new Uint8Array(8)); // Reserved

        // --- Write META Chunk ---
        // Optional, but good for robustness
        {
            const metaData = [['ExplicitAutoJoints', 'true']];
            const chunk = new BinaryWriter();
            chunk.writeUInt32LE(metaData.length);
            metaData.forEach(([k, v]) => {
                chunk.writeString(k);
                chunk.writeString(v);
            });
            writeChunk(writer, 'META', chunk.getResult());
        }

        // --- Write SSTR Chunk ---
        // We aren't using shared strings for simplicity (optimization), just emitting empty or minimal SSTR if needed.
        // Spec says 0 or 1. We can skip it or write empty.
        {
            const chunk = new BinaryWriter();
            chunk.writeUInt32LE(0); // Version
            chunk.writeUInt32LE(0); // Count
            writeChunk(writer, 'SSTR', chunk.getResult());
        }

        // --- Write INST Chunks ---
        classes.forEach((instList, className) => {
            const chunk = new BinaryWriter();
            chunk.writeUInt32LE(classIds.get(className)); // Class ID
            chunk.writeString(className);

            const isService = ['Workspace', 'Lighting', 'ReplicatedStorage', 'ServerScriptService', 
                'ServerStorage', 'StarterGui', 'StarterPack', 'Teams', 'SoundService', 
                'Chat', 'Players', 'ReplicatedFirst'].includes(className);

            chunk.writeUInt8(isService ? 1 : 0); // Object Format
            chunk.writeUInt32LE(instList.length);

            // Referents (Delta Encoded, Transformed, Interleaved)
            const referents = new Int32Array(instList.length);
            let lastRef = 0;
            instList.forEach((inst, i) => {
                const delta = inst.id - lastRef;
                referents[i] = transformInt(delta);
                lastRef = inst.id;
            });
            chunk.writeInterleaved(referents);

            if (isService) {
                // Service Markers (all 1s?)
                // Spec: "Service Markers ... 1 for each instance if the class is a service"
                // Actually it's uint8 array?
                // "Service Markers | Array(u8)"
                // We write N bytes of 1? Or just markers?
                // "If the Object Format is service, the service markers section contains 1 repeated for the number of instances"
                // Actually, usually 1 means "Do Not Replicate"? No, "Is Service".
                // Let's just write 1s.
                const markers = new Uint8Array(instList.length);
                markers.fill(1);
                chunk.writeBytes(markers);
            }

            writeChunk(writer, 'INST', chunk.getResult());
        });

        // --- Write PROP Chunks ---
        // Helper to write a property chunk
        const writeProp = (className, propName, typeId, values) => {
            const chunk = new BinaryWriter();
            chunk.writeUInt32LE(classIds.get(className));
            chunk.writeString(propName);
            chunk.writeUInt8(typeId);

            // Values writing based on type
            if (typeId === 0x1) { // String
                values.forEach(v => chunk.writeString(v));
            } else if (typeId === 0x2) { // Bool
                values.forEach(v => chunk.writeUInt8(v ? 1 : 0));
            } else if (typeId === 0x3) { // Int32
                const raw = values.map(v => transformInt(v));
                chunk.writeInterleaved(raw);
            } else if (typeId === 0x4) { // Float32
                const raw = values.map(v => transformFloat(v));
                chunk.writeInterleaved(raw);
            } else if (typeId === 0xC) { // Color3
                const rs = values.map(v => transformFloat(v.r));
                const gs = values.map(v => transformFloat(v.g));
                const bs = values.map(v => transformFloat(v.b));
                chunk.writeInterleaved(rs);
                chunk.writeInterleaved(gs);
                chunk.writeInterleaved(bs);
            } else if (typeId === 0xE) { // Vector3
                const xs = values.map(v => transformFloat(v.x));
                const ys = values.map(v => transformFloat(v.y));
                const zs = values.map(v => transformFloat(v.z));
                chunk.writeInterleaved(xs);
                chunk.writeInterleaved(ys);
                chunk.writeInterleaved(zs);
            } else if (typeId === 0x12) { // Enum (UInt32)
                 const raw = values.map(v => transformInt(v));
                 chunk.writeInterleaved(raw);
            } else if (typeId === 0x10) { // CFrame
                // Spec fix: CFrame rotation/IDs are mixed, not interleaved arrays.
                // Structure: [ID][Rot?][ID][Rot?]... followed by [Pos X][Pos Y][Pos Z]
                
                const idsAndRots = new BinaryWriter();
                const xs = [], ys = [], zs = [];

                values.forEach(mat => {
                    const elements = mat.elements;
                    // ThreeJS (Col-Major) to Roblox (Row-Major components) mapping:
                    // R00, R01, R02 (Row 0) -> elements[0], elements[4], elements[8]
                    const r00 = elements[0], r10 = elements[1], r20 = elements[2];
                    const r01 = elements[4], r11 = elements[5], r21 = elements[6];
                    const r02 = elements[8], r12 = elements[9], r22 = elements[10];
                    
                    const x = elements[12], y = elements[13], z = elements[14];

                    // Check Identity (approximate)
                    const isIdentity = 
                        Math.abs(r00-1)<1e-4 && Math.abs(r01)<1e-4 && Math.abs(r02)<1e-4 &&
                        Math.abs(r10)<1e-4 && Math.abs(r11-1)<1e-4 && Math.abs(r12)<1e-4 &&
                        Math.abs(r20)<1e-4 && Math.abs(r21)<1e-4 && Math.abs(r22-1)<1e-4;

                    if (isIdentity) {
                        idsAndRots.writeUInt8(0x02); // Type 2: Identity
                    } else {
                        idsAndRots.writeUInt8(0x00); // Type 0: Rotation
                        
                        // Write 9 Floats (R00..R22), Little Endian, RAW (No Interleaving)
                        const rotBuf = new ArrayBuffer(36);
                        const rotView = new DataView(rotBuf);
                        rotView.setFloat32(0, r00, true);
                        rotView.setFloat32(4, r01, true);
                        rotView.setFloat32(8, r02, true);
                        rotView.setFloat32(12, r10, true);
                        rotView.setFloat32(16, r11, true);
                        rotView.setFloat32(20, r12, true);
                        rotView.setFloat32(24, r20, true);
                        rotView.setFloat32(28, r21, true);
                        rotView.setFloat32(32, r22, true);
                        idsAndRots.writeBytes(new Uint8Array(rotBuf));
                    }

                    xs.push(transformFloat(x));
                    ys.push(transformFloat(y));
                    zs.push(transformFloat(z));
                });

                // Write ID/Rotation stream
                chunk.writeBytes(idsAndRots.getResult());

                // Write Positions (Standard Interleaved Vector3)
                chunk.writeInterleaved(xs);
                chunk.writeInterleaved(ys);
                chunk.writeInterleaved(zs);
            }

            writeChunk(writer, 'PROP', chunk.getResult());
        };

        // Iterate Classes and Properties
        classes.forEach((instList, className) => {
            // Define property extractors
            // Name is universal
            writeProp(className, 'Name', 0x1, instList.map(i => i.name));

            // Specifics
            if (className === 'Part' || className === 'SpawnLocation') {
                writeProp(className, 'Anchored', 0x2, instList.map(i => i.props.Anchored));
                writeProp(className, 'CanCollide', 0x2, instList.map(i => i.props.CanCollide));
                writeProp(className, 'Locked', 0x2, instList.map(i => i.props.Locked));
                writeProp(className, 'Transparency', 0x4, instList.map(i => i.props.Transparency));
                writeProp(className, 'Size', 0xE, instList.map(i => i.props.Size)); 
                writeProp(className, 'Color', 0xC, instList.map(i => i.props.Color));
                writeProp(className, 'CFrame', 0x10, instList.map(i => i.props.CFrame));
                writeProp(className, 'Shape', 0x12, instList.map(i => i.props.Shape));
            }

            if (className === 'Script') {
                writeProp(className, 'Source', 0x1, instList.map(i => i.props.Source));
            }
        });

        // --- Write PRNT Chunk ---
        {
            const chunk = new BinaryWriter();
            chunk.writeUInt8(0); // Version
            chunk.writeUInt32LE(instances.length);

            const childRefs = new Int32Array(instances.length);
            const parentRefs = new Int32Array(instances.length);

            instances.forEach((inst, i) => {
                childRefs[i] = transformInt(inst.id); // Child IDs are delta encoded? 
                // Spec: "Child Referents and Parent Referents ... Referent type".
                // Referent arrays are delta encoded.
                // BUT PRNT chunk format: "Referents of child instances" (Array).
                // Actually, PRNT chunk uses two arrays of referents.
                // Are they delta encoded? Yes.
            });

            // Construct delta arrays
            // We need to sort or just iterate?
            // Usually we just write them in the order of instances?
            // No, the arrays are parallel. index i in Child corresponds to index i in Parent.
            // We can just use the instances array order.

            let lastChild = 0;
            let lastParent = 0;
            const deltaChild = new Int32Array(instances.length);
            const deltaParent = new Int32Array(instances.length);

            for(let i=0; i<instances.length; i++) {
                const inst = instances[i];
                deltaChild[i] = transformInt(inst.id - lastChild);
                lastChild = inst.id;

                deltaParent[i] = transformInt(inst.parentId - lastParent);
                lastParent = inst.parentId;
            }

            chunk.writeInterleaved(deltaChild);
            chunk.writeInterleaved(deltaParent);

            writeChunk(writer, 'PRNT', chunk.getResult());
        }

        // --- Write END Chunk ---
        {
            const chunk = new BinaryWriter();
            chunk.writeBytes(stringToBytes('</roblox>'));
            writeChunk(writer, 'END', chunk.getResult());
        }

        // Download
        const blob = new Blob([writer.getResult()], { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'place.rbxl';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        log('[Studio] Exported binary place.rbxl');

    } catch (e) {
        log('[Studio] Export failed: ' + e.message, 'error');
        console.error(e);
    }
}

function writeChunk(writer, name, data) {
    // Name: 4 bytes string
    // Compressed Len: u32 (0 for uncompressed)
    // Uncompressed Len: u32
    // Reserved: 4 bytes (0)
    // Data

    const nameBytes = stringToBytes(name);
    const finalName = new Uint8Array(4);
    finalName.set(nameBytes.subarray(0, 4));

    writer.writeBytes(finalName);
    writer.writeUInt32LE(0); // Compressed Length (0 = uncompressed)
    writer.writeUInt32LE(data.length); // Uncompressed Length
    writer.writeUInt32LE(0); // Reserved
    writer.writeBytes(data);
}