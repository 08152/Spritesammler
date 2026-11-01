
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

export class CoinFactory {
    constructor(options = {}) {
        this.radius = options.radius ?? 0.18;
        this.thickness = options.thickness ?? 0.035;

        this.materials = {
            gold: new THREE.MeshStandardMaterial({
                color: 0xE9A817,
                metalness: 0.92,
                roughness: 0.24
            }),

            brightGold: new THREE.MeshStandardMaterial({
                color: 0xFFD95A,
                metalness: 0.95,
                roughness: 0.19
            }),

            darkGold: new THREE.MeshStandardMaterial({
                color: 0x9D640A,
                metalness: 0.9,
                roughness: 0.3
            }),

            edge: new THREE.MeshStandardMaterial({
                color: 0xC58A12,
                metalness: 0.95,
                roughness: 0.22
            })
        };

        this.geometry = this.createGeometry();
    }

    createGeometry() {
        const group = new THREE.Group();

        // Hauptkörper der Münze
        const bodyGeometry = new THREE.CylinderGeometry(
            this.radius,
            this.radius,
            this.thickness,
            64,
            1,
            false
        );

        const body = new THREE.Mesh(
            bodyGeometry,
            this.materials.gold
        );

        body.rotation.x = Math.PI / 2;
        group.add(body);

        // Vorderseite
        this.addFace(group, 1);

        // Rückseite
        this.addFace(group, -1);

        // Äußerer Rand
        const rimGeometry = new THREE.TorusGeometry(
            this.radius * 0.91,
            this.radius * 0.055,
            10,
            64
        );

        const frontRim = new THREE.Mesh(
            rimGeometry,
            this.materials.brightGold
        );

        frontRim.position.z = this.thickness / 2 + 0.003;
        group.add(frontRim);

        const backRim = frontRim.clone();
        backRim.position.z = -this.thickness / 2 - 0.003;
        group.add(backRim);

        // Dekorativer Innenring
        const innerRingGeometry = new THREE.TorusGeometry(
            this.radius * 0.68,
            this.radius * 0.018,
            8,
            64
        );

        const innerRing = new THREE.Mesh(
            innerRingGeometry,
            this.materials.darkGold
        );

        innerRing.position.z = this.thickness / 2 + 0.004;
        group.add(innerRing);

        const innerBack = innerRing.clone();
        innerBack.position.z = -this.thickness / 2 - 0.004;
        group.add(innerBack);

        // Kleine Rillen am Münzrand
        this.addEdgeDetails(group);

        group.traverse(object => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });

        return group;
    }

    addFace(group, side) {
        const z = side * (this.thickness / 2 + 0.004);

        // Großes geprägtes Symbol
        const symbolGroup = new THREE.Group();
        symbolGroup.position.z = z;

        const symbolMaterial = this.materials.brightGold;

        // Zentraler Stern
        const starShape = new THREE.Shape();

        const outerRadius = this.radius * 0.32;
        const innerRadius = this.radius * 0.14;

        for (let i = 0; i < 10; i++) {
            const angle = i * Math.PI / 5 - Math.PI / 2;
            const r = i % 2 === 0 ? outerRadius : innerRadius;

            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;

            if (i === 0) {
                starShape.moveTo(x, y);
            } else {
                starShape.lineTo(x, y);
            }
        }

        starShape.closePath();

        const starGeometry = new THREE.ExtrudeGeometry(
            starShape,
            {
                depth: 0.004,
                bevelEnabled: true,
                bevelSegments: 2,
                steps: 1,
                bevelSize: 0.002,
                bevelThickness: 0.001
            }
        );

        const star = new THREE.Mesh(
            starGeometry,
            symbolMaterial
        );

        star.position.z = 0.001;
        symbolGroup.add(star);

        // Kleine geprägte Punkte rundherum
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;

            const dotGeometry = new THREE.SphereGeometry(
                this.radius * 0.025,
                10,
                8
            );

            const dot = new THREE.Mesh(
                dotGeometry,
                this.materials.brightGold
            );

            dot.position.set(
                Math.cos(angle) * this.radius * 0.79,
                Math.sin(angle) * this.radius * 0.79,
                0.003
            );

            symbolGroup.add(dot);
        }

        // Rückseite umdrehen
        if (side < 0) {
            symbolGroup.rotation.y = Math.PI;
        }

        group.add(symbolGroup);
    }

    addEdgeDetails(group) {
        const count = 48;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;

            const detailGeometry = new THREE.BoxGeometry(
                0.008,
                0.012,
                this.thickness * 0.7
            );

            const detail = new THREE.Mesh(
                detailGeometry,
                this.materials.brightGold
            );

            detail.position.set(
                Math.cos(angle) * this.radius,
                Math.sin(angle) * this.radius,
                0
            );

            detail.rotation.z = angle;
            group.add(detail);
        }
    }

    create(position = { x: 0, y: 0, z: 0 }, options = {}) {
        const coin = this.geometry.clone();

        coin.position.set(
            position.x,
            position.y,
            position.z
        );

        if (options.rotation) {
            coin.rotation.set(
                options.rotation.x ?? 0,
                options.rotation.y ?? 0,
                options.rotation.z ?? 0
            );
        }

        if (options.scale) {
            coin.scale.setScalar(options.scale);
        }

        coin.userData.isCoin = true;
        coin.userData.coinId = options.id ?? null;

        return coin;
    }

    createInstancedMesh(count) {
        const geometry = new THREE.CylinderGeometry(
            this.radius,
            this.radius,
            this.thickness,
            32
        );

        const mesh = new THREE.InstancedMesh(
            geometry,
            this.materials.gold,
            count
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.instanceMatrix.setUsage(
            THREE.DynamicDrawUsage
        );

        return mesh;
    }

    updateInstancedMesh(mesh, index, position, quaternion, scale = 1) {
        const matrix = new THREE.Matrix4();

        const scaled = new THREE.Vector3(
            scale,
            scale,
            scale
        );

        matrix.compose(
            new THREE.Vector3(
                position.x,
                position.y,
                position.z
            ),
            quaternion,
            scaled
        );

        mesh.setMatrixAt(index, matrix);
        mesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.geometry.traverse(object => {
            if (object.geometry) {
                object.geometry.dispose();
            }
        });

        for (const material of Object.values(this.materials)) {
            material.dispose();
        }
    }
}

// Direkt verwendbare Standard-Fabrik
export const coinFactory = new CoinFactory();

// Einzelne Münze erstellen
export function createCoin(position, options = {}) {
    return coinFactory.create(position, options);
}
