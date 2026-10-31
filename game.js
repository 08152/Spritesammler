
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// =============================================
// KONFIGURATION
// =============================================

const TOTAL_COINS = 1000000;
const COINS_PER_OBJECT = 100;
const OBJECT_COUNT = TOTAL_COINS / COINS_PER_OBJECT;
const SLOT_COUNT = 15;
const STACK_LIMIT = 9999;
const FLOOR_HEIGHT = 8;
const FLOOR_COUNT = 7;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171715);
scene.fog = new THREE.FogExp2(0x171715, 0.008);

const camera = new THREE.PerspectiveCamera(
    75,
    innerWidth / innerHeight,
    0.1,
    160
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

document.body.appendChild(renderer.domElement);

// =============================================
// MATERIALIEN
// =============================================

const concrete = new THREE.MeshStandardMaterial({
    color: 0x51504b,
    roughness: 0.92
});

const floorMat = new THREE.MeshStandardMaterial({
    color: 0x30312e,
    roughness: 0.9
});

const steel = new THREE.MeshStandardMaterial({
    color: 0x42494c,
    metalness: 0.8,
    roughness: 0.45
});

const gold = new THREE.MeshStandardMaterial({
    color: 0xe8ad29,
    metalness: 0.85,
    roughness: 0.22
});

const dark = new THREE.MeshStandardMaterial({
    color: 0x171a1b,
    metalness: 0.5,
    roughness: 0.7
});

const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe6b0,
    emissive: 0xffbd52,
    emissiveIntensity: 2
});

// =============================================
// LICHT
// =============================================

scene.add(new THREE.HemisphereLight(
    0xb8c5d2,
    0x30251a,
    0.55
));

const mainLight = new THREE.DirectionalLight(0xffe1b1, 1.0);
mainLight.position.set(-8, 20, 5);
scene.add(mainLight);

// =============================================
// HILFSFUNKTIONEN
// =============================================

function box(w, h, d, material, x, y, z, cast = true) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    scene.add(mesh);

    return mesh;
}

function pointLight(x, y, z, intensity = 65, distance = 13) {
    const light = new THREE.PointLight(
        0xffc979,
        intensity,
        distance,
        2
    );

    light.position.set(x, y, z);
    scene.add(light);
}

// =============================================
// BUNKERWÄNDE
// =============================================

box(1, 60, 25, concrete, -12, -24, 0);
box(1, 60, 25, concrete, 12, -24, 0);
box(24, 60, 1, concrete, 0, -24, -12);
box(24, 60, 1, concrete, 0, -24, 12);

box(24, 1, 24, floorMat, 0, 5, 0);

// =============================================
// ETAGEN MIT TREPPENÖFFNUNG
// =============================================

const floors = [];

for (let level = 0; level < FLOOR_COUNT; level++) {

    const y = -level * FLOOR_HEIGHT;

    // Der Schacht für die Treppe bleibt frei.

    box(12, 0.7, 23, floorMat, -5.5, y - 0.35, 0);
    box(5, 0.7, 23, floorMat, -3.5, y - 0.35, 0);
    box(5, 0.7, 23, floorMat, 9.5, y - 0.35, 0);

    floors.push(y);

    // Wandverstärkungen

    for (let z = -9; z <= 9; z += 3) {
        box(0.15, 7.7, 0.15, steel, -11.3, y + 3.5, z);
        box(0.15, 7.7, 0.15, steel, 11.3, y + 3.5, z);
    }

    // Beleuchtung

    for (const side of [-1, 1]) {
        for (const z of [-8, 0, 8]) {

            const x = side * 11.35;

            box(0.25, 0.7, 0.45, steel, x, y + 3.5, z);

            const bulb = box(
                0.12, 0.35, 0.28,
                lampMat,
                x - side * 0.18,
                y + 3.5,
                z,
                false
            );

            pointLight(x - side * 0.7, y + 3.5, z, 60, 14);
        }
    }

    // Rohre an der Wand

    box(0.25, 7, 0.25, steel, -10.7, y + 3.5, -10.3);
    box(0.25, 7, 0.25, steel, 10.7, y + 3.5, -10.3);
}

// =============================================
// TREPPE
// =============================================

const stairMat = new THREE.MeshStandardMaterial({
    color: 0x555b5d,
    metalness: 0.65,
    roughness: 0.6
});

const stairColliders = [];

for (let level = 0; level < FLOOR_COUNT - 1; level++) {

    const topY = -level * FLOOR_HEIGHT;
    const direction = level % 2 === 0 ? 1 : -1;
    const startZ = direction === 1 ? -7 : 7;

    for (let i = 0; i < 32; i++) {

        const t = i / 32;
        const z = startZ + direction * t * 14;
        const y = topY - t * FLOOR_HEIGHT;

        const step = box(
            3.4, 0.25, 0.5,
            stairMat,
            8.5,
            y - 0.12,
            z
        );

        stairColliders.push(step);
    }

    // Geländer

    for (const side of [-1, 1]) {

        box(
            0.12, 0.7, 14,
            steel,
            8.5 + side * 1.8,
            topY - 4,
            0
        );
    }
}

// =============================================
// WEITERE GEGENSTÄNDE
// =============================================

// Kisten

const crateMat = new THREE.MeshStandardMaterial({
    color: 0x55412c,
    roughness: 0.9
});

for (let i = 0; i < 14; i++) {

    const x = i % 2 === 0 ? -9 : 3;
    const z = -9 + (i % 7) * 2.5;
    const y = -Math.floor(i / 2) * FLOOR_HEIGHT;

    box(1.5, 1.4, 1.5, crateMat, x, y + 0.7, z);
    box(1.55, 0.12, 0.12, steel, x, y + 0.7, z - 0.76);
}

// Große Rohrleitungen

for (let level = 0; level < FLOOR_COUNT; level++) {

    const y = -level * FLOOR_HEIGHT + 5.8;

    const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 21, 12),
        steel
    );

    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, y, -10.7);

    scene.add(pipe);
}

// =============================================
// MÜNZHAUFEN - DEKORATION
// =============================================

const decorativeCoins = [];

function createPile(x, y, z, amount) {

    const group = new THREE.Group();

    for (let i = 0; i < amount; i++) {

        const coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 0.045, 12),
            gold
        );

        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.6;

        coin.position.set(
            Math.cos(a) * r,
            Math.random() * 1.5,
            Math.sin(a) * r
        );

        coin.rotation.y = Math.random() * Math.PI;
        group.add(coin);
    }

    group.position.set(x, y, z);
    scene.add(group);
    decorativeCoins.push(group);
}

for (let level = 0; level < FLOOR_COUNT; level++) {

    const y = -level * FLOOR_HEIGHT;

    createPile(-7, y, -5, 35);
    createPile(-4, y, 5, 35);
    createPile(1, y, -6, 35);
    createPile(3, y, 5, 35);
}

// =============================================
// 1.000.000 MÜNZEN
// =============================================

// 10.000 Instanzen statt 1 Million einzelner Meshes.
// Jedes Objekt repräsentiert 100 Münzen.

const coinGeometry = new THREE.CylinderGeometry(
    0.19, 0.19, 0.055, 12
);

const coinMesh = new THREE.InstancedMesh(
    coinGeometry,
    gold,
    OBJECT_COUNT
);

coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
coinMesh.castShadow = false;
coinMesh.receiveShadow = false;

const coinDummy = new THREE.Object3D();
const coinPositions = [];
const coinCollected = new Uint8Array(OBJECT_COUNT);

function random(min, max) {
    return min + Math.random() * (max - min);
}

let coinIndex = 0;

for (let level = 0; level < FLOOR_COUNT; level++) {

    const baseY = -level * FLOOR_HEIGHT;

    for (let i = 0; i < OBJECT_COUNT / FLOOR_COUNT; i++) {

        if (coinIndex >= OBJECT_COUNT) break;

        let x = random(-10, 10);
        let z = random(-10, 10);

        // Freie Laufwege und Treppe

        if (x > 6.2) x = random(-10, 5.8);

        if (Math.abs(x) < 1.5 && Math.abs(z) < 1.5) {
            z += 3;
        }

        const y = baseY + 0.12;

        coinPositions.push(new THREE.Vector3(x, y, z));

        coinDummy.position.set(x, y, z);
        coinDummy.rotation.set(
            random(-0.08, 0.08),
            random(0, Math.PI),
            random(-0.08, 0.08)
        );

        coinDummy.updateMatrix();

        coinMesh.setMatrixAt(coinIndex, coinDummy.matrix);
        coinIndex++;
    }
}

coinMesh.count = coinIndex;
coinMesh.instanceMatrix.needsUpdate = true;
scene.add(coinMesh);

// =============================================
// MÜNZZÄHLER
// =============================================

const machine = new THREE.Group();

const machineBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 2.6, 1.5),
    dark
);

machineBase.position.y = 1.3;
machine.add(machineBase);

const machineTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.18, 1.7),
    steel
);

machineTop.position.y = 2.65;
machine.add(machineTop);

// Einwurfschacht

const opening = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.15, 0.8),
    new THREE.MeshStandardMaterial({
        color: 0x080808,
        metalness: 0.6
    })
);

opening.position.set(0, 2.77, 0);
machine.add(opening);

// Display

const displayMat = new THREE.MeshStandardMaterial({
    color: 0x06140d,
    emissive: 0x0c9c48,
    emissiveIntensity: 0.6
});

const display = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.55, 0.08),
    displayMat
);

display.position.set(0, 2.05, 0.79);
machine.add(display);

const machineLight = new THREE.PointLight(0x40ff9b, 4, 5);
machineLight.position.set(0, 2.3, 1);
machine.add(machineLight);

machine.position.set(-8, 0, 8);
scene.add(machine);

// =============================================
// SPIELER UND INVENTAR
// =============================================

const player = {
    position: new THREE.Vector3(0, 1.7, 0),
    velocity: new THREE.Vector3(),
    grounded: false,
    speed: 5.5,
    radius: 0.32,
    height: 1.7
};

let yaw = 0;
let pitch = 0;

const keys = {};
let locked = false;

const inventory = Array.from(
    { length: SLOT_COUNT },
    () => 0
);

let selectedSlot = 0;
let money = 0;
let heldCoins = 0;

const raycaster = new THREE.Raycaster();
raycaster.far = 3.5;

const downRay = new THREE.Raycaster();

const tmpVector = new THREE.Vector3();

// =============================================
// INVENTAR-UI
// =============================================

const inventoryUI = document.getElementById("inventory");

function renderInventory() {

    inventoryUI.innerHTML = "";

    inventory.forEach((amount, index) => {

        const slot = document.createElement("div");

        slot.className =
            "slot" + (index === selectedSlot ? " active" : "");

        slot.innerHTML = `
            <span class="slot-number">${index + 1}</span>
            ${amount > 0 ? "🪙" : ""}
            <span class="slot-count">${amount || ""}</span>
        `;

        inventoryUI.appendChild(slot);
    });
}

function updateHUD() {

    heldCoins = inventory.reduce((a, b) => a + b, 0);

    document.getElementById("money").textContent =
        money.toLocaleString("de-DE");

    document.getElementById("held").textContent =
        heldCoins.toLocaleString("de-DE");

    const total = money + heldCoins;

    document.getElementById("progressText").textContent =
        total.toLocaleString("de-DE") + " / 1.000.000";

    document.getElementById("progressFill").style.width =
        (total / TOTAL_COINS * 100) + "%";

    renderInventory();
}

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

// =============================================
// INTERAKTION UND MÜNZEN AUFHEBEN
// =============================================

let targetCoin = null;
let messageTimeout;

function showMessage(text) {

    const el = document.getElementById("message");

    el.textContent = text;
    el.style.opacity = "1";

    clearTimeout(messageTimeout);

    messageTimeout = setTimeout(() => {
        el.style.opacity = "0";
    }, 1600);
}

function getLookTarget() {

    camera.updateMatrixWorld();

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    return raycaster.intersectObject(coinMesh, false)[0] || null;
}

function collectCoin() {

    if (!targetCoin) return;

    const id = targetCoin.instanceId;

    if (id === undefined || coinCollected[id]) return;

    const pos = coinPositions[id];

    if (camera.position.distanceTo(pos) > 3.5) return;

    const added = addCoins(COINS_PER_OBJECT);

    if (added <= 0) {
        showMessage("Inventar ist voll!");
        return;
    }

    coinCollected[id] = 1;

    coinDummy.position.set(0, -1000, 0);
    coinDummy.scale.set(0, 0, 0);
    coinDummy.updateMatrix();

    coinMesh.setMatrixAt(id, coinDummy.matrix);
    coinMesh.instanceMatrix.needsUpdate = true;

    targetCoin = null;
}

// =============================================
// MÜNZEN ABGEBEN
// =============================================

function depositCoins() {

    const distance = player.position.distanceTo(
        new THREE.Vector3(-8, player.position.y, 8)
    );

    if (distance > 3.5) return;

    const amount = inventory.reduce((a, b) => a + b, 0);

    if (amount <= 0) {
        showMessage("Du hast keine Münzen dabei!");
        return;
    }

    money += amount;

    inventory.fill(0);

    updateHUD();

    showMessage(
        "+" + amount.toLocaleString("de-DE") + " Coins eingezahlt!"
    );

    // Zählmaschinen-Animation

    machine.scale.y = 0.92;

    setTimeout(() => {
        machine.scale.y = 1;
    }, 180);
}

// =============================================
// TASTEN
// =============================================

document.addEventListener("keydown", e => {

    keys[e.code] = true;

    if (e.code === "KeyE" && locked) {

        const distance = player.position.distanceTo(
            new THREE.Vector3(-8, player.position.y, 8)
        );

        if (distance < 3.5) {
            depositCoins();
        } else {
            collectCoin();
        }
    }

    if (e.code.startsWith("Digit")) {

        const n = Number(e.code.replace("Digit", ""));

        if (n >= 1 && n <= SLOT_COUNT) {
            selectedSlot = n - 1;
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

    pitch = THREE.MathUtils.clamp(
        pitch,
        -1.5,
        1.5
    );
});

// =============================================
// SPIELSTART
// =============================================

document.getElementById("startButton").addEventListener(
    "click",
    () => {
        renderer.domElement.requestPointerLock();
    }
);

document.addEventListener("pointerlockchange", () => {

    locked = document.pointerLockElement === renderer.domElement;

    document.getElementById("startScreen").style.display =
        locked ? "none" : "flex";
});

// =============================================
// PHYSIK UND HITBOXEN
// =============================================

function getFloorHeight(x, z) {

    // Etagenböden haben eine Treppenöffnung.
    // Außerhalb der Öffnung bleibt der Spieler auf der Etage.

    for (let level = 0; level < FLOOR_COUNT; level++) {

        const y = -level * FLOOR_HEIGHT;

        const inStairwell =
            x > 6.3 && x < 10.6 &&
            z > -11.4 && z < 11.4;

        if (!inStairwell) {
            if (player.position.y >= y - 0.1) {
                return y;
            }
        }
    }

    return -48;
}

function getGround() {

    downRay.set(
        new THREE.Vector3(
            player.position.x,
            player.position.y + 0.3,
            player.position.z
        ),
        new THREE.Vector3(0, -1, 0)
    );

    downRay.far = 3;

    const surfaces = [
        ...stairColliders
    ];

    const hits = downRay.intersectObjects(
        surfaces,
        false
    );

    let result = getFloorHeight(
        player.position.x,
        player.position.z
    );

    if (hits.length > 0) {
        result = Math.max(result, hits[0].point.y);
    }

    return result;
}

function resolveMovement(oldX, oldZ) {

    const radius = player.radius;

    // Außenwände

    player.position.x = THREE.MathUtils.clamp(
        player.position.x,
        -11 + radius,
        11 - radius
    );

    player.position.z = THREE.MathUtils.clamp(
        player.position.z,
        -11 + radius,
        11 - radius
    );

    // Kisten-Kollisionen

    for (let i = 0; i < 14; i++) {

        const x = i % 2 === 0 ? -9 : 3;
        const z = -9 + (i % 7) * 2.5;
        const y = -Math.floor(i / 2) * FLOOR_HEIGHT;

        if (Math.abs(player.position.y - y) > 2.5) continue;

        if (
            Math.abs(player.position.x - x) < 1.1 &&
            Math.abs(player.position.z - z) < 1.1
        ) {

            player.position.x = oldX;
            player.position.z = oldZ;
        }
    }

    // Münzzähler-Kollision

    if (
        Math.abs(player.position.x + 8) < 1.7 &&
        Math.abs(player.position.z - 8) < 1.3
    ) {
        player.position.x = oldX;
        player.position.z = oldZ;
    }
}

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

    resolveMovement(oldX, oldZ);

    // Schwerkraft

    player.velocity.y -= 18 * dt;
    player.position.y += player.velocity.y * dt;

    const ground = getGround() + player.height;

    if (player.position.y <= ground) {

        player.position.y = ground;
        player.velocity.y = 0;
        player.grounded = true;

    } else {
        player.grounded = false;
    }

    // Springen

    if (keys.Space && player.grounded) {

        player.velocity.y = 6;
        player.grounded = false;
    }

    camera.position.copy(player.position);

    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

// =============================================
// INTERAKTIONSANZEIGE
// =============================================

function updateInteraction() {

    const ui = document.getElementById("interaction");

    const distance = player.position.distanceTo(
        new THREE.Vector3(-8, player.position.y, 8)
    );

    if (distance < 3.5) {

        ui.style.display = "block";
        ui.innerHTML = "<b>[E]</b> Münzen einzahlen";

        targetCoin = null;
        return;
    }

    const hit = getLookTarget();

    targetCoin = null;

    if (hit && hit.instanceId !== undefined) {

        const id = hit.instanceId;

        if (
            !coinCollected[id] &&
            player.position.distanceTo(coinPositions[id]) < 3.5
        ) {
            targetCoin = hit;

            ui.style.display = "block";
            ui.innerHTML = "<b>[E]</b> Münzen aufheben (100 Coins)";
            return;
        }
    }

    ui.style.display = "none";
}

// =============================================
// ANIMATION
// =============================================

let lastTime = 0;

function animate(time) {

    requestAnimationFrame(animate);

    const dt = Math.min((time - lastTime) / 1000, 0.04);
    lastTime = time;

    if (locked) {
        updatePlayer(dt);
        updateInteraction();
    }

    renderer.render(scene, camera);
}

renderInventory();
updateHUD();

animate(0);

// =============================================
// RESIZE
// =============================================

window.addEventListener("resize", () => {

    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(innerWidth, innerHeight);
});
