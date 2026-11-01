
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/*
=========================================================
 HEBEN.JS – MÜNZEN, INSTANCED MESHES UND INVENTAR
=========================================================

 LINKSKLICK:
 Eine Münze aufheben.

 Q:
 Eine Münze droppen.

 E:
 Für die Zählmaschine reserviert.

 UNTERSTÜTZT:
 - Normale THREE.Mesh-Münzen
 - Münz-Gruppen
 - THREE.InstancedMesh mit sehr vielen Münzen
 - Rapier-Physik
=========================================================
*/

export class CoinPickupSystem {

    constructor(scene, camera, physics, options = {}) {

        this.scene = scene;
        this.camera = camera;
        this.physics = physics;

        this.options = {
            maxDistance: 3.5,

            dropDistance: 1.1,
            dropHeight: -0.35,

            dropSpeed: 2.0,
            dropSpin: 3.5,

            coinRadius: 0.18,
            coinThickness: 0.035,

            onPickup: null,
            onDrop: null,
            onInventoryChange: null,
            onInstanceRemoved: null,

            ...options
        };

        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = this.options.maxDistance;

        this.coins = new Map();

        // Registrierte InstancedMeshes
        this.instancedMeshes = new Map();

        // Inventar
        this.inventory = [];

        this.totalCollected = 0;

        this.enabled = true;

        this.targetCoin = null;

        this.tempMatrix = new THREE.Matrix4();
        this.tempWorldMatrix = new THREE.Matrix4();

        this.tempPosition = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.tempScale = new THREE.Vector3();
        this.tempColor = new THREE.Color();

        this.createTarget();
    }

    // =====================================================
    // ZIELANZEIGE
    // =====================================================

    createTarget() {

        this.target = new THREE.Group();

        this.target.visible = false;

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.045, 0.065, 32),

            new THREE.MeshBasicMaterial({
                color: 0xffd45c,
                transparent: true,
                opacity: 0.9,
                depthTest: false,
                side: THREE.DoubleSide
            })
        );

        const center = new THREE.Mesh(
            new THREE.CircleGeometry(0.012, 16),

            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                depthTest: false
            })
        );

        ring.position.z = -0.002;

        this.target.add(ring);
        this.target.add(center);

        this.target.position.set(0, 0, -1);

        this.target.renderOrder = 1000;

        this.camera.add(this.target);
    }

    // =====================================================
    // NORMALE MÜNZE REGISTRIEREN
    // =====================================================

    registerCoin(mesh, physicsCoin = null, value = 1, options = {}) {

        if (!mesh) return null;

        if (this.coins.has(mesh.uuid)) {
            return this.coins.get(mesh.uuid);
        }

        const coin = {

            type: "normal",

            mesh,

            physicsCoin,

            value,

            available: true,

            collected: false,

            originalScale: mesh.scale.clone(),

            physicsOptions: {
                radius: options.radius ?? this.options.coinRadius,
                thickness: options.thickness ?? this.options.coinThickness,
                density: options.density ?? 2.5,
                friction: options.friction ?? 0.85,
                restitution: options.restitution ?? 0.16
            }

        };

        mesh.userData.isPickupCoin = true;
        mesh.userData.pickupData = coin;
        mesh.userData.coinValue = value;

        this.coins.set(mesh.uuid, coin);

        return coin;
    }

    // =====================================================
    // INSTANCED MESH REGISTRIEREN
    // =====================================================

    /*
       Beispiel:

       pickup.registerInstancedMesh(coinMesh, {
           valuePerCoin: 1,
           radius: 0.18,
           thickness: 0.035
       });

       Optional:
       values: [1, 1, 5, 10, ...]
    */

    registerInstancedMesh(mesh, options = {}) {

        if (!mesh || !mesh.isInstancedMesh) {
            console.warn("registerInstancedMesh benötigt ein THREE.InstancedMesh.");
            return null;
        }

        if (this.instancedMeshes.has(mesh.uuid)) {
            return this.instancedMeshes.get(mesh.uuid);
        }

        const record = {

            mesh,

            count: mesh.count,

            instances: [],

            options: {

                valuePerCoin: options.valuePerCoin ?? 1,

                values: options.values ?? null,

                radius: options.radius ?? this.options.coinRadius,

                thickness: options.thickness ?? this.options.coinThickness,

                density: options.density ?? 2.5,

                friction: options.friction ?? 0.85,

                restitution: options.restitution ?? 0.16,

                onInstanceRemoved: options.onInstanceRemoved ?? null

            }

        };

        for (let i = 0; i < mesh.count; i++) {

            record.instances.push({

                value: record.options.values?.[i] ??
                    record.options.valuePerCoin,

                available: true

            });

        }

        mesh.userData.isPickupInstancedMesh = true;

        this.instancedMeshes.set(mesh.uuid, record);

        return record;
    }

    // =====================================================
    // INSTANCED MESH ABMELDEN
    // =====================================================

    unregisterInstancedMesh(mesh) {

        if (!mesh) return;

        const record = this.instancedMeshes.get(mesh.uuid);

        if (!record) return;

        delete mesh.userData.isPickupInstancedMesh;

        this.instancedMeshes.delete(mesh.uuid);
    }

    // =====================================================
    // NORMALE MÜNZE ABMELDEN
    // =====================================================

    unregisterCoin(mesh) {

        if (!mesh) return;

        const coin = this.coins.get(mesh.uuid);

        if (!coin) return;

        this.coins.delete(mesh.uuid);

        mesh.userData.isPickupCoin = false;

        delete mesh.userData.pickupData;
    }

    // =====================================================
    // INSTANCED MESH: WELTTRANSFORM ERMITTELN
    // =====================================================

    getInstanceTransform(record, instanceId) {

        const mesh = record.mesh;

        if (
            !mesh ||
            instanceId < 0 ||
            instanceId >= record.count
        ) {
            return null;
        }

        mesh.updateWorldMatrix(true, false);

        mesh.getMatrixAt(instanceId, this.tempMatrix);

        this.tempWorldMatrix.multiplyMatrices(
            mesh.matrixWorld,
            this.tempMatrix
        );

        this.tempWorldMatrix.decompose(
            this.tempPosition,
            this.tempQuaternion,
            this.tempScale
        );

        return {

            position: this.tempPosition.clone(),

            quaternion: this.tempQuaternion.clone(),

            scale: this.tempScale.clone()

        };
    }

    // =====================================================
    // INSTANCED MESH: EINZELNE MÜNZE ENTFERNEN
    // =====================================================

    removeInstance(record, instanceId) {

        if (!record) return false;

        if (
            instanceId < 0 ||
            instanceId >= record.count
        ) {
            return false;
        }

        const mesh = record.mesh;

        const lastIndex = record.count - 1;

        const removedData = record.instances[instanceId];

        let movedData = null;

        // Letzte Instanz auf die entfernte Position verschieben.
        if (instanceId !== lastIndex) {

            mesh.getMatrixAt(lastIndex, this.tempMatrix);

            mesh.setMatrixAt(instanceId, this.tempMatrix);

            if (mesh.instanceColor) {

                mesh.getColorAt(lastIndex, this.tempColor);

                mesh.setColorAt(instanceId, this.tempColor);

            }

            movedData = record.instances[lastIndex];

            record.instances[instanceId] = movedData;
        }

        record.instances.pop();

        record.count--;

        mesh.count = record.count;

        mesh.instanceMatrix.needsUpdate = true;

        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }

        mesh.computeBoundingSphere();

        const callbackData = {

            mesh,

            removedIndex: instanceId,

            movedFromIndex: lastIndex,

            removedData,

            movedData,

            newCount: record.count

        };

        if (typeof record.options.onInstanceRemoved === "function") {

            record.options.onInstanceRemoved(callbackData);

        }

        if (typeof this.options.onInstanceRemoved === "function") {

            this.options.onInstanceRemoved(callbackData);

        }

        return true;
    }

    // =====================================================
    // INSTANCED MESH: EINZELNE MÜNZE ALS MESH ERSTELLEN
    // =====================================================

    createIndividualCoin(record, instanceId, transform) {

        const source = record.mesh;

        let material;

        if (Array.isArray(source.material)) {

            material = source.material.map(m => m.clone());

        } else {

            material = source.material.clone();

        }

        // Individuelle Instanzfarbe übernehmen.
        if (source.instanceColor) {

            source.getColorAt(instanceId, this.tempColor);

            if (Array.isArray(material)) {

                for (const mat of material) {
                    if (mat.color) mat.color.multiply(this.tempColor);
                }

            } else if (material.color) {

                material.color.multiply(this.tempColor);

            }
        }

        const mesh = new THREE.Mesh(
            source.geometry,
            material
        );

        mesh.position.copy(transform.position);

        mesh.quaternion.copy(transform.quaternion);

        mesh.scale.copy(transform.scale);

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.userData.isPickupCoin = true;

        return mesh;
    }

    // =====================================================
    // ZIELMÜNZE FINDEN
    // =====================================================

    findTargetCoin() {

        if (!this.enabled) return null;

        this.raycaster.setFromCamera(
            new THREE.Vector2(0, 0),
            this.camera
        );

        const objects = [];

        // Normale Münzen.
        for (const coin of this.coins.values()) {

            if (!coin.available || coin.collected) continue;

            if (!coin.mesh.visible) continue;

            objects.push(coin.mesh);
        }

        // InstancedMeshes.
        for (const record of this.instancedMeshes.values()) {

            if (!record.mesh.visible) continue;

            if (record.count <= 0) continue;

            objects.push(record.mesh);
        }

        const intersections = this.raycaster.intersectObjects(
            objects,
            true
        );

        for (const hit of intersections) {

            if (hit.distance > this.options.maxDistance) continue;

            // Treffer auf einer InstancedMesh-Münze.
            if (
                hit.object.isInstancedMesh &&
                hit.instanceId !== undefined
            ) {

                const record = this.instancedMeshes.get(
                    hit.object.uuid
                );

                if (!record) continue;

                const instance = record.instances[hit.instanceId];

                if (!instance || !instance.available) continue;

                return {

                    type: "instance",

                    record,

                    instanceId: hit.instanceId,

                    instance,

                    distance: hit.distance,

                    point: hit.point

                };
            }

            // Treffer auf einer normalen Münze.
            let object = hit.object;

            while (object && !object.userData.pickupData) {

                object = object.parent;

            }

            if (!object) continue;

            const coin = object.userData.pickupData;

            if (!coin || !coin.available) continue;

            return {

                type: "normal",

                coin,

                distance: hit.distance,

                point: hit.point

            };
        }

        return null;
    }

    // =====================================================
    // MÜNZE AUFHEBEN
    // =====================================================

    pickupCoin() {

        if (!this.enabled) return false;

        const target = this.findTargetCoin();

        if (!target) return false;

        let coin;

        // -------------------------------------------------
        // INSTANCED MESH
        // -------------------------------------------------

        if (target.type === "instance") {

            const transform = this.getInstanceTransform(
                target.record,
                target.instanceId
            );

            if (!transform) return false;

            const individualMesh = this.createIndividualCoin(
                target.record,
                target.instanceId,
                transform
            );

            coin = {

                type: "instance",

                mesh: individualMesh,

                physicsCoin: null,

                value: target.instance.value,

                available: false,

                collected: true,

                originalScale: transform.scale.clone(),

                physicsOptions: {

                    radius: target.record.options.radius,
                    thickness: target.record.options.thickness,
                    density: target.record.options.density,
                    friction: target.record.options.friction,
                    restitution: target.record.options.restitution

                }

            };

            // Die einzelne Münze aus dem Stapel entfernen.
            const success = this.removeInstance(
                target.record,
                target.instanceId
            );

            if (!success) return false;
        }

        // -------------------------------------------------
        // NORMALE MÜNZE
        // -------------------------------------------------

        else {

            coin = target.coin;

            coin.available = false;
            coin.collected = true;

            if (this.physics && coin.physicsCoin) {

                this.physics.freezeCoin(coin.physicsCoin);

            }

            if (coin.mesh.parent) {

                coin.mesh.parent.remove(coin.mesh);

            }
        }

        // Inventar.
        this.inventory.push(coin);

        this.totalCollected++;

        this.updateInventory();

        if (typeof this.options.onPickup === "function") {

            this.options.onPickup(coin);

        }

        return true;
    }

    // =====================================================
    // EINE MÜNZE DROPPEN
    // =====================================================

    dropCoin() {

        if (!this.enabled) return false;

        if (this.inventory.length === 0) return false;

        const coin = this.inventory.shift();

        const mesh = coin.mesh;

        if (!mesh) {

            this.updateInventory();

            return false;
        }

        // Kamerarichtung.
        const direction = new THREE.Vector3();

        this.camera.getWorldDirection(direction);

        const cameraPosition = new THREE.Vector3();

        this.camera.getWorldPosition(cameraPosition);

        const dropPosition = cameraPosition.clone();

        dropPosition.addScaledVector(
            direction,
            this.options.dropDistance
        );

        dropPosition.y += this.options.dropHeight;

        // Mesh wieder in die Welt setzen.
        if (mesh.parent) {

            mesh.parent.remove(mesh);

        }

        this.scene.add(mesh);

        mesh.position.copy(dropPosition);

        mesh.scale.copy(coin.originalScale);

        const randomTilt = new THREE.Euler(
            Math.random() * 0.5,
            Math.random() * Math.PI * 2,
            Math.random() * 0.5
        );

        mesh.quaternion.setFromEuler(randomTilt);

        // Falls noch kein Physikkörper existiert,
        // einen neuen erzeugen.
        if (this.physics && !coin.physicsCoin) {

            coin.physicsCoin = this.physics.createCoin(
                {
                    x: dropPosition.x,
                    y: dropPosition.y,
                    z: dropPosition.z
                },
                coin.physicsOptions
            );

        }

        // Physik aktivieren.
        if (this.physics && coin.physicsCoin) {

            const body = coin.physicsCoin.body;

            this.physics.resumeCoin(coin.physicsCoin);

            if (body) {

                body.setTranslation({

                    x: dropPosition.x,
                    y: dropPosition.y,
                    z: dropPosition.z

                }, true);

                const correction = new THREE.Quaternion();

                correction.setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0),
                    Math.PI / 2
                );

                const physicsRotation = mesh.quaternion.clone();

                physicsRotation.multiply(correction);

                body.setRotation({

                    x: physicsRotation.x,
                    y: physicsRotation.y,
                    z: physicsRotation.z,
                    w: physicsRotation.w

                }, true);

                body.setLinvel({

                    x: direction.x * this.options.dropSpeed,
                    y: -0.8,
                    z: direction.z * this.options.dropSpeed

                }, true);

                body.setAngvel({

                    x: (Math.random() - 0.5) * this.options.dropSpin,
                    y: (Math.random() - 0.5) * this.options.dropSpin,
                    z: (Math.random() - 0.5) * this.options.dropSpin

                }, true);

                body.wakeUp();
            }
        }

        coin.collected = false;
        coin.available = true;

        // Wieder als normale Münze registrieren.
        mesh.userData.isPickupCoin = true;
        mesh.userData.pickupData = coin;
        mesh.userData.coinValue = coin.value;

        this.coins.set(mesh.uuid, coin);

        this.updateInventory();

        if (typeof this.options.onDrop === "function") {

            this.options.onDrop(coin);

        }

        return true;
    }

    // =====================================================
    // MÜNZEN AN DIE MASCHINE ÜBERGEBEN
    // =====================================================

    takeCoinsForMachine(amount = null) {

        const count = amount === null
            ? this.inventory.length
            : Math.min(
                Math.max(0, Math.floor(amount)),
                this.inventory.length
            );

        const coins = this.inventory.splice(0, count);

        for (const coin of coins) {

            coin.collected = true;
            coin.available = false;

            if (coin.mesh?.parent) {

                coin.mesh.parent.remove(coin.mesh);

            }

            if (this.physics && coin.physicsCoin) {

                this.physics.removeCoin(coin.physicsCoin);

            }

            if (coin.mesh) {

                this.coins.delete(coin.mesh.uuid);

                delete coin.mesh.userData.pickupData;
            }

            // Materialien der individuellen Instanzkopie freigeben.
            if (coin.type === "instance" && coin.mesh?.material) {

                if (Array.isArray(coin.mesh.material)) {

                    coin.mesh.material.forEach(m => m.dispose());

                } else {

                    coin.mesh.material.dispose();

                }
            }
        }

        this.updateInventory();

        return coins;
    }

    // =====================================================
    // INVENTAR
    // =====================================================

    getInventoryCount() {

        return this.inventory.length;
    }

    getInventoryValue() {

        return this.inventory.reduce(
            (total, coin) => total + coin.value,
            0
        );
    }

    getCollectedCount() {

        return this.totalCollected;
    }

    updateInventory() {

        if (typeof this.options.onInventoryChange === "function") {

            this.options.onInventoryChange({

                count: this.getInventoryCount(),

                value: this.getInventoryValue()

            });
        }
    }

    // =====================================================
    // ZIELANZEIGE
    // =====================================================

    updateTarget() {

        const target = this.findTargetCoin();

        this.targetCoin = target;

        this.target.visible = !!target;
    }

    // =====================================================
    // HAUPTUPDATE
    // =====================================================

    update(deltaTime = 0) {

        if (!this.enabled) return;

        this.updateTarget();
    }

    // =====================================================
    // MAUS
    // =====================================================

    handlePointerDown(event) {

        if (!this.enabled) return false;

        if (event.button !== 0) return false;

        return this.pickupCoin();
    }

    // =====================================================
    // TASTEN
    // =====================================================

    handleKeyDown(event) {

        if (!this.enabled) return false;

        if (event.repeat) return false;

        if (event.key?.toLowerCase() === "q") {

            return this.dropCoin();
        }

        // E bleibt für die Zählmaschine reserviert.

        return false;
    }

    // =====================================================
    // AKTIVIEREN / DEAKTIVIEREN
    // =====================================================

    setEnabled(enabled) {

        this.enabled = enabled;

        if (!enabled) {

            this.target.visible = false;
        }
    }

    // =====================================================
    // AUFRÄUMEN
    // =====================================================

    dispose() {

        this.camera.remove(this.target);

        this.target.traverse(object => {

            if (object.isMesh) {

                object.geometry.dispose();

                if (object.material) {

                    if (Array.isArray(object.material)) {

                        object.material.forEach(material => {
                            material.dispose();
                        });

                    } else {

                        object.material.dispose();
                    }
                }
            }
        });

        this.coins.clear();

        this.instancedMeshes.clear();

        this.inventory = [];
    }
}

// =========================================================
// ERSTELLFUNKTION
// =========================================================

export function createPickupSystem(
    scene,
    camera,
    physics,
    options = {}
) {

    return new CoinPickupSystem(
        scene,
        camera,
        physics,
        options
    );
}
