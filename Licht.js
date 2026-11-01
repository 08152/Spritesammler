
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

export class BunkerLighting {
    constructor(scene, options = {}) {
        this.scene = scene;

        this.floors = options.floors ?? 7;
        this.floorHeight = options.floorHeight ?? 8;
        this.floorSize = options.floorSize ?? 24;

        this.lampSpacing = options.lampSpacing ?? 8;
        this.ceilingOffset = options.ceilingOffset ?? 0.35;

        this.lights = [];
        this.lampObjects = [];

        this.warmColor = 0xFFE2A8;

        this.materials = {
            metal: new THREE.MeshStandardMaterial({
                color: 0x555B60,
                metalness: 0.85,
                roughness: 0.35
            }),

            frame: new THREE.MeshStandardMaterial({
                color: 0x25292C,
                metalness: 0.75,
                roughness: 0.42
            }),

            glass: new THREE.MeshStandardMaterial({
                color: 0xFFF0C9,
                emissive: 0xFFCA65,
                emissiveIntensity: 2.0,
                roughness: 0.25,
                metalness: 0.05
            }),

            darkGlass: new THREE.MeshStandardMaterial({
                color: 0xC99A43,
                emissive: 0x8A571B,
                emissiveIntensity: 0.5,
                roughness: 0.4
            })
        };
    }

    create() {
        this.clear();

        for (let floor = 0; floor < this.floors; floor++) {
            this.createFloorLighting(floor);
        }

        return this;
    }

    createFloorLighting(floor) {
        const floorY = floor * this.floorHeight;

        const ceilingY =
            floorY + this.floorHeight - this.ceilingOffset;

        const halfSize = this.floorSize / 2;

        const positions = [];

        // Lampenraster
        for (
            let x = -halfSize + this.lampSpacing / 2;
            x < halfSize;
            x += this.lampSpacing
        ) {
            for (
                let z = -halfSize + this.lampSpacing / 2;
                z < halfSize;
                z += this.lampSpacing
            ) {
                positions.push({ x, z });
            }
        }

        positions.forEach((position, index) => {
            const mainLamp = index === 0;

            this.createLamp(
                position.x,
                ceilingY,
                position.z,
                {
                    intensity: mainLamp ? 150 : 95,
                    range: mainLamp ? 13 : 10,
                    castShadow: mainLamp
                }
            );
        });

        // Schwaches Grundlicht pro Stockwerk
        const ambient = new THREE.AmbientLight(
            0xD8C9AD,
            0.13
        );

        this.scene.add(ambient);
        this.lights.push(ambient);
    }

    createLamp(x, y, z, options = {}) {
        const group = new THREE.Group();

        group.position.set(x, y, z);

        // Metallgehäuse
        const housingGeometry = new THREE.BoxGeometry(
            1.45,
            0.16,
            0.65
        );

        const housing = new THREE.Mesh(
            housingGeometry,
            this.materials.metal
        );

        housing.castShadow = true;
        housing.receiveShadow = true;

        group.add(housing);

        // Dunkler Rahmen
        const frameGeometry = new THREE.BoxGeometry(
            1.25,
            0.07,
            0.48
        );

        const frame = new THREE.Mesh(
            frameGeometry,
            this.materials.frame
        );

        frame.position.y = -0.095;

        group.add(frame);

        // Leuchtende Abdeckung
        const panelGeometry = new THREE.BoxGeometry(
            1.12,
            0.035,
            0.36
        );

        const panel = new THREE.Mesh(
            panelGeometry,
            this.materials.glass
        );

        panel.position.y = -0.13;

        group.add(panel);

        // Kleine seitliche Befestigungen
        for (const side of [-1, 1]) {
            const mount = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.08, 0.72),
                this.materials.frame
            );

            mount.position.x = side * 0.66;
            mount.position.y = -0.025;

            group.add(mount);
        }

        this.scene.add(group);
        this.lampObjects.push(group);

        // Licht unter der Lampe
        const light = new THREE.PointLight(
            this.warmColor,
            options.intensity ?? 110,
            options.range ?? 11,
            1.7
        );

        light.position.set(x, y - 0.25, z);

        light.castShadow = options.castShadow ?? false;

        if (light.castShadow) {
            light.shadow.mapSize.set(512, 512);
            light.shadow.camera.near = 0.2;
            light.shadow.camera.far = options.range ?? 13;
            light.shadow.bias = -0.001;
        }

        this.scene.add(light);
        this.lights.push(light);

        // Kleine zusätzliche Lichtquelle für die Abdeckung
        const glow = new THREE.PointLight(
            0xFFCA75,
            5,
            3,
            2
        );

        glow.position.set(x, y - 0.35, z);

        this.scene.add(glow);
        this.lights.push(glow);

        return group;
    }

    // Lichtstärke eines Stockwerks verändern
    setFloorIntensity(floor, intensity) {
        const yMin = floor * this.floorHeight;
        const yMax = yMin + this.floorHeight;

        for (const light of this.lights) {
            if (
                light.isLight &&
                light.position.y >= yMin &&
                light.position.y <= yMax
            ) {
                light.intensity = intensity;
            }
        }
    }

    // Alle Lampen etwas flackern lassen
    update(time) {
        const flicker = Math.sin(time * 0.003) * 0.015;

        for (const light of this.lights) {
            if (light.isPointLight) {
                light.intensity *= 1 + flicker;
            }
        }
    }

    // Lampen eines Stockwerks ein- und ausschalten
    setFloorVisible(floor, visible) {
        const yMin = floor * this.floorHeight;
        const yMax = yMin + this.floorHeight;

        for (const light of this.lights) {
            if (
                light.position.y >= yMin &&
                light.position.y <= yMax
            ) {
                light.visible = visible;
            }
        }

        for (const lamp of this.lampObjects) {
            const floorIndex = Math.round(
                lamp.position.y / this.floorHeight
            );

            if (floorIndex === floor) {
                lamp.visible = visible;
            }
        }
    }

    clear() {
        for (const light of this.lights) {
            this.scene.remove(light);
        }

        for (const lamp of this.lampObjects) {
            this.scene.remove(lamp);
        }

        this.lights = [];
        this.lampObjects = [];
    }

    dispose() {
        this.clear();

        for (const material of Object.values(this.materials)) {
            material.dispose();
        }
    }
}

// Hilfsfunktion für game.js
export function createBunkerLighting(scene, options = {}) {
    const lighting = new BunkerLighting(scene, options);
    lighting.create();
    return lighting;
}
