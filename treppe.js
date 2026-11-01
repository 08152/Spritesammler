
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/*
=========================================================
 TREPPE.JS – HOCHDETAILLIERTE BUNKERTREPPE
=========================================================

 Standard:
 - 7 Etagen
 - 8 Meter Etagenhöhe
 - 32 Stufen pro Etage
 - 2,2 Meter Treppenbreite
 - Metallkonstruktion
 - Riffelblechstufen
 - Geländer auf beiden Seiten

 Verwendung:

 import { createStaircase } from "./treppe.js";

 const staircase = createStaircase(scene);

 Optional mit Physik:

 const staircase = createStaircase(scene, {
     physics: physics
 });

=========================================================
*/

const DEFAULTS = {
    floors: 7,
    floorHeight: 8,

    stepsPerFloor: 32,

    width: 2.2,
    startX: 8.5,
    startZ: -7,

    runLength: 14,

    createPhysics: false,

    position: {
        x: 0,
        y: 0,
        z: 0
    }
};

export class BunkerStaircase {

    constructor(scene, options = {}) {

        this.scene = scene;
        this.options = {
            ...DEFAULTS,
            ...options,
            position: {
                ...DEFAULTS.position,
                ...(options.position || {})
            }
        };

        this.group = new THREE.Group();
        this.group.name = "Bunker_HighDetail_Staircase";

        this.group.position.set(
            this.options.position.x,
            this.options.position.y,
            this.options.position.z
        );

        this.physics = this.options.physics || null;

        this.physicsBodies = [];

        this.materials = this.createMaterials();

        this.build();

        this.scene.add(this.group);
    }

    // -----------------------------------------------------
    // MATERIALIEN
    // -----------------------------------------------------

    createMaterials() {

        return {

            steel: new THREE.MeshStandardMaterial({
                color: 0x343a40,
                metalness: 0.85,
                roughness: 0.42
            }),

            darkSteel: new THREE.MeshStandardMaterial({
                color: 0x171c20,
                metalness: 0.9,
                roughness: 0.48
            }),

            tread: new THREE.MeshStandardMaterial({
                color: 0x50585e,
                metalness: 0.88,
                roughness: 0.55
            }),

            edge: new THREE.MeshStandardMaterial({
                color: 0x858b8e,
                metalness: 0.9,
                roughness: 0.3
            }),

            yellow: new THREE.MeshStandardMaterial({
                color: 0xd59b24,
                metalness: 0.55,
                roughness: 0.48
            }),

            bolt: new THREE.MeshStandardMaterial({
                color: 0x9da3a6,
                metalness: 0.95,
                roughness: 0.25
            }),

            rubber: new THREE.MeshStandardMaterial({
                color: 0x111315,
                roughness: 0.95
            })
        };
    }

    // -----------------------------------------------------
    // HAUPTAUFBAU
    // -----------------------------------------------------

    build() {

        const floors = this.options.floors;

        for (let floor = 0; floor < floors - 1; floor++) {

            this.buildFloorFlight(floor);

        }

        this.buildBottomPlatform();
        this.buildTopPlatform();

    }

    // -----------------------------------------------------
    // EIN TREPPENABSCHNITT
    // -----------------------------------------------------

    buildFloorFlight(floor) {

        const count = this.options.stepsPerFloor;

        const height = this.options.floorHeight;

        const run = this.options.runLength;

        const stepHeight = height / count;

        const stepDepth = run / count;

        const baseY = floor * height;

        const baseX = this.options.startX;

        const baseZ = this.options.startZ;

        const width = this.options.width;

        const flight = new THREE.Group();

        flight.name = "Treppenabschnitt_Etage_" + floor;

        this.group.add(flight);

        // Einzelne Stufen
        for (let i = 0; i < count; i++) {

            const z = baseZ + i * stepDepth;

            const topY = baseY + (i + 1) * stepHeight;

            const centerY = topY - 0.055;

            this.buildStep(
                flight,
                baseX,
                centerY,
                z + stepDepth / 2,
                width,
                stepDepth,
                floor,
                i
            );

        }

        // Seitliche Träger
        this.buildStringers(
            flight,
            baseX,
            baseY,
            baseZ,
            width,
            height,
            run
        );

        // Geländer
        this.buildHandrail(
            flight,
            baseX,
            baseY,
            baseZ,
            width,
            height,
            run,
            -1
        );

        this.buildHandrail(
            flight,
            baseX,
            baseY,
            baseZ,
            width,
            height,
            run,
            1
        );

        // Diagonale Verstrebungen
        this.buildBracing(
            flight,
            baseX,
            baseY,
            baseZ,
            width,
            height,
            run
        );

        // Etagenpodest
        this.buildLanding(
            flight,
            baseX,
            baseY + height,
            baseZ + run,
            width,
            floor
        );

    }

    // -----------------------------------------------------
    // EINZELNE METALLSTUFE
    // -----------------------------------------------------

    buildStep(parent, x, y, z, width, depth, floor, index) {

        const group = new THREE.Group();

        group.position.set(x, y, z);

        parent.add(group);

        const thickness = 0.11;

        // Hauptplatte
        const plate = new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                thickness,
                depth * 0.96
            ),
            this.materials.tread
        );

        plate.castShadow = true;
        plate.receiveShadow = true;

        group.add(plate);

        // Vorderkante
        const frontEdge = new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                0.035,
                0.045
            ),
            this.materials.edge
        );

        frontEdge.position.set(
            0,
            -0.015,
            depth * 0.46
        );

        group.add(frontEdge);

        // Gelbe Sicherheitsmarkierung
        const safetyLine = new THREE.Mesh(
            new THREE.BoxGeometry(
                width * 0.94,
                0.012,
                0.025
            ),
            this.materials.yellow
        );

        safetyLine.position.set(
            0,
            thickness / 2 + 0.008,
            depth * 0.39
        );

        group.add(safetyLine);

        // Riffelblechstreifen
        for (let r = 0; r < 5; r++) {

            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(
                    width * 0.94,
                    0.012,
                    0.018
                ),
                this.materials.edge
            );

            stripe.position.set(
                0,
                thickness / 2 + 0.008,
                -depth * 0.32 + r * depth * 0.15
            );

            group.add(stripe);

        }

        // Kleine Schraubenköpfe
        for (const side of [-1, 1]) {

            for (const front of [-1, 1]) {

                this.addBolt(
                    group,
                    side * (width / 2 - 0.12),
                    thickness / 2 + 0.012,
                    front * (depth / 2 - 0.09)
                );

            }

        }

        // Unterseitige Verstärkungsprofile
        for (const side of [-1, 1]) {

            const support = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.055,
                    0.07,
                    depth * 0.8
                ),
                this.materials.darkSteel
            );

            support.position.set(
                side * (width / 2 - 0.16),
                -0.075,
                0
            );

            group.add(support);

        }

        // Physikkollision für die Stufe
        if (this.physics && this.options.createPhysics) {

            const body = this.physics.createStaticBox(
                {
                    x: x,
                    y: y,
                    z: z
                },
                {
                    x: width,
                    y: thickness,
                    z: depth * 0.96
                },
                {
                    friction: 0.85,
                    restitution: 0
                }
            );

            if (body) {
                this.physicsBodies.push(body);
            }

        }

    }

    // -----------------------------------------------------
    // SCHRAUBEN
    // -----------------------------------------------------

    addBolt(parent, x, y, z) {

        const bolt = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.025,
                0.025,
                0.014,
                8
            ),
            this.materials.bolt
        );

        bolt.rotation.x = Math.PI / 2;

        bolt.position.set(x, y, z);

        parent.add(bolt);

        // Innensechskant
        const slot = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.018,
                0.003,
                0.004
            ),
            this.materials.darkSteel
        );

        slot.position.set(
            x,
            y + 0.009,
            z
        );

        parent.add(slot);

    }

    // -----------------------------------------------------
    // SEITLICHE TREPPENTRÄGER
    // -----------------------------------------------------

    buildStringers(parent, x, baseY, baseZ, width, height, run) {

        for (const side of [-1, 1]) {

            const beam = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.16,
                    Math.sqrt(height * height + run * run),
                    0.22
                ),
                this.materials.darkSteel
            );

            const slope = Math.atan2(height, run);

            beam.position.set(
                x + side * (width / 2 + 0.02),
                baseY + height / 2 - 0.04,
                baseZ + run / 2
            );

            beam.rotation.x = slope;

            beam.castShadow = true;

            parent.add(beam);

            // Äußere Metallabdeckung
            const cover = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.025,
                    Math.sqrt(height * height + run * run) * 0.96,
                    0.25
                ),
                this.materials.steel
            );

            cover.position.copy(beam.position);

            cover.position.x += side * 0.09;

            cover.rotation.x = slope;

            parent.add(cover);

        }

    }

    // -----------------------------------------------------
    // GELÄNDER
    // -----------------------------------------------------

    buildHandrail(parent, x, baseY, baseZ, width, height, run, side) {

        const railX = x + side * (width / 2 + 0.08);

        const railHeight = 1.05;

        const postCount = 17;

        // Senkrechte Pfosten
        for (let i = 0; i <= postCount; i++) {

            const t = i / postCount;

            const postZ = baseZ + t * run;

            const postY = baseY + t * height;

            const post = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.075,
                    railHeight,
                    0.075
                ),
                this.materials.steel
            );

            post.position.set(
                railX,
                postY + railHeight / 2,
                postZ
            );

            post.castShadow = true;

            parent.add(post);

            // Fußplatte
            const foot = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.17,
                    0.045,
                    0.17
                ),
                this.materials.darkSteel
            );

            foot.position.set(
                railX,
                postY + 0.04,
                postZ
            );

            parent.add(foot);

            // Befestigungsschrauben
            this.addBolt(
                foot,
                -0.045,
                0.025,
                0
            );

            this.addBolt(
                foot,
                0.045,
                0.025,
                0
            );

        }

        // Oberer Handlauf
        this.addSlopedBeam(
            parent,
            railX,
            baseY + railHeight,
            baseZ,
            0.09,
            height,
            run,
            this.materials.edge
        );

        // Unterer Querholm
        this.addSlopedBeam(
            parent,
            railX,
            baseY + 0.42,
            baseZ,
            0.045,
            height,
            run,
            this.materials.steel
        );

        // Mittlerer Querholm
        this.addSlopedBeam(
            parent,
            railX,
            baseY + 0.72,
            baseZ,
            0.045,
            height,
            run,
            this.materials.steel
        );

    }

    // -----------------------------------------------------
    // SCHRÄGE METALLTRÄGER
    // -----------------------------------------------------

    addSlopedBeam(parent, x, y, z, thickness, height, run, material) {

        const length = Math.sqrt(
            height * height + run * run
        );

        const beam = new THREE.Mesh(
            new THREE.BoxGeometry(
                thickness,
                length,
                thickness
            ),
            material
        );

        beam.position.set(
            x,
            y + height / 2,
            z + run / 2
        );

        beam.rotation.x = Math.atan2(height, run);

        beam.castShadow = true;

        parent.add(beam);

    }

    // -----------------------------------------------------
    // VERSTREBUNGEN
    // -----------------------------------------------------

    buildBracing(parent, x, baseY, baseZ, width, height, run) {

        for (const side of [-1, 1]) {

            const braceX = x + side * (width / 2 + 0.18);

            for (let i = 0; i < 4; i++) {

                const t = i / 4;

                const brace = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.055,
                        1.5,
                        0.055
                    ),
                    this.materials.darkSteel
                );

                brace.position.set(
                    braceX,
                    baseY + height * t + 0.75,
                    baseZ + run * t + 0.5
                );

                brace.rotation.x = -0.35;

                parent.add(brace);

            }

        }

    }

    // -----------------------------------------------------
    // ZWISCHENPODEST
    // -----------------------------------------------------

    buildLanding(parent, x, y, z, width, floor) {

        const landing = new THREE.Group();

        landing.position.set(x, y, z);

        parent.add(landing);

        // Bodenplatte
        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(
                width + 0.2,
                0.18,
                1.6
            ),
            this.materials.tread
        );

        platform.position.set(0, -0.09, 0.8);

        platform.receiveShadow = true;
        platform.castShadow = true;

        landing.add(platform);

        // Gelbe Markierungen
        for (const side of [-1, 1]) {

            const marking = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.055,
                    0.015,
                    1.45
                ),
                this.materials.yellow
            );

            marking.position.set(
                side * (width / 2 - 0.08),
                0.01,
                0.8
            );

            landing.add(marking);

        }

        // Untere Träger
        for (const side of [-1, 1]) {

            const support = new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.12,
                    0.25,
                    1.7
                ),
                this.materials.darkSteel
            );

            support.position.set(
                side * (width / 2 - 0.12),
                -0.24,
                0.8
            );

            landing.add(support);

        }

        // Kleine Warnleuchte
        const lamp = new THREE.Mesh(
            new THREE.BoxGeometry(
                0.18,
                0.07,
                0.09
            ),
            this.materials.yellow
        );

        lamp.position.set(
            width / 2 - 0.2,
            0.16,
            0.2
        );

        landing.add(lamp);

    }

    // -----------------------------------------------------
    // UNTERES PODEST
    // -----------------------------------------------------

    buildBottomPlatform() {

        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(
                this.options.width + 0.5,
                0.16,
                1.8
            ),
            this.materials.tread
        );

        platform.position.set(
            this.options.startX,
            -0.08,
            this.options.startZ - 0.9
        );

        platform.receiveShadow = true;

        this.group.add(platform);

    }

    // -----------------------------------------------------
    // OBERES PODEST
    // -----------------------------------------------------

    buildTopPlatform() {

        const lastFloor = this.options.floors - 1;

        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(
                this.options.width + 0.5,
                0.16,
                1.8
            ),
            this.materials.tread
        );

        platform.position.set(
            this.options.startX,
            lastFloor * this.options.floorHeight - 0.08,
            this.options.startZ + this.options.runLength + 0.9
        );

        platform.receiveShadow = true;

        this.group.add(platform);

    }

    // -----------------------------------------------------
    // POSITION ÄNDERN
    // -----------------------------------------------------

    setPosition(x, y, z) {

        this.group.position.set(x, y, z);

    }

    // -----------------------------------------------------
    // SICHTBARKEIT
    // -----------------------------------------------------

    setVisible(visible) {

        this.group.visible = visible;

    }

    // -----------------------------------------------------
    // AUFRÄUMEN
    // -----------------------------------------------------

    dispose() {

        if (this.physics && this.physics.world) {

            for (const item of this.physicsBodies) {

                const body = item.body || item;

                try {
                    this.physics.world.removeRigidBody(body);
                } catch (error) {
                    console.warn("Treppenkörper konnte nicht entfernt werden:", error);
                }

            }

        }

        this.group.traverse(object => {

            if (object.isMesh) {

                object.geometry.dispose();

            }

        });

        for (const material of Object.values(this.materials)) {

            material.dispose();

        }

        this.scene.remove(this.group);

        this.physicsBodies = [];

    }

}

// ---------------------------------------------------------
// EINFACHE ERSTELLFUNKTION
// ---------------------------------------------------------

export function createStaircase(scene, options = {}) {

    return new BunkerStaircase(scene, options);

}
