import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

import { PhysicsSystem } from "./physik.js";
import { CoinFactory } from "./coin.js";
import { createStaircase } from "./treppe.js";
import { createPickupSystem } from "./heben.js";
import { createCoinCountingMachine } from "./maschine.js";
import { createBunkerLighting } from "./Licht.js";

// ============================================================
// ONE MILLION COINS – GAME.JS
// ============================================================

// KONFIGURATION

const FLOOR_COUNT = 7;
const FLOOR_HEIGHT = 8;

const GRID_SIZE = 55;
const CELL_SIZE = 0.4;

const COIN_DIAMETER = 0.376;
const COIN_THICKNESS = 0.1;
const COIN_RADIUS = COIN_DIAMETER / 2;

const LOWER_LAYERS = 80;
const TOP_LAYERS = 4;

const CHUNK_SIZE = 5;
const CHUNKS_PER_SIDE = GRID_SIZE / CHUNK_SIZE;

const TOTAL_COINS =
    (FLOOR_COUNT - 1) *
    GRID_SIZE * GRID_SIZE * LOWER_LAYERS +
    GRID_SIZE * GRID_SIZE * TOP_LAYERS;

const SLOT_COUNT = 15;
const STACK_LIMIT = 9999;
const MAX_INVENTORY = SLOT_COUNT * STACK_LIMIT;

const STAIR_X = 8.5;
const STAIR_START_Z = -7;
const STAIR_LENGTH = 14;
const STAIR_STEPS = 32;

const STAIR_RUN = STAIR_LENGTH / STAIR_STEPS;
const STAIR_RISE = FLOOR_HEIGHT / STAIR_STEPS;

const MACHINE_POSITION = {
    x: -8,
    y: 0.4,
    z: -8
};

// ============================================================
// SZENE
// ============================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x171918);
scene.fog = new THREE.FogExp2(0x171918, 0.006);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    180
);

camera.position.set(0, 2.1, -6);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.25)
);

renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

renderer.domElement.style.position = "fixed";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "0";

document.body.appendChild(renderer.domElement);

// ============================================================
// STARTBILDSCHIRM
// ============================================================

const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");

if (startScreen) {
    startScreen.style.position = "fixed";
    startScreen.style.inset = "0";
    startScreen.style.zIndex = "1000";
    startScreen.style.pointerEvents = "auto";
}

if (startButton) {
    startButton.style.position = "relative";
    startButton.style.zIndex = "1001";
    startButton.style.pointerEvents = "auto";
    startButton.style.cursor = "pointer";
}

// ============================================================
// PHYSIK
// ============================================================

const physics = new PhysicsSystem({
    maxBodies: 5000,
    gravity: -9.81,
    fixedTimeStep: 1 / 60,
    maxSubSteps: 4
});

await physics.init();

// ============================================================
// MÜNZFABRIK
// ============================================================

const coinFactory = new CoinFactory({
    radius: COIN_RADIUS,
    thickness: COIN_THICKNESS,
    detailLevel: 64
});

// ============================================================
// MATERIALIEN
// ============================================================

const concrete = new THREE.MeshStandardMaterial({
    color: 0x555751,
    roughness: 0.9
});

const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x30332f,
    roughness: 0.95
});

const steel = new THREE.MeshStandardMaterial({
    color: 0x454e50,
    metalness: 0.85,
    roughness: 0.35
});

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function createBox(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    parent.add(mesh);

    return mesh;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function random(min, max) {
    return min + Math.random() * (max - min);
}

// ============================================================
// LICHT
// ============================================================

scene.add(
    new THREE.HemisphereLight(
        0xc6d2dc,
        0x29231b,
        0.65
    )
);

const mainLight = new THREE.DirectionalLight(
    0xffe4b7,
    1.1
);

mainLight.position.set(-8, 20, 5);
scene.add(mainLight);

const bunkerLighting = createBunkerLighting(scene, {
    floors: FLOOR_COUNT,
    floorHeight: FLOOR_HEIGHT,
    floorSize: 24,
    lampSpacing: 8
});

for (const light of bunkerLighting.lights) {
    if (light.isPointLight) {
        light.position.y = 15.3 - light.position.y;
    }
}

for (const lamp of bunkerLighting.lampObjects) {
    lamp.position.y = 15.3 - lamp.position.y;
}

// ============================================================
// BUNKERWÄNDE
// ============================================================

createBox(1, 65, 25, concrete, -12, -24, 0);
createBox(1, 65, 25, concrete, 12, -24, 0);
createBox(24, 65, 1, concrete, 0, -24, -12);
createBox(24, 65, 1, concrete, 0, -24, 12);

// ============================================================
// WELTPHYSIK
// ============================================================

function createWorldPhysics() {
    physics.createStaticBox(
        { x: -12, y: -24, z: 0 },
        { x: 1, y: 65, z: 25 }
    );

    physics.createStaticBox(
        { x: 12, y: -24, z: 0 },
        { x: 1, y: 65, z: 25 }
    );

    physics.createStaticBox(
        { x: 0, y: -24, z: -12 },
        { x: 24, y: 65, z: 1 }
    );

    physics.createStaticBox(
        { x: 0, y: -24, z: 12 },
        { x: 24, y: 65, z: 1 }
    );

    for (let level = 0; level < FLOOR_COUNT; level++) {
        const y = -level * FLOOR_HEIGHT - 0.35;

        physics.createStaticBox(
            { x: -2.75, y, z: 0 },
            { x: 18.5, y: 0.7, z: 24 }
        );

        physics.createStaticBox(
            { x: 11.25, y, z: 0 },
            { x: 1.5, y: 0.7, z: 24 }
        );
    }

    for (let level = 0; level < FLOOR_COUNT - 1; level++) {
        for (let i = 0; i < STAIR_STEPS; i++) {
            const topY =
                level * FLOOR_HEIGHT +
                (i + 1) * STAIR_RISE;

            const centerY = -topY + 0.055;

            const centerZ =
                STAIR_START_Z +
                (i + 0.5) * STAIR_RUN;

            physics.createStaticBox(
                {
                    x: STAIR_X,
                    y: centerY,
                    z: centerZ
                },
                {
                    x: 2.2,
                    y: 0.11,
                    z: STAIR_RUN * 0.96
                },
                {
                    friction: 0.85,
                    restitution: 0
                }
            );
        }
    }
}

createWorldPhysics();

// ============================================================
// ETAGEN
// ============================================================

for (let level = 0; level < FLOOR_COUNT; level++) {
    const y = -level * FLOOR_HEIGHT;

    createBox(
        18.5, 0.7, 24,
        floorMaterial,
        -2.75, y - 0.35, 0
    );

    createBox(
        1.5, 0.7, 24,
        floorMaterial,
        11.25, y - 0.35, 0
    );

    for (let z = -9; z <= 9; z += 3) {
        createBox(
            0.16, 7.5, 0.16,
            steel,
            -11.3, y + 3.5, z
        );

        createBox(
            0.16, 7.5, 0.16,
            steel,
            11.3, y + 3.5, z
        );
    }

    for (const x of [-10.7, 10.7]) {
        const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 7, 12),
            steel
        );

        pipe.position.set(x, y + 5.5, -10.6);
        scene.add(pipe);
    }
}

// ============================================================
// TREPPE
// ============================================================

const staircase = createStaircase(scene, {
    floors: FLOOR_COUNT,
    floorHeight: FLOOR_HEIGHT,
    stepsPerFloor: STAIR_STEPS,
    width: 2.2,
    startX: STAIR_X,
    startZ: STAIR_START_Z,
    runLength: STAIR_LENGTH,
    createPhysics: false
});

staircase.group.scale.y = -1;

// ============================================================
// MÜNZSTAPEL UND CHUNKS
// ============================================================

const dummy = new THREE.Object3D();

const faceUpQuaternion = new THREE.Quaternion()
    .setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        -Math.PI / 2
    );

const spinQuaternion = new THREE.Quaternion();
const spinAxis = new THREE.Vector3(0, 0, 1);

const cellCounts = [];
const cellStarts = [];
const cellChunkIds = [];
const coinChunks = [];

function cellIndex(x, z) {
    return z * GRID_SIZE + x;
}

function getCellWorld(ix, iz) {
    return {
        x: -11 + (ix + 0.5) * CELL_SIZE,
        z: -11 + (iz + 0.5) * CELL_SIZE
    };
}

for (let level = 0; level < FLOOR_COUNT; level++) {
    const layers = level === 0 ? TOP_LAYERS : LOWER_LAYERS;

    const counts = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const starts = new Uint32Array(GRID_SIZE * GRID_SIZE);
    const chunkIds = new Uint16Array(GRID_SIZE * GRID_SIZE);

    const floorChunks = [];
    const floorY = -level * FLOOR_HEIGHT;

    counts.fill(layers);

    for (let cz = 0; cz < CHUNKS_PER_SIDE; cz++) {
        for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
            const chunkIndex = cz * CHUNKS_PER_SIDE + cx;

            const minCellX = cx * CHUNK_SIZE;
            const minCellZ = cz * CHUNK_SIZE;

            for (let iz = minCellZ; iz < minCellZ + CHUNK_SIZE; iz++) {
                for (let ix = minCellX; ix < minCellX + CHUNK_SIZE; ix++) {
                    chunkIds[cellIndex(ix, iz)] = chunkIndex;
                }
            }

            const minX = -11 + cx * CHUNK_SIZE * CELL_SIZE;
            const minZ = -11 + cz * CHUNK_SIZE * CELL_SIZE;

            const maxX = minX + CHUNK_SIZE * CELL_SIZE;
            const maxZ = minZ + CHUNK_SIZE * CELL_SIZE;

            floorChunks.push({
                mesh: null,
                remaining: CHUNK_SIZE * CHUNK_SIZE * layers,
                level,
                chunkIndex,
                cx,
                cz,
                box: new THREE.Box3(
                    new THREE.Vector3(
                        minX - 0.2,
                        floorY - 0.2,
                        minZ - 0.2
                    ),
                    new THREE.Vector3(
                        maxX + 0.2,
                        floorY + layers * COIN_THICKNESS + 0.2,
                        maxZ + 0.2
                    )
                )
            });
        }
    }

    cellCounts.push(counts);
    cellStarts.push(starts);
    cellChunkIds.push(chunkIds);
    coinChunks.push(floorChunks);
}

function worldToCell(x, z) {
    const ix = Math.floor((x + 11) / CELL_SIZE);
    const iz = Math.floor((z + 11) / CELL_SIZE);

    if (
        ix < 0 || ix >= GRID_SIZE ||
        iz < 0 || iz >= GRID_SIZE
    ) {
        return null;
    }

    return {
        ix,
        iz,
        index: cellIndex(ix, iz)
    };
}

function getChunkForCell(level, cell) {
    return coinChunks[level][
        cellChunkIds[level][cell.index]
    ];
}

// ============================================================
// CHUNK LADEN
// ============================================================

function ensureChunkLoaded(chunk) {
    if (chunk.mesh || chunk.remaining <= 0) return;

    const level = chunk.level;
    const layers = level === 0 ? TOP_LAYERS : LOWER_LAYERS;
    const floorY = -level * FLOOR_HEIGHT;

    const capacity = CHUNK_SIZE * CHUNK_SIZE * layers;

    // Muss die detaillierte Geometrie aus coin.js verwenden.
    const mesh = coinFactory.createInstancedMesh(
        capacity,
        {
            name: `CoinChunk_${level}_${chunk.chunkIndex}`
        }
    );

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    let localId = 0;

    const minCellX = chunk.cx * CHUNK_SIZE;
    const minCellZ = chunk.cz * CHUNK_SIZE;

    for (let iz = minCellZ; iz < minCellZ + CHUNK_SIZE; iz++) {
        for (let ix = minCellX; ix < minCellX + CHUNK_SIZE; ix++) {
            const cell = cellIndex(ix, iz);
            const pos = getCellWorld(ix, iz);

            cellStarts[level][cell] = localId;

            for (let layer = 0; layer < cellCounts[level][cell]; layer++) {
                dummy.position.set(
                    pos.x,
                    floorY + COIN_THICKNESS * (layer + 0.5),
                    pos.z
                );

                spinQuaternion.setFromAxisAngle(
                    spinAxis,
                    random(0, Math.PI * 2)
                );

                dummy.quaternion
                    .copy(faceUpQuaternion)
                    .multiply(spinQuaternion);

                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();

                mesh.setMatrixAt(localId, dummy.matrix);
                localId++;
            }
        }
    }

    mesh.count = localId;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();

    scene.add(mesh);
    chunk.mesh = mesh;
}

// ============================================================
// SPIELER
// ============================================================

const player = {
    position: new THREE.Vector3(0, 2.1, -6),
    velocity: new THREE.Vector3(),
    speed: 4.5,
    radius: 0.32,
    height: 1.7,
    grounded: false
};

let yaw = 0;
let pitch = 0;
let locked = false;
const keys = {};

function isInRampArea(x, z) {
    return (
        x > 6.7 && x < 10.3 &&
        z > -7.5 && z < 7.5
    );
}

function getCurrentFloor() {
    if (isInRampArea(player.position.x, player.position.z)) {
        const progress = clamp(
            (player.position.z - STAIR_START_Z) / STAIR_LENGTH,
            0,
            1
        );

        return clamp(
            Math.round(
                (1.7 - player.position.y - progress * FLOOR_HEIGHT) /
                FLOOR_HEIGHT
            ),
            0,
            FLOOR_COUNT - 1
        );
    }

    return clamp(
        Math.round((1.7 - player.position.y) / FLOOR_HEIGHT),
        0,
        FLOOR_COUNT - 1
    );
}

// ============================================================
// CHUNK SICHTBARKEIT
// ============================================================

const coinFrustum = new THREE.Frustum();
const coinViewProjection = new THREE.Matrix4();

function updateCoinVisibility() {
    const level = getCurrentFloor();
    const onStairs = isInRampArea(player.position.x, player.position.z);

    camera.updateMatrixWorld(true);

    coinViewProjection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );

    coinFrustum.setFromProjectionMatrix(coinViewProjection);

    for (let floor = 0; floor < FLOOR_COUNT; floor++) {
        const showFloor =
            floor === level ||
            (onStairs && Math.abs(floor - level) === 1);

        for (const chunk of coinChunks[floor]) {
            if (!showFloor || chunk.remaining <= 0) {
                if (chunk.mesh) chunk.mesh.visible = false;
                continue;
            }

            const inView = coinFrustum.intersectsBox(chunk.box);

            if (inView) {
                ensureChunkLoaded(chunk);
                if (chunk.mesh) chunk.mesh.visible = true;
            } else if (chunk.mesh) {
                chunk.mesh.visible = false;
            }
        }
    }
}

// ============================================================
// INVENTAR
// ============================================================

let money = 0;
let selectedSlot = 0;

const pickup = createPickupSystem(
    scene,
    camera,
    physics,
    {
        maxDistance: 4.5,
        dropDistance: 1.1,
        dropHeight: -0.35,
        onInventoryChange: updateHUD
    }
);

function getHeldCoins() {
    return pickup.getInventoryCount();
}

function renderInventory() {
    const ui = document.getElementById("inventory");
    if (!ui) return;

    ui.innerHTML = "";

    const total = getHeldCoins();

    for (let i = 0; i < SLOT_COUNT; i++) {
        const amount = clamp(
            total - i * STACK_LIMIT,
            0,
            STACK_LIMIT
        );

        const slot = document.createElement("div");
        slot.className = "slot" + (i === selectedSlot ? " active" : "");

        slot.innerHTML = `
            <span class="slot-number">${i + 1}</span>
            ${amount > 0 ? "🪙" : ""}
            <span class="slot-count">${amount || ""}</span>
        `;

        ui.appendChild(slot);
    }
}

function updateHUD() {
    const held = getHeldCoins();

    const moneyUI = document.getElementById("money");
    const heldUI = document.getElementById("held");
    const progressText = document.getElementById("progressText");
    const progressFill = document.getElementById("progressFill");

    if (moneyUI) moneyUI.textContent = money.toLocaleString("de-DE");
    if (heldUI) heldUI.textContent = held.toLocaleString("de-DE");

    const progress = money + held;

    if (progressText) {
        progressText.textContent =
            progress.toLocaleString("de-DE") +
            " / " +
            TOTAL_COINS.toLocaleString("de-DE");
    }

    if (progressFill) {
        progressFill.style.width =
            clamp(progress / TOTAL_COINS * 100, 0, 100) + "%";
    }

    renderInventory();
}

// ============================================================
// MÜNZEN AUS STAPEL AUFHEBEN
// ============================================================

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

const horizontalPlane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    0
);

const hitPoint = new THREE.Vector3();
const cameraForward = new THREE.Vector3();

function findPileCoin() {
    raycaster.setFromCamera(mouse, camera);
    camera.getWorldDirection(cameraForward);

    let best = null;
    let bestDistance = Infinity;

    for (let level = 0; level < FLOOR_COUNT; level++) {
        const floorVisible = coinChunks[level].some(
            chunk => chunk.mesh && chunk.mesh.visible
        );

        if (!floorVisible) continue;

        const maxLayers = level === 0 ? TOP_LAYERS : LOWER_LAYERS;
        const floorY = -level * FLOOR_HEIGHT;

        for (let layer = maxLayers - 1; layer >= 0; layer--) {
            const planeY = floorY + COIN_THICKNESS * (layer + 1);
            horizontalPlane.constant = -planeY;

            if (!raycaster.ray.intersectPlane(horizontalPlane, hitPoint)) {
                continue;
            }

            const cell = worldToCell(hitPoint.x, hitPoint.z);
            if (!cell) continue;

            if (cellCounts[level][cell.index] !== layer + 1) continue;

            const chunk = getChunkForCell(level, cell);

            if (!chunk.mesh || !chunk.mesh.visible) continue;

            const center = getCellWorld(cell.ix, cell.iz);

            const targetPosition = new THREE.Vector3(
                center.x,
                planeY,
                center.z
            );

            const distance = camera.position.distanceTo(targetPosition);

            const direction = new THREE.Vector3()
                .subVectors(targetPosition, camera.position);

            if (direction.dot(cameraForward) <= 0) continue;
            if (distance > 4.5 || distance >= bestDistance) continue;

            bestDistance = distance;

            best = {
                level,
                cell,
                point: targetPosition.clone(),
                layer
            };
        }
    }

    return best;
}

// ============================================================
// INVENTARMÜNZE ERSTELLEN
// ============================================================

function createInventoryCoin(position) {
    // Inventarmünzen benötigen keinen aktiven Physikkörper.
    // Erst beim Fallenlassen erzeugt heben.js die Physik.

    const mesh = coinFactory.create(
        position,
        { value: 1 }
    );

    if (!mesh) {
        showMessage("Münze konnte nicht erstellt werden!");
        return false;
    }

    scene.add(mesh);

    const data = pickup.registerCoin(mesh, null, 1);

    if (!data) {
        scene.remove(mesh);
        return false;
    }

    scene.remove(mesh);

    data.available = false;
    data.collected = true;
    data.physicsCoin = null;

    pickup.inventory.push(data);
    pickup.totalCollected++;

    pickup.updateInventory();

    return true;
}

// ============================================================
// SAMMELEFFEKT
// ============================================================

const particles = [];

function createPickupEffect(x, y, z) {
    for (let i = 0; i < 5; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0xffd45c,
                transparent: true
            })
        );

        particle.position.set(x, y, z);

        particle.userData.velocity = new THREE.Vector3(
            random(-1, 1),
            random(0.5, 2),
            random(-1, 1)
        );

        particle.userData.life = 0.4;

        scene.add(particle);
        particles.push(particle);
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.position.addScaledVector(p.userData.velocity, dt);
        p.userData.life -= dt;

        p.material.opacity = Math.max(0, p.userData.life / 0.4);

        if (p.userData.life <= 0) {
            scene.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            particles.splice(i, 1);
        }
    }
}

// ============================================================
// STAPELMÜNZE SAMMELN
// ============================================================

function collectPileCoin() {
    if (!locked) return false;

    if (getHeldCoins() >= MAX_INVENTORY) {
        showMessage("Inventar ist voll!");
        return false;
    }

    const target = findPileCoin();
    if (!target) return false;

    const { level, cell, point } = target;
    const count = cellCounts[level][cell.index];

    if (count <= 0) return false;

    const chunk = getChunkForCell(level, cell);
    if (!chunk.mesh) return false;

    const localId = cellStarts[level][cell.index] + count - 1;

    const coinPosition = {
        x: point.x,
        y: point.y - COIN_THICKNESS / 2,
        z: point.z
    };

    if (!createInventoryCoin(coinPosition)) return false;

    cellCounts[level][cell.index]--;

    dummy.position.set(0, -1000, 0);
    dummy.quaternion.identity();
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();

    chunk.mesh.setMatrixAt(localId, dummy.matrix);
    chunk.mesh.instanceMatrix.needsUpdate = true;

    chunk.remaining--;

    createPickupEffect(point.x, point.y, point.z);
    showMessage("+1 Coin");

    return true;
}

// ============================================================
// MÜNZE FALLEN LASSEN
// ============================================================

function dropInventoryCoin() {
    if (getHeldCoins() <= 0) {
        showMessage("Keine Münzen im Inventar!");
        return false;
    }

    const success = pickup.dropCoin();

    if (!success) {
        showMessage("Münze konnte nicht fallen gelassen werden!");
        return false;
    }

    showMessage("Münze fallengelassen!");
    updateHUD();

    return true;
}

// ============================================================
// FALLEN GELASSENE MÜNZEN SYNCHRONISIEREN
// ============================================================

const physicsQuaternion = new THREE.Quaternion();

const visualCorrection = new THREE.Quaternion()
    .setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        -Math.PI / 2
    );

function updateDroppedCoinVisuals() {
    for (const coin of pickup.coins.values()) {
        if (!coin.available) continue;
        if (!coin.physicsCoin?.active) continue;
        if (!coin.mesh) continue;

        const transform = physics.getTransform(coin.physicsCoin);
        if (!transform) continue;

        const p = transform.position;
        const r = transform.rotation;

        coin.mesh.position.set(p.x, p.y, p.z);

        physicsQuaternion.set(r.x, r.y, r.z, r.w);

        coin.mesh.quaternion.copy(physicsQuaternion)
            .multiply(visualCorrection);

        if (p.y < -60) {
            scene.remove(coin.mesh);
            physics.removeCoin(coin.physicsCoin);
            coin.available = false;
        }
    }
}

// ============================================================
// MÜNZZÄHLMASCHINE
// ============================================================

const machine = createCoinCountingMachine(
    scene,
    physics,
    {
        position: MACHINE_POSITION,
        scale: 1,
        spawnInterval: 0.13,
        maxQueuedCoins: MAX_INVENTORY
    }
);

// ============================================================
// NACHRICHTEN
// ============================================================

function showMessage(text) {
    const el = document.getElementById("message");
    if (!el) return;

    el.textContent = text;
    el.style.opacity = "1";

    clearTimeout(window.messageTimeout);

    window.messageTimeout = setTimeout(() => {
        el.style.opacity = "0";
    }, 1500);
}

// ============================================================
// EINZAHLEN
// ============================================================

function isNearMachine() {
    const dx = player.position.x - MACHINE_POSITION.x;
    const dz = player.position.z - MACHINE_POSITION.z;

    return Math.sqrt(dx * dx + dz * dz) < 3.5;
}

function depositCoins() {
    if (!isNearMachine()) return false;

    const amount = pickup.getInventoryCount();

    if (amount <= 0) {
        showMessage("Keine Münzen zum Einzahlen!");
        return false;
    }

    const accepted = machine.insertCoins(amount, {
        valuePerCoin: 1
    });

    if (accepted <= 0) {
        showMessage("Maschine ist voll!");
        return false;
    }

    pickup.takeCoinsForMachine(accepted);

    showMessage(
        accepted.toLocaleString("de-DE") +
        " Münzen werden eingeworfen!"
    );

    updateHUD();

    return true;
}

// ============================================================
// BODENHÖHE
// ============================================================

function getGroundHeight(x, z, level) {
    const floorY = -level * FLOOR_HEIGHT;
    const cell = worldToCell(x, z);

    if (level === 0 && cell) {
        const amount = cellCounts[0][cell.index];

        if (amount > 0) {
            return floorY + amount * COIN_THICKNESS;
        }
    }

    if (isInRampArea(x, z)) {
        const progress = clamp(
            (z - STAIR_START_Z) / STAIR_LENGTH,
            0,
            1
        );

        return floorY - progress * FLOOR_HEIGHT;
    }

    return floorY;
}

// ============================================================
// SPIELERBEWEGUNG
// ============================================================

function updatePlayer(dt) {
    const oldX = player.position.x;
    const oldZ = player.position.z;

    const forward = new THREE.Vector3(
        -Math.sin(yaw),
        0,
        -Math.cos(yaw)
    );

    const right = new THREE.Vector3(
        Math.cos(yaw),
        0,
        -Math.sin(yaw)
    );

    const direction = new THREE.Vector3();

    if (keys.KeyW) direction.add(forward);
    if (keys.KeyS) direction.sub(forward);
    if (keys.KeyD) direction.add(right);
    if (keys.KeyA) direction.sub(right);

    if (direction.lengthSq() > 0) {
        direction.normalize();

        player.position.x += direction.x * player.speed * dt;
        player.position.z += direction.z * player.speed * dt;
    }

    player.position.x = clamp(player.position.x, -11.4, 11.4);
    player.position.z = clamp(player.position.z, -11.4, 11.4);

    const cell = worldToCell(player.position.x, player.position.z);
    let blocked = false;

    if (cell && !isInRampArea(player.position.x, player.position.z)) {
        for (let floor = 1; floor < FLOOR_COUNT; floor++) {
            const amount = cellCounts[floor][cell.index];
            if (amount <= 0) continue;

            const bottom = -floor * FLOOR_HEIGHT;
            const top = bottom + amount * COIN_THICKNESS;
            const feet = player.position.y - player.height;

            if (
                feet < top - 0.03 &&
                player.position.y > bottom + 0.03
            ) {
                blocked = true;
                break;
            }
        }
    }

    if (blocked) {
        player.position.x = oldX;
        player.position.z = oldZ;
    }

    if (
        Math.abs(player.position.x + 8) < 1.9 &&
        Math.abs(player.position.z + 8) < 1.6
    ) {
        player.position.x = oldX;
        player.position.z = oldZ;
    }

    const activeLevel = getCurrentFloor();

    const ground = getGroundHeight(
        player.position.x,
        player.position.z,
        activeLevel
    );

    player.velocity.y -= 20 * dt;
    player.position.y += player.velocity.y * dt;

    if (player.position.y <= ground + player.height) {
        player.position.y = ground + player.height;
        player.velocity.y = 0;
        player.grounded = true;
    } else {
        player.grounded = false;
    }

    camera.position.copy(player.position);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    physics.pushCoinsNearPlayer(
        player.position,
        1.25,
        0.8
    );

    updateCoinVisibility();
}

// ============================================================
// INTERAKTION
// ============================================================

function updateInteraction() {
    const ui = document.getElementById("interaction");
    if (!ui) return;

    if (isNearMachine()) {
        ui.style.display = "block";
        ui.innerHTML = "<b>[E]</b> Münzen in die Zählmaschine einwerfen";
        return;
    }

    const droppedCoin = pickup.findTargetCoin();
    const pileCoin = findPileCoin();

    if (droppedCoin || pileCoin) {
        ui.style.display = "block";
        ui.innerHTML = "<b>[LINKSKLICK]</b> Münze einsammeln";
        return;
    }

    if (getHeldCoins() > 0) {
        ui.style.display = "block";
        ui.innerHTML = "<b>[Q]</b> Münze fallen lassen";
        return;
    }

    ui.style.display = "none";
}

// ============================================================
// MAUSKLICK
// ============================================================

document.addEventListener("mousedown", event => {
    if (!locked || event.button !== 0) return;

    if (pickup.pickupCoin()) {
        showMessage("+1 Coin");
        updateHUD();
        return;
    }

    collectPileCoin();
});

// ============================================================
// TASTEN
// ============================================================

document.addEventListener("keydown", event => {
    keys[event.code] = true;

    if (event.repeat) return;

    if (event.code === "KeyE" && locked) {
        depositCoins();
    }

    if (event.code === "KeyQ" && locked) {
        dropInventoryCoin();
    }

    if (
        event.code === "Space" &&
        player.grounded &&
        locked
    ) {
        player.velocity.y = 6;
        player.grounded = false;
    }

    if (event.code.startsWith("Digit")) {
        const number = Number(event.code.replace("Digit", ""));

        if (number >= 1 && number <= 9) {
            selectedSlot = number - 1;
            renderInventory();
        }
    }
});

document.addEventListener("keyup", event => {
    keys[event.code] = false;
});

// ============================================================
// MAUSBEWEGUNG
// ============================================================

document.addEventListener("mousemove", event => {
    if (!locked) return;

    yaw -= event.movementX * 0.002;
    pitch -= event.movementY * 0.002;

    pitch = clamp(pitch, -1.5, 1.5);
});

// ============================================================
// RECHTSKLICK
// ============================================================

document.addEventListener("contextmenu", event => {
    event.preventDefault();
});

// ============================================================
// ANIMATION
// ============================================================

let lastTime = 0;
let hudTimer = 0;

const HUD_INTERVAL = 0.15;

function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(
        (time - lastTime) / 1000,
        0.04
    );

    lastTime = time;

    if (locked) {
        updatePlayer(dt);
        updateInteraction();
    }

    physics.update(dt);
    machine.update(dt);
    pickup.update(dt);

    updateDroppedCoinVisuals();

    money = machine.totalValue;

    hudTimer += dt;

    if (hudTimer >= HUD_INTERVAL) {
        hudTimer = 0;
        updateHUD();
    }

    updateParticles(dt);

    renderer.render(scene, camera);
}

// ============================================================
// STARTBUTTON – SPIEL STARTET ERST NACH KLICK
// ============================================================

let gameStarted = false;

function startGame() {
    if (!gameStarted) {
        gameStarted = true;

        lastTime = performance.now();

        requestAnimationFrame(animate);
    }

    // Auch nach Verlassen des Pointer-Locks kann erneut gestartet werden.
    renderer.domElement.requestPointerLock();
}

if (startButton) {
    startButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        startGame();
    });
} else {
    console.error(
        "Start-Button nicht gefunden. Prüfe id='startButton' in deiner HTML-Datei."
    );
}

document.addEventListener("pointerlockchange", () => {
    locked =
        document.pointerLockElement === renderer.domElement;

    if (startScreen) {
        startScreen.style.display =
            locked ? "none" : "flex";
    }
});

// ============================================================
// FENSTERGRÖSSE
// ============================================================

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 1.25)
    );
});

// ============================================================
// ERSTER RENDER – OHNE SPIELSTART
// ============================================================

updateHUD();
updateCoinVisibility();

renderer.render(scene, camera);

// ============================================================
// DEBUG
// ============================================================

window.oneMillionCoins = {
    scene,
    camera,
    renderer,
    physics,
    pickup,
    machine,
    staircase,
    bunkerLighting,
    coinFactory,

    getMoney() {
        return machine.totalValue;
    },

    getInventory() {
        return pickup.getInventoryCount();
    },

    getActivePhysicsCoins() {
        return physics.getActiveCount();
    },

    getTotalPhysicsCoins() {
        return physics.getCoinCount();
    },

    getTotalCoins() {
        return TOTAL_COINS;
    },

    getLoadedChunks() {
        let count = 0;

        for (const floor of coinChunks) {
            for (const chunk of floor) {
                if (chunk.mesh) count++;
            }
        }

        return count;
    }
};
