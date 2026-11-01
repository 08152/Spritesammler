
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/*
=========================================================
 BUNKER.JS – REALISTISCHER BETONBUNKER
=========================================================

 7 Etagen
 24 x 24 Meter
 8 Meter Etagenhöhe
 Massive Betonwände
 Türöffnungen in der Vorderwand
 Stützpfeiler
 Physik-Kollisionen mit Rapier

 Diese Datei baut ausschließlich den Bunker.
=========================================================
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

            pillarSize: 0.55,

            createPhysics: true,

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

    // =====================================================
    // MATERIALIEN
    // =====================================================

    createMaterials() {

        this.materials.concrete = new THREE.MeshStandardMaterial({

            color: 0x777873,

            roughness: 0.96,

            metalness: 0.0

        });

        this.materials.floor = new THREE.MeshStandardMaterial({

            color: 0x666963,

            roughness: 0.98,

            metalness: 0.0

        });

        this.materials.pillar = new THREE.MeshStandardMaterial({

            color: 0x858680,

            roughness: 0.95,

            metalness: 0.0

        });

    }

    // =====================================================
    // BAUTEIL ERSTELLEN
    // =====================================================

    createPart(name, position, size, material) {

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

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.group.add(mesh);

        // Physik-Kollision erstellen
        if (
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

    // =====================================================
    // GESAMTEN BUNKER BAUEN
    // =====================================================

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

        }

        // Dach über der obersten Etage
        const roofY =
            this.options.floorCount *
            this.options.floorHeight;

        this.createFloorSlab(
            roofY,
            "Bunker_Dach"
        );

    }

    // =====================================================
    // BODENPLATTE
    // =====================================================

    createFloorSlab(floorY, name) {

        const centerY =
            floorY -
            this.options.floorThickness / 2;

        return this.createPart(

            name,

            {
                x: 0,
                y: centerY,
                z: 0
            },

            {
                x: this.options.width,
                y: this.options.floorThickness,
                z: this.options.depth
            },

            this.materials.floor

        );

    }

    buildFloor(floorY, floorIndex) {

        this.createFloorSlab(

            floorY,

            "Bunker_Boden_Etage_" + (floorIndex + 1)

        );

    }

    // =====================================================
    // WÄNDE
    // =====================================================

    buildWalls(floorY, floorIndex) {

        const width = this.options.width;
        const depth = this.options.depth;

        const thickness = this.options.wallThickness;
        const height = this.options.wallHeight;

        const halfWidth = width / 2;
        const halfDepth = depth / 2;

        const wallY = floorY + height / 2;

        const wallMaterial = this.materials.concrete;

        // Linke Wand
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

            wallMaterial

        );

        // Rechte Wand
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

            wallMaterial

        );

        // Hintere Wand
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

            wallMaterial

        );

        // Vorderwand mit Türöffnung
        this.buildFrontWall(
            floorY,
            floorIndex
        );

    }

    // =====================================================
    // VORDERWAND MIT TÜRÖFFNUNG
    // =====================================================

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

        // Linker Teil der Vorderwand
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

            this.materials.concrete

        );

        // Rechter Teil der Vorderwand
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

            this.materials.concrete

        );

        // Wandstück über der Tür
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

            this.materials.concrete

        );

    }

    // =====================================================
    // STÜTZPFEILER
    // =====================================================

    buildPillars(floorY, floorIndex) {

        const positions = [

            [-8, -8],
            [0, -8],
            [8, -8],

            [-8, 0],
            [0, 0],
            [8, 0],

            [-8, 8],
            [8, 8]

        ];

        const size = this.options.pillarSize;

        for (let i = 0; i < positions.length; i++) {

            const x = positions[i][0];
            const z = positions[i][1];

            this.createPart(

                "Bunker_Pfeiler_" + floorIndex + "_" + i,

                {
                    x,
                    y: floorY + this.options.wallHeight / 2,
                    z
                },

                {
                    x: size,
                    y: this.options.wallHeight,
                    z: size
                },

                this.materials.pillar

            );

        }

    }

    // =====================================================
    // ETAGE SICHTBAR SCHALTEN
    // =====================================================

    setFloorVisible(floorIndex, visible) {

        const prefix = [
            "Bunker_Boden_Etage_" + (floorIndex + 1),
            "Bunker_Wand_",
            "Bunker_Vorderwand_",
            "Bunker_Tuersturz_",
            "Bunker_Pfeiler_" + floorIndex + "_"
        ];

        this.group.children.forEach(object => {

            const matches = prefix.some(name =>
                object.name.startsWith(name)
            );

            if (matches) {

                object.visible = visible;

            }

        });

    }

    // =====================================================
    // ALLES SICHTBAR SCHALTEN
    // =====================================================

    setVisible(visible) {

        this.group.visible = visible;

    }

    // =====================================================
    // AUFRÄUMEN
    // =====================================================

    dispose() {

        this.group.traverse(object => {

            if (object.isMesh) {

                object.geometry.dispose();

            }

        });

        Object.values(this.materials).forEach(material => {

            material.dispose();

        });

        // Physik-Körper entfernen, sofern vorhanden
        if (this.physics && this.physics.world) {

            for (const entry of this.physicsBodies) {

                const body = entry?.body ?? entry;

                if (body && typeof body.isValid === "function") {

                    if (body.isValid()) {

                        this.physics.world.removeRigidBody(body);

                    }

                }

            }

        }

        this.physicsBodies = [];

        this.scene.remove(this.group);

    }

}

// =========================================================
// ERSTELLFUNKTION
// =========================================================

export function createBunker(scene, physics = null, options = {}) {

    return new BunkerSystem(
        scene,
        physics,
        options
    );

}
