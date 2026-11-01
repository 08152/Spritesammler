
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/*
=========================================================
 HEBEN.JS – MÜNZEN UND INVENTAR
=========================================================

 LINKSKLICK:
 Münze aufheben und ins Inventar legen.

 Q:
 Eine Münze aus dem Inventar droppen.
 Die Münze fällt mit Rapier-Physik herunter.

 E:
 Wird NICHT hier behandelt.
 E ist für die Zählmaschine reserviert.

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

            onPickup: null,
            onDrop: null,
            onInventoryChange: null,

            ...options
        };

        this.raycaster = new THREE.Raycaster();

        this.raycaster.far = this.options.maxDistance;

        this.coins = new Map();

        this.inventory = [];

        this.totalCollected = 0;

        this.enabled = true;

        this.targetCoin = null;

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
    // MÜNZE REGISTRIEREN
    // =====================================================

    registerCoin(mesh, physicsCoin = null, value = 1) {

        if (!mesh) return null;

        if (this.coins.has(mesh.uuid)) {
            return this.coins.get(mesh.uuid);
        }

        const coin = {

            mesh,

            physicsCoin,

            value,

            available: true,

            collected: false,

            originalScale: mesh.scale.clone(),

            originalParent: mesh.parent

        };

        mesh.userData.isPickupCoin = true;

        mesh.userData.pickupData = coin;

        mesh.userData.coinValue = value;

        this.coins.set(mesh.uuid, coin);

        return coin;

    }

    // =====================================================
    // MÜNZE ABMELDEN
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
    // ZIELMÜNZE FINDEN
    // =====================================================

    findTargetCoin() {

        if (!this.enabled) return null;

        this.raycaster.setFromCamera(
            new THREE.Vector2(0, 0),
            this.camera
        );

        const objects = [];

        for (const coin of this.coins.values()) {

            if (!coin.available) continue;

            if (coin.collected) continue;

            if (!coin.mesh.visible) continue;

            objects.push(coin.mesh);

        }

        const intersections = this.raycaster.intersectObjects(
            objects,
            true
        );

        for (const hit of intersections) {

            let object = hit.object;

            while (object && !object.userData.pickupData) {
                object = object.parent;
            }

            if (!object) continue;

            const coin = object.userData.pickupData;

            if (!coin || !coin.available) continue;

            if (hit.distance > this.options.maxDistance) continue;

            return {
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

        const coin = target.coin;

        coin.available = false;

        coin.collected = true;

        // Physikkörper einfrieren
        if (this.physics && coin.physicsCoin) {

            this.physics.freezeCoin(coin.physicsCoin);

        }

        // Münze aus der sichtbaren Welt entfernen
        if (coin.mesh.parent) {

            coin.mesh.parent.remove(coin.mesh);

        }

        // Münze im Inventar speichern
        this.inventory.push(coin);

        this.totalCollected++;

        this.updateInventory();

        if (typeof this.options.onPickup === "function") {

            this.options.onPickup(coin);

        }

        return true;

    }

    // =====================================================
    // EINE MÜNZE AUS DEM INVENTAR DROPPEN
    // =====================================================

    dropCoin() {

        if (!this.enabled) return false;

        if (this.inventory.length === 0) return false;

        // Erste Inventarmünze nehmen
        const coin = this.inventory.shift();

        const mesh = coin.mesh;

        if (!mesh) return false;

        coin.collected = false;

        coin.available = true;

        // Position vor der Kamera berechnen
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

        // Münze wieder in die Welt setzen
        if (mesh.parent) {

            mesh.parent.remove(mesh);

        }

        this.scene.add(mesh);

        mesh.position.copy(dropPosition);

        mesh.scale.copy(coin.originalScale);

        // Münze leicht kippen
        const randomTilt = new THREE.Euler(
            Math.random() * 0.5,
            Math.random() * Math.PI * 2,
            Math.random() * 0.5
        );

        mesh.quaternion.setFromEuler(randomTilt);

        // Physikkörper reaktivieren
        if (this.physics && coin.physicsCoin) {

            const body = coin.physicsCoin.body;

            if (body) {

                // Gespeicherten Physikzustand wieder aktivieren
                this.physics.resumeCoin(coin.physicsCoin);

                // Position und Rotation setzen
                body.setTranslation({
                    x: dropPosition.x,
                    y: dropPosition.y,
                    z: dropPosition.z
                }, true);

                /*
                 Rapier-Zylinder haben ihre Achse auf Y.
                 Die visuelle Münze ist in coin.js um X gedreht.
                 Daher wird die Rotation entsprechend korrigiert.
                */

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

                // Fallgeschwindigkeit
                body.setLinvel({
                    x: direction.x * this.options.dropSpeed,
                    y: -0.8,
                    z: direction.z * this.options.dropSpeed
                }, true);

                // Drehbewegung
                body.setAngvel({
                    x: (Math.random() - 0.5) * this.options.dropSpin,
                    y: (Math.random() - 0.5) * this.options.dropSpin,
                    z: (Math.random() - 0.5) * this.options.dropSpin
                }, true);

                body.wakeUp();

            }

        }

        // Wieder als aufhebbare Münze registriert lassen
        this.coins.set(mesh.uuid, coin);

        this.updateInventory();

        if (typeof this.options.onDrop === "function") {

            this.options.onDrop(coin);

        }

        return true;

    }

    // =====================================================
    // INVENTAR AN DIE ZÄHLMASCHINE ÜBERGEBEN
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

            if (coin.mesh.parent) {

                coin.mesh.parent.remove(coin.mesh);

            }

            if (this.physics && coin.physicsCoin) {

                this.physics.removeCoin(coin.physicsCoin);

            }

            this.coins.delete(coin.mesh.uuid);

        }

        this.updateInventory();

        return coins;

    }

    // =====================================================
    // INVENTARWERT
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

    // =====================================================
    // INVENTAR AKTUALISIEREN
    // =====================================================

    updateInventory() {

        if (typeof this.options.onInventoryChange === "function") {

            this.options.onInventoryChange({

                count: this.getInventoryCount(),

                value: this.getInventoryValue()

            });

        }

    }

    // =====================================================
    // ZIELANZEIGE AKTUALISIEREN
    // =====================================================

    updateTarget() {

        const target = this.findTargetCoin();

        this.targetCoin = target ? target.coin : null;

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

        if (event.key.toLowerCase() === "q") {

            return this.dropCoin();

        }

        // E wird bewusst nicht behandelt.
        // E gehört zur Zählmaschine.

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
