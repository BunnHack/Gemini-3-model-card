import * as THREE from 'three';

export function createWedgeGeometry(width, height, depth) {
    const shape = new THREE.Shape();
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    shape.moveTo(-halfWidth, -halfHeight);
    shape.lineTo(halfWidth, -halfHeight);
    shape.lineTo(-halfWidth, halfHeight);
    shape.lineTo(-halfWidth, -halfHeight);

    const extrudeSettings = {
        steps: 1,
        depth: depth,
        bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.translate(0, 0, -depth / 2); // Center the geometry
    return geometry;
}

