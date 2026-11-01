import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js";

await RAPIER.init();

// =====================================================
// EINSTELLUNGEN
// =====================================================

const FLOOR_COUNT = 7;
const FLOOR_HEIGHT = 8;

const GRID_SIZE = 55;
const CELL_SIZE = 0.4;

const CHUNK_SIZE = 5;
const CHUNKS_PER_SIDE = 11;

const LOWER_LAYERS = 80;
const TOP_LAYERS = 4;

const COIN_RADIUS = 0.188;
const COIN_THICKNESS = 0.1;

const MAX_LOADED_CHUNKS = 24;
const MAX_ACTIVE_BODIES = 180;

const PHYSICS_RADIUS = 6;
const MAX_CHUNK_LOADS = 3;

const TOTAL_COINS =
    6 * GRID_SIZE * GRID_SIZE * LOWER_LAYERS +
    GRID_SIZE * GRID_SIZE * TOP_LAYERS;

// =====================================================
// THREE.JS
// =====================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x111619);
scene.fog = new THREE.FogExp2(0x111619, 0.0045);

const camera = new THREE.PerspectiveCamera(
    75,
    innerWidth / innerHeight,
    0.1,
    180
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

document.body.appendChild(renderer.domElement);

// =====================================================
// DESIGN / HUD
// =====================================================

const style = document.createElement("style");

style.textContent = `
    body {
        margin: 0;
        overflow: hidden;
        background: #101518;
        font-family: Arial, sans-serif;
    }

    canvas {
        display: block;
    }

    #inventory {
        display: flex;
        justify-content: center;
        gap: 7px;
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
    }

    .slot {
        width: 55px;
        height: 55px;
        border: 1px solid rgba(255,255,255,.17);
        background: rgba(12,20,24,.88);
        border-radius: 10px;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        font-size: 19px;
        position: relative;
        box-shadow: 0 5px 20px #0008;
        transition: .15s;
    }

    .slot.active {
        border: 2px solid #f4c45d;
        background: rgba(80,59,24,.8);
        transform: translateY(-7px);
        box-shadow: 0 0 18px #f4c45d55;
    }

    .slot span {
        position: absolute;
        top: 4px;
        left: 6px;
        font-size: 10px;
        color: #aeb8bc;
    }

    .slot small {
        font-size: 10px;
        color: #f4d17e;
    }

    #message {
        position: fixed;
        top: 18%;
        left: 50%;
        transform: translateX(-50%);
        color: #ffe2a0;
        background: rgba(12,18,21,.9);
        border: 1px solid #b98a38;
        border-radius: 10px;
        padding: 12px 24px;
        font-size: 15px;
        letter-spacing: 1px;
        opacity: 0;
        pointer-events: none;
        z-index: 30;
        transition: opacity .2s;
        box-shadow: 0 5px 25px #0009;
    }

    #interaction {
        color: #f5d58a;
        text-shadow: 0 2px 5px black;
    }

    #progressFill {
        transition: width .3s;
    }

    #startScreen {
        backdrop-filter: blur(12px);
        background: rgba(5,10,13,.88);
    }

    #startButton {
        cursor: pointer;
        transition: .2s;
    }

    #startButton:hover {
        transform: scale(1.05);
        filter: brightness(1.2);
    }

    #gameCrosshair {
        position: fixed;
        width: 8px;
        height: 8px;
        left: 50%;
        top: 50%;
        transform: translate(-50%,-50%);
        border: 1px solid rgba(255,226,160,.9);
        border-radius: 50%;
        pointer-events: none;
        z-index: 20;
        box-shadow: 0 0 8px #ffcf70;
    }

    #gameVignette {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 5;
        background: radial-gradient(
            ellipse at center,
            transparent 50%,
            rgba(0,0,0,.35) 100%
        );
    }
`;

document.head.appendChild(style);

const crosshair = document.createElement("div");
crosshair.id = "gameCrosshair";
document.body.appendChild(crosshair);

const vignette = document.createElement("div");
vignette.id = "gameVignette";
document.body.appendChild(vignette);

// =====================================================
// PHYSIK
// =====================================================

const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0
});

world.timestep = 1 / 60;

const eventQueue = new RAPIER.EventQueue(true);

// =====================================================
// MATERIALIEN
// =====================================================

const concrete = new THREE.MeshStandardMaterial({
    color: 0x3b4548,
    roughness: 0.85,
    metalness: 0.15
});

const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x252e32,
    roughness: 0.82,
    metalness: 0.3
});

const steel = new THREE.MeshStandardMaterial({
    color: 0x65757a,
    metalness: 0.85,
    roughness: 0.3
});

const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x20292d,
    metalness: 0.8,
    roughness: 0.35
});

const goldSide = new THREE.MeshStandardMaterial({
    color: 0xd99a19,
    metalness: 0.95,
    roughness: 0.2
});

// Münztextur

const coinCanvas = document.createElement("canvas");
coinCanvas.width = 256;
coinCanvas.height = 256;

const coinCtx = coinCanvas.getContext("2d");

const gradient = coinCtx.createRadialGradient(
    128, 128, 10,
    128, 128, 130
);

gradient.addColorStop(0, "#ffe9a0");
gradient.addColorStop(0.55, "#e9b83c");
gradient.addColorStop(1, "#a66b12");

coinCtx.fillStyle = gradient;
coinCtx.fillRect(0, 0, 256, 256);

coinCtx.strokeStyle = "#fff0ad";
coinCtx.lineWidth = 8;
coinCtx.beginPath();
coinCtx.arc(128, 128, 110, 0, Math.PI * 2);
coinCtx.stroke();

coinCtx.strokeStyle = "#9a6510";
coinCtx.lineWidth = 5;
coinCtx.beginPath();
coinCtx.arc(128, 128, 92, 0, Math.PI * 2);
coinCtx.stroke();

coinCtx.fillStyle = "#86550d";
coinCtx.font = "bold 110px Arial";
coinCtx.textAlign = "center";
coinCtx.textBaseline = "middle";
coinCtx.fillText("1", 128, 128);

const coinTexture = new THREE.CanvasTexture(coinCanvas);
coinTexture.colorSpace = THREE.SRGBColorSpace;

const coinFace = new THREE.MeshStandardMaterial({
    map: coinTexture,
    metalness: 0.85,
    roughness: 0.2
});

const coinGeometry = new THREE.CylinderGeometry(
    COIN_RADIUS,
    COIN_RADIUS,
    COIN_THICKNESS,
    20
);

// =====================================================
// LICHT
// =====================================================

scene.add(new THREE.HemisphereLight(
    0xb9d4e0,
    0x20190f,
    1.0
));

const mainLight = new THREE.DirectionalLight(
    0xffe4b7,
    1.5
);

mainLight.position.set(-8, 25, 8);
scene.add(mainLight);

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function box(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    scene.add(mesh);
    return mesh;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
    return min + Math.random() * (max - min);
}

// =====================================================
// BUNKER-DEKORATION
// =====================================================

function createLightStrip(x, y, z, length, horizontal = true) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(
            horizontal ? length : 0.08,
            0.07,
            horizontal ? 0.08 : length
        ),
        new THREE.MeshBasicMaterial({
            color: 0xffbd55
        })
    );

    mesh.position.set(x, y, z);
    scene.add(mesh);
}

for (let level = 0; level < FLOOR_COUNT; level++) {
    const y = -level * FLOOR_HEIGHT;

    createLightStrip(-11.3, y + 5.5, -11.3, 20);
    createLightStrip(11.3, y + 5.5, -11.3, 20);
    createLightStrip(-11.3, y + 5.5, 11.3, 20);

    for (const side of [-1, 1]) {
        const lamp = new THREE.PointLight(
            0xffc978,
            28,
            15
        );

        lamp.position.set(side * 9.8, y + 4.5, 0);
        scene.add(lamp);
    }
}

// =====================================================
// FESTE PHYSIKBÖDEN
// =====================================================

function createPhysicsFloor(x, y, z, w, h, d) {
    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
            .setTranslation(x, y, z)
    );

    world.createCollider(
        RAPIER.ColliderDesc.cuboid(
            w / 2,
            h / 2,
            d / 2
        ),
        body
    );

    box(w, h, d, floorMaterial, x, y, z);
}

// =====================================================
// BUNKER
// =====================================================

box(1, 65, 25, concrete, -12, -24, 0);
box(1, 65, 25, concrete, 12, -24, 0);
box(24, 65, 1, concrete, 0, -24, -12);
box(24, 65, 1, concrete, 0, -24, 12);

for (let level = 0; level < FLOOR_COUNT; level++) {
    const y = -level * FLOOR_HEIGHT;

    createPhysicsFloor(
        -2.5,
        y - 0.35,
        0,
        19,
        0.7,
        24
    );

    createPhysicsFloor(
        11.25,
        y - 0.35,
        0,
        1.5,
        0.7,
        24
    );
}

// =====================================================
// TREPPE
// =====================================================

const STAIR_X = 8.5;
const STAIR_START_Z = -7;
const STAIR_LENGTH = 14;
const STAIR_STEPS = 32;

const stairRun = STAIR_LENGTH / STAIR_STEPS;
const stairRise = FLOOR_HEIGHT / STAIR_STEPS;

for (let level = 0; level < FLOOR_COUNT - 1; level++) {
    const topY = -level * FLOOR_HEIGHT;

    for (let i = 0; i < STAIR_STEPS; i++) {
        const z = STAIR_START_Z + i * stairRun;
        const y = topY - i * stairRise;

        box(
            3.5,
            0.22,
            stairRun,
            steel,
            STAIR_X,
            y - 0.11,
            z + stairRun / 2
        );

        const body = world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed()
                .setTranslation(
                    STAIR_X,
                    y - 0.11,
                    z + stairRun / 2
                )
        );

        world.createCollider(
            RAPIER.ColliderDesc.cuboid(
                1.75,
                0.11,
                stairRun / 2
            ),
            body
        );
    }
}

// =====================================================
// CHUNKS
// =====================================================

const chunks = [];
const cellCounts = [];
const cellChunkIds = [];

function cellIndex(x, z) {
    return z * GRID_SIZE + x;
}

function getCellPosition(ix, iz) {
    return {
        x: -11 + (ix + 0.5) * CELL_SIZE,
        z: -11 + (iz + 0.5) * CELL_SIZE
    };
}

function getCell(x, z) {
    const ix = Math.floor((x + 11) / CELL_SIZE);
    const iz = Math.floor((z + 11) / CELL_SIZE);

    if (
        ix < 0 || ix >= GRID_SIZE ||
        iz < 0 || iz >= GRID_SIZE
    ) return null;

    return {
        ix,
        iz,
        index: cellIndex(ix, iz)
    };
}

for (let level = 0; level < FLOOR_COUNT; level++) {
    const layers = level === 0
        ? TOP_LAYERS
        : LOWER_LAYERS;

    const counts = new Uint8Array(GRID_SIZE * GRID_SIZE);
    counts.fill(layers);

    const ids = new Uint16Array(GRID_SIZE * GRID_SIZE);
    const floorChunks = [];

    for (let cz = 0; cz < CHUNKS_PER_SIDE; cz++) {
        for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
            const id = cz * CHUNKS_PER_SIDE + cx;

            for (
                let iz = cz * CHUNK_SIZE;
                iz < (cz + 1) * CHUNK_SIZE;
                iz++
            ) {
                for (
                    let ix = cx * CHUNK_SIZE;
                    ix < (cx + 1) * CHUNK_SIZE;
                    ix++
                ) {
                    ids[cellIndex(ix, iz)] = id;
                }
            }

            floorChunks.push({
                level,
                cx,
                cz,
                mesh: null,
                coins: null,
                lastSeen: 0
            });
        }
    }

    cellCounts.push(counts);
    cellChunkIds.push(ids);
    chunks.push(floorChunks);
}

function getChunk(level, cell) {
    return chunks[level][
        cellChunkIds[level][cell.index]
    ];
}

// =====================================================
// SPIELER
// =====================================================

const player = {
    position: new THREE.Vector3(0, 2, -6),
    velocity: new THREE.Vector3(),
    height: 1.7,
    speed: 4.5,
    grounded: false
};

let yaw = 0;
let pitch = 0;
let locked = false;

const keys = {};

// =====================================================
// INVENTAR
// =====================================================

const inventory = Array.from(
    { length: 15 },
    () => 0
);

const STACK_LIMIT = 9999;

let money = 0;
let selectedSlot = 0;

function getHeldCoins() {
    return inventory.reduce((a, b) => a + b, 0);
}

function addCoins(amount) {
    let remaining = amount;

    for (let i = 0; i < inventory.length; i++) {
        const free = STACK_LIMIT - inventory[i];
        const add = Math.min(free, remaining);

        inventory[i] += add;
        remaining -= add;

        if (remaining <= 0) break;
    }

    updateHUD();
    return amount - remaining;
}

function updateHUD() {
    const held = getHeldCoins();

    const moneyUI = document.getElementById("money");
    const heldUI = document.getElementById("held");

    if (moneyUI) {
        moneyUI.textContent = money.toLocaleString("de-DE");
    }

    if (heldUI) {
        heldUI.textContent = held.toLocaleString("de-DE");
    }

    const progress = money + held;

    const progressText = document.getElementById("progressText");
    const progressFill = document.getElementById("progressFill");

    if (progressText) {
        progressText.textContent =
            progress.toLocaleString("de-DE") +
            " / " +
            TOTAL_COINS.toLocaleString("de-DE");
    }

    if (progressFill) {
        progressFill.style.width =
            (progress / TOTAL_COINS * 100) + "%";
    }

    const ui = document.getElementById("inventory");

    if (ui) {
        ui.innerHTML = "";

        inventory.forEach((amount, i) => {
            const slot = document.createElement("div");

            slot.className =
                "slot" +
                (i === selectedSlot ? " active" : "");

            slot.innerHTML = `
                <span>${i + 1}</span>
                ${amount > 0 ? "●" : ""}
                <small>${amount || ""}</small>
            `;

            ui.appendChild(slot);
        });
    }
}

// =====================================================
// PHYSIK-MÜNZEN
// =====================================================

const activeCoins = new Set();
const tempObject = new THREE.Object3D();

function createPhysicsCoin(coin) {
    if (activeCoins.size >= MAX_ACTIVE_BODIES) {
        return false;
    }

    if (coin.body || coin.collected) return false;

    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(coin.x, coin.y, coin.z)
            .setLinearDamping(0.25)
            .setAngularDamping(0.35)
            .setCanSleep(true)
    );

    world.createCollider(
        RAPIER.ColliderDesc.cylinder(
            COIN_THICKNESS / 2,
            COIN_RADIUS
        )
            .setDensity(7)
            .setFriction(0.9)
            .setRestitution(0.12),
        body
    );

    if (coin.rotation) {
        body.setRotation(coin.rotation, true);
    }

    if (coin.velocity) {
        body.setLinvel(coin.velocity, true);
    }

    if (coin.angularVelocity) {
        body.setAngvel(coin.angularVelocity, true);
    }

    coin.body = body;
    activeCoins.add(coin);

    return true;
}

function saveCoinPhysics(coin) {
    if (!coin.body) return;

    const body = coin.body;

    const p = body.translation();
    const r = body.rotation();
    const v = body.linvel();
    const a = body.angvel();

    coin.x = p.x;
    coin.y = p.y;
    coin.z = p.z;

    coin.rotation = {
        x: r.x,
        y: r.y,
        z: r.z,
        w: r.w
    };

    coin.velocity = {
        x: v.x,
        y: v.y,
        z: v.z
    };

    coin.angularVelocity = {
        x: a.x,
        y: a.y,
        z: a.z
    };

    world.removeRigidBody(body);

    activeCoins.delete(coin);
    coin.body = null;
}

function freezeChunk(chunk) {
    if (!chunk.coins) return;

    for (const coin of chunk.coins) {
        if (coin.body) {
            saveCoinPhysics(coin);
        }
    }
}

// =====================================================
// CHUNK ERSTELLEN
// =====================================================

function createChunkData(chunk) {
    const level = chunk.level;

    const layers = level === 0
        ? TOP_LAYERS
        : LOWER_LAYERS;

    const coins = [];
    const floorY = -level * FLOOR_HEIGHT;

    for (
        let iz = chunk.cz * CHUNK_SIZE;
        iz < (chunk.cz + 1) * CHUNK_SIZE;
        iz++
    ) {
        for (
            let ix = chunk.cx * CHUNK_SIZE;
            ix < (chunk.cx + 1) * CHUNK_SIZE;
            ix++
        ) {
            const cell = cellIndex(ix, iz);
            const pos = getCellPosition(ix, iz);

            for (
                let layer = 0;
                layer < cellCounts[level][cell];
                layer++
            ) {
                coins.push({
                    localId: coins.length,
                    layer,
                    x: pos.x,
                    y: floorY + COIN_THICKNESS * (layer + 0.5),
                    z: pos.z,
                    rotation: null,
                    velocity: null,
                    angularVelocity: null,
                    body: null,
                    collected: false
                });
            }
        }
    }

    return coins;
}

function setCoinMatrix(mesh, coin) {
    if (coin.collected) {
        tempObject.position.set(0, -1000, 0);
        tempObject.scale.set(0, 0, 0);
        tempObject.quaternion.identity();
    } else {
        tempObject.position.set(coin.x, coin.y, coin.z);
        tempObject.scale.set(1, 1, 1);

        if (coin.rotation) {
            tempObject.quaternion.set(
                coin.rotation.x,
                coin.rotation.y,
                coin.rotation.z,
                coin.rotation.w
            );
        } else {
            tempObject.quaternion.identity();
        }
    }

    tempObject.updateMatrix();
    mesh.setMatrixAt(coin.localId, tempObject.matrix);
}

function loadChunk(chunk) {
    if (chunk.mesh) return;

    if (!chunk.coins) {
        chunk.coins = createChunkData(chunk);
    }

    const mesh = new THREE.InstancedMesh(
        coinGeometry,
        [goldSide, coinFace],
        chunk.coins.length
    );

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    mesh.userData.chunk = chunk;

    for (const coin of chunk.coins) {
        setCoinMatrix(mesh, coin);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();

    scene.add(mesh);
    chunk.mesh = mesh;
}

// =====================================================
// PHYSIK AKTIVIEREN
// =====================================================

function activateNearbyCoins() {
    if (activeCoins.size >= MAX_ACTIVE_BODIES) return;

    const radiusSq = PHYSICS_RADIUS * PHYSICS_RADIUS;

    for (const floorChunks of chunks) {
        for (const chunk of floorChunks) {
            if (!chunk.mesh || !chunk.mesh.visible) continue;
            if (!chunk.coins) continue;

            for (const coin of chunk.coins) {
                if (activeCoins.size >= MAX_ACTIVE_BODIES) return;

                if (coin.collected || coin.body) continue;

                const dx = coin.x - player.position.x;
                const dy = coin.y - player.position.y;
                const dz = coin.z - player.position.z;

                if (
                    dx * dx + dy * dy + dz * dz >
                    radiusSq
                ) continue;

                // Nur Münzen in erreichbarer Höhe aktivieren.
                if (Math.abs(dy) > 2.8) continue;

                createPhysicsCoin(coin);
            }
        }
    }
}

// =====================================================
// PHYSIK-UPDATE
// =====================================================

function updateCoinPhysics() {
    world.step(eventQueue);

    for (const coin of activeCoins) {
        if (!coin.body) continue;

        const p = coin.body.translation();
        const r = coin.body.rotation();

        coin.x = p.x;
        coin.y = p.y;
        coin.z = p.z;

        coin.rotation = {
            x: r.x,
            y: r.y,
            z: r.z,
            w: r.w
        };

        const chunk = getChunk(
            getCurrentFloor(),
            getCell(coin.x, coin.z) || { index: 0 }
        );

        // Die Münze wird über ihre eigene Chunk-Referenz aktualisiert.
        if (coin.chunk && coin.chunk.mesh) {
            setCoinMatrix(coin.chunk.mesh, coin);
            coin.chunk.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

// =====================================================
// SICHTFELD / CHUNK-STREAMING
// =====================================================

const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();

function getCurrentFloor() {
    return clamp(
        Math.round((1.7 - player.position.y) / FLOOR_HEIGHT),
        0,
        FLOOR_COUNT - 1
    );
}

function isInRampArea(x, z) {
    return (
        x > 6.5 &&
        x < 10.5 &&
        z > -7.5 &&
        z < 7.5
    );
}

function updateVisibility() {
    camera.updateMatrixWorld(true);

    viewProjection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );

    frustum.setFromProjectionMatrix(viewProjection);

    const level = getCurrentFloor();
    let loads = 0;

    for (let floor = 0; floor < FLOOR_COUNT; floor++) {
        for (const chunk of chunks[floor]) {
            const minX = -11 + chunk.cx * CHUNK_SIZE * CELL_SIZE;
            const minZ = -11 + chunk.cz * CHUNK_SIZE * CELL_SIZE;

            const boxBounds = new THREE.Box3(
                new THREE.Vector3(
                    minX,
                    -floor * FLOOR_HEIGHT,
                    minZ
                ),
                new THREE.Vector3(
                    minX + CHUNK_SIZE * CELL_SIZE,
                    -floor * FLOOR_HEIGHT + 8,
                    minZ + CHUNK_SIZE * CELL_SIZE
                )
            );

            const visible =
                (
                    floor === level ||
                    (
                        isInRampArea(
                            player.position.x,
                            player.position.z
                        ) &&
                        Math.abs(floor - level) <= 1
                    )
                ) &&
                frustum.intersectsBox(boxBounds);

            if (!visible) {
                if (chunk.mesh) {
                    chunk.mesh.visible = false;
                    freezeChunk(chunk);
                }

                continue;
            }

            chunk.lastSeen = performance.now();

            if (!chunk.mesh && loads < MAX_CHUNK_LOADS) {
                loadChunk(chunk);
                loads++;
            }

            if (chunk.mesh) {
                chunk.mesh.visible = true;
            }
        }
    }

    // Nicht sichtbare Chunks bei Bedarf aus dem Speicher der GPU nehmen.
    const loaded = [];

    for (const floorChunks of chunks) {
        for (const chunk of floorChunks) {
            if (chunk.mesh) loaded.push(chunk);
        }
    }

    if (loaded.length > MAX_LOADED_CHUNKS) {
        loaded
            .filter(c => !c.mesh.visible)
            .sort((a, b) => a.lastSeen - b.lastSeen)
            .slice(0, loaded.length - MAX_LOADED_CHUNKS)
            .forEach(chunk => {
                freezeChunk(chunk);

                scene.remove(chunk.mesh);
                chunk.mesh.dispose?.();
                chunk.mesh = null;
            });
    }
}

// =====================================================
// MÜNZEN EINSAMMELN
// =====================================================

const raycaster = new THREE.Raycaster();

function collectCoin() {
    if (!locked) return;

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    const meshes = [];

    for (const floorChunks of chunks) {
        for (const chunk of floorChunks) {
            if (chunk.mesh && chunk.mesh.visible) {
                meshes.push(chunk.mesh);
            }
        }
    }

    const hits = raycaster.intersectObjects(meshes);

    if (!hits.length) return;

    const hit = hits[0];

    if (hit.distance > 4.5) return;

    const chunk = hit.object.userData.chunk;

    if (!chunk || !chunk.coins) return;

    const coin = chunk.coins[hit.instanceId];

    if (!coin || coin.collected) return;

    if (getHeldCoins() >= 15 * STACK_LIMIT) {
        showMessage("Inventar voll!");
        return;
    }

    coin.collected = true;

    if (coin.body) {
        world.removeRigidBody(coin.body);
        activeCoins.delete(coin);
        coin.body = null;
    }

    setCoinMatrix(chunk.mesh, coin);
    chunk.mesh.instanceMatrix.needsUpdate = true;

    addCoins(1);
    showMessage("+1 Coin");
}

// =====================================================
// FÖRDERBAND
// =====================================================

const conveyor = new THREE.Group();
scene.add(conveyor);

function conveyorBox(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material
    );

    mesh.position.set(x, y, z);
    conveyor.add(mesh);

    return mesh;
}

conveyorBox(2, 0.35, 4, darkSteel, 0, 0, 0);
conveyorBox(1.65, 0.12, 3.7, steel, 0, 0.22, 0);

conveyor.position.set(-8, 1, -5);

// Rollen

const beltRollers = [];

for (let i = 0; i < 6; i++) {
    const roller = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.12,
            0.12,
            1.8,
            16
        ),
        steel
    );

    roller.rotation.z = Math.PI / 2;
    roller.position.set(
        0,
        0.1,
        -1.65 + i * 0.66
    );

    conveyor.add(roller);
    beltRollers.push(roller);
}

// Laufbandstreifen

const beltLines = [];

for (let i = 0; i < 12; i++) {
    const line = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.025, 0.07),
        darkSteel
    );

    line.position.set(
        0,
        0.3,
        -1.75 + i * 0.31
    );

    conveyor.add(line);
    beltLines.push(line);
}

// =====================================================
// FÖRDERBAND-MÜNZEN
// =====================================================

const beltCoins = [];

const beltCoinGeometry = new THREE.CylinderGeometry(
    0.16,
    0.16,
    0.07,
    20
);

function spawnBeltCoin() {
    if (beltCoins.length >= 24) return;

    const x = -8 + rand(-0.4, 0.4);
    const y = 1.55;
    const z = -6.5;

    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setLinearDamping(0.12)
            .setAngularDamping(0.2)
    );

    world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.035, 0.16)
            .setDensity(7)
            .setFriction(0.7)
            .setRestitution(0.15),
        body
    );

    const mesh = new THREE.Mesh(
        beltCoinGeometry,
        [goldSide, coinFace]
    );

    mesh.position.set(x, y, z);
    scene.add(mesh);

    body.setLinvel({
        x: rand(-0.1, 0.1),
        y: 0.2,
        z: 2.7
    }, true);

    body.setAngvel({
        x: rand(-1, 1),
        y: rand(-2, 2),
        z: rand(-1, 1)
    }, true);

    beltCoins.push({
        body,
        mesh,
        age: 0
    });
}

function updateBeltCoins(dt) {
    for (let i = beltCoins.length - 1; i >= 0; i--) {
        const coin = beltCoins[i];

        coin.age += dt;

        const p = coin.body.translation();
        const r = coin.body.rotation();

        coin.mesh.position.set(p.x, p.y, p.z);

        coin.mesh.quaternion.set(
            r.x,
            r.y,
            r.z,
            r.w
        );

        if (coin.age > 5 || p.z > -1) {
            scene.remove(coin.mesh);
            world.removeRigidBody(coin.body);

            beltCoins.splice(i, 1);
        }
    }
}

// =====================================================
// EINZAHLEN
// =====================================================

function showMessage(text) {
    const el = document.getElementById("message");

    if (!el) return;

    el.textContent = text;
    el.style.opacity = "1";

    clearTimeout(window.messageTimeout);

    window.messageTimeout = setTimeout(() => {
        el.style.opacity = "0";
    }, 1600);
}

let beltSpawnQueue = 0;
let beltSpawnTimer = 0;

function depositCoins() {
    const distance = player.position.distanceTo(
        new THREE.Vector3(-8, player.position.y, -5)
    );

    if (distance > 4) return;

    const amount = getHeldCoins();

    if (amount <= 0) {
        showMessage("Keine Münzen!");
        return;
    }

    money += amount;
    inventory.fill(0);

    // Sichtbare Münzen werden nacheinander erzeugt.
    beltSpawnQueue = Math.min(amount, 24);
    beltSpawnTimer = 0;

    updateHUD();

    showMessage(
        amount.toLocaleString("de-DE") +
        " Coins eingezahlt!"
    );
}

function updateDepositAnimation(dt) {
    if (beltSpawnQueue <= 0) return;

    beltSpawnTimer += dt;

    if (beltSpawnTimer >= 0.12) {
        beltSpawnTimer = 0;

        spawnBeltCoin();
        beltSpawnQueue--;
    }
}

// =====================================================
// SPIELERBEWEGUNG
// =====================================================

function updatePlayer(dt) {
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

    const movement = new THREE.Vector3();

    if (keys.KeyW) movement.add(forward);
    if (keys.KeyS) movement.sub(forward);
    if (keys.KeyD) movement.add(right);
    if (keys.KeyA) movement.sub(right);

    if (movement.lengthSq() > 0) {
        movement.normalize();

        player.position.addScaledVector(
            movement,
            player.speed * dt
        );
    }

    player.position.x = clamp(
        player.position.x,
        -11.4,
        11.4
    );

    player.position.z = clamp(
        player.position.z,
        -11.4,
        11.4
    );

    const level = getCurrentFloor();

    let ground = -level * FLOOR_HEIGHT;

    if (isInRampArea(
        player.position.x,
        player.position.z
    )) {
        const progress = clamp(
            (player.position.z + 7) / 14,
            0,
            1
        );

        ground -= progress * FLOOR_HEIGHT;
    }

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
}

// =====================================================
// EINGABEN
// =====================================================

document.addEventListener("keydown", e => {
    keys[e.code] = true;

    if (
        e.code === "Space" &&
        player.grounded &&
        locked
    ) {
        player.velocity.y = 6;
        player.grounded = false;
    }

    if (e.code === "KeyE" && locked) {
        depositCoins();
    }

    if (e.code.startsWith("Digit")) {
        const n = Number(e.code.replace("Digit", ""));

        if (n >= 1 && n <= 9) {
            selectedSlot = n - 1;
            updateHUD();
        }
    }
});

document.addEventListener("keyup", e => {
    keys[e.code] = false;
});

document.addEventListener("mousemove", e => {
    if (!locked) return;

    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;

    pitch = clamp(pitch, -1.5, 1.5);
});

document.addEventListener("mousedown", e => {
    if (e.button === 0) {
        collectCoin();
    }
});

document.addEventListener("contextmenu", e => {
    e.preventDefault();
});

// =====================================================
// POINTER LOCK
// =====================================================

document.getElementById("startButton")?.addEventListener(
    "click",
    () => {
        renderer.domElement.requestPointerLock();
    }
);

document.addEventListener("pointerlockchange", () => {
    locked =
        document.pointerLockElement === renderer.domElement;

    const screen = document.getElementById("startScreen");

    if (screen) {
        screen.style.display = locked ? "none" : "flex";
    }

    crosshair.style.display = locked ? "block" : "none";
});

// =====================================================
// ANIMATION
// =====================================================

let lastTime = 0;
let visibilityTimer = 0;
let physicsTimer = 0;
let activationTimer = 0;
let animationTime = 0;

function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(
        (time - lastTime) / 1000,
        0.033
    );

    lastTime = time;
    animationTime += dt;

    if (locked) {
        updatePlayer(dt);

        visibilityTimer += dt;
        physicsTimer += dt;
        activationTimer += dt;

        if (visibilityTimer >= 0.12) {
            visibilityTimer = 0;
            updateVisibility();
        }

        if (activationTimer >= 0.25) {
            activationTimer = 0;
            activateNearbyCoins();
        }

        if (physicsTimer >= 1 / 60) {
            physicsTimer = 0;
            updateCoinPhysics();
        }
    }

    // Laufband bewegt sich sichtbar.
    for (const line of beltLines) {
        line.position.z += dt * 2.7;

        if (line.position.z > 1.9) {
            line.position.z = -1.75;
        }
    }

    for (const roller of beltRollers) {
        roller.rotation.x += dt * 3;
    }

    updateDepositAnimation(dt);
    updateBeltCoins(dt);

    renderer.render(scene, camera);
}

// =====================================================
// START
// =====================================================

updateHUD();

camera.position.copy(player.position);

updateVisibility();

animate(0);

// =====================================================
// FENSTERGRÖSSE
// =====================================================

window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(innerWidth, innerHeight);
});
