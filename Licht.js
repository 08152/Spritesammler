
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// ============================================================
// ONE MILLION COINS
// LICHT.JS – BUNKERBELEUCHTUNG
// ============================================================

export class BunkerLighting {

    constructor(scene, options = {}) {

        this.scene = scene;

        this.floorCount = options.floors ?? 7;
        this.floorHeight = options.floorHeight ?? 8;
        this.floorSize = options.floorSize ?? 24;

        this.spacing = options.lampSpacing ?? 8;

        this.color = options.color ?? 0xffd39a;
        this.intensity = options.intensity ?? 2.2;

        this.enableFlicker =
            options.enableFlicker ?? true;

        this.lights = [];
        this.lampObjects = [];
        this.floorObjects = [];

        this.lightData = [];

        this.created = false;

        this.materials = {};

        this.createMaterials();
        this.create();
    }

    // ========================================================
    // MATERIALIEN
    // ========================================================

    createMaterials() {

        this.materials.metal =
            new THREE.MeshStandardMaterial({
                color: 0x333b3d,
                metalness: 0.85,
                roughness: 0.38
            });

        this.materials.darkMetal =
            new THREE.MeshStandardMaterial({
                color: 0x151a1c,
                metalness: 0.7,
                roughness: 0.48
            });

        this.materials.glass =
            new THREE.MeshStandardMaterial({
                color: 0xffdca8,
                emissive: 0xffa94a,
                emissiveIntensity: 2.5,
                roughness: 0.3,
                metalness: 0.1
            });

        this.materials.grill =
            new THREE.MeshStandardMaterial({
                color: 0x687071,
                metalness: 0.8,
                roughness: 0.5
            });

        this.materials.bolt =
            new THREE.MeshStandardMaterial({
                color: 0x92999a,
                metalness: 0.9,
                roughness: 0.25
            });

    }

    // ========================================================
    // GESAMTE BELEUCHTUNG ERSTELLEN
    // ========================================================

    create() {

        if (this.created) return;

        this.created = true;

        for (
            let floor = 0;
            floor < this.floorCount;
            floor++
        ) {

            this.createFloorLighting(floor);

        }

    }

    // ========================================================
    // BELEUCHTUNG EINER ETAGE
    // ========================================================

    createFloorLighting(floor) {

        const floorGroup = new THREE.Group();

        floorGroup.name =
            `BunkerLighting_Floor_${floor + 1}`;

        const halfSize = this.floorSize / 2;

        const lampPositions = [];

        // Drei Lampenreihen entlang der Etage

        const xPositions = [-5.5, 0, 5.5];

        for (const x of xPositions) {

            for (
                let z = -halfSize + 4;
                z <= halfSize - 4;
                z += this.spacing
            ) {

                lampPositions.push({ x, z });

            }

        }

        for (const position of lampPositions) {

            this.createLamp(
                floorGroup,
                floor,
                position.x,
                position.z
            );

        }

        this.scene.add(floorGroup);

        this.floorObjects.push({
            floor,
            group: floorGroup
        });

    }

    // ========================================================
    // EINZELNE INDUSTRIELAMPE
    // ========================================================

    createLamp(parent, floor, x, z) {

        const lamp = new THREE.Group();

        lamp.name =
            `IndustrialLamp_F${floor + 1}`;

        // Das Modul baut zunächst in positiver Y-Richtung.
        // Die aktuelle game.js spiegelt die Lampen anschließend
        // passend für den nach unten gehenden Bunker.

        const y = floor * this.floorHeight + 7.5;

        lamp.position.set(x, y, z);

        // ----------------------------------------------------
        // METALLGEHÄUSE
        // ----------------------------------------------------

        const housing = new THREE.Mesh(
            new THREE.BoxGeometry(2.15, 0.22, 0.85),
            this.materials.metal
        );

        housing.position.y = 0.08;

        lamp.add(housing);

        // ----------------------------------------------------
        // DUNKLE RÜCKSEITE
        // ----------------------------------------------------

        const back = new THREE.Mesh(
            new THREE.BoxGeometry(2.0, 0.08, 0.72),
            this.materials.darkMetal
        );

        back.position.y = 0.21;

        lamp.add(back);

        // ----------------------------------------------------
        // LEUCHTFLÄCHE
        // ----------------------------------------------------

        const glass = new THREE.Mesh(
            new THREE.BoxGeometry(1.82, 0.035, 0.57),
            this.materials.glass
        );

        glass.position.y = -0.055;

        lamp.add(glass);

        // ----------------------------------------------------
        // METALLGITTER
        // ----------------------------------------------------

        const grillGroup = new THREE.Group();

        for (let i = -3; i <= 3; i++) {

            const bar = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.025,
                    0.035,
                    0.62
                ),
                this.materials.grill
            );

            bar.position.x = i * 0.25;

            bar.position.y = -0.025;

            grillGroup.add(bar);

        }

        for (let i = -1; i <= 1; i++) {

            const bar = new THREE.Mesh(
                new THREE.BoxGeometry(
                    1.85,
                    0.035,
                    0.025
                ),
                this.materials.grill
            );

            bar.position.z = i * 0.2;

            bar.position.y = -0.025;

            grillGroup.add(bar);

        }

        lamp.add(grillGroup);

        // ----------------------------------------------------
        // SCHRAUBEN
        // ----------------------------------------------------

        for (const sx of [-0.9, 0.9]) {

            for (const sz of [-0.28, 0.28]) {

                const bolt = new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.035,
                        0.035,
                        0.025,
                        8
                    ),
                    this.materials.bolt
                );

                bolt.rotation.x = Math.PI / 2;

                bolt.position.set(
                    sx,
                    0.13,
                    sz
                );

                lamp.add(bolt);

            }

        }

        // ----------------------------------------------------
        // HALTERUNGEN
        // ----------------------------------------------------

        for (const sx of [-0.75, 0.75]) {

            const holder = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.12,
                    0.35,
                    0.12
                ),
                this.materials.darkMetal
            );

            holder.position.set(
                sx,
                0.25,
                0
            );

            lamp.add(holder);

        }

        // ----------------------------------------------------
        // LEUCHTGEHÄUSE HINZUFÜGEN
        // ----------------------------------------------------

        lamp.traverse(object => {

            if (object.isMesh) {

                object.castShadow = false;
                object.receiveShadow = false;

            }

        });

        parent.add(lamp);

        this.lampObjects.push(lamp);

        // ----------------------------------------------------
        // POINTLIGHT
        // ----------------------------------------------------

        const pointLight = new THREE.PointLight(
            this.color,
            this.intensity,
            12,
            1.7
        );

        pointLight.position.set(
            x,
            y - 0.65,
            z
        );

        pointLight.castShadow = false;

        this.scene.add(pointLight);

        this.lights.push(pointLight);

        this.lightData.push({

            light: pointLight,

            floor,

            baseIntensity: this.intensity,

            phase: Math.random() * Math.PI * 2,

            flickerSpeed: 2 + Math.random() * 5,

            flickerAmount:
                0.025 + Math.random() * 0.035,

            enabled: true

        });

    }

    // ========================================================
    // LICHTSTÄRKE EINER ETAGE EINSTELLEN
    // ========================================================

    setFloorIntensity(floor, intensity) {

        for (const data of this.lightData) {

            if (data.floor !== floor) continue;

            data.baseIntensity = intensity;

            data.light.intensity = intensity;

        }

    }

    // ========================================================
    // ETAGE SICHTBAR / UNSICHTBAR
    // ========================================================

    setFloorVisible(floor, visible) {

        const floorObject =
            this.floorObjects.find(
                item => item.floor === floor
            );

        if (floorObject) {

            floorObject.group.visible = visible;

        }

        for (const data of this.lightData) {

            if (data.floor !== floor) continue;

            data.enabled = visible;

            data.light.visible = visible;

        }

    }

    // ========================================================
    // ALLE LAMPEN EIN- ODER AUSSCHALTEN
    // ========================================================

    setAllVisible(visible) {

        for (
            let floor = 0;
            floor < this.floorCount;
            floor++
        ) {

            this.setFloorVisible(
                floor,
                visible
            );

        }

    }

    // ========================================================
    // ANIMATION UND FLACKERN
    // ========================================================

    update(time = 0) {

        if (!this.enableFlicker) return;

        for (const data of this.lightData) {

            if (!data.enabled) continue;

            const wave = Math.sin(
                time * data.flickerSpeed +
                data.phase
            );

            const smallFlicker =
                Math.sin(
                    time * 17 +
                    data.phase * 2
                ) * 0.008;

            const intensity =
                data.baseIntensity *
                (
                    1 +
                    wave * data.flickerAmount +
                    smallFlicker
                );

            data.light.intensity = Math.max(
                0,
                intensity
            );

        }

    }

    // ========================================================
    // FLACKERN EIN-/AUSSCHALTEN
    // ========================================================

    setFlickerEnabled(enabled) {

        this.enableFlicker = enabled;

        if (!enabled) {

            for (const data of this.lightData) {

                data.light.intensity =
                    data.baseIntensity;

            }

        }

    }

    // ========================================================
    // ALLE LAMPEN ENTFERNEN
    // ========================================================

    clear() {

        for (const object of this.floorObjects) {

            this.scene.remove(object.group);

            object.group.traverse(child => {

                if (child.isMesh) {

                    child.geometry.dispose();

                }

            });

        }

        for (const light of this.lights) {

            this.scene.remove(light);

        }

        this.floorObjects = [];
        this.lights = [];
        this.lampObjects = [];
        this.lightData = [];

        this.created = false;

    }

    // ========================================================
    // AUFRÄUMEN
    // ========================================================

    dispose() {

        this.clear();

        for (const material of Object.values(
            this.materials
        )) {

            material.dispose();

        }

    }

}

// ============================================================
// FACTORY-FUNKTION
// ============================================================

export function createBunkerLighting(
    scene,
    options = {}
) {

    return new BunkerLighting(
        scene,
        options
    );

}
