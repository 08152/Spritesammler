
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/*
============================================================
 BUNKER.JS – HIGH DETAIL UNDERGROUND BUNKER
============================================================

 FEATURES:
 - 7 Etagen
 - 24 x 24 Meter Grundfläche
 - 8 Meter Etagenhöhe
 - Realistische Betontexturen
 - Sichtbare Betonplatten und Fugen
 - Massive Stützpfeiler
 - Verstärkte Türöffnungen
 - Deckenverstärkungen
 - Bodenfugen
 - Wandverstärkungen
 - Rapier-Kollisionen

 NICHT ENTHALTEN:
 - Treppen
 - Beleuchtung
 - Münzen
 - Zählmaschine
 - Spieler

============================================================
*/

export class BunkerSystem {

    constructor(scene, physics = null, options = {}) {

        this.scene = scene;
        this.physics = physics;

        this.options = {

            floorCount: 7,

            floorHeight: 8,

            width: 24,

            depth: 24,

            wallThickness: 0.4,

            wallHeight: 7.6,

            floorThickness: 0.5,

            doorWidth: 3.2,

            doorHeight: 3.4,

            pillarSize: 0.65,

            pillarPositions: [
                [-8, -8],
                [0, -8],
                [8, -8],
                [-8, 0],
                [0, 0],
                [8, 0],
                [-8, 8],
                [8, 8]
            ],

            createPhysics: true,

            createWallDetails: true,

            createFloorDetails: true,

            createCeilingDetails: true,

            createPillarDetails: true,

            ...options

        };

        this.group = new THREE.Group();

        this.group.name = "Bunker";

        this.scene.add(this.group);

        this.materials = {};

        this.physicsBodies = [];

        this.createMaterials();

        this.build();

    }

    // ========================================================
    // PROZEDURALE BETONTEXTUR
    // ========================================================

    createConcreteTexture() {

        const canvas = document.createElement("canvas");

        canvas.width = 512;
        canvas.height = 512;

        const context = canvas.getContext("2d");

        const image = context.createImageData(512, 512);

        let seed = 123456;

        const random = () => {

            seed = (seed * 1664525 + 1013904223) >>> 0;

            return seed / 4294967296;

        };

        for (let i = 0; i < image.data.length; i += 4) {

            const noise = (random() - 0.5) * 25;

            const base = 125 + noise;

            image.data[i] = base;
            image.data[i + 1] = base;
            image.data[i + 2] = base - 2;

            image.data[i + 3] = 255;

        }

        context.putImageData(image, 0, 0);

        // Leichte dunkle Betonflecken
        for (let i = 0; i < 100; i++) {

            const x = random() * 512;
            const y = random() * 512;

            const radius = 3 + random() * 22;

            context.fillStyle =
                `rgba(35, 38, 35, ${0.015 + random() * 0.045})`;

            context.beginPath();

            context.arc(
                x,
                y,
                radius,
                0,
                Math.PI * 2
            );

            context.fill();

        }

        // Kleine Oberflächenkratzer
        for (let i = 0; i < 180; i++) {

            context.strokeStyle =
                `rgba(25, 27, 25, ${random() * 0.12})`;

            context.lineWidth = 0.5 + random() * 1.5;

            context.beginPath();

            const x = random() * 512;
            const y = random() * 512;

            context.moveTo(x, y);

            context.lineTo(
                x + (random() - 0.5) * 25,
                y + (random() - 0.5) * 25
            );

            context.stroke();

        }

        const texture = new THREE.CanvasTexture(canvas);

        texture.colorSpace = THREE.SRGBColorSpace;

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        texture.repeat.set(2, 2);

        texture.anisotropy = 8;

        return texture;

    }

    // ========================================================
    // MATERIALIEN
    // ========================================================

    createMaterials() {

        const concreteTexture = this.createConcreteTexture();

        this.materials.concrete =
            new THREE.MeshStandardMaterial({

                color: 0xb0b0aa,

                map: concreteTexture,

                roughness: 0.96,

                metalness: 0.0,

                bumpMap: concreteTexture,

                bumpScale: 0.035

            });

        this.materials.floor =
            new THREE.MeshStandardMaterial({

                color: 0x777973,

                map: concreteTexture,

                roughness: 0.98,

                metalness: 0.0,

                bumpMap: concreteTexture,

                bumpScale: 0.025

            });

        this.materials.pillar =
            new THREE.MeshStandardMaterial({

                color: 0xa0a09a,

                map: concreteTexture,

                roughness: 0.96,

                metalness: 0.0,

                bumpMap: concreteTexture,

                bumpScale: 0.035

            });

        this.materials.darkConcrete =
            new THREE.MeshStandardMaterial({

                color: 0x41433f,

                roughness: 0.96

            });

        this.materials.joint =
            new THREE.MeshStandardMaterial({

                color: 0x353732,

                roughness: 1.0

            });

        this.materials.reinforcement =
            new THREE.MeshStandardMaterial({

                color: 0x555752,

                roughness: 0.85,

                metalness: 0.05

            });

        this.materials.warning =
            new THREE.MeshStandardMaterial({

                color: 0xb28a35,

                roughness: 0.85

            });

    }

    // ========================================================
    // BAUTEIL ERSTELLEN
    // ========================================================

    createPart(
        name,
        position,
        size,
        material,
        options = {}
    ) {

        const {

            solid = false,

            floorIndex = -1,

            castShadow = true,

            receiveShadow = true

        } = options;

        const geometry = new THREE.BoxGeometry(
            size.x,
            size.y,
            size.z
        );

        const mesh = new THREE.Mesh(
            geometry,
            material
        );

        mesh.name = name;

        mesh.position.set(
            position.x,
            position.y,
            position.z
        );

        mesh.castShadow = castShadow;

        mesh.receiveShadow = receiveShadow;

        mesh.userData.floorIndex = floorIndex;

        this.group.add(mesh);

        // Nur tragende Bauteile erhalten Physik.
        if (
            solid &&
            this.options.createPhysics &&
            this.physics
        ) {

            const body = this.physics.createStaticBox(

                {
                    x: position.x,
                    y: position.y,
                    z: position.z
                },

                {
                    x: size.x,
                    y: size.y,
                    z: size.z
                }

            );

            if (body) {

                this.physicsBodies.push(body);

            }

        }

        return mesh;

    }

    // ========================================================
    // GESAMTEN BUNKER BAUEN
    // ========================================================

    build() {

        for (
            let floor = 0;
            floor < this.options.floorCount;
            floor++
        ) {

            const floorY =
                floor * this.options.floorHeight;

            this.buildFloor(floorY, floor);

            this.buildWalls(floorY, floor);

            this.buildPillars(floorY, floor);

            this.buildReinforcements(floorY, floor);

            if (this.options.createCeilingDetails) {

                this.buildCeiling(floorY, floor);

            }

        }

        // Dach über der obersten Etage
        const roofY =
            this.options.floorCount *
            this.options.floorHeight;

        this.createFloorSlab(
            roofY,
            "Bunker_Dach",
            this.options.floorCount
        );

    }

    // ========================================================
    // BODENPLATTEN
    // ========================================================

    createFloorSlab(floorY, name, floorIndex) {

        const thickness = this.options.floorThickness;

        return this.createPart(

            name,

            {
                x: 0,
                y: floorY - thickness / 2,
                z: 0
            },

            {
                x: this.options.width,
                y: thickness,
                z: this.options.depth
            },

            this.materials.floor,

            {
                solid: true,
                floorIndex
            }

        );

    }

    buildFloor(floorY, floorIndex) {

        this.createFloorSlab(

            floorY,

            "Bunker_Boden_Etage_" + (floorIndex + 1),

            floorIndex

        );

        if (this.options.createFloorDetails) {

            this.buildFloorJoints(
                floorY,
                floorIndex
            );

        }

    }

    // ========================================================
    // BODENFUGEN
    // ========================================================

    buildFloorJoints(floorY, floorIndex) {

        const size = this.options.width;

        const half = size / 2;

        const spacing = 6;

        const lineThickness = 0.025;

        const lineY = floorY + 0.006;

        for (
            let x = -half + spacing;
            x < half;
            x += spacing
        ) {

            this.createPart(

                "Bodenfuge_X_" + floorIndex + "_" + x,

                {
                    x,
                    y: lineY,
                    z: 0
                },

                {
                    x: lineThickness,
                    y: 0.008,
                    z: size
                },

                this.materials.joint,

                {
                    floorIndex
                }

            );

        }

        for (
            let z = -half + spacing;
            z < half;
            z += spacing
        ) {

            this.createPart(

                "Bodenfuge_Z_" + floorIndex + "_" + z,

                {
                    x: 0,
                    y: lineY,
                    z
                },

                {
                    x: size,
                    y: 0.008,
                    z: lineThickness
                },

                this.materials.joint,

                {
                    floorIndex
                }

            );

        }

    }

    // ========================================================
    // WÄNDE
    // ========================================================

    buildWalls(floorY, floorIndex) {

        const width = this.options.width;

        const depth = this.options.depth;

        const thickness = this.options.wallThickness;

        const height = this.options.wallHeight;

        const halfWidth = width / 2;

        const halfDepth = depth / 2;

        const wallY = floorY + height / 2;

        // Linke Außenwand
        this.createPart(

            "Bunker_Wand_Links_" + floorIndex,

            {
                x: -halfWidth + thickness / 2,
                y: wallY,
                z: 0
            },

            {
                x: thickness,
                y: height,
                z: depth
            },

            this.materials.concrete,

            {
                solid: true,
                floorIndex
            }

        );

        // Rechte Außenwand
        this.createPart(

            "Bunker_Wand_Rechts_" + floorIndex,

            {
                x: halfWidth - thickness / 2,
                y: wallY,
                z: 0
            },

            {
                x: thickness,
                y: height,
                z: depth
            },

            this.materials.concrete,

            {
                solid: true,
                floorIndex
            }

        );

        // Hintere Außenwand
        this.createPart(

            "Bunker_Wand_Hinten_" + floorIndex,

            {
                x: 0,
                y: wallY,
                z: -halfDepth + thickness / 2
            },

            {
                x: width,
                y: height,
                z: thickness
            },

            this.materials.concrete,

            {
                solid: true,
                floorIndex
            }

        );

        // Vorderwand mit Türöffnung
        this.buildFrontWall(floorY, floorIndex);

        if (this.options.createWallDetails) {

            this.buildWallDetails(floorY, floorIndex);

        }

    }

    // ========================================================
    // VORDERWAND MIT TÜRÖFFNUNG
    // ========================================================

    buildFrontWall(floorY, floorIndex) {

        const width = this.options.width;

        const thickness = this.options.wallThickness;

        const height = this.options.wallHeight;

        const doorWidth = this.options.doorWidth;

        const doorHeight = this.options.doorHeight;

        const halfWidth = width / 2;

        const halfDoor = doorWidth / 2;

        const frontZ =
            this.options.depth / 2 -
            thickness / 2;

        const wallY =
            floorY + height / 2;

        const sideWidth =
            halfWidth - halfDoor;

        // Linker Wandabschnitt
        this.createPart(

            "Bunker_Vorderwand_Links_" + floorIndex,

            {
                x: -(halfDoor + sideWidth / 2),
                y: wallY,
                z: frontZ
            },

            {
                x: sideWidth,
                y: height,
                z: thickness
            },

            this.materials.concrete,

            {
                solid: true,
                floorIndex
            }

        );

        // Rechter Wandabschnitt
        this.createPart(

            "Bunker_Vorderwand_Rechts_" + floorIndex,

            {
                x: halfDoor + sideWidth / 2,
                y: wallY,
                z: frontZ
            },

            {
                x: sideWidth,
                y: height,
                z: thickness
            },

            this.materials.concrete,

            {
                solid: true,
                floorIndex
            }

        );

        // Beton über der Tür
        const upperHeight =
            height - doorHeight;

        const upperY =
            floorY + doorHeight + upperHeight / 2;

        this.createPart(

            "Bunker_Tuersturz_" + floorIndex,

            {
                x: 0,
                y: upperY,
                z: frontZ
            },

            {
                x: doorWidth,
                y: upperHeight,
                z: thickness
            },

            this.materials.concrete,

            {
                solid: true,
                floorIndex
            }

        );

        this.buildDoorFrame(
            floorY,
            floorIndex,
            frontZ
        );

    }

    // ========================================================
    // VERSTÄRKTER TÜRRAHMEN
    // ========================================================

    buildDoorFrame(floorY, floorIndex, frontZ) {

        const width = this.options.doorWidth;

        const height = this.options.doorHeight;

        const frameWidth = 0.18;

        const frameDepth = 0.12;

        const frameZ = frontZ + 0.24;

        // Linker Rahmen
        this.createPart(

            "Tuerrahmen_Links_" + floorIndex,

            {
                x: -width / 2,
                y: floorY + height / 2,
                z: frameZ
            },

            {
                x: frameWidth,
                y: height,
                z: frameDepth
            },

            this.materials.reinforcement,

            {
                floorIndex
            }

        );

        // Rechter Rahmen
        this.createPart(

            "Tuerrahmen_Rechts_" + floorIndex,

            {
                x: width / 2,
                y: floorY + height / 2,
                z: frameZ
            },

            {
                x: frameWidth,
                y: height,
                z: frameDepth
            },

            this.materials.reinforcement,

            {
                floorIndex
            }

        );

        // Oberer Rahmen
        this.createPart(

            "Tuerrahmen_Oben_" + floorIndex,

            {
                x: 0,
                y: floorY + height,
                z: frameZ
            },

            {
                x: width + frameWidth,
                y: frameWidth,
                z: frameDepth
            },

            this.materials.reinforcement,

            {
                floorIndex
            }

        );

    }

    // ========================================================
    // WANDPLATTEN UND BETONFUGEN
    // ========================================================

    buildWallDetails(floorY, floorIndex) {

        const half = this.options.width / 2;

        const depth = this.options.depth;

        const height = this.options.wallHeight;

        const thickness = 0.025;

        const wallSurface = this.options.width / 2 -
            this.options.wallThickness - 0.015;

        const spacing = 4;

        // Fugen an linker und rechter Wand
        for (
            let z = -half + spacing;
            z < half;
            z += spacing
        ) {

            this.createPart(

                "Wandfuge_Seite_" + floorIndex + "_" + z,

                {
                    x: -wallSurface,
                    y: floorY + height / 2,
                    z
                },

                {
                    x: thickness,
                    y: height - 0.2,
                    z: 0.025
                },

                this.materials.joint,

                {
                    floorIndex
                }

            );

            this.createPart(

                "Wandfuge_Seite2_" + floorIndex + "_" + z,

                {
                    x: wallSurface,
                    y: floorY + height / 2,
                    z
                },

                {
                    x: thickness,
                    y: height - 0.2,
                    z: 0.025
                },

                this.materials.joint,

                {
                    floorIndex
                }

            );

        }

        // Fugen an der Rückwand
        const backZ =
            -depth / 2 +
            this.options.wallThickness +
            0.015;

        for (
            let x = -half + spacing;
            x < half;
            x += spacing
        ) {

            this.createPart(

                "Wandfuge_Hinten_" + floorIndex + "_" + x,

                {
                    x,
                    y: floorY + height / 2,
                    z: backZ
                },

                {
                    x: 0.025,
                    y: height - 0.2,
                    z: thickness
                },

                this.materials.joint,

                {
                    floorIndex
                }

            );

        }

        // Horizontale Plattenfuge
        const horizontalY =
            floorY + height / 2;

        this.createPart(

            "Horizontale_Wandfuge_" + floorIndex,

            {
                x: 0,
                y: horizontalY,
                z: backZ
            },

            {
                x: this.options.width - 0.3,
                y: 0.025,
                z: thickness
            },

            this.materials.joint,

            {
                floorIndex
            }

        );

    }

    // ========================================================
    // STÜTZPFEILER
    // ========================================================

    buildPillars(floorY, floorIndex) {

        const positions = this.options.pillarPositions;

        const size = this.options.pillarSize;

        const height = this.options.wallHeight;

        for (let i = 0; i < positions.length; i++) {

            const x = positions[i][0];

            const z = positions[i][1];

            // Hauptpfeiler
            this.createPart(

                "Bunker_Pfeiler_" + floorIndex + "_" + i,

                {
                    x,
                    y: floorY + height / 2,
                    z
                },

                {
                    x: size,
                    y: height,
                    z: size
                },

                this.materials.pillar,

                {
                    solid: true,
                    floorIndex
                }

            );

            if (this.options.createPillarDetails) {

                this.buildPillarDetails(
                    x,
                    z,
                    floorY,
                    floorIndex,
                    i
                );

            }

        }

    }

    // ========================================================
    // PFEILERDETAILS
    // ========================================================

    buildPillarDetails(x, z, floorY, floorIndex, index) {

        const size = this.options.pillarSize;

        const height = this.options.wallHeight;

        const baseSize = size + 0.28;

        // Sockel
        this.createPart(

            "Pfeiler_Sockel_" + floorIndex + "_" + index,

            {
                x,
                y: floorY + 0.18,
                z
            },

            {
                x: baseSize,
                y: 0.36,
                z: baseSize
            },

            this.materials.darkConcrete,

            {
                floorIndex
            }

        );

        // Verstärkung oben
        this.createPart(

            "Pfeiler_Kopf_" + floorIndex + "_" + index,

            {
                x,
                y: floorY + height - 0.2,
                z
            },

            {
                x: baseSize,
                y: 0.4,
                z: baseSize
            },

            this.materials.reinforcement,

            {
                floorIndex
            }

        );

    }

    // ========================================================
    // WANDVERSTÄRKUNGEN
    // ========================================================

    buildReinforcements(floorY, floorIndex) {

        const half = this.options.width / 2;

        const height = this.options.wallHeight;

        const thickness = 0.3;

        const positions = [-8, 0, 8];

        for (let i = 0; i < positions.length; i++) {

            const z = positions[i];

            // Verstärkungsrippen an linker Wand
            this.createPart(

                "Wandverstaerkung_Links_" + floorIndex + "_" + i,

                {
                    x: -half + 0.65,
                    y: floorY + height / 2,
                    z
                },

                {
                    x: thickness,
                    y: height,
                    z: 0.5
                },

                this.materials.darkConcrete,

                {
                    solid: true,
                    floorIndex
                }

            );

            // Verstärkungsrippen an rechter Wand
            this.createPart(

                "Wandverstaerkung_Rechts_" + floorIndex + "_" + i,

                {
                    x: half - 0.65,
                    y: floorY + height / 2,
                    z
                },

                {
                    x: thickness,
                    y: height,
                    z: 0.5
                },

                this.materials.darkConcrete,

                {
                    solid: true,
                    floorIndex
                }

            );

        }

    }

    // ========================================================
    // DECKENBALKEN
    // ========================================================

    buildCeiling(floorY, floorIndex) {

        const height = this.options.wallHeight;

        const width = this.options.width;

        const depth = this.options.depth;

        const beamY =
            floorY + height - 0.22;

        const beamSize = 0.38;

        // Querbalken
        for (
            let z = -8;
            z <= 8;
            z += 8
        ) {

            this.createPart(

                "Deckenbalken_" + floorIndex + "_" + z,

                {
                    x: 0,
                    y: beamY,
                    z
                },

                {
                    x: width - 0.5,
                    y: beamSize,
                    z: beamSize
                },

                this.materials.darkConcrete,

                {
                    solid: true,
                    floorIndex
                }

            );

        }

        // Längsbalken
        for (
            let x = -8;
            x <= 8;
            x += 8
        ) {

            this.createPart(

                "Deckenbalken_Laengs_" + floorIndex + "_" + x,

                {
                    x,
                    y: beamY,
                    z: 0
                },

                {
                    x: beamSize,
                    y: beamSize,
                    z: depth - 0.5
                },

                this.materials.darkConcrete,

                {
                    solid: true,
                    floorIndex
                }

            );

        }

    }

    // ========================================================
    // ETAGE SICHTBAR SCHALTEN
    // ========================================================

    setFloorVisible(floorIndex, visible) {

        this.group.children.forEach(object => {

            if (object.userData.floorIndex === floorIndex) {

                object.visible = visible;

            }

        });

    }

    // ========================================================
    // ALLE ETAGEN SICHTBAR SCHALTEN
    // ========================================================

    setVisible(visible) {

        this.group.visible = visible;

    }

    // ========================================================
    // PHYSIK-KOLLISIONEN ENTFERNEN
    // ========================================================

    removePhysicsBodies() {

        if (!this.physics || !this.physics.world) {

            this.physicsBodies = [];

            return;

        }

        for (const entry of this.physicsBodies) {

            const body =
                entry?.body ??
                entry?.rigidBody ??
                entry;

            if (!body) continue;

            try {

                if (
                    typeof body.isValid !== "function" ||
                    body.isValid()
                ) {

                    this.physics.world.removeRigidBody(body);

                }

            } catch (error) {

                console.warn(
                    "Bunker-Physikkörper konnte nicht entfernt werden:",
                    error
                );

            }

        }

        this.physicsBodies = [];

    }

    // ========================================================
    // AUFRÄUMEN
    // ========================================================

    dispose() {

        this.removePhysicsBodies();

        this.group.traverse(object => {

            if (object.isMesh) {

                object.geometry.dispose();

            }

        });

        const disposedTextures = new Set();

        Object.values(this.materials).forEach(material => {

            if (material.map && !disposedTextures.has(material.map)) {

                material.map.dispose();

                disposedTextures.add(material.map);

            }

            if (material.bumpMap && !disposedTextures.has(material.bumpMap)) {

                material.bumpMap.dispose();

                disposedTextures.add(material.bumpMap);

            }

            material.dispose();

        });

        this.scene.remove(this.group);

    }

}

// ============================================================
// ERSTELLFUNKTION
// ============================================================

export function createBunker(
    scene,
    physics = null,
    options = {}
) {

    return new BunkerSystem(
        scene,
        physics,
        options
    );

}
