
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

import {
    mergeGeometries
} from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js";


export class CoinFactory {

    constructor(options = {}) {

        this.radius = options.radius ?? 0.18;
        this.thickness = options.thickness ?? 0.035;

        this.detailLevel = options.detailLevel ?? 64;

        this.materials = {

            gold: new THREE.MeshStandardMaterial({
                color: 0xE9A817,
                metalness: 0.96,
                roughness: 0.22
            }),

            brightGold: new THREE.MeshStandardMaterial({
                color: 0xFFD95A,
                metalness: 0.98,
                roughness: 0.17
            }),

            darkGold: new THREE.MeshStandardMaterial({
                color: 0x9D640A,
                metalness: 0.94,
                roughness: 0.29
            }),

            edge: new THREE.MeshStandardMaterial({
                color: 0xC58A12,
                metalness: 0.97,
                roughness: 0.2
            }),

            highlight: new THREE.MeshStandardMaterial({
                color: 0xFFF0A0,
                metalness: 0.98,
                roughness: 0.13
            })
        };

        this.geometry = this.createGeometry();

        this.instancedGeometry = this.createMergedGeometry();

        this.tempMatrix = new THREE.Matrix4();
        this.tempPosition = new THREE.Vector3();
        this.tempScale = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();

        this.disposed = false;
    }


    // ==================================================
    // MÜNZEN-GEOMETRIE
    // ==================================================

    createGeometry() {

        const group = new THREE.Group();

        // Hauptkörper
        const bodyGeometry = new THREE.CylinderGeometry(
            this.radius,
            this.radius,
            this.thickness,
            this.detailLevel,
            1,
            false
        );

        const body = new THREE.Mesh(
            bodyGeometry,
            this.materials.gold
        );

        body.rotation.x = Math.PI / 2;
        group.add(body);


        // Vorder- und Rückseite
        this.addFace(group, 1);
        this.addFace(group, -1);


        // Äußerer Rand
        this.addRim(group);


        // Zusätzliche feine Ringe
        this.addDecorativeRings(group);


        // Rillen am Münzrand
        this.addEdgeDetails(group);


        // Zusätzliche Prägung
        this.addMicroDetails(group);


        group.traverse(object => {

            if (!object.isMesh) return;

            object.castShadow = true;
            object.receiveShadow = true;

        });

        return group;
    }


    // ==================================================
    // MÜNZENFLÄCHEN
    // ==================================================

    addFace(group, side) {

        const z = side * (
            this.thickness / 2 + 0.004
        );

        const face = new THREE.Group();

        face.position.z = z;

        // Zentraler Stern
        const starShape = new THREE.Shape();

        const outerRadius = this.radius * 0.34;
        const innerRadius = this.radius * 0.145;

        for (let i = 0; i < 10; i++) {

            const angle =
                i * Math.PI / 5 - Math.PI / 2;

            const radius =
                i % 2 === 0
                    ? outerRadius
                    : innerRadius;

            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

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
                bevelSegments: 3,
                steps: 1,
                bevelSize: 0.002,
                bevelThickness: 0.001,
                curveSegments: 12
            }
        );

        const star = new THREE.Mesh(
            starGeometry,
            this.materials.highlight
        );

        star.position.z = 0.001;

        face.add(star);


        // Innerer Kreis um den Stern
        const centerRing = new THREE.Mesh(
            new THREE.TorusGeometry(
                this.radius * 0.46,
                this.radius * 0.018,
                10,
                64
            ),
            this.materials.darkGold
        );

        centerRing.position.z = 0.001;

        face.add(centerRing);


        // Kleine geprägte Punkte
        const dotGeometry = new THREE.SphereGeometry(
            this.radius * 0.025,
            12,
            10
        );

        for (let i = 0; i < 16; i++) {

            const angle =
                i / 16 * Math.PI * 2;

            const dot = new THREE.Mesh(
                dotGeometry,
                this.materials.brightGold
            );

            dot.position.set(
                Math.cos(angle) * this.radius * 0.79,
                Math.sin(angle) * this.radius * 0.79,
                0.003
            );

            face.add(dot);
        }


        // Äußerer Prägestreifen
        const outerDots = 32;

        for (let i = 0; i < outerDots; i++) {

            const angle =
                i / outerDots * Math.PI * 2;

            const dot = new THREE.Mesh(
                dotGeometry,
                this.materials.highlight
            );

            dot.scale.setScalar(0.55);

            dot.position.set(
                Math.cos(angle) * this.radius * 0.91,
                Math.sin(angle) * this.radius * 0.91,
                0.002
            );

            face.add(dot);
        }


        // Rückseite drehen
        if (side < 0) {
            face.rotation.y = Math.PI;
        }

        group.add(face);
    }


    // ==================================================
    // ÄUSSERER MÜNZENRAND
    // ==================================================

    addRim(group) {

        const rimGeometry = new THREE.TorusGeometry(
            this.radius * 0.91,
            this.radius * 0.055,
            12,
            96
        );

        const front = new THREE.Mesh(
            rimGeometry,
            this.materials.brightGold
        );

        front.position.z =
            this.thickness / 2 + 0.003;

        group.add(front);


        const back = new THREE.Mesh(
            rimGeometry,
            this.materials.brightGold
        );

        back.position.z =
            -this.thickness / 2 - 0.003;

        group.add(back);


        // Äußerer schmaler Metallring
        const outerGeometry = new THREE.TorusGeometry(
            this.radius * 0.975,
            this.radius * 0.012,
            8,
            96
        );

        const outerFront = new THREE.Mesh(
            outerGeometry,
            this.materials.edge
        );

        outerFront.position.z =
            this.thickness / 2;

        group.add(outerFront);


        const outerBack = new THREE.Mesh(
            outerGeometry,
            this.materials.edge
        );

        outerBack.position.z =
            -this.thickness / 2;

        group.add(outerBack);
    }


    // ==================================================
    // DEKORATIVE RINGE
    // ==================================================

    addDecorativeRings(group) {

        const rings = [
            {
                radius: 0.68,
                thickness: 0.018,
                material: this.materials.darkGold
            },
            {
                radius: 0.73,
                thickness: 0.009,
                material: this.materials.highlight
            },
            {
                radius: 0.84,
                thickness: 0.012,
                material: this.materials.edge
            }
        ];

        for (const settings of rings) {

            const geometry = new THREE.TorusGeometry(
                this.radius * settings.radius,
                this.radius * settings.thickness,
                8,
                72
            );

            for (const side of [-1, 1]) {

                const ring = new THREE.Mesh(
                    geometry,
                    settings.material
                );

                ring.position.z =
                    side * (this.thickness / 2 + 0.004);

                group.add(ring);
            }
        }
    }


    // ==================================================
    // GERILLTER MÜNZENRAND
    // ==================================================

    addEdgeDetails(group) {

        const count = 64;

        const detailGeometry = new THREE.BoxGeometry(
            0.007,
            0.014,
            this.thickness * 0.78
        );

        for (let i = 0; i < count; i++) {

            const angle =
                i / count * Math.PI * 2;

            const detail = new THREE.Mesh(
                detailGeometry,
                this.materials.highlight
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


    // ==================================================
    // KLEINE PRÄGEDETAILS
    // ==================================================

    addMicroDetails(group) {

        const geometry = new THREE.SphereGeometry(
            this.radius * 0.012,
            8,
            6
        );

        for (const side of [-1, 1]) {

            const detailGroup = new THREE.Group();

            detailGroup.position.z =
                side * (this.thickness / 2 + 0.005);

            for (let i = 0; i < 24; i++) {

                const angle =
                    i / 24 * Math.PI * 2;

                const detail = new THREE.Mesh(
                    geometry,
                    this.materials.highlight
                );

                detail.position.set(
                    Math.cos(angle) * this.radius * 0.59,
                    Math.sin(angle) * this.radius * 0.59,
                    0
                );

                detailGroup.add(detail);
            }

            if (side < 0) {
                detailGroup.rotation.y = Math.PI;
            }

            group.add(detailGroup);
        }
    }


    // ==================================================
    // OPTIMIERTE INSTANCED-GEOMETRIE
    // ==================================================

    createMergedGeometry() {

        const group = this.geometry;

        group.updateMatrixWorld(true);

        const materialList = Object.values(this.materials);

        const geometryGroups = materialList.map(() => []);

        const materialIndices = new Map();

        materialList.forEach((material, index) => {
            materialIndices.set(material, index);
        });


        // Alle Münzenteile nach Material sortieren
        group.traverse(object => {

            if (!object.isMesh) return;

            const materialIndex =
                materialIndices.get(object.material);

            if (materialIndex === undefined) return;

            const geometry = object.geometry.clone();

            geometry.applyMatrix4(object.matrixWorld);

            geometryGroups[materialIndex].push(geometry);
        });


        // Geometrien je Material zusammenführen
        const mergedByMaterial = [];

        for (const geometries of geometryGroups) {

            if (geometries.length === 0) {
                continue;
            }

            const merged = mergeGeometries(
                geometries,
                false
            );

            for (const geometry of geometries) {
                geometry.dispose();
            }

            if (merged) {
                mergedByMaterial.push(merged);
            }
        }


        // Eine Gesamtgeometrie mit Materialgruppen
        const finalGeometry = mergeGeometries(
            mergedByMaterial,
            true
        );

        for (const geometry of mergedByMaterial) {
            geometry.dispose();
        }

        if (!finalGeometry) {
            throw new Error(
                "Die optimierte Münzgeometrie konnte nicht erstellt werden."
            );
        }

        finalGeometry.computeBoundingBox();
        finalGeometry.computeBoundingSphere();

        return finalGeometry;
    }


    // ==================================================
    // EINZELNE MÜNZE
    // ==================================================

    create(position = {}, options = {}) {

        if (this.disposed) {
            throw new Error("CoinFactory wurde bereits entsorgt.");
        }

        const coin = this.geometry.clone();

        coin.position.set(
            position.x ?? 0,
            position.y ?? 0,
            position.z ?? 0
        );

        if (options.rotation) {

            coin.rotation.set(
                options.rotation.x ?? 0,
                options.rotation.y ?? 0,
                options.rotation.z ?? 0
            );
        }

        if (options.scale !== undefined) {
            coin.scale.setScalar(options.scale);
        }

        coin.userData.isCoin = true;
        coin.userData.coinId = options.id ?? null;
        coin.userData.value = options.value ?? 1;

        coin.userData.radius = this.radius;
        coin.userData.thickness = this.thickness;

        return coin;
    }


    // ==================================================
    // INSTANCED MÜNZEN
    // ==================================================

    createInstancedMesh(count, options = {}) {

        if (this.disposed) {
            throw new Error("CoinFactory wurde bereits entsorgt.");
        }

        count = Math.max(1, Math.floor(count));

        const mesh = new THREE.InstancedMesh(
            this.instancedGeometry,
            Object.values(this.materials),
            count
        );

        mesh.instanceMatrix.setUsage(
            THREE.DynamicDrawUsage
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.frustumCulled = true;

        mesh.count = count;

        mesh.userData.isCoinCollection = true;
        mesh.userData.coinRadius = this.radius;
        mesh.userData.coinThickness = this.thickness;

        mesh.userData.coinCapacity = count;

        if (options.name) {
            mesh.name = options.name;
        }

        // Alle Instanzen zunächst unsichtbar positionieren
        const dummy = new THREE.Object3D();

        dummy.scale.setScalar(0);

        dummy.updateMatrix();

        for (let i = 0; i < count; i++) {
            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;

        mesh.computeBoundingSphere();

        return mesh;
    }


    // ==================================================
    // INSTANCED MÜNZE AKTUALISIEREN
    // ==================================================

    updateInstancedMesh(
        mesh,
        index,
        position,
        quaternion = null,
        scale = 1
    ) {

        if (!mesh || !mesh.isInstancedMesh) {
            return false;
        }

        if (index < 0 || index >= mesh.userData.coinCapacity) {
            return false;
        }

        this.tempPosition.set(
            position.x ?? 0,
            position.y ?? 0,
            position.z ?? 0
        );

        if (quaternion) {

            this.tempQuaternion.copy(quaternion);

        } else {

            this.tempQuaternion.identity();
        }

        this.tempScale.setScalar(scale);

        this.tempMatrix.compose(
            this.tempPosition,
            this.tempQuaternion,
            this.tempScale
        );

        mesh.setMatrixAt(index, this.tempMatrix);

        mesh.instanceMatrix.needsUpdate = true;

        return true;
    }


    // ==================================================
    // BATCH-UPDATE
    // ==================================================

    commitInstancedMesh(mesh) {

        if (!mesh || !mesh.isInstancedMesh) {
            return;
        }

        mesh.instanceMatrix.needsUpdate = true;

        mesh.computeBoundingSphere();
    }


    // ==================================================
    // INSTANZ-FARBE
    // ==================================================

    setInstanceColor(mesh, index, color) {

        if (!mesh || !mesh.isInstancedMesh) {
            return false;
        }

        if (index < 0 || index >= mesh.userData.coinCapacity) {
            return false;
        }

        mesh.setColorAt(
            index,
            color instanceof THREE.Color
                ? color
                : new THREE.Color(color)
        );

        mesh.instanceColor.needsUpdate = true;

        return true;
    }


    // ==================================================
    // GEOMETRIE UND MATERIALIEN AUFRÄUMEN
    // ==================================================

    dispose() {

        if (this.disposed) return;

        this.disposed = true;

        const geometries = new Set();

        this.geometry.traverse(object => {

            if (object.isMesh && object.geometry) {
                geometries.add(object.geometry);
            }
        });

        geometries.add(this.instancedGeometry);

        for (const geometry of geometries) {
            geometry.dispose();
        }

        for (const material of Object.values(this.materials)) {
            material.dispose();
        }

        this.geometry.clear();

    }
}


// ======================================================
// STANDARD-COIN-FACTORY
// ======================================================

export const coinFactory = new CoinFactory();


// ======================================================
// DIREKT VERWENDBARE MÜNZE
// ======================================================

export function createCoin(position, options = {}) {

    return coinFactory.create(position, options);
}
