import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// =====================================================
// KONFIGURATION
// =====================================================

const FLOOR_COUNT = 7;
const FLOOR_HEIGHT = 8;

const GRID_SIZE = 55;
const CELL_SIZE = 0.4;
const WORLD_SIZE = GRID_SIZE * CELL_SIZE;

const COIN_DIAMETER = 0.376;
const COIN_THICKNESS = 0.1;

const LOWER_LAYERS = 80;
const TOP_LAYERS = 4;

const CHUNK_SIZE = 5;
const CHUNKS_PER_SIDE = 11;

const COINS_PER_LOWER_FLOOR = GRID_SIZE * GRID_SIZE * LOWER_LAYERS;
const COINS_ON_TOP_FLOOR = GRID_SIZE * GRID_SIZE * TOP_LAYERS;

const TOTAL_COINS =
    (FLOOR_COUNT - 1) * COINS_PER_LOWER_FLOOR +
    COINS_ON_TOP_FLOOR;

const SLOT_COUNT = 15;
const STACK_LIMIT = 9999;

// Performance
const MAX_LOADED_CHUNKS = 40;
const MAX_CHUNK_LOADS_PER_UPDATE = 2;

let chunkClock = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171918);
scene.fog = new THREE.FogExp2(0x171918, 0.006);

const camera = new THREE.PerspectiveCamera(
    75,
    innerWidth / innerHeight,
    0.1,
    180
);

const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance"
});

renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

document.body.appendChild(renderer.domElement);

// =====================================================
// MATERIALIEN
// =====================================================

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

const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x171d20,
    metalness: 0.7,
    roughness: 0.4
});

const goldSide = new THREE.MeshStandardMaterial({
    color: 0xd99a19,
    metalness: 0.9,
    roughness: 0.22
});

// =====================================================
// MÜNZENTEXTUR
// =====================================================

function createCoinTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#e9b83c";
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = "#fff0a0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#98620b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 64, 43, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#fff0a0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(64, 64, 34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#98620b";
    ctx.font = "bold 38px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", 64, 66);

    ctx.fillStyle = "#fff2b5";
    ctx.font = "bold 12px Arial";
    ctx.fillText("COIN", 64, 94);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

const coinFace = new THREE.MeshStandardMaterial({
    map: createCoinTexture(),
    color: 0xffffff,
    metalness: 0.8,
    roughness: 0.24
});

const coinGeometry = new THREE.CylinderGeometry(
    COIN_DIAMETER / 2,
    COIN_DIAMETER / 2,
    COIN_THICKNESS,
    16
);

// =====================================================
// LICHT
// =====================================================

scene.add(new THREE.HemisphereLight(
    0xc6d2dc,
    0x29231b,
    0.65
));

const mainLight = new THREE.DirectionalLight(0xffe4b7, 1.1);
mainLight.position.set(-8, 20, 5);
mainLight.castShadow = false;
scene.add(mainLight);

function addPointLight(x, y, z, intensity = 55, distance = 13) {
    const light = new THREE.PointLight(
        0xffc978,
        intensity,
        distance
    );

    light.position.set(x, y, z);
    scene.add(light);

    return light;
}

// =====================================================
// HILFSFUNKTIONEN
// =====================================================

function createBox(
    w, h, d,
    material,
    x, y, z,
    parent = scene
) {
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

// =====================================================
// BUNKER
// =====================================================

createBox(1, 65, 25, concrete, -12, -24, 0);
createBox(1, 65, 25, concrete, 12, -24, 0);
createBox(24, 65, 1, concrete, 0, -24, -12);
createBox(24, 65, 1, concrete, 0, -24, 12);

for (let level = 0; level < FLOOR_COUNT; level++) {
    const y = -level * FLOOR_HEIGHT;

    // Etagenböden mit Treppenöffnung

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

    // Wandverstärkungen

    for (let z = -9; z <= 9; z += 3) {
        createBox(0.16, 7.5, 0.16, steel, -11.3, y + 3.5, z);
        createBox(0.16, 7.5, 0.16, steel, 11.3, y + 3.5, z);
    }

    // Lampen

    for (const side of [-1, 1]) {
        for (const z of [-8, 0, 8]) {
            const x = side * 11.3;

            createBox(
                0.25, 0.65, 0.5,
                steel,
                x, y + 3.5, z
            );

            const bulb = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.35, 0.28),
                new THREE.MeshStandardMaterial({
                    color: 0xffe2a5,
                    emissive: 0xffb83d,
                    emissiveIntensity: 2
                })
            );

            bulb.position.set(
                x - side * 0.18,
                y + 3.5,
                z
            );

            scene.add(bulb);

            if (z === 0) {
                addPointLight(
                    x - side * 0.7,
                    y + 3.5,
                    z,
                    42,
                    12
                );
            }
        }
    }

    // Rohre

    for (const x of [-10.7, 10.7]) {
        const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 7, 12),
            steel
        );

        pipe.position.set(x, y + 5.5, -10.6);
        scene.add(pipe);
    }
}

// =====================================================
// TREPPE: 32 EINZELNE STUFEN
// =====================================================

const stairMaterial = new THREE.MeshStandardMaterial({
    color: 0x596164,
    metalness: 0.72,
    roughness: 0.42
});

const stairEdgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x252d30,
    metalness: 0.8,
    roughness: 0.35
});

const STAIR_X = 8.5;
const STAIR_START_Z = -7;
const STAIR_LENGTH = 14;
const STAIR_STEPS = 32;

const STAIR_RUN = STAIR_LENGTH / STAIR_STEPS;
const STAIR_RISE = FLOOR_HEIGHT / STAIR_STEPS;

for (let level = 0; level < FLOOR_COUNT - 1; level++) {
    const topY = -level * FLOOR_HEIGHT;

    for (let i = 0; i < STAIR_STEPS; i++) {
        const z = STAIR_START_Z + i * STAIR_RUN;
        const top = topY - i * STAIR_RISE;

        const tread = new THREE.Mesh(
            new THREE.BoxGeometry(
                3.5,
                0.22,
                STAIR_RUN + 0.025
            ),
            stairMaterial
        );

        tread.position.set(
            STAIR_X,
            top - 0.11,
            z + STAIR_RUN / 2
        );

        tread.castShadow = false;
        tread.receiveShadow = false;

        scene.add(tread);

        const nosing = new THREE.Mesh(
            new THREE.BoxGeometry(3.48, 0.045, 0.055),
            stairEdgeMaterial
        );

        nosing.position.set(
            STAIR_X,
            top - 0.018,
            z + 0.025
        );

        scene.add(nosing);
    }

    // Geländer

    for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.75, STAIR_LENGTH),
            steel
        );

        rail.position.set(
            STAIR_X + side * 1.86,
            topY - FLOOR_HEIGHT / 2,
            0
        );

        rail.rotation.x = Math.atan(FLOOR_HEIGHT / STAIR_LENGTH);
        scene.add(rail);

        for (let i = 0; i <= 7; i++) {
            const z = STAIR_START_Z + i * 2;

            const y = topY -
                ((z - STAIR_START_Z) / STAIR_LENGTH) *
                FLOOR_HEIGHT;

            createBox(
                0.10, 0.85, 0.10,
                steel,
                STAIR_X + side * 1.86,
                y + 0.42,
                z
            );
        }
    }
}

// =====================================================
// MÜNZEN UND CHUNKS
// =====================================================

const dummy = new THREE.Object3D();

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

// Etagen und Chunks vorbereiten.
// Die Münz-Meshes selbst werden noch NICHT erstellt.

for (let level = 0; level < FLOOR_COUNT; level++) {
    const layers = level === 0
        ? TOP_LAYERS
        : LOWER_LAYERS;

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

            for (
                let iz = minCellZ;
                iz < minCellZ + CHUNK_SIZE;
                iz++
            ) {
                for (
                    let ix = minCellX;
                    ix < minCellX + CHUNK_SIZE;
                    ix++
                ) {
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
                lastSeen: 0,
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

// =====================================================
// ZELLE UND CHUNK FINDEN
// =====================================================

function worldToCell(x, z) {
    const ix = Math.floor((x + 11) / CELL_SIZE);
    const iz = Math.floor((z + 11) / CELL_SIZE);

    if (
        ix < 0 ||
        ix >= GRID_SIZE ||
        iz < 0 ||
        iz >= GRID_SIZE
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

// =====================================================
// CHUNK ERSTELLEN
// =====================================================

function ensureChunkLoaded(chunk) {
    if (chunk.mesh || chunk.remaining <= 0) return;

    const level = chunk.level;

    const layers = level === 0
        ? TOP_LAYERS
        : LOWER_LAYERS;

    chunk.lastSeen = ++chunkClock;

    const floorY = -level * FLOOR_HEIGHT;

    const capacity =
        CHUNK_SIZE * CHUNK_SIZE * layers;

    const mesh = new THREE.InstancedMesh(
        coinGeometry,
        [goldSide, coinFace],
        capacity
    );

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    let localId = 0;

    const minCellX = chunk.cx * CHUNK_SIZE;
    const minCellZ = chunk.cz * CHUNK_SIZE;

    for (
        let iz = minCellZ;
        iz < minCellZ + CHUNK_SIZE;
        iz++
    ) {
        for (
            let ix = minCellX;
            ix < minCellX + CHUNK_SIZE;
            ix++
        ) {
            const cell = cellIndex(ix, iz);
            const pos = getCellWorld(ix, iz);

            cellStarts[level][cell] = localId;

            for (
                let layer = 0;
                layer < cellCounts[level][cell];
                layer++
            ) {
                dummy.position.set(
                    pos.x,
                    floorY + COIN_THICKNESS * (layer + 0.5),
                    pos.z
                );

                dummy.rotation.set(
                    0,
                    random(0, Math.PI * 2),
                    0
                );

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
    mesh.visible = true;

    scene.add(mesh);

    chunk.mesh = mesh;
}

// =====================================================
// SICHTFELD UND CHUNK-VERWALTUNG
// =====================================================

const coinFrustum = new THREE.Frustum();
const coinViewProjection = new THREE.Matrix4();

function updateCoinVisibility() {
    const level = getCurrentFloor();

    const onStairs = isInRampArea(
        player.position.x,
        player.position.z
    );

    camera.updateMatrixWorld(true);

    coinViewProjection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );

    coinFrustum.setFromProjectionMatrix(
        coinViewProjection
    );

    let loadsThisPass = 0;

    // Nur sichtbare Etagen berücksichtigen.

    for (let floor = 0; floor < FLOOR_COUNT; floor++) {
        const showFloor =
            floor === level ||
            (
                onStairs &&
                Math.abs(floor - level) === 1
            );

        for (const chunk of coinChunks[floor]) {
            if (!showFloor || chunk.remaining <= 0) {
                if (chunk.mesh) {
                    chunk.mesh.visible = false;
                }

                continue;
            }

            const inView = coinFrustum.intersectsBox(
                chunk.box
            );

            if (!inView) {
                if (chunk.mesh) {
                    chunk.mesh.visible = false;
                }

                continue;
            }

            chunk.lastSeen = ++chunkClock;

            // Maximal zwei neue Chunks pro Durchlauf.

            if (
                !chunk.mesh &&
                loadsThisPass < MAX_CHUNK_LOADS_PER_UPDATE
            ) {
                ensureChunkLoaded(chunk);
                loadsThisPass++;
            }

            if (chunk.mesh) {
                chunk.mesh.visible = true;
            }
        }
    }

    // Geladene Chunks zählen.

    const loaded = [];

    for (const floorChunks of coinChunks) {
        for (const chunk of floorChunks) {
            if (chunk.mesh) {
                loaded.push(chunk);
            }
        }
    }

    // Alte, unsichtbare Chunks entfernen.

    let excess = loaded.length - MAX_LOADED_CHUNKS;

    if (excess > 0) {
        loaded
            .filter(chunk => !chunk.mesh.visible)
            .sort((a, b) => a.lastSeen - b.lastSeen)
            .some(chunk => {
                if (excess <= 0) return true;

                scene.remove(chunk.mesh);

                chunk.mesh = null;
                excess--;

                return false;
            });
    }
}

// =====================================================
// SPIELER UND INVENTAR
// =====================================================

const player = {
    position: new THREE.Vector3(0, 2.1, -6),
    velocity: new THREE.Vector3(),
    speed: 4.5,
    radius: 0.32,
    height: 1.7,
    grounded: false
};

function getCurrentFloor() {
    if (
        isInRampArea(
            player.position.x,
            player.position.z
        )
    ) {
        const progress = clamp(
            (player.position.z - STAIR_START_Z) / STAIR_LENGTH,
            0,
            1
        );

        const topLevel = Math.round(
            (
                1.7 -
                player.position.y -
                progress * FLOOR_HEIGHT
            ) / FLOOR_HEIGHT
        );

        return clamp(
            topLevel,
            0,
            FLOOR_COUNT - 1
        );
    }

    return clamp(
        Math.round(
            (1.7 - player.position.y) / FLOOR_HEIGHT
        ),
        0,
        FLOOR_COUNT - 1
    );
}

let yaw = 0;
let pitch = 0;
let locked = false;

const keys = {};

const inventory = Array.from(
    { length: SLOT_COUNT },
    () => 0
);

let money = 0;
let selectedSlot = 0;
let heldCoins = 0;

// =====================================================
// MÜNZEN INS INVENTAR
// =====================================================

function addCoins(amount) {
    let remaining = amount;

    for (let i = 0; i < SLOT_COUNT; i++) {
        const free = STACK_LIMIT - inventory[i];

        if (free <= 0) continue;

        const add = Math.min(free, remaining);

        inventory[i] += add;
        remaining -= add;

        if (remaining <= 0) break;
    }

    updateHUD();

    return amount - remaining;
}

// =====================================================
// INVENTAR ANZEIGEN
// =====================================================

function renderInventory() {
    const ui = document.getElementById("inventory");

    if (!ui) return;

    ui.innerHTML = "";

    inventory.forEach((amount, index) => {
        const slot = document.createElement("div");

        slot.className =
            "slot" +
            (index === selectedSlot ? " active" : "");

        slot.innerHTML = `
            <span class="slot-number">${index + 1}</span>
            ${amount > 0 ? "🪙" : ""}
            <span class="slot-count">${amount || ""}</span>
        `;

        ui.appendChild(slot);
    });
}

// =====================================================
// HUD
// =====================================================

function updateHUD() {
    heldCoins = inventory.reduce(
        (a, b) => a + b,
        0
    );

    const moneyUI = document.getElementById("money");
    const heldUI = document.getElementById("held");

    const progressText =
        document.getElementById("progressText");

    const progressFill =
        document.getElementById("progressFill");

    if (moneyUI) {
        moneyUI.textContent =
            money.toLocaleString("de-DE");
    }

    if (heldUI) {
        heldUI.textContent =
            heldCoins.toLocaleString("de-DE");
    }

    const total = money + heldCoins;

    if (progressText) {
        progressText.textContent =
            total.toLocaleString("de-DE") +
            " / " +
            TOTAL_COINS.toLocaleString("de-DE");
    }

    if (progressFill) {
        progressFill.style.width =
            (total / TOTAL_COINS * 100) + "%";
    }

    renderInventory();
}

// =====================================================
// MÜNZEN EINSAMMELN
// =====================================================

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);

const horizontalPlane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    0
);

let targetCell = null;

function findTargetCoin() {
    raycaster.setFromCamera(mouse, camera);

    let best = null;
    let bestDistance = Infinity;

    for (let level = 0; level < FLOOR_COUNT; level++) {
        const floorVisible = coinChunks[level].some(
            chunk => chunk.mesh && chunk.mesh.visible
        );

        if (!floorVisible) continue;

        const maxLayers = level === 0
            ? TOP_LAYERS
            : LOWER_LAYERS;

        const floorY = -level * FLOOR_HEIGHT;

        for (
            let layer = maxLayers - 1;
            layer >= 0;
            layer--
        ) {
            const planeY =
                floorY + COIN_THICKNESS * (layer + 1);

            horizontalPlane.constant = -planeY;

            const point = new THREE.Vector3();

            if (
                !raycaster.ray.intersectPlane(
                    horizontalPlane,
                    point
                )
            ) {
                continue;
            }

            const cell = worldToCell(
                point.x,
                point.z
            );

            if (!cell) continue;

            if (
                cellCounts[level][cell.index] !==
                layer + 1
            ) {
                continue;
            }

            const chunk = getChunkForCell(level, cell);

            if (
                !chunk.mesh ||
                !chunk.mesh.visible
            ) {
                continue;
            }

            const distance =
                camera.position.distanceTo(point);

            if (
                distance > 4.5 ||
                distance >= bestDistance
            ) {
                continue;
            }

            bestDistance = distance;

            best = {
                level,
                cell,
                point,
                layer
            };
        }
    }

    return best;
}

function collectCoin() {
    if (!locked) return;

    const target = findTargetCoin();

    if (!target) return;

    const { level, cell } = target;

    const count = cellCounts[level][cell.index];

    if (count <= 0) return;

    if (heldCoins >= SLOT_COUNT * STACK_LIMIT) {
        showMessage("Inventar ist voll!");
        return;
    }

    const chunk = getChunkForCell(level, cell);

    if (!chunk.mesh) return;

    const localId =
        cellStarts[level][cell.index] + count - 1;

    cellCounts[level][cell.index]--;

    dummy.position.set(0, -1000, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();

    chunk.mesh.setMatrixAt(
        localId,
        dummy.matrix
    );

    chunk.mesh.instanceMatrix.needsUpdate = true;

    chunk.remaining--;

    if (chunk.remaining <= 0) {
        chunk.mesh.visible = false;
    }

    const added = addCoins(1);

    if (added !== 1) {
        cellCounts[level][cell.index]++;
        showMessage("Inventar ist voll!");
        return;
    }

    showMessage("+1 Coin");

    createPickupEffect(
        target.point.x,
        target.point.y,
        target.point.z
    );
}

// =====================================================
// SAMMELEFFEKT
// =====================================================

const particles = [];

function createPickupEffect(x, y, z) {
    for (let i = 0; i < 5; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0xffd45c
            })
        );

        particle.position.set(x, y, z);

        particle.userData.velocity =
            new THREE.Vector3(
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
    for (
        let i = particles.length - 1;
        i >= 0;
        i--
    ) {
        const p = particles[i];

        p.position.addScaledVector(
            p.userData.velocity,
            dt
        );

        p.userData.life -= dt;

        p.material.opacity = Math.max(
            0,
            p.userData.life / 0.4
        );

        p.material.transparent = true;

        if (p.userData.life <= 0) {
            scene.remove(p);

            p.geometry.dispose();
            p.material.dispose();

            particles.splice(i, 1);
        }
    }
}

// =====================================================
// TREPPENBEREICH
// =====================================================

function isInRampArea(x, z) {
    return (
        x > 6.7 &&
        x < 10.3 &&
        z > -7.5 &&
        z < 7.5
    );
}

// =====================================================
// MÜNZZÄHLER
// =====================================================

const machine = new THREE.Group();

createBox(
    2.5, 2.7, 1.7,
    darkSteel,
    0, 1.35, 0,
    machine
);

createBox(
    2.7, 0.2, 1.9,
    steel,
    0, 2.75, 0,
    machine
);

// Metallrahmen

for (const x of [-1.15, 1.15]) {
    createBox(
        0.12, 2.5, 0.12,
        steel,
        x, 1.35, 0.88,
        machine
    );
}

// Einwurfschacht

createBox(
    1.15, 0.12, 0.7,
    darkSteel,
    0, 2.9, 0,
    machine
);

// Display

const displayCanvas = document.createElement("canvas");

displayCanvas.width = 512;
displayCanvas.height = 192;

const displayContext = displayCanvas.getContext("2d");

const displayTexture =
    new THREE.CanvasTexture(displayCanvas);

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

// Display aktualisieren

function updateMachineDisplay() {
    displayContext.fillStyle = "#03140c";
    displayContext.fillRect(0, 0, 512, 192);

    displayContext.fillStyle = "#48ff9b";
    displayContext.font = "bold 27px Arial";
    displayContext.fillText(
        "COIN COUNTER",
        24,
        40
    );

    displayContext.font = "bold 58px monospace";

    displayContext.fillText(
        money.toLocaleString("de-DE"),
        24,
        112
    );

    displayContext.font = "bold 20px Arial";

    displayContext.fillText(
        "COINS COUNTED",
        24,
        155
    );

    displayTexture.needsUpdate = true;
}

updateMachineDisplay();

// Förderband

createBox(
    1.5, 0.18, 2.8,
    darkSteel,
    0, 0.95, 2.1,
    machine
);

// Förderbandstreifen

const beltStripes = [];

for (let i = 0; i < 9; i++) {
    const stripe = createBox(
        1.45, 0.035, 0.08,
        steel,
        0, 1.06, 0.9 + i * 0.3,
        machine
    );

    beltStripes.push(stripe);
}

// Rollen

const rollers = [];

for (const z of [0.8, 3.4]) {
    const roller = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.14,
            0.14,
            1.6,
            16
        ),
        steel
    );

    roller.rotation.z = Math.PI / 2;
    roller.position.set(0, 0.95, z);

    machine.add(roller);
    rollers.push(roller);
}

// Leuchtanzeigen

const machineBulb = new THREE.PointLight(
    0x3cff9b,
    3,
    6
);

machineBulb.position.set(0, 2.5, 1);
machine.add(machineBulb);

machine.position.set(
    -8,
    TOP_LAYERS * COIN_THICKNESS,
    -8
);

scene.add(machine);

// =====================================================
// NACHRICHTEN
// =====================================================

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

// =====================================================
// MÜNZEN EINZAHLEN
// =====================================================

function depositCoins() {
    const dx =
        player.position.x - machine.position.x;

    const dz =
        player.position.z - machine.position.z;

    if (Math.sqrt(dx * dx + dz * dz) > 3.5) {
        return;
    }

    const amount = inventory.reduce(
        (a, b) => a + b,
        0
    );

    if (amount <= 0) {
        showMessage("Keine Münzen zum Einzahlen!");
        return;
    }

    money += amount;
    inventory.fill(0);

    updateHUD();
    updateMachineDisplay();

    showMessage(
        "+" +
        amount.toLocaleString("de-DE") +
        " Coins eingezahlt!"
    );

    machine.scale.set(1.04, 0.94, 1.04);

    setTimeout(() => {
        machine.scale.set(1, 1, 1);
    }, 150);
}

// =====================================================
// BODENHÖHE
// =====================================================

function getGroundHeight(x, z, level) {
    const floorY = -level * FLOOR_HEIGHT;
    const cell = worldToCell(x, z);

    if (level === 0 && cell) {
        const amount =
            cellCounts[0][cell.index];

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

// =====================================================
// SPIELERBEWEGUNG UND KOLLISIONEN
// =====================================================

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

        player.position.x +=
            direction.x * player.speed * dt;

        player.position.z +=
            direction.z * player.speed * dt;
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

    // Münzstapel-Kollision

    const cell = worldToCell(
        player.position.x,
        player.position.z
    );

    let blocked = false;

    if (cell) {
        for (let floor = 0; floor < FLOOR_COUNT; floor++) {
            const amount =
                cellCounts[floor][cell.index];

            if (amount <= 0) continue;

            const bottom = -floor * FLOOR_HEIGHT;

            const top =
                bottom + amount * COIN_THICKNESS;

            const feet =
                player.position.y - player.height;

            if (
                feet < top - 0.03 &&
                player.position.y > bottom + 0.03
            ) {
                if (floor !== 0) {
                    blocked = true;
                }
            }
        }
    }

    if (blocked) {
        player.position.x = oldX;
        player.position.z = oldZ;
    }

    // Münzzähler-Kollision

    if (
        Math.abs(player.position.x + 8) < 1.65 &&
        Math.abs(player.position.z + 8) < 1.5
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

    if (
        player.position.y <= ground + player.height
    ) {
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
// INTERAKTION
// =====================================================

function updateInteraction() {
    const ui = document.getElementById("interaction");

    if (!ui) return;

    const dx =
        player.position.x - machine.position.x;

    const dz =
        player.position.z - machine.position.z;

    if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
        ui.style.display = "block";
        ui.innerHTML = "<b>[E]</b> Münzen einzahlen";

        targetCell = null;

        return;
    }

    targetCell = findTargetCoin();

    if (targetCell) {
        ui.style.display = "block";
        ui.innerHTML =
            "<b>[LINKSKLICK]</b> 1 Münze einsammeln";

        return;
    }

    ui.style.display = "none";
}

// =====================================================
// TASTEN UND MAUS
// =====================================================

document.addEventListener("keydown", e => {
    keys[e.code] = true;

    if (e.code === "KeyE" && locked) {
        depositCoins();
    }

    if (
        e.code === "Space" &&
        player.grounded
    ) {
        player.velocity.y = 6;
        player.grounded = false;
    }

    if (e.code.startsWith("Digit")) {
        const number = Number(
            e.code.replace("Digit", "")
        );

        if (number >= 1 && number <= 9) {
            selectedSlot = number - 1;
            renderInventory();
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
    if (e.button === 0 && locked) {
        collectCoin();
    }
});

document.addEventListener("contextmenu", e => {
    e.preventDefault();
});

// =====================================================
// SPIELSTART
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

    const startScreen =
        document.getElementById("startScreen");

    if (startScreen) {
        startScreen.style.display =
            locked ? "none" : "flex";
    }
});

// =====================================================
// ANIMATIONEN
// =====================================================

let lastTime = 0;
let animationTime = 0;

let visibilityTimer = 0;
let interactionTimer = 0;

function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min(
        (time - lastTime) / 1000,
        0.04
    );

    lastTime = time;
    animationTime += dt;

    if (locked) {
        updatePlayer(dt);

        visibilityTimer += dt;
        interactionTimer += dt;

        // Sichtfeldprüfung nur etwa 8-mal pro Sekunde.

        if (visibilityTimer >= 0.12) {
            visibilityTimer = 0;
            updateCoinVisibility();
        }

        // Münzsuche ebenfalls nicht in jedem Frame.

        if (interactionTimer >= 0.12) {
            interactionTimer = 0;
            updateInteraction();
        }
    }

    // Förderband bewegen

    for (let i = 0; i < beltStripes.length; i++) {
        const stripe = beltStripes[i];

        stripe.position.z =
            0.9 +
            (
                (i * 0.3 + animationTime * 0.7) %
                2.5
            );
    }

    // Rollen drehen

    for (const roller of rollers) {
        roller.rotation.x += dt * 2.5;
    }

    // Maschinenlicht pulsiert

    machineBulb.intensity =
        2.5 + Math.sin(animationTime * 3) * 0.7;

    updateParticles(dt);

    renderer.render(scene, camera);
}

// =====================================================
// START
// =====================================================

updateHUD();
updateMachineDisplay();

camera.position.copy(player.position);

updateCoinVisibility();

animate(0);

// =====================================================
// FENSTERGRÖSSE
// =====================================================

window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(innerWidth, innerHeight);
});
