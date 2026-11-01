
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

import { CoinFactory } from "./coin.js";
import { BunkerSystem } from "./bunker.js";
import { PhysicsSystem } from "./physik.js";
import { createStaircase } from "./treppe.js";
import { BunkerLighting } from "./Licht.js";
import { CoinPickupSystem } from "./heben.js";
import { CoinCountingMachine } from "./maschine.js";

// ======================================================
// ONE MILLION COINS
// ======================================================

const CONFIG = {
    floors: 7,
    floorHeight: 8,
    bunkerSize: 24,

    coinsPerFloor: 100,

    coinRadius: 0.188,
    coinThickness: 0.035,

    inventorySlots: 15,
    stackLimit: 9999,

    playerSpeed: 4.5,
    playerHeight: 1.7,

    machinePosition: {
        x: -8,
        y: 0,
        z: -5
    },

    stairPosition: {
        x: 8.5,
        z: -7
    }
};

// ======================================================
// HTML-ELEMENTE
// ======================================================

const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");

const moneyElement = document.getElementById("money");
const heldElement = document.getElementById("held");

const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");

const inventoryElement = document.getElementById("inventory");
const interactionElement = document.getElementById("interaction");
const messageElement = document.getElementById("message");
const hintElement = document.getElementById("hint");

if (
    !startScreen ||
    !startButton ||
    !inventoryElement
) {
    throw new Error(
        "HTML-Elemente fehlen. Bitte game.html überprüfen."
    );
}

// ======================================================
// THREE.JS
// ======================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x15191c);
scene.fog = new THREE.FogExp2(0x15191c, 0.003);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    250
);

camera.position.set(0, CONFIG.playerHeight, 8);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.5)
);

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

renderer.shadowMap.enabled = false;

renderer.domElement.style.position = "fixed";
renderer.domElement.style.inset = "0";
renderer.domElement.style.zIndex = "0";

document.body.appendChild(renderer.domElement);

// HUD über dem Canvas halten
const hud = document.getElementById("hud");

if (hud) {
    hud.style.zIndex = "2";
}

startScreen.style.zIndex = "10";

// ======================================================
// SPIELSTATUS
// ======================================================

let ready = false;
let gameStarted = false;
let locked = false;

let currentFloor = 0;
let money = 0;

let yaw = 0;
let pitch = 0;

const keys = {};

const clock = new THREE.Clock();

let messageTimeout = null;

// ======================================================
// NACHRICHTEN
// ======================================================

function showMessage(text) {
    if (!messageElement) return;

    messageElement.textContent = text;
    messageElement.style.opacity = "1";

    clearTimeout(messageTimeout);

    messageTimeout = setTimeout(() => {
        messageElement.style.opacity = "0";
    }, 2200);
}

// ======================================================
// INVENTAR
// ======================================================

function getInventoryCount() {
    return pickupSystem?.getInventoryCount() ?? 0;
}

function getInventoryValue() {
    return pickupSystem?.getInventoryValue() ?? 0;
}

function updateInventory() {
    const count = getInventoryCount();

    if (heldElement) {
        heldElement.textContent =
            count.toLocaleString("de-DE");
    }

    inventoryElement.innerHTML = "";

    const inventory = pickupSystem?.getInventory() ?? [];

    for (let slotIndex = 0; slotIndex < CONFIG.inventorySlots; slotIndex++) {
        const start = slotIndex * CONFIG.stackLimit;

        const amount = Math.max(
            0,
            Math.min(
                CONFIG.stackLimit,
                inventory.length - start
            )
        );

        const slot = document.createElement("div");

        slot.className =
            "slot" + (slotIndex === 0 ? " active" : "");

        slot.innerHTML = `
            <span class="slot-number">${slotIndex + 1}</span>
            <span>●</span>
            <span class="slot-count">
                ${amount > 0 ? amount.toLocaleString("de-DE") : ""}
            </span>
        `;

        inventoryElement.appendChild(slot);
    }
}

// ======================================================
// GELD UND FORTSCHRITT
// ======================================================

function updateMoney() {
    if (moneyElement) {
        moneyElement.textContent =
            money.toLocaleString("de-DE");
    }

    if (progressText) {
        progressText.textContent =
            `${money.toLocaleString("de-DE")} / 1.000.000`;
    }

    if (progressFill) {
        const percentage = Math.min(
            100,
            money / 1000000 * 100
        );

        progressFill.style.width =
            percentage + "%";
    }
}

// ======================================================
// STARTBUTTON
// ======================================================

startButton.addEventListener("click", () => {
    if (!ready) {
        showMessage("Das Spiel lädt noch ...");
        return;
    }

    if (gameStarted) return;

    gameStarted = true;

    startScreen.style.display = "none";

    showMessage("Willkommen im Bunker!");

    renderer.domElement.requestPointerLock();
});

// ======================================================
// MAUSSTEUERUNG
// ======================================================

document.addEventListener("pointerlockchange", () => {
    locked =
        document.pointerLockElement === renderer.domElement;
});

document.addEventListener("mousemove", event => {
    if (!locked || !gameStarted) return;

    yaw -= event.movementX * 0.002;
    pitch -= event.movementY * 0.002;

    pitch = THREE.MathUtils.clamp(
        pitch,
        -1.5,
        1.5
    );

    camera.rotation.set(
        pitch,
        yaw,
        0,
        "YXZ"
    );
});

// Erneut ins Spielfeld klicken, falls Pointer Lock verloren geht
renderer.domElement.addEventListener("click", () => {
    if (gameStarted && !locked) {
        renderer.domElement.requestPointerLock();
    }
});

// ======================================================
// TASTEN
// ======================================================

document.addEventListener("keydown", event => {
    keys[event.code] = true;

    if (!gameStarted || !ready || event.repeat) return;

    if (event.code === "KeyQ") {
        if (pickupSystem.handleKeyDown(event)) {
            updateInventory();
        }
    }

    if (event.code === "KeyE") {
        depositCoins();
    }

    if (event.code === "KeyF") {
        useStairs();
    }
});

document.addEventListener("keyup", event => {
    keys[event.code] = false;
});

document.addEventListener("contextmenu", event => {
    event.preventDefault();
});

// ======================================================
// MÜNZEN AUFHEBEN
// ======================================================

document.addEventListener("mousedown", event => {
    if (!gameStarted || !locked) return;

    if (event.button !== 0) return;

    const maximumCoins =
        CONFIG.inventorySlots * CONFIG.stackLimit;

    if (getInventoryCount() >= maximumCoins) {
        showMessage("Inventar ist voll!");
        return;
    }

    const collected =
        pickupSystem.handlePointerDown(event);

    if (collected) {
        updateInventory();
        showMessage("+1 Münze");
    }
});

// ======================================================
// SPIELINITIALISIERUNG
// ======================================================

let physics;
let bunker;
let staircase;
let lighting;
let coinFactory;
let pickupSystem;
let machine;

async function initializeGame() {

    // --------------------------------------------------
    // PHYSIK
    // --------------------------------------------------

    physics = new PhysicsSystem({
        gravity: -9.81,
        maxBodies: 5000
    });

    await physics.init();

    // --------------------------------------------------
    // BUNKER
    // --------------------------------------------------

    bunker = new BunkerSystem(
        scene,
        physics,
        {
            floorCount: CONFIG.floors,
            floorHeight: CONFIG.floorHeight,

            width: CONFIG.bunkerSize,
            depth: CONFIG.bunkerSize,

            createPhysics: true,
            createWallDetails: true,
            createFloorDetails: true,
            createCeilingDetails: true,
            createPillarDetails: true
        }
    );

    // --------------------------------------------------
    // TREPPEN
    // --------------------------------------------------

    staircase = createStaircase(
        scene,
        {
            floors: CONFIG.floors,
            floorHeight: CONFIG.floorHeight,

            physics: physics,
            createPhysics: false
        }
    );

    // --------------------------------------------------
    // BELEUCHTUNG
    // --------------------------------------------------

    lighting = new BunkerLighting(
        scene,
        {
            floors: CONFIG.floors,
            floorHeight: CONFIG.floorHeight,
            floorSize: CONFIG.bunkerSize,

            color: 0xffd39a,
            intensity: 2.2,

            enableFlicker: true
        }
    );

    // --------------------------------------------------
    // MÜNZENFABRIK
    // --------------------------------------------------

    coinFactory = new CoinFactory({
        radius: CONFIG.coinRadius,
        thickness: CONFIG.coinThickness,
        detailLevel: 64
    });

    // --------------------------------------------------
    // AUFHEBESYSTEM
    // --------------------------------------------------

    pickupSystem = new CoinPickupSystem(
        scene,
        camera,
        physics,
        {
            maxDistance: 3.5,

            dropDistance: 1.1,
            dropHeight: -0.35,

            coinRadius: CONFIG.coinRadius,
            coinThickness: CONFIG.coinThickness,

            onInventoryChange: () => {
                updateInventory();
            }
        }
    );

    // --------------------------------------------------
    // MÜNZZÄHLMASCHINE
    // --------------------------------------------------

    machine = new CoinCountingMachine(
        scene,
        physics,
        {
            position: CONFIG.machinePosition,

            scale: 1,

            maxQueuedCoins: 5000,
            maxActiveCoins: 100
        }
    );

    // --------------------------------------------------
    // MÜNZEN IN ALLEN ETAGEN
    // --------------------------------------------------

    createCoinFloors();

    updateInventory();
    updateMoney();

    console.log("ONE MILLION COINS: Alle Systeme geladen.");

    ready = true;
}

// ======================================================
// MÜNZEN ERSTELLEN
// ======================================================

function createCoinFloors() {

    const dummy = new THREE.Object3D();

    for (
        let floor = 0;
        floor < CONFIG.floors;
        floor++
    ) {

        const count = CONFIG.coinsPerFloor;

        const mesh = coinFactory.createInstancedMesh(
            count,
            {
                name: `Coins_Floor_${floor + 1}`
            }
        );

        const floorY =
            floor * CONFIG.floorHeight;

        for (let i = 0; i < count; i++) {

            let x;
            let z;

            // Münzen zufällig im Bunker verteilen
            do {
                x = THREE.MathUtils.randFloat(-10, 10);
                z = THREE.MathUtils.randFloat(-10, 10);

            } while (
                floor === 0 &&
                Math.hypot(
                    x - CONFIG.machinePosition.x,
                    z - CONFIG.machinePosition.z
                ) < 2.5
            );

            const position = {
                x,
                y: floorY + 0.08,
                z
            };

            const rotation = new THREE.Euler(
                -Math.PI / 2,
                0,
                Math.random() * Math.PI * 2
            );

            const quaternion =
                new THREE.Quaternion().setFromEuler(rotation);

            coinFactory.updateInstancedMesh(
                mesh,
                i,
                position,
                quaternion,
                1
            );
        }

        coinFactory.commitInstancedMesh(mesh);

        scene.add(mesh);

        pickupSystem.registerInstancedMesh(
            mesh,
            {
                valuePerCoin: 1,

                radius: CONFIG.coinRadius,
                thickness: CONFIG.coinThickness
            }
        );
    }
}

// ======================================================
// SPIELERBEWEGUNG
// ======================================================

function updatePlayer(delta) {

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

    if (keys["KeyW"]) movement.add(forward);
    if (keys["KeyS"]) movement.sub(forward);

    if (keys["KeyD"]) movement.add(right);
    if (keys["KeyA"]) movement.sub(right);

    if (movement.lengthSq() > 0) {
        movement.normalize();

        camera.position.addScaledVector(
            movement,
            CONFIG.playerSpeed * delta
        );
    }

    // Bunkergrenzen
    camera.position.x = THREE.MathUtils.clamp(
        camera.position.x,
        -11.1,
        11.1
    );

    camera.position.z = THREE.MathUtils.clamp(
        camera.position.z,
        -11.1,
        11.1
    );

    // Aktuelle Etagenhöhe
    camera.position.y =
        currentFloor * CONFIG.floorHeight +
        CONFIG.playerHeight;
}

// ======================================================
// TREPPEN BENUTZEN
// ======================================================

function useStairs() {

    const dx =
        camera.position.x - CONFIG.stairPosition.x;

    const dz =
        camera.position.z - CONFIG.stairPosition.z;

    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 2.5) {
        showMessage("Gehe zum Treppenhaus!");
        return;
    }

    if (currentFloor >= CONFIG.floors - 1) {
        currentFloor = 0;
    } else {
        currentFloor++;
    }

    camera.position.set(
        CONFIG.stairPosition.x,
        currentFloor * CONFIG.floorHeight +
            CONFIG.playerHeight,
        CONFIG.stairPosition.z
    );

    showMessage(
        `Etage ${currentFloor + 1} von ${CONFIG.floors}`
    );
}

// ======================================================
// MASCHINE UND EINZAHLUNG
// ======================================================

function isNearMachine() {

    if (currentFloor !== 0) return false;

    const dx =
        camera.position.x - CONFIG.machinePosition.x;

    const dz =
        camera.position.z - CONFIG.machinePosition.z;

    return Math.hypot(dx, dz) < 4;
}

function depositCoins() {

    if (!isNearMachine()) {
        showMessage("Gehe zum Münzzähler!");
        return;
    }

    const amount = getInventoryCount();

    if (amount <= 0) {
        showMessage("Du hast keine Münzen!");
        return;
    }

    // Münzen in die Maschine geben
    const accepted = machine.addCoins(amount, 1);

    if (accepted <= 0) {
        showMessage("Die Maschine ist voll!");
        return;
    }

    // Münzen aus dem Inventar entfernen
    pickupSystem.takeCoinsForMachine(accepted);

    money += accepted;

    updateInventory();
    updateMoney();

    showMessage(
        `${accepted.toLocaleString("de-DE")} Münzen eingezahlt!`
    );

    // Maschinenanimation
    machine.group.scale.set(
        1.04,
        0.96,
        1.04
    );

    setTimeout(() => {
        machine.group.scale.setScalar(1);
    }, 180);
}

// ======================================================
// INTERAKTIONSANZEIGE
// ======================================================

function updateInteraction() {

    if (!gameStarted) return;

    if (isNearMachine()) {

        interactionElement.style.display = "block";

        interactionElement.innerHTML =
            "<b>E</b> – Münzen einzahlen";

        return;
    }

    const dx =
        camera.position.x - CONFIG.stairPosition.x;

    const dz =
        camera.position.z - CONFIG.stairPosition.z;

    if (Math.hypot(dx, dz) < 2.5) {

        interactionElement.style.display = "block";

        interactionElement.innerHTML =
            "<b>F</b> – Nächste Etage";

        return;
    }

    interactionElement.style.display = "none";
}

// ======================================================
// PHYSIK-MÜNZEN AKTUALISIEREN
// ======================================================

function updateDroppedCoins() {

    if (!pickupSystem || !physics) return;

    for (const coin of pickupSystem.coins.values()) {

        if (
            !coin.physicsCoin ||
            !coin.physicsCoin.active ||
            !coin.mesh
        ) {
            continue;
        }

        const transform =
            physics.getTransform(coin.physicsCoin);

        if (!transform) continue;

        coin.mesh.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z
        );

        coin.mesh.quaternion.set(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z,
            transform.rotation.w
        );
    }
}

// ======================================================
// ANIMATION
// ======================================================

function animate() {

    requestAnimationFrame(animate);

    const delta = Math.min(
        clock.getDelta(),
        0.05
    );

    if (ready) {

        if (gameStarted) {

            updatePlayer(delta);

            physics.update(delta);

            updateDroppedCoins();

            pickupSystem.update(delta);

            updateInteraction();
        }

        machine.update(delta);

        lighting.update(clock.elapsedTime);
    }

    renderer.render(scene, camera);
}

// ======================================================
// FENSTERGRÖSSE
// ======================================================

window.addEventListener("resize", () => {

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});

// ======================================================
// START
// ======================================================

async function start() {

    try {

        await initializeGame();

        if (hintElement) {
            hintElement.textContent =
                "WASD · Laufen | Maus · Umschauen | Linksklick · Aufheben | Q · Ablegen | E · Einzahlen | F · Etage";
        }

        animate();

    } catch (error) {

        console.error(
            "ONE MILLION COINS konnte nicht geladen werden:",
            error
        );

        showMessage("Fehler beim Laden – Konsole überprüfen.");

        throw error;
    }
}

start();
