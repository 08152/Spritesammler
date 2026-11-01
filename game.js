
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// =====================================================
// KONFIGURATION
// =====================================================

const TOTAL_COINS = 1_000_000;
const FLOOR_COUNT = 7;
const FLOOR_HEIGHT = 8;

const GRID_SIZE = 200;
const CELL_SIZE = 0.1;
const WORLD_SIZE = GRID_SIZE * CELL_SIZE;

const LOWER_COINS_PER_CELL = 4;
const TOP_COINS_PER_CELL = 2;

const SLOT_COUNT = 15;
const STACK_LIMIT = 9999;

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

// Geprägte Münzoberfläche

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
    0.047,
    0.047,
    0.025,
    20
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
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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

// Etagenböden mit Treppenöffnung

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

    // Wandverstärkungen

    for (let z = -9; z <= 9; z += 3) {
        createBox(0.16, 7.5, 0.16, steel, -11.3, y + 3.5, z);
        createBox(0.16, 7.5, 0.16, steel, 11.3, y + 3.5, z);
    }

    // Lampen

    for (const side of [-1, 1]) {
        for (const z of [-8, 0, 8]) {
            const x = side * 11.3;

            createBox(0.25, 0.65, 0.5, steel, x, y + 3.5, z);

            const bulb = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.35, 0.28),
                new THREE.MeshStandardMaterial({
                    color: 0xffe2a5,
                    emissive: 0xffb83d,
                    emissiveIntensity: 2
                })
            );

            bulb.position.set(x - side * 0.18, y + 3.5, z);
            scene.add(bulb);

            addPointLight(x - side * 0.7, y + 3.5, z, 48, 13);
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
// TREPPEN
// =====================================================

// Breite Rampen statt unzuverlässiger einzelner Stufen.
// Die Stufenoptik liegt auf einer stabilen Schräge.

const ramps = [];

const rampMaterial = new THREE.MeshStandardMaterial({
    color: 0x50595a,
    metalness: 0.75,
    roughness: 0.48
});

const rampAngle = Math.atan(8 / 14);

for (let level = 0; level < FLOOR_COUNT - 1; level++) {
    const topY = -level * FLOOR_HEIGHT;

    const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.35, 16),
        rampMaterial
    );

    ramp.position.set(8.5, topY - 4, 0);
    ramp.rotation.x = rampAngle;
    ramp.castShadow = true;
    ramp.receiveShadow = true;

    scene.add(ramp);
    ramps.push(ramp);

    // Stufenstreifen

    for (let i = 0; i < 28; i++) {
        const z = -6.7 + i * 0.49;
        const y = topY - ((z + 7) / 14) * 8;

        const strip = createBox(
            3.45,
            0.07,
            0.12,
            steel,
            8.5,
            y + 0.12,
            z
        );
    }

    // Geländer

    for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.13, 0.75, 14),
            steel
        );

        rail.position.set(
            8.5 + side * 1.85,
            topY - 4,
            0
        );

        rail.rotation.x = rampAngle;
        scene.add(rail);
    }
}

// =====================================================
// MÜNZEN: EXAKT 1.000.000 EINZELNE COINS
// =====================================================

// Untere Etagen:
// 6 Etagen x 40.000 Felder x 4 Münzen = 960.000
//
// Oberste Etage:
// 20.000 Felder x 2 Münzen = 40.000
//
// Gesamt: genau 1.000.000 Münzen.

const coinMesh = new THREE.InstancedMesh(
    coinGeometry,
    [goldSide, coinFace],
    TOTAL_COINS
);

coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
coinMesh.castShadow = false;
coinMesh.receiveShadow = false;

const dummy = new THREE.Object3D();

const cellCounts = [];
const cellStarts = [];

let coinID = 0;

function cellIndex(x, z) {
    return z * GRID_SIZE + x;
}

function getCellWorld(ix, iz) {
    return {
        x: -10 + (ix + 0.5) * CELL_SIZE,
        z: -10 + (iz + 0.5) * CELL_SIZE
    };
}

// Die Landefläche am Ende der Treppe bleibt frei.
// Die Münzen werden dafür auf andere Felder verteilt.

function isLandingPad(ix, iz) {
    return (
        ix >= 179 && ix <= 191 &&
        iz >= 164 && iz <= 176
    );
}

for (let level = 0; level < FLOOR_COUNT; level++) {
    const counts = new Uint8Array(GRID_SIZE * GRID_SIZE);
    const starts = new Uint32Array(GRID_SIZE * GRID_SIZE);

    const floorY = -level * FLOOR_HEIGHT;

    for (let iz = 0; iz < GRID_SIZE; iz++) {
        for (let ix = 0; ix < GRID_SIZE; ix++) {
            const cell = cellIndex(ix, iz);

            let amount = 0;

            if (level === 0) {
                // Oben nur die hintere Hälfte.
                if (iz >= 100) {
                    amount = TOP_COINS_PER_CELL;
                }
            } else {
                // Alle unteren Etagen komplett gefüllt.
                amount = LOWER_COINS_PER_CELL;

                // Kleine freie Landefläche am Treppenende.
                if (isLandingPad(ix, iz)) {
                    amount = 0;
                }

                // Die entfernten Münzen werden anderswo gestapelt.
                if (
                    ix >= 20 && ix < 33 &&
                    iz >= 20 && iz < 33
                ) {
                    amount += 4;
                }
            }

            counts[cell] = amount;
            starts[cell] = coinID;

            const pos = getCellWorld(ix, iz);

            for (let layer = 0; layer < amount; layer++) {
                dummy.position.set(
                    pos.x,
                    floorY + 0.02 + layer * 0.027,
                    pos.z
                );

                dummy.rotation.set(
                    0,
                    random(0, Math.PI * 2),
                    0
                );

                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();

                coinMesh.setMatrixAt(coinID, dummy.matrix);
                coinID++;
            }
        }
    }

    cellCounts.push(counts);
    cellStarts.push(starts);
}

if (coinID !== TOTAL_COINS) {
    console.error("Münzanzahl stimmt nicht:", coinID);
}

coinMesh.count = coinID;
coinMesh.instanceMatrix.needsUpdate = true;
scene.add(coinMesh);

// =====================================================
// MÜNZEN-LOGIK
// =====================================================

function getCurrentFloor() {
    return clamp(
        Math.floor((1.7 - player.position.y) / FLOOR_HEIGHT),
        0,
        FLOOR_COUNT - 1
    );
}

function worldToCell(x, z) {
    const ix = Math.floor((x + 10) / CELL_SIZE);
    const iz = Math.floor((z + 10) / CELL_SIZE);

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

function getCoinPosition(id) {
    // Die Positionen werden nicht zusätzlich gespeichert.
    // Die InstancedMesh-Matrix enthält sie bereits.
    const matrix = new THREE.Matrix4();
    coinMesh.getMatrixAt(id, matrix);

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);

    return position;
}

// =====================================================
// SPIELER UND INVENTAR
// =====================================================

const player = {
    position: new THREE.Vector3(0, 1.7, -6),
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

const inventory = Array.from(
    { length: SLOT_COUNT },
    () => 0
);

let money = 0;
let selectedSlot = 0;
let heldCoins = 0;

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

function renderInventory() {
    const ui = document.getElementById("inventory");
    if (!ui) return;

    ui.innerHTML = "";

    inventory.forEach((amount, index) => {
        const slot = document.createElement("div");

        slot.className =
            "slot" + (index === selectedSlot ? " active" : "");

        slot.innerHTML = `
            <span class="slot-number">${index + 1}</span>
            ${amount > 0 ? "🪙" : ""}
            <span class="slot-count">${amount || ""}</span>
        `;

        ui.appendChild(slot);
    });
}

function updateHUD() {
    heldCoins = inventory.reduce((a, b) => a + b, 0);

    const moneyUI = document.getElementById("money");
    const heldUI = document.getElementById("held");
    const progressText = document.getElementById("progressText");
    const progressFill = document.getElementById("progressFill");

    if (moneyUI) {
        moneyUI.textContent = money.toLocaleString("de-DE");
    }

    if (heldUI) {
        heldUI.textContent = heldCoins.toLocaleString("de-DE");
    }

    const total = money + heldCoins;

    if (progressText) {
        progressText.textContent =
            total.toLocaleString("de-DE") + " / 1.000.000";
    }

    if (progressFill) {
        progressFill.style.width =
            (total / TOTAL_COINS * 100) + "%";
    }

    renderInventory();
}

// =====================================================
// MÜNZEN EINSAMMELN MIT LINKSKLICK
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

    const level = getCurrentFloor();
    const floorY = -level * FLOOR_HEIGHT;

    const maxLayers = level === 0 ? 2 : 8;

    // Von der obersten sichtbaren Münzschicht nach unten suchen.

    for (let layer = maxLayers - 1; layer >= 0; layer--) {
        const planeY = floorY + 0.02 + layer * 0.027;

        horizontalPlane.constant = -planeY;

        const point = new THREE.Vector3();

        const hit = raycaster.ray.intersectPlane(
            horizontalPlane,
            point
        );

        if (!hit) continue;

        const cell = worldToCell(point.x, point.z);
        if (!cell) continue;

        const count = cellCounts[level][cell.index];

        // Nur die oberste Münze des Stapels ist anklickbar.
        if (count !== layer + 1) continue;

        if (camera.position.distanceTo(point) > 3.5) {
            continue;
        }

        return {
            level,
            cell,
            point,
            layer
        };
    }

    return null;
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

    const id =
        cellStarts[level][cell.index] + count - 1;

    // Genau eine Münze entfernen.

    cellCounts[level][cell.index]--;

    dummy.position.set(0, -1000, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();

    coinMesh.setMatrixAt(id, dummy.matrix);
    coinMesh.instanceMatrix.needsUpdate = true;

    const added = addCoins(1);

    if (added !== 1) {
        // Sollte bei vollem Inventar nicht passieren.
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
// TREPPEN FREILEGEN
// =====================================================

// Der Treppenweg muss freigeräumt werden.
// Es gibt keine automatische Abkürzung nach unten.

function isStairPathClear(level) {
    const counts = cellCounts[level];

    const startZ = level === 0 ? 100 : 30;
    const endZ = 170;

    for (let iz = startZ; iz <= endZ; iz++) {
        for (let ix = 181; ix <= 188; ix++) {
            const index = cellIndex(ix, iz);

            if (counts[index] > 0) {
                return false;
            }
        }
    }

    return true;
}

function isInRampArea(x, z) {
    return (
        x > 6.7 && x < 10.3 &&
        z > -7.5 && z < 7.5
    );
}

// =====================================================
// MÜNZZÄHLER
// =====================================================

const machine = new THREE.Group();

const machineBody = createBox(
    2.5, 2.7, 1.7,
    darkSteel,
    0, 1.35, 0,
    machine
);

const machineTop = createBox(
    2.7, 0.2, 1.9,
    steel,
    0, 2.75, 0,
    machine
);

// Metallrahmen

for (const x of [-1.15, 1.15]) {
    createBox(0.12, 2.5, 0.12, steel, x, 1.35, 0.88, machine);
}

// Einwurfschacht

const slot = createBox(
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

// Display aktualisieren

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

// Förderband

const belt = createBox(
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
        new THREE.CylinderGeometry(0.14, 0.14, 1.6, 16),
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

machine.position.set(-8, 0, -8);
scene.add(machine);

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
    }, 1500);
}

function depositCoins() {
    const dx = player.position.x - machine.position.x;
    const dz = player.position.z - machine.position.z;

    if (Math.sqrt(dx * dx + dz * dz) > 3.5) {
        return;
    }

    const amount = inventory.reduce((a, b) => a + b, 0);

    if (amount <= 0) {
        showMessage("Keine Münzen zum Einzahlen!");
        return;
    }

    money += amount;
    inventory.fill(0);

    updateHUD();
    updateMachineDisplay();

    showMessage(
        "+" + amount.toLocaleString("de-DE") + " Coins eingezahlt!"
    );

    machine.scale.set(1.04, 0.94, 1.04);

    setTimeout(() => {
        machine.scale.set(1, 1, 1);
    }, 150);
}

// =====================================================
// BEWEGUNG UND KOLLISIONEN
// =====================================================

function getGroundHeight(x, z, level) {
    const floorY = -level * FLOOR_HEIGHT;

    if (isInRampArea(x, z)) {
        return floorY - ((z + 7) / 14) * FLOOR_HEIGHT;
    }

    return floorY;
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

    let level = getCurrentFloor();

    // Rampen dürfen nur benutzt werden,
    // wenn der komplette Weg freigeräumt ist.

    if (
        isInRampArea(player.position.x, player.position.z) &&
        !isStairPathClear(level)
    ) {
        player.position.x = oldX;
        player.position.z = oldZ;
    }

    level = getCurrentFloor();

    // Münzen blockieren den Weg.
    // Du musst sie mit Linksklick entfernen.

    const cell = worldToCell(
        player.position.x,
        player.position.z
    );

    if (cell) {
        const inRamp = isInRampArea(
            player.position.x,
            player.position.z
        );

        if (
            cellCounts[level][cell.index] > 0 &&
            !inRamp
        ) {
            player.position.x = oldX;
            player.position.z = oldZ;
        }
    }

    // Münzzähler-Kollision

    if (
        Math.abs(player.position.x + 8) < 1.65 &&
        Math.abs(player.position.z + 8) < 1.5
    ) {
        player.position.x = oldX;
        player.position.z = oldZ;
    }

    // Boden und Treppenphysik

    level = getCurrentFloor();

    const ground = getGroundHeight(
        player.position.x,
        player.position.z,
        level
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
}

// =====================================================
// INTERAKTION
// =====================================================

function updateInteraction() {
    const ui = document.getElementById("interaction");
    if (!ui) return;

    const dx = player.position.x - machine.position.x;
    const dz = player.position.z - machine.position.z;

    if (Math.sqrt(dx * dx + dz * dz) < 3.5) {
        ui.style.display = "block";
        ui.innerHTML = "<b>[E]</b> Münzen einzahlen";
        targetCell = null;
        return;
    }

    targetCell = findTargetCoin();

    if (targetCell) {
        ui.style.display = "block";
        ui.innerHTML = "<b>[LINKSKLICK]</b> 1 Münze einsammeln";
        return;
    }

    const level = getCurrentFloor();

    if (
        isInRampArea(player.position.x, player.position.z) &&
        !isStairPathClear(level)
    ) {
        ui.style.display = "block";
        ui.innerHTML = "Treppenweg ist noch voller Münzen!";
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

    if (e.code === "Space" && player.grounded) {
        player.velocity.y = 6;
        player.grounded = false;
    }

    if (e.code.startsWith("Digit")) {
        const number = Number(e.code.replace("Digit", ""));

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

    const startScreen = document.getElementById("startScreen");

    if (startScreen) {
        startScreen.style.display = locked ? "none" : "flex";
    }
});

// =====================================================
// ANIMATIONEN
// =====================================================

let lastTime = 0;
let animationTime = 0;

function animate(time) {
    requestAnimationFrame(animate);

    const dt = Math.min((time - lastTime) / 1000, 0.04);
    lastTime = time;

    animationTime += dt;

    if (locked) {
        updatePlayer(dt);
        updateInteraction();
    }

    // Förderband bewegt sich

    for (let i = 0; i < beltStripes.length; i++) {
        const stripe = beltStripes[i];

        stripe.position.z =
            0.9 + ((i * 0.3 + animationTime * 0.7) % 2.5);
    }

    // Rollen drehen sich

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

animate(0);

// =====================================================
// FENSTERGRÖSSE
// =====================================================

window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(innerWidth, innerHeight);
});
