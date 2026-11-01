
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { createCoin } from "./coin.js";

export class CoinCountingMachine {
    constructor(scene, physics, options = {}) {
        this.scene = scene;
        this.physics = physics ?? null;

        this.position = options.position ?? {
            x: -8,
            y: 0,
            z: -5
        };

        this.scale = options.scale ?? 1;

        this.group = new THREE.Group();
        this.group.position.set(
            this.position.x,
            this.position.y,
            this.position.z
        );
        this.group.scale.setScalar(this.scale);

        this.count = 0;
        this.totalValue = 0;
        this.speed = 0;

        this.running = true;
        this.coinsPerSecond = 0;

        this.elapsed = 0;
        this.spawnTimer = 0;
        this.displayTimer = 0;

        this.spawnInterval = options.spawnInterval ?? 0.08;
        this.maxQueuedCoins = options.maxQueuedCoins ?? 5000;
        this.maxActiveCoins = options.maxActiveCoins ?? 300;

        this.coinQueue = [];
        this.activeCoins = [];

        this.movingParts = [];
        this.indicatorLights = [];
        this.staticColliders = [];

        this.createMaterials();
        this.createMachine();
        this.createDisplay();
        this.createPhysicsColliders();

        this.scene.add(this.group);
    }

    // MATERIALIEN

    createMaterials() {
        this.materials = {
            steel: new THREE.MeshStandardMaterial({
                color: 0x414950,
                metalness: 0.88,
                roughness: 0.29
            }),

            darkSteel: new THREE.MeshStandardMaterial({
                color: 0x171D22,
                metalness: 0.82,
                roughness: 0.36
            }),

            silver: new THREE.MeshStandardMaterial({
                color: 0xA4ADB3,
                metalness: 0.94,
                roughness: 0.2
            }),

            gold: new THREE.MeshStandardMaterial({
                color: 0xDFA51C,
                metalness: 0.95,
                roughness: 0.2
            }),

            rubber: new THREE.MeshStandardMaterial({
                color: 0x17191B,
                roughness: 0.88
            }),

            glass: new THREE.MeshPhysicalMaterial({
                color: 0x9AB8C5,
                metalness: 0.1,
                roughness: 0.12,
                transmission: 0.35,
                transparent: true,
                opacity: 0.3,
                thickness: 0.08,
                side: THREE.DoubleSide
            }),

            screen: new THREE.MeshStandardMaterial({
                color: 0x071A1C,
                emissive: 0x063D3A,
                emissiveIntensity: 0.8
            }),

            green: new THREE.MeshStandardMaterial({
                color: 0x31FF8A,
                emissive: 0x16D96B,
                emissiveIntensity: 2
            }),

            red: new THREE.MeshStandardMaterial({
                color: 0xFF3434,
                emissive: 0xB00000,
                emissiveIntensity: 1.5
            }),

            blue: new THREE.MeshStandardMaterial({
                color: 0x36BFFF,
                emissive: 0x0877FF,
                emissiveIntensity: 1.5
            })
        };
    }

    // HILFSFUNKTIONEN

    addBox(name, size, position, material, parent = this.group) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(size.x, size.y, size.z),
            material
        );

        mesh.name = name;
        mesh.position.set(position.x, position.y, position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        parent.add(mesh);
        return mesh;
    }

    addCylinder(name, radius, height, position, material, parent = this.group) {
        const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius, height, 32),
            material
        );

        mesh.name = name;
        mesh.position.set(position.x, position.y, position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        parent.add(mesh);
        return mesh;
    }

    worldPoint(x, y, z) {
        return {
            x: this.position.x + x * this.scale,
            y: this.position.y + y * this.scale,
            z: this.position.z + z * this.scale
        };
    }

    // MASCHINE

    createMachine() {
        this.createBase();
        this.createHousing();
        this.createHopper();
        this.createConveyor();
        this.createCountingMechanism();
        this.createOutput();
        this.createButtons();
        this.createIndicators();
        this.createScreenFrame();
    }

    createBase() {
        this.addBox(
            "MachineBase",
            { x: 3.6, y: 0.3, z: 2.1 },
            { x: 0, y: 0.15, z: 0 },
            this.materials.darkSteel
        );

        this.addBox(
            "MachineBody",
            { x: 3.35, y: 1.35, z: 1.9 },
            { x: 0, y: 0.95, z: 0 },
            this.materials.steel
        );

        for (const x of [-1.55, 1.55]) {
            for (const z of [-0.82, 0.82]) {
                this.addBox(
                    "CornerSupport",
                    { x: 0.12, y: 1.5, z: 0.12 },
                    { x, y: 0.9, z },
                    this.materials.darkSteel
                );
            }
        }

        for (const x of [-1.35, 1.35]) {
            for (const z of [-0.72, 0.72]) {
                this.addCylinder(
                    "MachineFoot",
                    0.12,
                    0.25,
                    { x, y: -0.12, z },
                    this.materials.darkSteel
                );
            }
        }
    }

    createHousing() {
        this.addBox(
            "TopHousing",
            { x: 2.65, y: 0.32, z: 1.65 },
            { x: 0, y: 1.85, z: 0 },
            this.materials.darkSteel
        );

        this.addBox(
            "FrontPanel",
            { x: 2.6, y: 0.85, z: 0.08 },
            { x: 0, y: 1.1, z: -0.97 },
            this.materials.silver
        );

        for (let i = 0; i < 9; i++) {
            this.addBox(
                "Ventilation",
                { x: 0.035, y: 0.42, z: 0.025 },
                {
                    x: -1.25 + i * 0.11,
                    y: 0.92,
                    z: -1.025
                },
                this.materials.darkSteel
            );
        }

        for (const side of [-1, 1]) {
            this.addBox(
                "SidePanel",
                { x: 0.06, y: 1.1, z: 1.5 },
                { x: side * 1.68, y: 0.95, z: 0 },
                this.materials.darkSteel
            );
        }
    }

    // EINFÜLLTRICHTER

    createHopper() {
        const hopper = new THREE.Group();
        hopper.position.set(-0.75, 2.05, 0);

        const top = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.78,
                0.34,
                0.75,
                4,
                1,
                true
            ),
            this.materials.silver
        );

        top.rotation.y = Math.PI / 4;
        top.position.y = 0.35;
        top.castShadow = true;
        hopper.add(top);

        this.addBox(
            "HopperChannel",
            { x: 0.7, y: 0.15, z: 0.55 },
            { x: 0, y: -0.12, z: 0 },
            this.materials.darkSteel,
            hopper
        );

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.76, 0.045, 8, 48),
            this.materials.gold
        );

        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.72;
        hopper.add(ring);

        this.group.add(hopper);
        this.hopper = hopper;
    }

    // FÖRDERBAND

    createConveyor() {
        const conveyor = new THREE.Group();
        conveyor.position.set(0.25, 1.75, 0);

        this.belt = this.addBox(
            "ConveyorBelt",
            { x: 2.35, y: 0.09, z: 0.75 },
            { x: 0.4, y: 0, z: 0 },
            this.materials.rubber,
            conveyor
        );

        for (const z of [-0.42, 0.42]) {
            this.addBox(
                "ConveyorRail",
                { x: 2.45, y: 0.2, z: 0.08 },
                { x: 0.4, y: 0.12, z },
                this.materials.silver,
                conveyor
            );
        }

        for (const x of [-0.78, 1.58]) {
            const roller = this.addCylinder(
                "ConveyorRoller",
                0.12,
                0.82,
                { x, y: -0.02, z: 0 },
                this.materials.darkSteel,
                conveyor
            );

            roller.rotation.x = Math.PI / 2;

            this.movingParts.push({
                mesh: roller,
                speed: 5,
                axis: "z"
            });
        }

        for (let i = 0; i < 5; i++) {
            const roller = this.addCylinder(
                "SupportRoller",
                0.045,
                0.72,
                {
                    x: -0.55 + i * 0.48,
                    y: -0.17,
                    z: 0
                },
                this.materials.silver,
                conveyor
            );

            roller.rotation.x = Math.PI / 2;

            this.movingParts.push({
                mesh: roller,
                speed: 3,
                axis: "z"
            });
        }

        this.group.add(conveyor);
    }

    // ZÄHLMECHANISMUS

    createCountingMechanism() {
        const mechanism = new THREE.Group();
        mechanism.position.set(0.4, 1.95, -0.45);

        const cover = new THREE.Mesh(
            new THREE.BoxGeometry(1.25, 0.75, 0.95),
            this.materials.glass
        );

        cover.position.y = 0.35;
        mechanism.add(cover);

        for (let i = 0; i < 3; i++) {
            const roller = this.addCylinder(
                "CountingRoller",
                0.19,
                0.75,
                {
                    x: -0.38 + i * 0.38,
                    y: 0.25,
                    z: 0
                },
                this.materials.gold,
                mechanism
            );

            roller.rotation.x = Math.PI / 2;

            this.movingParts.push({
                mesh: roller,
                speed: 9 + i * 2,
                axis: "z"
            });

            for (const side of [-1, 1]) {
                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(0.19, 0.025, 8, 32),
                    this.materials.silver
                );

                ring.position.set(
                    -0.38 + i * 0.38,
                    0.25,
                    side * 0.39
                );

                ring.rotation.y = Math.PI / 2;
                mechanism.add(ring);
            }
        }

        this.group.add(mechanism);
    }

    // AUSGABE

    createOutput() {
        this.addBox(
            "OutputTray",
            { x: 0.9, y: 0.12, z: 0.75 },
            { x: 1.25, y: 1.25, z: -0.25 },
            this.materials.silver
        );

        for (const z of [-0.36, 0.36]) {
            this.addBox(
                "OutputWall",
                { x: 0.9, y: 0.22, z: 0.06 },
                { x: 1.25, y: 1.4, z: z - 0.05 },
                this.materials.darkSteel
            );
        }

        this.addBox(
            "OutputChannel",
            { x: 0.6, y: 0.08, z: 0.45 },
            { x: 1.25, y: 1.58, z: -0.25 },
            this.materials.gold
        );
    }

    // BEDIENKNÖPFE

    createButtons() {
        const buttons = [
            { x: -0.9, color: this.materials.green, name: "start" },
            { x: -0.35, color: this.materials.red, name: "stop" },
            { x: 0.2, color: this.materials.blue, name: "reset" }
        ];

        this.buttonObjects = [];

        for (const data of buttons) {
            this.addCylinder(
                "ButtonBase",
                0.13,
                0.09,
                { x: data.x, y: 1.55, z: -1.04 },
                this.materials.darkSteel
            );

            const button = this.addCylinder(
                "ControlButton",
                0.09,
                0.08,
                { x: data.x, y: 1.63, z: -1.04 },
                data.color
            );

            button.userData.action = data.name;
            this.buttonObjects.push(button);
        }
    }

    createIndicators() {
        const colors = [
            this.materials.green,
            this.materials.blue,
            this.materials.red
        ];

        colors.forEach((material, i) => {
            const light = new THREE.Mesh(
                new THREE.SphereGeometry(0.055, 16, 12),
                material
            );

            light.position.set(
                0.85 + i * 0.2,
                1.65,
                -1.04
            );

            this.group.add(light);
            this.indicatorLights.push(light);
        });
    }

    // DISPLAY

    createScreenFrame() {
        this.addBox(
            "DisplayFrame",
            { x: 1.25, y: 0.85, z: 0.16 },
            { x: 0.85, y: 2.05, z: -0.85 },
            this.materials.darkSteel
        );

        this.addBox(
            "DisplayScreen",
            { x: 1.08, y: 0.65, z: 0.035 },
            { x: 0.85, y: 2.05, z: -0.95 },
            this.materials.screen
        );
    }

    createDisplay() {
        this.displayCanvas = document.createElement("canvas");
        this.displayCanvas.width = 512;
        this.displayCanvas.height = 320;

        this.displayContext = this.displayCanvas.getContext("2d");

        this.displayTexture = new THREE.CanvasTexture(
            this.displayCanvas
        );

        this.displayTexture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshBasicMaterial({
            map: this.displayTexture,
            toneMapped: false,
            side: THREE.DoubleSide
        });

        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(1.02, 0.59),
            material
        );

        screen.position.set(0.85, 2.05, -0.974);
        this.group.add(screen);

        this.drawDisplay();
    }

    drawDisplay() {
        const ctx = this.displayContext;
        if (!ctx) return;

        const w = 512;
        const h = 320;

        ctx.fillStyle = "#061311";
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "#0B2923";
        ctx.fillRect(12, 12, w - 24, h - 24);

        ctx.strokeStyle = "#1F765A";
        ctx.lineWidth = 3;
        ctx.strokeRect(12, 12, w - 24, h - 24);

        ctx.fillStyle = "#7BFFD0";
        ctx.font = "bold 25px Arial";
        ctx.fillText("COIN COUNTING SYSTEM", 28, 48);

        ctx.strokeStyle = "#347A62";
        ctx.beginPath();
        ctx.moveTo(25, 65);
        ctx.lineTo(487, 65);
        ctx.stroke();

        ctx.fillStyle = "#91BFB1";
        ctx.font = "19px Arial";
        ctx.fillText("TOTAL COINS", 30, 105);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 44px monospace";
        ctx.fillText(
            this.count.toLocaleString("de-DE"),
            30,
            155
        );

        ctx.fillStyle = "#91BFB1";
        ctx.font = "18px Arial";
        ctx.fillText("TOTAL VALUE", 30, 195);

        ctx.fillStyle = "#FFD76B";
        ctx.font = "bold 31px monospace";
        ctx.fillText(
            this.totalValue.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            30,
            235
        );

        ctx.fillStyle = "#91BFB1";
        ctx.font = "17px Arial";
        ctx.fillText(
            "SPEED: " + this.speed.toFixed(0) + " COINS / SEC",
            30,
            275
        );

        ctx.fillStyle = this.running ? "#39FF9A" : "#FF6666";
        ctx.beginPath();
        ctx.arc(445, 42, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 15px Arial";
        ctx.fillText(
            this.running ? "RUNNING" : "STOPPED",
            380,
            75
        );

        this.displayTexture.needsUpdate = true;
    }

    // STATISCHE KOLLISIONEN
    // Diese sind nur für die Maschinenumgebung.
    // Die Münzen selbst verwenden keine Physik.

    createPhysicsColliders() {
        if (!this.physics?.createStaticBox) return;

        const platform = this.physics.createStaticBox(
            this.worldPoint(0.4, 1.65, 0),
            {
                x: 2.5 * this.scale,
                y: 0.1 * this.scale,
                z: 0.95 * this.scale
            },
            { friction: 0.9 }
        );

        if (platform) this.staticColliders.push(platform);

        for (const z of [-0.48, 0.48]) {
            const rail = this.physics.createStaticBox(
                this.worldPoint(0.4, 1.85, z),
                {
                    x: 2.5 * this.scale,
                    y: 0.35 * this.scale,
                    z: 0.08 * this.scale
                },
                { friction: 0.8 }
            );

            if (rail) this.staticColliders.push(rail);
        }

        const catcher = this.physics.createStaticBox(
            this.worldPoint(-0.55, 1.65, 0),
            {
                x: 0.9 * this.scale,
                y: 0.1 * this.scale,
                z: 0.85 * this.scale
            },
            { friction: 0.9 }
        );

        if (catcher) this.staticColliders.push(catcher);
    }

    // MÜNZEN EINWERFEN

    insertCoins(amount = 1, options = {}) {
        amount = Math.max(0, Math.floor(amount));

        const available = Math.max(
            0,
            this.maxQueuedCoins - this.coinQueue.length
        );

        const accepted = Math.min(amount, available);

        const value = Number(options.valuePerCoin ?? 1);

        for (let i = 0; i < accepted; i++) {
            this.coinQueue.push({
                value: Number.isFinite(value) ? value : 1
            });
        }

        return accepted;
    }

    addCoins(amount, valuePerCoin = 1) {
        return this.insertCoins(amount, {
            valuePerCoin
        });
    }

    // Eine Münze erscheint an einer beliebigen Stelle auf dem Band.
    // Ihre Landeposition ist für das Zählen nicht entscheidend.

    spawnCoin() {
        if (this.activeCoins.length >= this.maxActiveCoins) {
            return false;
        }

        const startX = THREE.MathUtils.randFloat(-0.45, 1.05);
        const startZ = THREE.MathUtils.randFloat(-0.29, 0.29);

        const start = this.worldPoint(
            startX,
            1.84,
            startZ
        );

        const visual = createCoin(start, {});
        if (!visual) return false;

        visual.scale.setScalar(this.scale);

        // Münze liegt flach auf dem Förderband.
        visual.rotation.x = -Math.PI / 2;

        this.scene.add(visual);

        const queuedCoin = this.coinQueue.shift();

        this.activeCoins.push({
            visual,
            value: queuedCoin?.value ?? 1,

            startX,
            startZ,

            progress: 0,

            // Jede Münze hat eine eigene Transportdauer.
            duration: THREE.MathUtils.randFloat(0.75, 1.35),

            rotation: Math.random() * Math.PI * 2,
            counted: false
        });

        return true;
    }

    // MÜNZEN BEWEGEN UND ZÄHLEN

    updateCoins(deltaTime) {
        if (this.running) {
            this.spawnTimer += deltaTime;

            while (
                this.coinQueue.length > 0 &&
                this.spawnTimer >= this.spawnInterval &&
                this.activeCoins.length < this.maxActiveCoins
            ) {
                if (!this.spawnCoin()) break;

                this.spawnTimer -= this.spawnInterval;
            }
        }

        let countedThisFrame = 0;

        for (let i = this.activeCoins.length - 1; i >= 0; i--) {
            const item = this.activeCoins[i];

            if (this.running && !item.counted) {
                item.progress += deltaTime / item.duration;

                const t = THREE.MathUtils.clamp(
                    item.progress,
                    0,
                    1
                );

                // Sanfte Beschleunigung.
                const eased = t * t * (3 - 2 * t);

                // Bewegung über das Förderband.
                const x = THREE.MathUtils.lerp(
                    item.startX,
                    1.35,
                    eased
                );

                const z = THREE.MathUtils.lerp(
                    item.startZ,
                    -0.12,
                    eased
                );

                // Leichte Bewegung der Münze.
                const bounce = Math.sin(t * Math.PI * 5) * 0.012;

                const p = this.worldPoint(
                    x,
                    1.84 + bounce,
                    z
                );

                item.visual.position.set(p.x, p.y, p.z);

                item.rotation += deltaTime * 4;

                item.visual.rotation.set(
                    -Math.PI / 2,
                    0,
                    item.rotation
                );

                // Zählung erfolgt über den Ablauf,
                // nicht über eine exakte Kollisionsposition.
                if (item.progress >= 1) {
                    item.counted = true;

                    this.count++;
                    this.totalValue += item.value;

                    countedThisFrame++;

                    this.scene.remove(item.visual);
                    this.disposeCoinVisual(item.visual);

                    this.activeCoins.splice(i, 1);
                }
            }
        }

        if (countedThisFrame > 0) {
            this.coinsPerSecond = countedThisFrame / Math.max(deltaTime, 0.001);
        } else {
            this.coinsPerSecond *= 0.9;
        }

        this.speed = Math.max(0, this.coinsPerSecond);
    }

    disposeCoinVisual(visual) {
        if (!visual) return;

        visual.traverse(object => {
            if (object.geometry) {
                object.geometry.dispose();
            }

            // Materialien nicht zerstören, wenn sie geteilt werden.
            // Die Münzmaterialien werden von coin.js verwaltet.
        });
    }

    removeCoinAt(index) {
        const item = this.activeCoins[index];
        if (!item) return;

        this.scene.remove(item.visual);
        this.disposeCoinVisual(item.visual);

        this.activeCoins.splice(index, 1);
    }

    // STEUERUNG

    start() {
        this.running = true;

        this.indicatorLights[0].visible = true;
        this.indicatorLights[2].visible = false;

        this.drawDisplay();
    }

    stop() {
        this.running = false;

        this.indicatorLights[0].visible = false;
        this.indicatorLights[2].visible = true;

        this.drawDisplay();
    }

    reset() {
        this.count = 0;
        this.totalValue = 0;
        this.coinsPerSecond = 0;
        this.speed = 0;

        this.drawDisplay();
    }

    handleClick(raycaster) {
        const hits = raycaster.intersectObjects(
            this.group.children,
            true
        );

        if (!hits.length) return null;

        let object = hits[0].object;

        while (object && !object.userData.action) {
            object = object.parent;
        }

        if (!object) return null;

        const action = object.userData.action;

        if (action === "start") this.start();
        if (action === "stop") this.stop();
        if (action === "reset") this.reset();

        return action;
    }

    setPosition(x, y, z) {
        this.position = { x, y, z };
        this.group.position.set(x, y, z);
    }

    // UPDATE

    update(deltaTime) {
        const dt = Math.min(Math.max(deltaTime, 0), 0.05);

        this.elapsed += dt;

        if (this.running) {
            for (const part of this.movingParts) {
                part.mesh.rotation[part.axis] += part.speed * dt;
            }
        }

        this.updateCoins(dt);

        this.displayTimer += dt;

        if (this.displayTimer >= 0.15) {
            this.displayTimer = 0;
            this.drawDisplay();
        }

        if (this.indicatorLights.length >= 3) {
            this.indicatorLights[1].visible =
                this.running &&
                Math.floor(this.elapsed * 3) % 2 === 0;
        }
    }

    // AUFRÄUMEN

    dispose() {
        for (let i = this.activeCoins.length - 1; i >= 0; i--) {
            this.removeCoinAt(i);
        }

        for (const collider of this.staticColliders) {
            if (this.physics?.removeStaticBox) {
                this.physics.removeStaticBox(collider);
                continue;
            }

            const body = collider?.body ?? collider?.rigidBody;

            if (body && this.physics?.world) {
                try {
                    this.physics.world.removeRigidBody(body);
                } catch (error) {
                    console.warn(
                        "Collider konnte nicht entfernt werden:",
                        error
                    );
                }
            }
        }

        this.staticColliders = [];
        this.coinQueue = [];

        this.scene.remove(this.group);

        this.group.traverse(object => {
            if (object.geometry) {
                object.geometry.dispose();
            }
        });

        for (const material of Object.values(this.materials)) {
            material.dispose();
        }

        this.displayTexture?.dispose();
    }
}

// EXPORT

export function createCoinCountingMachine(scene, physics, options = {}) {
    return new CoinCountingMachine(scene, physics, options);
}
