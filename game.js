import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js";

// =====================================================
// RAPier INITIALISIEREN
// =====================================================

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
const MAX_ACTIVE_BODIES = 1200;

const PHYSICS_RADIUS = 7;
const MAX_CHUNK_LOADS = 2;

const TOTAL_COINS =
    6 * GRID_SIZE * GRID_SIZE * LOWER_LAYERS +
    GRID_SIZE * GRID_SIZE * TOP_LAYERS;

// =====================================================
// THREE.JS
// =====================================================

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

document.body.appendChild(renderer.domElement);

// =====================================================
// RAPier PHYSIK
// =====================================================

const gravity = { x: 0, y: -9.81, z: 0 };

const world = new RAPIER.World(gravity);

world.timestep = 1 / 60;

const eventQueue = new RAPIER.EventQueue(true);

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
    color: 0x596164,
    metalness: 0.75,
    roughness: 0.4
});

const goldSide = new THREE.MeshStandardMaterial({
    color: 0xd99a19,
    metalness: 0.9,
    roughness: 0.22
});

const coinCanvas = document.createElement("canvas");
coinCanvas.width = 128;
coinCanvas.height = 128;

const coinCtx = coinCanvas.getContext("2d");

coinCtx.fillStyle = "#e9b83c";
coinCtx.fillRect(0, 0, 128, 128);

coinCtx.strokeStyle = "#fff0a0";
coinCtx.lineWidth = 4;
coinCtx.beginPath();
coinCtx.arc(64, 64, 54, 0, Math.PI * 2);
coinCtx.stroke();

coinCtx.fillStyle = "#98620b";
coinCtx.font = "bold 46px Arial";
coinCtx.textAlign = "center";
coinCtx.textBaseline = "middle";
coinCtx.fillText("1", 64, 64);

const coinTexture = new THREE.CanvasTexture(coinCanvas);
coinTexture.colorSpace = THREE.SRGBColorSpace;

const coinFace = new THREE.MeshStandardMaterial({
    map: coinTexture,
    metalness: 0.8,
    roughness: 0.24
});

const coinGeometry = new THREE.CylinderGeometry(
    COIN_RADIUS,
    COIN_RADIUS,
    COIN_THICKNESS,
    12
);

// =====================================================
// LICHT
// =====================================================

scene.add(new THREE.HemisphereLight(
    0xc6d2dc,
    0x29231b,
    0.75
));

const mainLight = new THREE.DirectionalLight(
    0xffe4b7,
    1.2
);

mainLight.position.set(-8, 20, 5);
mainLight.castShadow = false;

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
// FESTE PHYSIKBÖDEN
// =====================================================

function createPhysicsFloor(x, y, z, w, h, d) {
    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
            .setTranslation(x, y, z)
    );

    const collider = RAPIER.ColliderDesc.cuboid(
        w / 2,
        h / 2,
        d / 2
    );

    world.createCollider(collider, body);

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

    // Ein durchgehender Boden mit seitlicher Treppenöffnung.

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

    // Beleuchtung

    for (const side of [-1, 1]) {
        for (const z of [-8, 0, 8]) {
            const light = new THREE.PointLight(
                0xffc978,
                35,
                12
            );

            light.position.set(
                side * 10.8,
                y + 3.5,
                z
            );

            scene.add(light);
        }
    }
}

// =====================================================
// TREPPE - 32 EINZELNE STUFEN
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

        const step = box(
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

const chunkLookup = [];

function cellIndex(x, z) {
    return z * GRID_SIZE + x;
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

function getCellPosition(ix, iz) {
    return {
        x: -11 + (ix + 0.5) * CELL_SIZE,
        z: -11 + (iz + 0.5) * CELL_SIZE
    };
}

for (let level = 0; level < FLOOR_COUNT; level++) {
    const layers = level === 0
        ? TOP_LAYERS
        : LOWER_LAYERS;

    const counts = new Uint8Array(
        GRID_SIZE * GRID_SIZE
    );

    counts.fill(layers);

    const ids = new Uint16Array(
        GRID_SIZE * GRID_SIZE
    );

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
                coins: [],
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
        moneyUI.textContent =
            money.toLocaleString("de-DE");
    }

    if (heldUI) {
        heldUI.textContent =
            held.toLocaleString("de-DE");
    }

    const progress = money + held;

    const progressText =
        document.getElementById("progressText");

    const progressFill =
        document.getElementById("progressFill");

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
                ${amount > 0 ? "🪙" : ""}
                <small>${amount || ""}</small>
            `;

            ui.appendChild(slot);
        });
    }
}

// =====================================================
// PHYSIK-MÜNZEN
// =====================================================

// Jede aktive Münze besitzt einen eigenen Rapier-Körper
// und eine eigene Kollisionsform.

const activeCoins = new Map();

let nextCoinId = 1;

const tempObject = new THREE.Object3D();

function createPhysicsCoin(x, y, z, chunk, localId) {
    if (activeCoins.size >= MAX_ACTIVE_BODIES) {
        return null;
    }

    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setLinearDamping(0.35)
            .setAngularDamping(0.55)
            .setCanSleep(true)
    );

    const collider = RAPIER.ColliderDesc.cylinder(
        COIN_THICKNESS / 2,
        COIN_RADIUS
    )
        .setDensity(7)
        .setFriction(0.8)
        .setRestitution(0.08);

    world.createCollider(collider, body);

    const id = nextCoinId++;

    const coin = {
        id,
        body,
        chunk,
        localId,
        frozen: false
    };

    activeCoins.set(id, coin);

    return coin;
}

// =====================================================
// MÜNZEN-CHUNK ERSTELLEN
// =====================================================

function loadChunk(chunk) {
    if (chunk.mesh) return;

    const level = chunk.level;

    const layers = level === 0
        ? TOP_LAYERS
        : LOWER_LAYERS;

    const capacity =
        CHUNK_SIZE * CHUNK_SIZE * layers;

    const mesh = new THREE.InstancedMesh(
        coinGeometry,
        [goldSide, coinFace],
        capacity
    );

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const floorY = -level * FLOOR_HEIGHT;

    let index = 0;

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
                const y =
                    floorY +
                    COIN_THICKNESS * (layer + 0.5);

                tempObject.position.set(pos.x, y, pos.z);
                tempObject.rotation.set(0, 0, 0);
                tempObject.updateMatrix();

                mesh.setMatrixAt(index, tempObject.matrix);

                chunk.coins.push({
                    localId: index,
                    x: pos.x,
                    y,
                    z: pos.z,
                    body: null,
                    collected: false
                });

                index++;
            }
        }
    }

    mesh.instanceMatrix.needsUpdate = true;

    scene.add(mesh);

    chunk.mesh = mesh;
}

// =====================================================
// PHYSIK AKTIVIEREN
// =====================================================

function activateNearbyCoins() {
    const radiusSq = PHYSICS_RADIUS * PHYSICS_RADIUS;

    for (const floorChunks of chunks) {
        for (const chunk of floorChunks) {
            if (!chunk.mesh) continue;

            for (const coin of chunk.coins) {
                if (coin.collected) continue;
                if (coin.body) continue;

                const dx = coin.x - player.position.x;
                const dy = coin.y - player.position.y;
                const dz = coin.z - player.position.z;

                if (
                    dx * dx + dy * dy + dz * dz >
                    radiusSq
                ) continue;

                const physicsCoin = createPhysicsCoin(
                    coin.x,
                    coin.y,
                    coin.z,
                    chunk,
                    coin.localId
                );

                if (!physicsCoin) return;

                coin.body = physicsCoin;
            }
        }
    }
}

// =====================================================
// PHYSIK PAUSIEREN
// =====================================================

function freezeCoin(coin) {
    if (!coin.body) return;

    const body = coin.body.body;

    const p = body.translation();
    const r = body.rotation();

    coin.x = p.x;
    coin.y = p.y;
    coin.z = p.z;

    coin.rotation = {
        x: r.x,
        y: r.y,
        z: r.z,
        w: r.w
    };

    world.removeRigidBody(body);

    activeCoins.delete(coin.body.id);

    coin.body = null;
}

// =====================================================
// PHYSIK-UPDATE
// =====================================================

function updateCoinPhysics() {
    world.step(eventQueue);

    for (const floorChunks of chunks) {
        for (const chunk of floorChunks) {
            if (!chunk.mesh) continue;

            for (const coin of chunk.coins) {
                if (coin.collected) continue;

                let x = coin.x;
                let y = coin.y;
                let z = coin.z;

                let rotation = null;

                if (coin.body) {
                    const body = coin.body.body;

                    const p = body.translation();
                    const r = body.rotation();

                    x = p.x;
                    y = p.y;
                    z = p.z;

                    rotation = r;

                    coin.x = x;
                    coin.y = y;
                    coin.z = z;
                }

                tempObject.position.set(x, y, z);

                if (rotation) {
                    tempObject.quaternion.set(
                        rotation.x,
                        rotation.y,
                        rotation.z,
                        rotation.w
                    );
                } else if (coin.rotation) {
                    tempObject.quaternion.set(
                        coin.rotation.x,
                        coin.rotation.y,
                        coin.rotation.z,
                        coin.rotation.w
                    );
                } else {
                    tempObject.quaternion.identity();
                }

                tempObject.updateMatrix();

                chunk.mesh.setMatrixAt(
                    coin.localId,
                    tempObject.matrix
                );
            }

            chunk.mesh.instanceMatrix.needsUpdate = true;
        }
    }
}

// =====================================================
// SICHTFELD
// =====================================================

const frustum = new THREE.Frustum();
const viewProjection = new THREE.Matrix4();

function getCurrentFloor() {
    return clamp(
        Math.round(
            (1.7 - player.position.y) / FLOOR_HEIGHT
        ),
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

                    // Physik der nicht sichtbaren Münzen einfrieren.
                    for (const coin of chunk.coins) {
                        if (coin.body) {
                            freezeCoin(coin);
                        }
                    }
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

    // Alte Chunks entfernen

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
                scene.remove(chunk.mesh);

                for (const coin of chunk.coins) {
                    if (coin.body) freezeCoin(coin);
                }

                chunk.mesh.geometry.dispose();
                chunk.mesh = null;
                chunk.coins = [];
            });
    }
}

// =====================================================
// MÜNZEN EINSAMMELN
// =====================================================

function collectCoin() {
    if (!locked) return;

    const raycaster = new THREE.Raycaster();

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

    const chunk = chunks.flat().find(
        c => c.mesh === hit.object
    );

    if (!chunk) return;

    const coin = chunk.coins[hit.instanceId];

    if (!coin || coin.collected) return;

    if (getHeldCoins() >= 15 * STACK_LIMIT) {
        showMessage("Inventar voll!");
        return;
    }

    coin.collected = true;

    if (coin.body) {
        freezeCoin(coin);
    }

    const matrix = new THREE.Matrix4();

    matrix.makeScale(0, 0, 0);

    chunk.mesh.setMatrixAt(
        coin.localId,
        matrix
    );

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

conveyorBox(
    1.8, 0.3, 3.5,
    steel,
    0, 0, 0
);

conveyorBox(
    1.5, 0.12, 3.3,
    darkSteel,
    0, 0.2, 0
);

conveyor.position.set(-8, 1, -5);

const beltCoins = [];

const beltCoinGeometry = new THREE.CylinderGeometry(
    0.16,
    0.16,
    0.07,
    16
);

function spawnBeltCoin() {
    if (beltCoins.length >= 25) {
        const old = beltCoins.shift();

        scene.remove(old.mesh);
        world.removeRigidBody(old.body);

        old.mesh.geometry.dispose();
    }

    const x = -8 + rand(-0.45, 0.45);
    const y = 1.55;
    const z = -6.2;

    const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setLinearDamping(0.1)
            .setAngularDamping(0.15)
    );

    world.createCollider(
        RAPIER.ColliderDesc.cylinder(
            0.035,
            0.16
        )
            .setDensity(7)
            .setFriction(0.65)
            .setRestitution(0.12),
        body
    );

    const mesh = new THREE.Mesh(
        beltCoinGeometry,
        [goldSide, coinFace]
    );

    mesh.position.set(x, y, z);

    scene.add(mesh);

    // Das Förderband gibt der Münze Bewegung.

    body.setLinvel(
        {
            x: 0,
            y: 0.2,
            z: 2.5
        },
        true
    );

    body.setAngvel(
        {
            x: rand(-1, 1),
            y: rand(-2, 2),
            z: rand(-1, 1)
        },
        true
    );

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

        if (coin.age > 4 || p.z > -1) {
            scene.remove(coin.mesh);
            world.removeRigidBody(coin.body);

            beltCoins.splice(i, 1);
        }
    }
}

// =====================================================
// MÜNZEN EINZAHLEN
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

let depositTimer = 0;
let depositAmount = 0;

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

    depositAmount = Math.min(amount, 25);
    depositTimer = 0;

    // Münzen sichtbar auf das Förderband legen.

    for (let i = 0; i < depositAmount; i++) {
        setTimeout(() => {
            spawnBeltCoin();
        }, i * 90);
    }

    updateHUD();

    showMessage(
        amount.toLocaleString("de-DE") +
        " Coins eingezahlt!"
    );
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

    // Boden und Treppe

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
// EINGABEN
// =====================================================

document.addEventListener("keydown", e => {
    keys[e.code] = true;

    if (e.code === "Space" && player.grounded) {
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
});

// =====================================================
// PHYSIK UND SICHTFELD ZEITPLAN
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

        if (activationTimer >= 0.2) {
            activationTimer = 0;
            activateNearbyCoins();
        }

        if (physicsTimer >= 1 / 60) {
            physicsTimer = 0;

            updateCoinPhysics();
        }
    }

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
