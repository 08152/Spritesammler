import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js";
import { CoinFactory } from "./coin.js";

// ============================================================
// ONE MILLION COINS
// Collect. Deposit. Upgrade.
// ============================================================

await RAPIER.init();

// ============================================================
// EINSTELLUNGEN
// ============================================================

const CONFIG = {
    floors: 7,
    floorHeight: 8,

    gridSize: 55,
    cellSize: 0.4,

    chunkSize: 5,
    chunksPerSide: 11,

    lowerLayers: 80,
    topLayers: 4,

    coinRadius: 0.188,
    coinThickness: 0.1,

    inventorySlots: 15,
    stackLimit: 9999,

    maxLoadedChunks: 24,
    maxActiveBodies: 180,
    maxChunkLoads: 3,

    physicsRadius: 6,

    playerSpeed: 4.5,
    playerHeight: 1.7,

    machinePosition: {
        x: -8,
        y: 0,
        z: -8
    }
};

const TOTAL_COINS =
    6 * CONFIG.gridSize * CONFIG.gridSize * CONFIG.lowerLayers +
    CONFIG.gridSize * CONFIG.gridSize * CONFIG.topLayers;

// ============================================================
// THREE.JS
// ============================================================

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
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = false;

renderer.domElement.style.position = "fixed";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "0";

document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.style.background = "#101518";

document.body.appendChild(renderer.domElement);

// ============================================================
// DESIGN
// ============================================================

const style = document.createElement("style");

style.textContent = `
* { box-sizing: border-box; }

body {
    font-family: Arial, sans-serif;
    color: white;
}

#hud {
    position: fixed;
    inset: 0;
    z-index: 10;
    pointer-events: none;
}

#topHUD {
    position: absolute;
    top: 20px;
    left: 20px;
    display: flex;
    gap: 10px;
}

.hudCard {
    min-width: 150px;
    padding: 13px 17px;
    border: 1px solid #ffffff20;
    border-radius: 9px;
    background: #10191ddd;
    box-shadow: 0 5px 25px #0006;
    backdrop-filter: blur(10px);
}

.hudLabel {
    color: #a9b6b9;
    font-size: 10px;
    letter-spacing: 2px;
    margin-bottom: 6px;
}

.hudValue {
    color: #ffdc82;
    font-size: 21px;
    font-weight: bold;
}

#progressHUD {
    position: absolute;
    top: 20px;
    right: 20px;
    width: min(280px, 40vw);
    padding: 13px;
    border: 1px solid #ffffff20;
    border-radius: 9px;
    background: #10191ddd;
}

#progressText {
    font-size: 12px;
    color: #f7d477;
    margin-bottom: 9px;
}

#progressTrack {
    height: 7px;
    border-radius: 20px;
    background: #ffffff18;
    overflow: hidden;
}

#progressFill {
    height: 100%;
    width: 0%;
    border-radius: 20px;
    background: linear-gradient(90deg, #b77b20, #ffe49a);
    transition: width .2s;
}

#inventory {
    position: absolute;
    bottom: 25px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
}

.slot {
    width: 54px;
    height: 59px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    border: 1px solid #ffffff25;
    border-radius: 8px;
    background: #10191de8;
    box-shadow: 0 5px 20px #0008;
    transition: .15s;
}

.slot.active {
    border: 2px solid #f5d178;
    background: #59451edb;
    transform: translateY(-7px);
    box-shadow: 0 0 20px #f5d17844;
}

.slotNumber {
    position: absolute;
    top: 4px;
    left: 6px;
    font-size: 10px;
    color: #aeb8bc;
}

.slotCoin {
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 25%, #fff1a8, #d99a19 65%, #81500b);
    box-shadow: 0 0 9px #f7c94c55;
}

.slotCount {
    color: #f5d178;
    font-size: 10px;
    margin-top: 4px;
}

#message {
    position: absolute;
    top: 22%;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 23px;
    border: 1px solid #d9a944;
    border-radius: 8px;
    background: #11191ded;
    color: #ffe4a0;
    font-size: 14px;
    letter-spacing: 1px;
    opacity: 0;
    transition: opacity .2s;
}

#crosshair {
    position: fixed;
    left: 50%;
    top: 50%;
    width: 9px;
    height: 9px;
    transform: translate(-50%, -50%);
    border: 1px solid #ffe4a0;
    border-radius: 50%;
    box-shadow: 0 0 8px #ffcf70;
    pointer-events: none;
    display: none;
}

#controlsHint {
    position: absolute;
    bottom: 105px;
    left: 50%;
    transform: translateX(-50%);
    color: #ffffff9c;
    font-size: 11px;
    text-shadow: 0 2px 5px black;
    white-space: nowrap;
}

#machineHint {
    position: absolute;
    left: 50%;
    bottom: 145px;
    transform: translateX(-50%);
    color: #ffdc82;
    font-size: 13px;
    text-shadow: 0 2px 6px black;
}

#vignette {
    position: fixed;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 48%, #00000066 100%);
}

@media(max-width: 650px) {
    #topHUD {
        top: 10px;
        left: 10px;
        gap: 5px;
    }

    .hudCard {
        min-width: 110px;
        padding: 9px;
    }

    .hudValue {
        font-size: 16px;
    }

    .slot {
        width: 39px;
        height: 48px;
    }

    #inventory {
        gap: 3px;
        bottom: 12px;
    }

    #progressHUD {
        top: 95px;
        right: 10px;
    }
}
`;

document.head.appendChild(style);

// ============================================================
// HUD
// ============================================================

function getOrCreate(id, tag = "div", parent = document.body) {
    let element = document.getElementById(id);

    if (!element) {
        element = document.createElement(tag);
        element.id = id;
        parent.appendChild(element);
    }

    return element;
}

// Alten Startbildschirm entfernen
document.getElementById("startScreen")?.remove();

const hud = getOrCreate("hud");
const topHUD = getOrCreate("topHUD", "div", hud);
const progressHUD = getOrCreate("progressHUD", "div", hud);
const inventoryUI = getOrCreate("inventory", "div", hud);
const messageUI = getOrCreate("message", "div", hud);
const crosshair = getOrCreate("crosshair", "div", hud);
const controlsHint = getOrCreate("controlsHint", "div", hud);
const machineHint = getOrCreate("machineHint", "div", hud);

if (!document.getElementById("money")) {
    topHUD.innerHTML = `
        <div class="hudCard">
            <div class="hudLabel">GESAMTES GELD</div>
            <div class="hudValue" id="money">0</div>
        </div>
        <div class="hudCard">
            <div class="hudLabel">IM INVENTAR</div>
            <div class="hudValue" id="held">0</div>
        </div>
    `;
}

if (!document.getElementById("progressText")) {
    progressHUD.innerHTML = `
        <div id="progressText">0 / 1.000.000</div>
        <div id="progressTrack">
            <div id="progressFill"></div>
        </div>
    `;
}

controlsHint.textContent =
    "WASD: Bewegen | Maus: Umschauen | Q: Ablegen | E: Einzahlen";

machineHint.textContent = "MÜNZZÄHLER: E zum Einzahlen";

const vignette = getOrCreate("vignette");

// ============================================================
// PHYSIK
// ============================================================

const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0
});

world.timestep = 1 / 60;

let physicsAccumulator = 0;

// ============================================================
// MÜNZENFABRIK
// ============================================================

const coinFactory = new CoinFactory({
    radius: CONFIG.coinRadius,
    thickness: CONFIG.coinThickness,
    detailLevel: 64
});

const coinTemplate = coinFactory.create({
    x: 0,
    y: 0,
    z: 0
});

coinTemplate.updateMatrixWorld(true);

const coinParts = [];

coinTemplate.traverse(object => {
    if (!object.isMesh) return;

    coinParts.push({
        geometry: object.geometry,
        material: object.material,
        localMatrix: object.matrixWorld.clone()
    });
});

if (coinParts.length === 0) {
    throw new Error(
        "coin.js: CoinFactory.create() hat keine Meshes zurückgegeben."
    );
}

// ============================================================
// DETAILLIERTE INSTANCED COINS
// ============================================================

const matrixTemp = new THREE.Matrix4();

function createDetailedCoinChunk(capacity, chunk) {
    const group = new THREE.Group();

    group.name = "DetailedCoinChunk";
    group.userData.chunk = chunk;

    const parts = [];

    for (const part of coinParts) {
        const mesh = new THREE.InstancedMesh(
            part.geometry,
            part.material,
            capacity
        );

        mesh.count = capacity;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.chunk = chunk;

        group.add(mesh);

        parts.push({
            mesh,
            localMatrix: part.localMatrix
        });
    }

    group.setMatrixAt = (index, baseMatrix) => {
        for (const part of parts) {
            matrixTemp.multiplyMatrices(
                baseMatrix,
                part.localMatrix
            );

            part.mesh.setMatrixAt(index, matrixTemp);
        }
    };

    group.instanceMatrix = {};

    Object.defineProperty(group.instanceMatrix, "needsUpdate", {
        set(value) {
            if (!value) return;

            for (const part of parts) {
                part.mesh.instanceMatrix.needsUpdate = true;
            }
        }
    });

    group.computeBoundingSphere = () => {
        for (const part of parts) {
            part.mesh.computeBoundingSphere();
        }
    };

    group.userData.parts = parts;

    return group;
}

// ============================================================
// MATERIALIEN
// ============================================================

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

// ============================================================
// LICHT
// ============================================================

scene.add(new THREE.HemisphereLight(
    0xc6d2dc,
    0x29231b,
    0.8
));

const mainLight = new THREE.DirectionalLight(
    0xffe4b7,
    1.5
);

mainLight.position.set(-8, 25, 8);
scene.add(mainLight);

function addPointLight(x, y, z, intensity = 30, distance = 15) {
    const light = new THREE.PointLight(
        0xffc978,
        intensity,
        distance
    );

    light.position.set(x, y, z);
    scene.add(light);

    return light;
}

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function random(min, max) {
    return min + Math.random() * (max - min);
}

function createBox(
    width,
    height,
    depth,
    material,
    x,
    y,
    z,
    parent = scene
) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    parent.add(mesh);

    return mesh;
}

function createFixedCollider(x, y, z, width, height, depth) {
    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
            .setTranslation(x, y, z)
    );

    world.createCollider(
        RAPIER.ColliderDesc.cuboid(
            width / 2,
            height / 2,
            depth / 2
        ),
        body
    );

    return body;
}

// ============================================================
// BUNKER
// ============================================================

createBox(1, 65, 25, concrete, -12, -24, 0);
createBox(1, 65, 25, concrete, 12, -24, 0);
createBox(24, 65, 1, concrete, 0, -24, -12);
createBox(24, 65, 1, concrete, 0, -24, 12);

createFixedCollider(-12, -24, 0, 1, 65, 25);
createFixedCollider(12, -24, 0, 1, 65, 25);
createFixedCollider(0, -24, -12, 24, 65, 1);
createFixedCollider(0, -24, 12, 24, 65, 1);

// ============================================================
// ETAGEN
// ============================================================

for (let level = 0; level < CONFIG.floors; level++) {
    const y = -level * CONFIG.floorHeight;

    createBox(
        19,
        0.7,
        24,
        floorMaterial,
        -2.5,
        y - 0.35,
        0
    );

    createBox(
        1.5,
        0.7,
        24,
        floorMaterial,
        11.25,
        y - 0.35,
        0
    );

    createFixedCollider(-2.5, y - 0.35, 0, 19, 0.7, 24);
    createFixedCollider(11.25, y - 0.35, 0, 1.5, 0.7, 24);

    for (let z = -9; z <= 9; z += 3) {
        createBox(0.16, 7.5, 0.16, steel, -11.3, y + 3.5, z);
        createBox(0.16, 7.5, 0.16, steel, 11.3, y + 3.5, z);
    }

    for (const side of [-1, 1]) {
        for (const z of [-8, 0, 8]) {
            createBox(
                0.25,
                0.65,
                0.5,
                steel,
                side * 11.3,
                y + 3.5,
                z
            );

            addPointLight(
                side * 10.6,
                y + 3.5,
                z,
                38,
                13
            );
        }
    }

    for (const x of [-10.7, 10.7]) {
        const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 7, 16),
            steel
        );

        pipe.position.set(x, y + 5.5, -10.6);
        scene.add(pipe);
    }
}

// ============================================================
// TREPPEN
// ============================================================

const STAIR_X = 8.5;
const STAIR_START_Z = -7;
const STAIR_LENGTH = 14;
const STAIR_STEPS = 32;

const stairRun = STAIR_LENGTH / STAIR_STEPS;
const stairRise = CONFIG.floorHeight / STAIR_STEPS;

const rampAngle = Math.atan(
    CONFIG.floorHeight / STAIR_LENGTH
);

for (let level = 0; level < CONFIG.floors - 1; level++) {
    const topY = -level * CONFIG.floorHeight;

    const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.35, 16),
        steel
    );

    ramp.position.set(STAIR_X, topY - 4, 0);
    ramp.rotation.x = rampAngle;
    scene.add(ramp);

    for (let i = 0; i < STAIR_STEPS; i++) {
        const z = STAIR_START_Z + i * stairRun;
        const y = topY - i * stairRise;

        createBox(
            3.5,
            0.16,
            stairRun,
            steel,
            STAIR_X,
            y - 0.08,
            z + stairRun / 2
        );
    }

    for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.13, 0.75, 14),
            steel
        );

        rail.position.set(
            STAIR_X + side * 1.85,
            topY - 4,
            0
        );

        rail.rotation.x = rampAngle;
        scene.add(rail);
    }
}

// ============================================================
// MÜNZEN UND CHUNKS
// ============================================================

const chunks = [];
const cellCounts = [];
const cellChunkIds = [];

function cellIndex(x, z) {
    return z * CONFIG.gridSize + x;
}

function getCellPosition(ix, iz) {
    return {
        x: -11 + (ix + 0.5) * CONFIG.cellSize,
        z: -11 + (iz + 0.5) * CONFIG.cellSize
    };
}

function getCell(x, z) {
    const ix = Math.floor((x + 11) / CONFIG.cellSize);
    const iz = Math.floor((z + 11) / CONFIG.cellSize);

    if (
        ix < 0 ||
        ix >= CONFIG.gridSize ||
        iz < 0 ||
        iz >= CONFIG.gridSize
    ) {
        return null;
    }

    return {
        ix,
        iz,
        index: cellIndex(ix, iz)
    };
}

for (let level = 0; level < CONFIG.floors; level++) {
    const layers = level === 0
        ? CONFIG.topLayers
        : CONFIG.lowerLayers;

    const counts = new Uint8Array(
        CONFIG.gridSize * CONFIG.gridSize
    );

    counts.fill(layers);

    const ids = new Uint16Array(
        CONFIG.gridSize * CONFIG.gridSize
    );

    const floorChunks = [];

    for (let cz = 0; cz < CONFIG.chunksPerSide; cz++) {
        for (let cx = 0; cx < CONFIG.chunksPerSide; cx++) {
            const id = cz * CONFIG.chunksPerSide + cx;

            for (
                let iz = cz * CONFIG.chunkSize;
                iz < (cz + 1) * CONFIG.chunkSize;
                iz++
            ) {
                for (
                    let ix = cx * CONFIG.chunkSize;
                    ix < (cx + 1) * CONFIG.chunkSize;
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

// ============================================================
// SPIELER
// ============================================================

const player = {
    position: new THREE.Vector3(0, 1.7, -6),
    velocity: new THREE.Vector3(),
    height: CONFIG.playerHeight,
    speed: CONFIG.playerSpeed,
    grounded: false
};

let yaw = 0;
let pitch = 0;
let locked = false;

const keys = {};

// ============================================================
// INVENTAR
// ============================================================

const inventory = Array.from(
    { length: CONFIG.inventorySlots },
    () => 0
);

let money = 0;
let selectedSlot = 0;

function getHeldCoins() {
    return inventory.reduce((sum, amount) => sum + amount, 0);
}

function addCoins(amount) {
    let remaining = amount;

    for (let i = 0; i < inventory.length; i++) {
        const free = CONFIG.stackLimit - inventory[i];

        if (free <= 0) continue;

        const added = Math.min(free, remaining);

        inventory[i] += added;
        remaining -= added;

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

    const total = money + held;

    const progressText = document.getElementById("progressText");
    const progressFill = document.getElementById("progressFill");

    if (progressText) {
        progressText.textContent =
            total.toLocaleString("de-DE") +
            " / " +
            TOTAL_COINS.toLocaleString("de-DE");
    }

    if (progressFill) {
        progressFill.style.width =
            clamp(total / TOTAL_COINS * 100, 0, 100) + "%";
    }

    inventoryUI.innerHTML = "";

    inventory.forEach((amount, index) => {
        const slot = document.createElement("div");

        slot.className =
            "slot" + (index === selectedSlot ? " active" : "");

        slot.innerHTML = `
            <span class="slotNumber">${index + 1}</span>
            ${amount > 0 ? '<div class="slotCoin"></div>' : ""}
            <span class="slotCount">${amount || ""}</span>
        `;

        inventoryUI.appendChild(slot);
    });
}

// ============================================================
// CHUNK-DATEN
// ============================================================

function createChunkData(chunk) {
    const coins = [];
    const floorY = -chunk.level * CONFIG.floorHeight;

    for (
        let iz = chunk.cz * CONFIG.chunkSize;
        iz < (chunk.cz + 1) * CONFIG.chunkSize;
        iz++
    ) {
        for (
            let ix = chunk.cx * CONFIG.chunkSize;
            ix < (chunk.cx + 1) * CONFIG.chunkSize;
            ix++
        ) {
            const cell = cellIndex(ix, iz);
            const position = getCellPosition(ix, iz);

            for (
                let layer = 0;
                layer < cellCounts[chunk.level][cell];
                layer++
            ) {
                coins.push({
                    localId: coins.length,
                    x: position.x,
                    y: floorY + CONFIG.coinThickness * (layer + 0.5),
                    z: position.z,
                    rotation: null,
                    velocity: null,
                    angularVelocity: null,
                    body: null,
                    collected: false,
                    chunk
                });
            }
        }
    }

    return coins;
}

// ============================================================
// MÜNZEN-MATRIX
// ============================================================

const tempObject = new THREE.Object3D();

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

// ============================================================
// CHUNK LADEN
// ============================================================

function loadChunk(chunk) {
    if (chunk.mesh) return;

    if (!chunk.coins) {
        chunk.coins = createChunkData(chunk);
    }

    const mesh = createDetailedCoinChunk(
        chunk.coins.length,
        chunk
    );

    for (const coin of chunk.coins) {
        setCoinMatrix(mesh, coin);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();

    scene.add(mesh);
    chunk.mesh = mesh;
}

// ============================================================
// PHYSIK-MÜNZEN
// ============================================================

const activeCoins = new Set();

function createPhysicsCoin(coin) {
    if (activeCoins.size >= CONFIG.maxActiveBodies) return false;
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
            CONFIG.coinThickness / 2,
            CONFIG.coinRadius
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

    const position = body.translation();
    const rotation = body.rotation();
    const velocity = body.linvel();
    const angularVelocity = body.angvel();

    coin.x = position.x;
    coin.y = position.y;
    coin.z = position.z;

    coin.rotation = {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
        w: rotation.w
    };

    coin.velocity = {
        x: velocity.x,
        y: velocity.y,
        z: velocity.z
    };

    coin.angularVelocity = {
        x: angularVelocity.x,
        y: angularVelocity.y,
        z: angularVelocity.z
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

// ============================================================
// PHYSIK AKTIVIEREN
// ============================================================

function activateNearbyCoins() {
    if (activeCoins.size >= CONFIG.maxActiveBodies) return;

    const radiusSq =
        CONFIG.physicsRadius * CONFIG.physicsRadius;

    for (const floorChunks of chunks) {
        for (const chunk of floorChunks) {
            if (!chunk.mesh || !chunk.mesh.visible) continue;
            if (!chunk.coins) continue;

            for (const coin of chunk.coins) {
                if (activeCoins.size >= CONFIG.maxActiveBodies) return;
                if (coin.collected || coin.body) continue;

                const dx = coin.x - player.position.x;
                const dy = coin.y - player.position.y;
                const dz = coin.z - player.position.z;

                if (dx * dx + dy * dy + dz * dz > radiusSq) {
                    continue;
                }

                if (Math.abs(dy) > 2.8) continue;

                createPhysicsCoin(coin);
            }
        }
    }
}

// ============================================================
// PHYSIK UPDATE
// ============================================================

function updateCoinPhysics() {
    world.step();

    for (const coin of activeCoins) {
        if (!coin.body) continue;

        const position = coin.body.translation();
        const rotation = coin.body.rotation();

        coin.x = position.x;
        coin.y = position.y;
        coin.z = position.z;

        coin.rotation = {
            x: rotation.x,
            y: rotation.y,
            z: rotation.z,
            w: rotation.w
        };

        if (coin.chunk && coin.chunk.mesh) {
            setCoinMatrix(coin.chunk.mesh, coin);
            coin.chunk.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

// ============================================================
// SICHTFELD UND CHUNK-STREAMING
// ============================================================

const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();

function getCurrentFloor() {
    return clamp(
        Math.round(
            (1.7 - player.position.y) / CONFIG.floorHeight
        ),
        0,
        CONFIG.floors - 1
    );
}

function isInRampArea(x, z) {
    return x > 6.5 && x < 10.5 && z > -7.5 && z < 7.5;
}

function updateVisibility() {
    camera.updateMatrixWorld(true);

    viewProjection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );

    frustum.setFromProjectionMatrix(viewProjection);

    const currentFloor = getCurrentFloor();
    let loads = 0;

    for (let floor = 0; floor < CONFIG.floors; floor++) {
        for (const chunk of chunks[floor]) {
            const minX =
                -11 + chunk.cx * CONFIG.chunkSize * CONFIG.cellSize;

            const minZ =
                -11 + chunk.cz * CONFIG.chunkSize * CONFIG.cellSize;

            const bounds = new THREE.Box3(
                new THREE.Vector3(
                    minX,
                    -floor * CONFIG.floorHeight,
                    minZ
                ),
                new THREE.Vector3(
                    minX + CONFIG.chunkSize * CONFIG.cellSize,
                    -floor * CONFIG.floorHeight + CONFIG.floorHeight,
                    minZ + CONFIG.chunkSize * CONFIG.cellSize
                )
            );

            const visibleFloor =
                floor === currentFloor ||
                (
                    isInRampArea(player.position.x, player.position.z) &&
                    Math.abs(floor - currentFloor) <= 1
                );

            const visible =
                visibleFloor && frustum.intersectsBox(bounds);

            if (!visible) {
                if (chunk.mesh) {
                    chunk.mesh.visible = false;
                    freezeChunk(chunk);
                }

                continue;
            }

            chunk.lastSeen = performance.now();

            if (!chunk.mesh && loads < CONFIG.maxChunkLoads) {
                loadChunk(chunk);
                loads++;
            }

            if (chunk.mesh) {
                chunk.mesh.visible = true;
            }
        }
    }

    const loaded = [];

    for (const floorChunks of chunks) {
        for (const chunk of floorChunks) {
            if (chunk.mesh) loaded.push(chunk);
        }
    }

    if (loaded.length > CONFIG.maxLoadedChunks) {
        loaded
            .filter(chunk => !chunk.mesh.visible)
            .sort((a, b) => a.lastSeen - b.lastSeen)
            .slice(0, loaded.length - CONFIG.maxLoadedChunks)
            .forEach(chunk => {
                freezeChunk(chunk);
                scene.remove(chunk.mesh);
                chunk.mesh = null;
                chunk.coins = null;
            });
    }
}

// ============================================================
// PARTIKEL
// ============================================================

const particles = [];

function createPickupEffect(x, y, z) {
    for (let i = 0; i < 7; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0xffd45c,
                transparent: true
            })
        );

        particle.position.set(x, y, z);

        particle.userData.velocity = new THREE.Vector3(
            random(-1.2, 1.2),
            random(0.5, 2),
            random(-1.2, 1.2)
        );

        particle.userData.life = 0.45;

        scene.add(particle);
        particles.push(particle);
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        particle.position.addScaledVector(
            particle.userData.velocity,
            dt
        );

        particle.userData.life -= dt;

        particle.material.opacity = Math.max(
            0,
            particle.userData.life / 0.45
        );

        if (particle.userData.life <= 0) {
            scene.remove(particle);
            particle.geometry.dispose();
            particle.material.dispose();
            particles.splice(i, 1);
        }
    }
}

// ============================================================
// MÜNZEN EINSAMMELN
// ============================================================

const raycaster = new THREE.Raycaster();

function collectCoin() {
    if (!locked) return;

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    const visibleChunks = [];

    for (const floorChunks of chunks) {
        for (const chunk of floorChunks) {
            if (chunk.mesh && chunk.mesh.visible) {
                visibleChunks.push(chunk.mesh);
            }
        }
    }

    const hits = raycaster.intersectObjects(
        visibleChunks,
        true
    );

    if (!hits.length) return;

    const hit = hits[0];

    if (hit.distance > 4.5) return;

    const chunk = hit.object.userData.chunk;

    if (!chunk || !chunk.coins) return;

    const coin = chunk.coins[hit.instanceId];

    if (!coin || coin.collected) return;

    if (
        getHeldCoins() >=
        CONFIG.inventorySlots * CONFIG.stackLimit
    ) {
        showMessage("INVENTAR VOLL!");
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

    const added = addCoins(1);

    if (added !== 1) {
        coin.collected = false;
        showMessage("INVENTAR VOLL!");
        return;
    }

    showMessage("+1 COIN");

    createPickupEffect(
        hit.point.x,
        hit.point.y,
        hit.point.z
    );
}

// ============================================================
// MÜNZEN ABLEGEN
// ============================================================

const droppedCoins = [];

function createDroppedCoin(x, y, z) {
    const mesh = coinFactory.create({ x, y, z });

    scene.add(mesh);

    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setLinearDamping(0.2)
            .setAngularDamping(0.35)
    );

    world.createCollider(
        RAPIER.ColliderDesc.cylinder(
            CONFIG.coinThickness / 2,
            CONFIG.coinRadius
        )
            .setDensity(7)
            .setFriction(0.8)
            .setRestitution(0.12),
        body
    );

    body.setLinvel({
        x: random(-0.7, 0.7),
        y: 1.2,
        z: random(-0.7, 0.7)
    }, true);

    const dropped = { mesh, body };

    mesh.traverse(object => {
        if (object.isMesh) {
            object.userData.droppedCoin = dropped;
        }
    });

    droppedCoins.push(dropped);

    return dropped;
}

function dropCoin() {
    if (!locked) return;

    const amount = inventory[selectedSlot];

    if (amount <= 0) {
        showMessage("SLOT IST LEER!");
        return;
    }

    inventory[selectedSlot]--;

    const direction = new THREE.Vector3(
        -Math.sin(yaw),
        0,
        -Math.cos(yaw)
    );

    const position = player.position.clone()
        .add(direction.multiplyScalar(1.1));

    createDroppedCoin(
        position.x,
        position.y - 0.25,
        position.z
    );

    updateHUD();
    showMessage("COIN ABGELEGT");
}

function collectDroppedCoin() {
    if (!locked) return;

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    const meshes = droppedCoins.map(coin => coin.mesh);

    const hits = raycaster.intersectObjects(meshes, true);

    if (!hits.length) return;

    const hit = hits[0];

    if (hit.distance > 4.5) return;

    const dropped = hit.object.userData.droppedCoin;

    if (!dropped) return;

    if (
        getHeldCoins() >=
        CONFIG.inventorySlots * CONFIG.stackLimit
    ) {
        showMessage("INVENTAR VOLL!");
        return;
    }

    const index = droppedCoins.indexOf(dropped);

    if (index < 0) return;

    world.removeRigidBody(dropped.body);
    scene.remove(dropped.mesh);
    droppedCoins.splice(index, 1);

    addCoins(1);
    showMessage("+1 COIN");
}

// ============================================================
// MÜNZZÄHLER
// ============================================================

const machine = new THREE.Group();
const machinePosition = CONFIG.machinePosition;

createBox(2.5, 2.7, 1.7, darkSteel, 0, 1.35, 0, machine);
createBox(2.7, 0.2, 1.9, steel, 0, 2.75, 0, machine);

for (const x of [-1.15, 1.15]) {
    createBox(0.12, 2.5, 0.12, steel, x, 1.35, 0.88, machine);
}

createBox(1.15, 0.12, 0.7, darkSteel, 0, 2.9, 0, machine);

const displayCanvas = document.createElement("canvas");
displayCanvas.width = 512;
displayCanvas.height = 192;

const displayContext = displayCanvas.getContext("2d");
const displayTexture = new THREE.CanvasTexture(displayCanvas);

const displayMaterial = new THREE.MeshStandardMaterial({
    map: displayTexture,
    emissive: 0x0bff83,
    emissiveMap: displayTexture,
    emissiveIntensity: 0.7
});

const displayPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 0.08),
    displayMaterial
);

displayPanel.position.set(0, 2.05, 0.89);
machine.add(displayPanel);

// Förderband

createBox(1.5, 0.18, 2.8, darkSteel, 0, 0.95, 2.1, machine);

const beltStripes = [];

for (let i = 0; i < 9; i++) {
    beltStripes.push(
        createBox(
            1.45,
            0.035,
            0.08,
            steel,
            0,
            1.06,
            0.9 + i * 0.3,
            machine
        )
    );
}

const rollers = [];

for (const z of [0.8, 3.4]) {
    const roller = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 1.6, 16),
        steel
    );

    roller.rotation.z = Math.PI / 2;
    roller.position.set(0, 0.95, z);

    machine.add(roller);
    rollers.push(roller);
}

const machineLight = new THREE.PointLight(
    0x3cff9b,
    3,
    6
);

machineLight.position.set(0, 2.5, 1);
machine.add(machineLight);

machine.position.set(
    machinePosition.x,
    machinePosition.y,
    machinePosition.z
);

scene.add(machine);

// ============================================================
// DISPLAY AKTUALISIEREN
// ============================================================

function updateMachineDisplay() {
    displayContext.fillStyle = "#03140c";
    displayContext.fillRect(0, 0, 512, 192);

    displayContext.fillStyle = "#48ff9b";
    displayContext.font = "bold 27px Arial";
    displayContext.fillText("COIN COUNTER", 24, 40);

    displayContext.font = "bold 58px monospace";

    displayContext.fillText(
        money.toLocaleString("de-DE"),
        24,
        112
    );

    displayContext.font = "bold 20px Arial";
    displayContext.fillText("COINS COUNTED", 24, 155);

    displayTexture.needsUpdate = true;
}

updateMachineDisplay();

// ============================================================
// FÖRDERBAND-MÜNZEN
// ============================================================

const beltCoins = [];

function spawnBeltCoin() {
    if (beltCoins.length >= 24) return;

    const x = machine.position.x + random(-0.4, 0.4);
    const y = 1.55;
    const z = machine.position.z + 1.5;

    const mesh = coinFactory.create({ x, y, z });

    scene.add(mesh);

    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setLinearDamping(0.12)
            .setAngularDamping(0.2)
    );

    world.createCollider(
        RAPIER.ColliderDesc.cylinder(
            CONFIG.coinThickness / 2,
            CONFIG.coinRadius
        )
            .setDensity(7)
            .setFriction(0.7)
            .setRestitution(0.15),
        body
    );

    body.setLinvel({
        x: random(-0.1, 0.1),
        y: 0.2,
        z: 2.7
    }, true);

    beltCoins.push({
        mesh,
        body,
        age: 0
    });
}

function updateBeltCoins(dt) {
    for (let i = beltCoins.length - 1; i >= 0; i--) {
        const coin = beltCoins[i];

        coin.age += dt;

        const position = coin.body.translation();
        const rotation = coin.body.rotation();

        coin.mesh.position.set(
            position.x,
            position.y,
            position.z
        );

        coin.mesh.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w
        );

        if (
            coin.age > 5 ||
            position.z > machine.position.z + 5
        ) {
            scene.remove(coin.mesh);
            world.removeRigidBody(coin.body);
            beltCoins.splice(i, 1);
        }
    }
}

// ============================================================
// EINZAHLEN
// ============================================================

let beltSpawnQueue = 0;
let beltSpawnTimer = 0;

function showMessage(text) {
    messageUI.textContent = text;
    messageUI.style.opacity = "1";

    clearTimeout(window.messageTimeout);

    window.messageTimeout = setTimeout(() => {
        messageUI.style.opacity = "0";
    }, 1600);
}

function depositCoins() {
    const dx = player.position.x - machine.position.x;
    const dz = player.position.z - machine.position.z;

    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 4) {
        showMessage("GEHE ZUM MÜNZZÄHLER!");
        return;
    }

    const amount = getHeldCoins();

    if (amount <= 0) {
        showMessage("KEINE MÜNZEN!");
        return;
    }

    money += amount;
    inventory.fill(0);

    beltSpawnQueue = Math.min(amount, 24);
    beltSpawnTimer = 0;

    updateHUD();
    updateMachineDisplay();

    showMessage(
        "+" + amount.toLocaleString("de-DE") + " COINS EINGEZAHLT!"
    );

    machine.scale.set(1.04, 0.94, 1.04);

    setTimeout(() => {
        machine.scale.set(1, 1, 1);
    }, 150);
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

// ============================================================
// SPIELERBEWEGUNG
// ============================================================

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

    let ground = -level * CONFIG.floorHeight;

    if (
        isInRampArea(
            player.position.x,
            player.position.z
        )
    ) {
        const progress = clamp(
            (player.position.z + 7) / 14,
            0,
            1
        );

        ground -= progress * CONFIG.floorHeight;
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

// ============================================================
// EINGABEN
// ============================================================

document.addEventListener("keydown", event => {
    keys[event.code] = true;

    if (
        event.code === "Space" &&
        player.grounded &&
        locked
    ) {
        player.velocity.y = 6;
        player.grounded = false;
    }

    if (event.code === "KeyE" && locked) {
        depositCoins();
    }

    if (event.code === "KeyQ" && locked) {
        dropCoin();
    }

    if (event.code.startsWith("Digit")) {
        const number = Number(
            event.code.replace("Digit", "")
        );

        if (number >= 1 && number <= 9) {
            selectedSlot = number - 1;
            updateHUD();
        }
    }
});

document.addEventListener("keyup", event => {
    keys[event.code] = false;
});

document.addEventListener("mousemove", event => {
    if (!locked) return;

    yaw -= event.movementX * 0.002;
    pitch -= event.movementY * 0.002;

    pitch = clamp(pitch, -1.5, 1.5);
});

document.addEventListener("mousedown", event => {
    if (!locked || event.button !== 0) return;

    collectDroppedCoin();
    collectCoin();
});

document.addEventListener("contextmenu", event => {
    event.preventDefault();
});

// ============================================================
// DIREKTSTART – KEIN STARTKNOPF
// ============================================================

let gameStarted = true;

function requestGamePointerLock() {
    if (
        renderer.domElement.requestPointerLock &&
        document.pointerLockElement !== renderer.domElement
    ) {
        try {
            const result = renderer.domElement.requestPointerLock();

            if (result && typeof result.catch === "function") {
                result.catch(error => {
                    console.warn("Maussteuerung nicht aktiviert:", error);
                });
            }
        } catch (error) {
            console.warn("Pointer Lock nicht verfügbar:", error);
        }
    }
}

// Klick ins Spielfeld aktiviert die Maussteuerung.
renderer.domElement.addEventListener("click", () => {
    if (!locked) {
        requestGamePointerLock();
    }
});

document.addEventListener("pointerlockchange", () => {
    locked =
        document.pointerLockElement === renderer.domElement;

    crosshair.style.display = locked ? "block" : "none";
});

// ============================================================
// ANIMATION
// ============================================================

let lastTime = performance.now();

let visibilityTimer = 0;
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
    }

    // Physik mit festem Zeitschritt
    physicsAccumulator += dt;

    while (physicsAccumulator >= 1 / 60) {
        world.timestep = 1 / 60;
        updateCoinPhysics();

        physicsAccumulator -= 1 / 60;
    }

    // Chunk-Streaming
    if (locked) {
        visibilityTimer += dt;
        activationTimer += dt;

        if (visibilityTimer >= 0.12) {
            visibilityTimer = 0;
            updateVisibility();
        }

        if (activationTimer >= 0.25) {
            activationTimer = 0;
            activateNearbyCoins();
        }
    }

    updateParticles(dt);

    // Förderband bewegen
    for (const stripe of beltStripes) {
        stripe.position.z += dt * 2.7;

        if (stripe.position.z > 3.5) {
            stripe.position.z = 0.9;
        }
    }

    for (const roller of rollers) {
        roller.rotation.x += dt * 3;
    }

    updateDepositAnimation(dt);
    updateBeltCoins(dt);

    // Abgelegte Münzen synchronisieren
    for (const coin of droppedCoins) {
        const position = coin.body.translation();
        const rotation = coin.body.rotation();

        coin.mesh.position.set(
            position.x,
            position.y,
            position.z
        );

        coin.mesh.quaternion.set(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w
        );
    }

    renderer.render(scene, camera);
}

// ============================================================
// FENSTERGRÖSSE
// ============================================================

window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(innerWidth, innerHeight);

    renderer.setPixelRatio(
        Math.min(devicePixelRatio, 1.5)
    );
});

// ============================================================
// FEHLERANZEIGE
// ============================================================

window.addEventListener("error", event => {
    console.error("Spiel-Fehler:", event.error);
});

window.addEventListener("unhandledrejection", event => {
    console.error("Asynchroner Fehler:", event.reason);
});

// ============================================================
// SPIEL INITIALISIEREN
// ============================================================

updateHUD();

camera.position.copy(player.position);

updateVisibility();

renderer.render(scene, camera);

// Animation sofort starten
requestAnimationFrame(animate);

console.log("ONE MILLION COINS gestartet!");
console.log(
    "Münzen insgesamt:",
    TOTAL_COINS.toLocaleString("de-DE")
);

// ============================================================
// DEBUG
// ============================================================

window.oneMillionCoins = {
    scene,
    camera,
    renderer,
    player,
    inventory,
    chunks,
    money: () => money,
    held: getHeldCoins,
    total: TOTAL_COINS
};
