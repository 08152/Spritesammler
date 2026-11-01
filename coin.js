
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

import {
    mergeGeometries
} from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js";

export class CoinFactory {

    constructor(options = {}) {

        this.radius = options.radius ?? 0.18;
        this.thickness = options.thickness ?? 0.035;
        this.detailLevel = options.detailLevel ?? 64;

        this.disposed = false;

        // ==================================================
        // MATERIALIEN
        // ==================================================

        this.materials = {

            gold: new THREE.MeshStandardMaterial({
                color: 0xD99A19,
                metalness: 0.96,
                roughness: 0.24
            }),

            brightGold: new THREE.MeshStandardMaterial({
                color: 0xFFD45B,
                metalness: 0.98,
                roughness: 0.17
            }),

            darkGold: new THREE.MeshStandardMaterial({
                color: 0x85500B,
                metalness: 0.94,
                roughness: 0.29
            }),

            edge: new THREE.MeshStandardMaterial({
                color: 0xB77A12,
                metalness: 0.97,
                roughness: 0.2
            }),

            highlight: new THREE.MeshStandardMaterial({
                color: 0xFFF0AC,
                metalness: 0.98,
                roughness: 0.13
            })
        };

        this.geometry = this.createGeometry();

        const merged = this.createMergedGeometry();

        this.instancedGeometry = merged.geometry;
        this.instancedMaterials = merged.materials;

        this.tempMatrix = new THREE.Matrix4();
        this.tempPosition = new THREE.Vector3();
        this.tempScale = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();

    }


    // ==================================================
    // KOMPLETTE MÜNZE
    // ==================================================

    createGeometry() {

        const group = new THREE.Group();

        group.name = "PremiumGoldCoin";

        this.addCoinBody(group);

        this.addFace(group, 1);
        this.addFace(group, -1);

        this.addRim(group);
        this.addDecorativeRings(group);
        this.addEdgeDetails(group);
        this.addMicroDetails(group);

        group.traverse(object => {

            if (!object.isMesh) return;

            object.castShadow = true;
            object.receiveShadow = true;

        });

        group.userData.isCoin = true;
        group.userData.radius = this.radius;
        group.userData.thickness = this.thickness;

        group.updateMatrixWorld(true);

        return group;
    }


    // ==================================================
    // MÜNZENKÖRPER
    // ==================================================

    addCoinBody(group) {

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

        // Z ist die Vorderseite der Münze.
        body.rotation.x = Math.PI / 2;

        group.add(body);

        // Dünner zusätzlicher Randkörper
        const innerGeometry = new THREE.CylinderGeometry(
            this.radius * 0.965,
            this.radius * 0.965,
            this.thickness * 1.04,
            this.detailLevel,
            1,
            false
        );

        const inner = new THREE.Mesh(
            innerGeometry,
            this.materials.edge
        );

        inner.rotation.x = Math.PI / 2;

        group.add(inner);
    }


    // ==================================================
    // STERNFORM
    // ==================================================

    createStarGeometry(outerRadius, innerRadius) {

        const shape = new THREE.Shape();

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
                shape.moveTo(x, y);
            } else {
                shape.lineTo(x, y);
            }
        }

        shape.closePath();

        return new THREE.ExtrudeGeometry(shape, {
            depth: 0.006,
            bevelEnabled: true,
            bevelSegments: 3,
            bevelSize: 0.002,
            bevelThickness: 0.0015,
            steps: 1,
            curveSegments: 12
        });
    }


    // ==================================================
    // VORDER- UND RÜCKSEITE
    // ==================================================

    addFace(group, side) {

        const face = new THREE.Group();

        face.name = side > 0
            ? "CoinFront"
            : "CoinBack";

        face.position.z =
            side * (this.thickness / 2 + 0.003);

        if (side < 0) {
            face.rotation.y = Math.PI;
        }

        // Zentraler großer Stern
        const star = new THREE.Mesh(
            this.createStarGeometry(
                this.radius * 0.34,
                this.radius * 0.145
            ),
            this.materials.highlight
        );

        star.position.z = 0.002;

        face.add(star);


        // Innerer Ring
        this.addTorus(
            face,
            this.radius * 0.46,
            this.radius * 0.025,
            this.materials.darkGold,
            0.002
        );


        // Zweiter feiner Ring
        this.addTorus(
            face,
            this.radius * 0.54,
            this.radius * 0.012,
            this.materials.brightGold,
            0.001
        );


        // Dekorative Strahlen um den Stern
        const rayGeometry = new THREE.BoxGeometry(
            this.radius * 0.018,
            this.radius * 0.20,
            0.003
        );

        for (let i = 0; i < 16; i++) {

            const angle =
                i / 16 * Math.PI * 2;

            const ray = new THREE.Mesh(
                rayGeometry,
                this.materials.brightGold
            );

            ray.position.set(
                Math.cos(angle) * this.radius * 0.66,
                Math.sin(angle) * this.radius * 0.66,
                0.002
            );

            ray.rotation.z = angle - Math.PI / 2;

            face.add(ray);
        }


        // Große Randpunkte
        const dotGeometry = new THREE.SphereGeometry(
            this.radius * 0.025,
            12,
            8
        );

        for (let i = 0; i < 24; i++) {

            const angle =
                i / 24 * Math.PI * 2;

            const dot = new THREE.Mesh(
                dotGeometry,
                this.materials.highlight
            );

            dot.position.set(
                Math.cos(angle) * this.radius * 0.82,
                Math.sin(angle) * this.radius * 0.82,
                0.003
            );

            face.add(dot);
        }


        // Äußerer feiner Punktring
        const smallDotGeometry = new THREE.SphereGeometry(
            this.radius * 0.012,
            8,
            6
        );

        for (let i = 0; i < 48; i++) {

            const angle =
                i / 48 * Math.PI * 2;

            const dot = new THREE.Mesh(
                smallDotGeometry,
                this.materials.darkGold
            );

            dot.position.set(
                Math.cos(angle) * this.radius * 0.94,
                Math.sin(angle) * this.radius * 0.94,
                0.002
            );

            face.add(dot);
        }

        group.add(face);
    }


    // ==================================================
    // TORUS-HILFSFUNKTION
    // ==================================================

    addTorus(
        parent,
        radius,
        tube,
        material,
        z = 0
    ) {

        const mesh = new THREE.Mesh(
            new THREE.TorusGeometry(
                radius,
                tube,
                10,
                96
            ),
            material
        );

        mesh.position.z = z;

        parent.add(mesh);

        return mesh;
    }


    // ==================================================
    // ÄUSSERER RAND
    // ==================================================

    addRim(group) {

        // Vorderer heller Rand
        this.addTorus(
            group,
            this.radius * 0.91,
            this.radius * 0.055,
            this.materials.brightGold,
            this.thickness / 2 + 0.002
        );

        // Hinterer heller Rand
        this.addTorus(
            group,
            this.radius * 0.91,
            this.radius * 0.055,
            this.materials.brightGold,
            -this.thickness / 2 - 0.002
        );

        // Äußerer Metallring vorne
        this.addTorus(
            group,
            this.radius * 0.975,
            this.radius * 0.012,
            this.materials.highlight,
            this.thickness / 2
        );

        // Äußerer Metallring hinten
        this.addTorus(
            group,
            this.radius * 0.975,
            this.radius * 0.012,
            this.materials.edge,
            -this.thickness / 2
        );
    }


    // ==================================================
    // DEKORATIVE RINGE
    // ==================================================

    addDecorativeRings(group) {

        const rings = [
            {
                radius: 0.66,
                thickness: 0.012,
                material: this.materials.darkGold
            },
            {
                radius: 0.70,
                thickness: 0.008,
                material: this.materials.highlight
            },
            {
                radius: 0.76,
                thickness: 0.009,
                material: this.materials.edge
            }
        ];

        for (const settings of rings) {

            for (const side of [-1, 1]) {

                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(
                        this.radius * settings.radius,
                        this.radius * settings.thickness,
                        8,
                        96
                    ),
                    settings.material
                );

                ring.position.z =
                    side * (this.thickness / 2 + 0.003);

                group.add(ring);
            }
        }
    }


    // ==================================================
    // GERILLTER MÜNZENRAND
    // ==================================================

    addEdgeDetails(group) {

        const count = 80;

        const geometry = new THREE.BoxGeometry(
            0.006,
            0.012,
            this.thickness * 0.82
        );

        for (let i = 0; i < count; i++) {

            const angle =
                i / count * Math.PI * 2;

            const detail = new THREE.Mesh(
                geometry,
                i % 2 === 0
                    ? this.materials.highlight
                    : this.materials.darkGold
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
    // FEINE MIKROPRÄGUNG
    // ==================================================

    addMicroDetails(group) {

        const geometry = new THREE.SphereGeometry(
            this.radius * 0.009,
            8,
            6
        );

        for (const side of [-1, 1]) {

            const detailGroup = new THREE.Group();

            detailGroup.position.z =
                side * (this.thickness / 2 + 0.004);

            if (side < 0) {
                detailGroup.rotation.y = Math.PI;
            }

            for (let i = 0; i < 40; i++) {

                const angle =
                    i / 40 * Math.PI * 2;

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


        // Meshes nach Material sortieren
        group.traverse(object => {

            if (!object.isMesh) return;

            const materialIndex =
                materialIndices.get(object.material);

            if (materialIndex === undefined) return;

            let geometry = object.geometry.clone();

            geometry.applyMatrix4(object.matrixWorld);

            // Einheitlich nicht-indizierte Geometrien verwenden.
            if (geometry.index) {
                const nonIndexed = geometry.toNonIndexed();
                geometry.dispose();
                geometry = nonIndexed;
            }

            geometry.clearGroups();

            geometryGroups[materialIndex].push(geometry);
        });


        // Je Material zusammenführen
        const mergedGeometries = [];
        const mergedMaterials = [];

        for (let i = 0; i < geometryGroups.length; i++) {

            const geometries = geometryGroups[i];

            if (geometries.length === 0) continue;

            const merged = mergeGeometries(
                geometries,
                false
            );

            for (const geometry of geometries) {
                geometry.dispose();
            }

            if (!merged) {
                throw new Error(
                    "Münzgeometrie konnte nicht zusammengeführt werden."
                );
            }

            mergedGeometries.push(merged);
            mergedMaterials.push(materialList[i]);
        }


        // Gesamtgeometrie mit Materialgruppen
        const finalGeometry = mergeGeometries(
            mergedGeometries,
            true
        );

        for (const geometry of mergedGeometries) {
            geometry.dispose();
        }

        if (!finalGeometry) {
            throw new Error(
                "Die finale Instanced-Münzgeometrie ist fehlgeschlagen."
            );
        }

        finalGeometry.computeVertexNormals();
        finalGeometry.computeBoundingBox();
        finalGeometry.computeBoundingSphere();

        return {
            geometry: finalGeometry,
            materials: mergedMaterials
        };
    }


    // ==================================================
    // EINZELNE MÜNZE ERSTELLEN
    // ==================================================

    create(position = {}, options = {}) {

        this.checkDisposed();

        const coin = this.geometry.clone(true);

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

        if (options.quaternion) {
            coin.quaternion.copy(options.quaternion);
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
    // INSTANCED MESH ERSTELLEN
    // ==================================================

    createInstancedMesh(count, options = {}) {

        this.checkDisposed();

        const capacity = Math.max(
            1,
            Math.floor(count)
        );

        const mesh = new THREE.InstancedMesh(
            this.instancedGeometry,
            this.instancedMaterials,
            capacity
        );

        mesh.name = options.name ?? "CoinCollection";

        mesh.instanceMatrix.setUsage(
            THREE.DynamicDrawUsage
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Bei dynamischen Instanzen keine falsche Frustum-Grenze.
        mesh.frustumCulled = false;

        mesh.userData.isCoinCollection = true;
        mesh.userData.coinRadius = this.radius;
        mesh.userData.coinThickness = this.thickness;
        mesh.userData.coinCapacity = capacity;

        // Anfangszustand: unsichtbar
        const dummy = new THREE.Object3D();

        dummy.position.set(0, -10000, 0);
        dummy.scale.setScalar(0);

        dummy.updateMatrix();

        for (let i = 0; i < capacity; i++) {
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

        if (
            index < 0 ||
            index >= mesh.userData.coinCapacity
        ) {
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
    // BATCH UPDATE
    // ==================================================

    commitInstancedMesh(mesh) {

        if (!mesh || !mesh.isInstancedMesh) {
            return;
        }

        mesh.instanceMatrix.needsUpdate = true;

        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }

        mesh.computeBoundingSphere();
    }


    // ==================================================
    // INSTANZFARBE ÄNDERN
    // ==================================================

    setInstanceColor(mesh, index, color) {

        if (!mesh || !mesh.isInstancedMesh) {
            return false;
        }

        if (
            index < 0 ||
            index >= mesh.userData.coinCapacity
        ) {
            return false;
        }

        const threeColor = color instanceof THREE.Color
            ? color
            : new THREE.Color(color);

        mesh.setColorAt(index, threeColor);

        mesh.instanceColor.needsUpdate = true;

        return true;
    }


    // ==================================================
    // FEHLERPRÜFUNG
    // ==================================================

    checkDisposed() {

        if (this.disposed) {
            throw new Error(
                "CoinFactory wurde bereits entsorgt."
            );
        }
    }


    // ==================================================
    // AUFRÄUMEN
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
// STANDARD FACTORY
// ======================================================

export const coinFactory = new CoinFactory();


// ======================================================
// DIREKT VERWENDBARE MÜNZE
// ======================================================

export function createCoin(position, options = {}) {

    return coinFactory.create(position, options);
}
