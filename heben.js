
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/*
=========================================================
 HEBEN.JS – ADVANCED COIN PICKUP SYSTEM
=========================================================

LINKSKLICK:
    Münze aufheben

Q:
    Münze droppen

E:
    Für die Zählmaschine reserviert

PHYSIK:
    - Keine Physik im Inventar
    - Keine Physik bei Instanced-Münzen
    - Keine Physik bei Maschinenmünzen
    - Physik ausschließlich für gedroppte Münzen

UNTERSTÜTZT:
    - THREE.Mesh
    - THREE.Group
    - THREE.InstancedMesh
    - Rapier 0.17.3
    - Individuelle Münzwerte
    - InstancedMesh-Callbacks
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

            coinRadius: 0.188,
            coinThickness: 0.1,

            density: 2.5,
            friction: 0.95,
            restitution: 0.025,

            onPickup: null,
            onDrop: null,
            onInventoryChange: null,
            onInstanceRemoved: null,

            ...options

        };

        this.enabled = true;

        this.raycaster = new THREE.Raycaster();

        this.raycaster.far = this.options.maxDistance;

        this.center = new THREE.Vector2(0, 0);

        this.coins = new Map();

        this.instancedMeshes = new Map();

        this.inventory = [];

        this.totalCollected = 0;
        this.totalDropped = 0;

        this.targetCoin = null;

        this.tempMatrix = new THREE.Matrix4();
        this.tempWorldMatrix = new THREE.Matrix4();

        this.tempPosition = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.tempScale = new THREE.Vector3();

        this.tempColor = new THREE.Color();

        this.tempDirection = new THREE.Vector3();
        this.tempCameraPosition = new THREE.Vector3();

        this.tempCorrection = new THREE.Quaternion();

        this.createTarget();

    }

    // =====================================================
    // ZIELANZEIGE
    // =====================================================

    createTarget() {

        this.target = new THREE.Group();

        this.target.visible = false;

        const ringGeometry = new THREE.RingGeometry(
            0.045,
            0.062,
            40
        );

        const ringMaterial = new THREE.MeshBasicMaterial({

            color: 0xffd45c,

            transparent: true,
            opacity: 0.9,

            depthTest: false,
            depthWrite: false,

            side: THREE.DoubleSide

        });

        const ring = new THREE.Mesh(
            ringGeometry,
            ringMaterial
        );

        ring.position.z = -0.002;

        const center = new THREE.Mesh(

            new THREE.CircleGeometry(0.009, 20),

            new THREE.MeshBasicMaterial({

                color: 0xffffff,

                depthTest: false,
                depthWrite: false

            })

        );

        this.target.add(ring);
        this.target.add(center);

        this.target.position.set(0, 0, -1);

        this.target.renderOrder = 1000;

        this.camera.add(this.target);

    }

    // =====================================================
    // PHYSIKOPTIONEN
    // =====================================================

    getPhysicsOptions(options = {}) {

        return {

            radius: options.radius ?? this.options.coinRadius,

            thickness: options.thickness ?? this.options.coinThickness,

            density: options.density ?? this.options.density,

            friction: options.friction ?? this.options.friction,

            restitution: options.restitution ?? this.options.restitution,

            linearDamping: options.linearDamping ?? 0.35,

            angularDamping: options.angularDamping ?? 0.65

        };

    }

    // =====================================================
    // NORMALE MÜNZE REGISTRIEREN
    // =====================================================

    registerCoin(
        mesh,
        physicsCoin = null,
        value = 1,
        options = {}
    ) {

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

            physicsOptions: this.getPhysicsOptions(options),

            worldQuaternion: mesh.quaternion.clone(),

            worldScale: mesh.scale.clone()

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

    registerInstancedMesh(mesh, options = {}) {

        if (!mesh || !mesh.isInstancedMesh) {

            console.warn(
                "registerInstancedMesh benötigt ein THREE.InstancedMesh."
            );

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

                density: options.density ?? this.options.density,

                friction: options.friction ?? this.options.friction,

                restitution: options.restitution ?? this.options.restitution,

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

        if (!mesh) return false;

        const record = this.instancedMeshes.get(mesh.uuid);

        if (!record) return false;

        delete mesh.userData.isPickupInstancedMesh;

        this.instancedMeshes.delete(mesh.uuid);

        return true;

    }

    // =====================================================
    // NORMALE MÜNZE ABMELDEN
    // =====================================================

    unregisterCoin(mesh, removePhysics = false) {

        if (!mesh) return false;

        const coin = this.coins.get(mesh.uuid);

        if (!coin) return false;

        if (removePhysics && coin.physicsCoin) {

            this.physics?.removeCoin(coin.physicsCoin);

        }

        this.coins.delete(mesh.uuid);

        delete mesh.userData.pickupData;

        mesh.userData.isPickupCoin = false;

        return true;

    }

    // =====================================================
    // INSTANCED MESH TRANSFORM
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

        mesh.getMatrixAt(
            instanceId,
            this.tempMatrix
        );

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
    // INSTANCED MESH: MÜNZE ENTFERNEN
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

        if (instanceId !== lastIndex) {

            // Matrix verschieben.
            mesh.getMatrixAt(
                lastIndex,
                this.tempMatrix
            );

            mesh.setMatrixAt(
                instanceId,
                this.tempMatrix
            );

            // Farbe verschieben.
            if (mesh.instanceColor) {

                mesh.getColorAt(
                    lastIndex,
                    this.tempColor
                );

                mesh.setColorAt(
                    instanceId,
                    this.tempColor
                );

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
    // INSTANCED MESH: INDIVIDUELLE MÜNZE
    // =====================================================

    createIndividualCoin(record, instanceId, transform) {

        const source = record.mesh;

        let material;

        if (Array.isArray(source.material)) {

            material = source.material.map(
                mat => mat.clone()
            );

        } else {

            material = source.material.clone();

        }

        // Instanzfarbe übernehmen.
        if (source.instanceColor) {

            source.getColorAt(
                instanceId,
                this.tempColor
            );

            if (Array.isArray(material)) {

                for (const mat of material) {

                    if (mat.color) {

                        mat.color.multiply(this.tempColor);

                    }

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
            this.center,
            this.camera
        );

        const objects = [];

        // Normale Münzen.
        for (const coin of this.coins.values()) {

            if (!coin.available || coin.collected) continue;

            if (!coin.mesh?.visible) continue;

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

            if (hit.distance > this.options.maxDistance) {
                continue;
            }

            // InstancedMesh.
            if (
                hit.object.isInstancedMesh &&
                hit.instanceId !== undefined
            ) {

                const record = this.instancedMeshes.get(
                    hit.object.uuid
                );

                if (!record) continue;

                const instance = record.instances[hit.instanceId];

                if (!instance || !instance.available) {
                    continue;
                }

                return {

                    type: "instance",

                    record,

                    instanceId: hit.instanceId,

                    instance,

                    distance: hit.distance,

                    point: hit.point.clone()

                };

            }

            // Normale Meshes oder Groups.
            let object = hit.object;

            while (
                object &&
                !object.userData.pickupData
            ) {

                object = object.parent;

            }

            if (!object) continue;

            const coin = object.userData.pickupData;

            if (!coin || !coin.available) continue;

            return {

                type: "normal",

                coin,

                distance: hit.distance,

                point: hit.point.clone()

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

        let coin = null;

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

                physicsOptions: this.getPhysicsOptions(
                    target.record.options
                ),

                worldQuaternion: transform.quaternion.clone(),

                worldScale: transform.scale.clone()

            };

            // Instanz erst entfernen, wenn die Einzelmünze existiert.
            const success = this.removeInstance(
                target.record,
                target.instanceId
            );

            if (!success) {

                if (Array.isArray(individualMesh.material)) {

                    individualMesh.material.forEach(m => m.dispose());

                } else {

                    individualMesh.material.dispose();

                }

                return false;

            }

        }

        // -------------------------------------------------
        // NORMALE MÜNZE
        // -------------------------------------------------

        else {

            coin = target.coin;

            // Welttransform sichern.
            coin.mesh.updateWorldMatrix(true, false);

            coin.mesh.getWorldQuaternion(
                coin.worldQuaternion
            );

            coin.mesh.getWorldScale(
                coin.worldScale
            );

            // Vorhandene Physik einfrieren.
            if (
                this.physics &&
                coin.physicsCoin &&
                coin.physicsCoin.active
            ) {

                this.physics.freezeCoin(
                    coin.physicsCoin
                );

            }

            coin.available = false;

            coin.collected = true;

            if (coin.mesh.parent) {

                coin.mesh.parent.remove(coin.mesh);

            }

        }

        // -------------------------------------------------
        // INVENTAR
        // -------------------------------------------------

        this.inventory.push(coin);

        this.totalCollected++;

        this.updateInventory();

        if (typeof this.options.onPickup === "function") {

            this.options.onPickup(coin);

        }

        return true;

    }

    // =====================================================
    // DROP-POSITION BERECHNEN
    // =====================================================

    getDropPosition() {

        this.camera.getWorldDirection(
            this.tempDirection
        );

        this.camera.getWorldPosition(
            this.tempCameraPosition
        );

        const position = this.tempCameraPosition.clone();

        position.addScaledVector(
            this.tempDirection,
            this.options.dropDistance
        );

        position.y += this.options.dropHeight;

        return position;

    }

    // =====================================================
    // PHYSIK FÜR EINE GEDROPPTE MÜNZE AKTIVIEREN
    // =====================================================

    activateDroppedPhysics(coin, position, mesh) {

        if (!this.physics || !this.physics.initialized) {

            console.error(
                "Physiksystem ist nicht initialisiert."
            );

            return false;

        }

        let physicsCoin = coin.physicsCoin;

        // Fall 1: Bereits vorhandene, eingefrorene Münze.
        if (physicsCoin && !physicsCoin.active) {

            const resumed = this.physics.resumeCoin(
                physicsCoin,
                {
                    x: position.x,
                    y: position.y,
                    z: position.z
                }
            );

            if (!resumed) {

                return false;

            }

        }

        // Fall 2: Neue Münze, zum Beispiel aus einem InstancedMesh.
        else if (!physicsCoin) {

            const createFunction =
                this.physics.createDroppedCoin ??
                this.physics.createCoin;

            physicsCoin = createFunction.call(
                this.physics,
                {
                    x: position.x,
                    y: position.y,
                    z: position.z
                },
                coin.physicsOptions
            );

            if (!physicsCoin) {

                return false;

            }

            coin.physicsCoin = physicsCoin;

        }

        // Fall 3: Münze war unerwartet noch aktiv.
        if (!physicsCoin || !physicsCoin.body) {

            return false;

        }

        const body = physicsCoin.body;

        // Position aktualisieren.
        body.setTranslation({

            x: position.x,
            y: position.y,
            z: position.z

        }, true);

        // Three.js-Münze: lokale Z-Achse ist die Münzfläche.
        // Rapier-Zylinder: lokale Y-Achse ist die Zylinderachse.
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

        // Leichter Vorwärtsimpuls.
        body.setLinvel({

            x: this.tempDirection.x * this.options.dropSpeed,

            y: -0.8,

            z: this.tempDirection.z * this.options.dropSpeed

        }, true);

        // Natürliche Drehbewegung.
        body.setAngvel({

            x: (Math.random() - 0.5) * this.options.dropSpin,

            y: (Math.random() - 0.5) * this.options.dropSpin,

            z: (Math.random() - 0.5) * this.options.dropSpin

        }, true);

        body.wakeUp();

        return true;

    }

    // =====================================================
    // MÜNZE DROPPEN
    // =====================================================

    dropCoin() {

        if (!this.enabled) return false;

        if (this.inventory.length === 0) {
            return false;
        }

        // Noch nicht aus dem Inventar entfernen.
        // Erst sicherstellen, dass das Droppen funktioniert.
        const coin = this.inventory[
            this.inventory.length - 1
        ];

        const mesh = coin.mesh;

        if (!mesh) return false;

        const position = this.getDropPosition();

        // Welttransform in die Szene übernehmen.
        mesh.position.copy(position);

        mesh.scale.copy(
            coin.worldScale ?? coin.originalScale
        );

        // Kleine zufällige Neigung.
        const randomTilt = new THREE.Euler(

            Math.random() * 0.5,

            Math.random() * Math.PI * 2,

            Math.random() * 0.5

        );

        mesh.quaternion.setFromEuler(randomTilt);

        // Physik ausschließlich jetzt aktivieren.
        const success = this.activateDroppedPhysics(
            coin,
            position,
            mesh
        );

        if (!success) {

            console.warn(
                "Münze konnte nicht gedroppt werden. Physiklimit erreicht oder Physik nicht verfügbar."
            );

            return false;

        }

        // Erst jetzt aus dem Inventar entfernen.
        this.inventory.pop();

        // Münze wieder in die Spielwelt setzen.
        if (mesh.parent) {

            mesh.parent.remove(mesh);

        }

        this.scene.add(mesh);

        coin.collected = false;

        coin.available = true;

        mesh.userData.isPickupCoin = true;

        mesh.userData.pickupData = coin;

        mesh.userData.coinValue = coin.value;

        this.coins.set(mesh.uuid, coin);

        this.totalDropped++;

        this.updateInventory();

        if (typeof this.options.onDrop === "function") {

            this.options.onDrop(coin);

        }

        return true;

    }

    // =====================================================
    // MÜNZEN AN DIE ZÄHLMASCHINE ÜBERGEBEN
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

            // Sicherheitsmaßnahme:
            // Inventarmünzen dürfen keine aktive Physik haben.
            if (
                this.physics &&
                coin.physicsCoin?.active
            ) {

                this.physics.freezeCoin(
                    coin.physicsCoin
                );

            }

            if (coin.mesh?.parent) {

                coin.mesh.parent.remove(
                    coin.mesh
                );

            }

            // Physikkörper vollständig entfernen.
            if (this.physics && coin.physicsCoin) {

                this.physics.removeCoin(
                    coin.physicsCoin
                );

                coin.physicsCoin = null;

            }

            if (coin.mesh) {

                this.coins.delete(
                    coin.mesh.uuid
                );

                delete coin.mesh.userData.pickupData;

                coin.mesh.userData.isPickupCoin = false;

            }

            // Individuelle Materialkopien freigeben.
            if (
                coin.type === "instance" &&
                coin.mesh?.material
            ) {

                if (Array.isArray(coin.mesh.material)) {

                    coin.mesh.material.forEach(
                        material => material.dispose()
                    );

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

    getDroppedCount() {

        return this.totalDropped;

    }

    getInventory() {

        return [...this.inventory];

    }

    updateInventory() {

        if (typeof this.options.onInventoryChange === "function") {

            this.options.onInventoryChange({

                count: this.getInventoryCount(),

                value: this.getInventoryValue(),

                totalCollected: this.totalCollected,

                totalDropped: this.totalDropped

            });

        }

    }

    // =====================================================
    // ZIELANZEIGE
    // =====================================================

    updateTarget() {

        const target = this.findTargetCoin();

        this.targetCoin = target;

        this.target.visible = Boolean(target);

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

        return false;

    }

    // =====================================================
    // AKTIVIEREN / DEAKTIVIEREN
    // =====================================================

    setEnabled(enabled) {

        this.enabled = Boolean(enabled);

        if (!this.enabled) {

            this.target.visible = false;

            this.targetCoin = null;

        }

    }

    // =====================================================
    // AUFRÄUMEN
    // =====================================================

    dispose() {

        this.camera.remove(this.target);

        this.target.traverse(object => {

            if (!object.isMesh) return;

            object.geometry.dispose();

            if (object.material) {

                if (Array.isArray(object.material)) {

                    object.material.forEach(
                        material => material.dispose()
                    );

                } else {

                    object.material.dispose();

                }

            }

        });

        this.coins.clear();

        this.instancedMeshes.clear();

        this.inventory.length = 0;

        this.targetCoin = null;

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
