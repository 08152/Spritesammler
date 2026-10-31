
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// ==========================================
// GRUNDKONFIGURATION
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171613);
scene.fog = new THREE.FogExp2(0x171613, 0.009);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    180
);

camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

document.body.appendChild(renderer.domElement);

// ==========================================
// MATERIALIEN
// ==========================================

const concrete = new THREE.MeshStandardMaterial({
    color: 0x454541,
    roughness: 0.92
});

const darkConcrete = new THREE.MeshStandardMaterial({
    color: 0x292a27,
    roughness: 0.95
});

const metal = new THREE.MeshStandardMaterial({
    color: 0x34383a,
    metalness: 0.75,
    roughness: 0.5
});

const gold = new THREE.MeshStandardMaterial({
    color: 0xe9aa20,
    metalness: 0.85,
    roughness: 0.24
});

const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe3a0,
    emissive: 0xffb943,
    emissiveIntensity: 2
});

// ==========================================
// LICHT
// ==========================================

scene.add(new THREE.AmbientLight(0xffffff, 0.42));

const mainLight = new THREE.DirectionalLight(0xffe1a5, 1.1);
mainLight.position.set(-8, 20, -5);
scene.add(mainLight);

// ==========================================
// BUNKER
// ==========================================

const bunkerWidth = 24;
const bunkerLength = 24;
const floorHeight = 8;
const floors = 7;

function createBox(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);
    return mesh;
}

// Außenwände

createBox(1, 60, 25, concrete, -12, -24, 0);
createBox(1, 60, 25, concrete, 12, -24, 0);
createBox(24, 60, 1, concrete, 0, -24, -12);
createBox(24, 60, 1, concrete, 0, -24, 12);

// Oberste Decke

createBox(24, 1, 24, darkConcrete, 0, 5, 0);

// ==========================================
// ETAGEN
// ==========================================

const walkableSurfaces = [];

for (let i = 0; i < floors; i++) {

    const y = -i * floorHeight;

    const floor = createBox(
        23,
        0.7,
        23,
        darkConcrete,
        0,
        y - 0.35,
        0
    );

    walkableSurfaces.push(floor);

    // Wandstreifen und Metallkonstruktionen

    for (let x = -10; x <= 10; x += 5) {
        createBox(
            0.15, 7.8, 0.15,
            metal,
            x, y + 3.5, -11.35
        );
    }

    // Wandlampen auf jeder Etage

    for (const side of [-1, 1]) {

        for (const z of [-8, 0, 8]) {

            const lampX = side * 11.35;
            const lampY = y + 3.5;

            createBox(
                0.25, 0.65, 0.45,
                metal,
                lampX, lampY, z
            );

            const bulb = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.35, 0.28),
                lightMaterial
            );

            bulb.position.set(
                lampX - side * 0.2,
                lampY,
                z
            );

            scene.add(bulb);

            const lampLight = new THREE.PointLight(
                0xffc96b,
                95,
                14,
                2
            );

            lampLight.position.set(
                lampX - side * 0.7,
                lampY,
                z
            );

            scene.add(lampLight);
        }
    }
}

// ==========================================
// MÜNZEN
// ==========================================

const coinGeometry = new THREE.CylinderGeometry(
    0.19,
    0.19,
    0.055,
    20
);

const coinMeshes = [];

function random(min, max) {
    return min + Math.random() * (max - min);
}

for (let level = 0; level < floors; level++) {

    const floorY = -level * floorHeight;

    const coinCount = 1150;

    const coins = new THREE.InstancedMesh(
        coinGeometry,
        gold,
        coinCount
    );

    const dummy = new THREE.Object3D();

    for (let i = 0; i < coinCount; i++) {

        const x = random(-10.5, 10.5);
        const z = random(-10.5, 10.5);

        // Freier Bereich für die Treppe

        if (x > 6.1 && x < 10.5) {
            // Coins werden später neu positioniert.
            // Der Treppenbereich bleibt begehbar.
        }

        let height = 0;

        // Mehrere große Münzhaufen

        const piles = [
            [-5, -5, 2.5, 3.5],
            [0, -5, 2.0, 3.5],
            [-5, 3, 2.4, 3.0],
            [1, 4, 2.0, 3.0],
            [4, -2, 1.7, 3.0]
        ];

        for (const pile of piles) {

            const dx = x - pile[0];
            const dz = z - pile[1];

            const distance = Math.sqrt(dx * dx + dz * dz);

            const mound = Math.max(
                0,
                1 - distance / pile[3]
            );

            height = Math.max(
                height,
                mound * pile[2]
            );
        }

        // Keine Münzen direkt auf dem Treppenweg

        if (x > 6.1 && x < 10.5) {
            height = 0;
        }

        const coinY = floorY + 0.12 +
            height * random(0.65, 1.0);

        dummy.position.set(x, coinY, z);

        dummy.rotation.set(
            random(-0.12, 0.12),
            random(0, Math.PI),
            random(-0.12, 0.12)
        );

        const scale = random(0.85, 1.15);
        dummy.scale.set(scale, 1, scale);

        dummy.updateMatrix();
        coins.setMatrixAt(i, dummy.matrix);
    }

    coins.instanceMatrix.needsUpdate = true;
    coins.castShadow = true;
    coins.receiveShadow = true;

    scene.add(coins);
    coinMeshes.push(coins);
}

// ==========================================
// TREPPE - 7 ETAGEN
// ==========================================

const stairMaterial = new THREE.MeshStandardMaterial({
    color: 0x494a47,
    metalness: 0.45,
    roughness: 0.7
});

for (let level = 0; level < floors - 1; level++) {

    const startY = -level * floorHeight;

    const direction = level % 2 === 0 ? 1 : -1;
    const startZ = direction === 1 ? -7 : 7;

    const stepCount = 24;

    for (let s = 0; s <= stepCount; s++) {

        const progress = s / stepCount;

        const z = startZ + direction * progress * 14;
        const y = startY - progress * floorHeight;

        const step = createBox(
            3.2,
            0.45,
            0.72,
            stairMaterial,
            8.5,
            y - 0.22,
            z
        );

        walkableSurfaces.push(step);
    }

    // Treppengeländer

    for (const side of [-1, 1]) {

        createBox(
            0.12,
            0.7,
            14,
            metal,
            8.5 + side * 1.65,
            startY - 4,
            0
        );
    }
}

// ==========================================
// ZUSÄTZLICHE MÜNZHAUFEN
// ==========================================

function createCoinPile(x, y, z, amount) {

    const pile = new THREE.Group();

    for (let i = 0; i < amount; i++) {

        const coin = new THREE.Mesh(
            coinGeometry,
            gold
        );

        const angle = random(0, Math.PI * 2);
        const radius = random(0, 1.7);
        const height = random(0, 1.8);

        coin.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );

        coin.rotation.y = random(0, Math.PI);
        coin.castShadow = true;

        pile.add(coin);
    }

    pile.position.set(x, y, z);
    scene.add(pile);
}

// Große Münzstapel auf jeder Etage

for (let i = 0; i < floors; i++) {

    const y = -i * floorHeight;

    createCoinPile(-7, y, 7, 30);
    createCoinPile(3, y, -8, 25);
    createCoinPile(-2, y, 0, 35);
}

// ==========================================
// SPIELER
// ==========================================

const player = {
    x: 0,
    y: 1.7,
    z: 0,
    velocityY: 0,
    speed: 6,
    grounded: false
};

let yaw = 0;
let pitch = 0;

const keys = {};

document.addEventListener("keydown", e => {
    keys[e.code] = true;
});

document.addEventListener("keyup", e => {
    keys[e.code] = false;
});

document.addEventListener("mousemove", e => {

    if (document.pointerLockElement !== renderer.domElement) {
        return;
    }

    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;

    pitch = THREE.MathUtils.clamp(
        pitch,
        -Math.PI / 2.1,
        Math.PI / 2.1
    );
});

// ==========================================
// START
// ==========================================

const startScreen = document.getElementById("startScreen");

document.getElementById("startButton").addEventListener("click", () => {

    renderer.domElement.requestPointerLock();

    startScreen.style.display = "none";
});

document.addEventListener("pointerlockchange", () => {

    if (document.pointerLockElement !== renderer.domElement) {
        startScreen.style.display = "flex";
    } else {
        startScreen.style.display = "none";
    }
});

// ==========================================
// BEWEGUNG UND TREPPENKOLLISION
// ==========================================

const groundRay = new THREE.Raycaster();

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

    if (keys["KeyW"] || keys["ArrowUp"]) {
        movement.add(forward);
    }

    if (keys["KeyS"] || keys["ArrowDown"]) {
        movement.sub(forward);
    }

    if (keys["KeyD"] || keys["ArrowRight"]) {
        movement.add(right);
    }

    if (keys["KeyA"] || keys["ArrowLeft"]) {
        movement.sub(right);
    }

    if (movement.lengthSq() > 0) {

        movement.normalize();

        player.x += movement.x * player.speed * delta;
        player.z += movement.z * player.speed * delta;
    }

    // Bunkergrenzen

    player.x = THREE.MathUtils.clamp(player.x, -10.5, 10.5);
    player.z = THREE.MathUtils.clamp(player.z, -10.5, 10.5);

    // Springen

    if (keys["Space"] && player.grounded) {
        player.velocityY = 5.5;
        player.grounded = false;
    }

    // Schwerkraft

    player.velocityY -= 13 * delta;
    player.y += player.velocityY * delta;

    // Boden- und Treppenerkennung

    groundRay.set(
        new THREE.Vector3(player.x, player.y + 1.5, player.z),
        new THREE.Vector3(0, -1, 0)
    );

    groundRay.far = 3;

    const hits = groundRay.intersectObjects(
        walkableSurfaces,
        false
    );

    if (hits.length > 0) {

        const groundY = hits[0].point.y;

        if (
            player.velocityY <= 0 &&
            groundY <= player.y + 0.15 &&
            groundY >= player.y - 0.65
        ) {

            player.y = groundY;
            player.velocityY = 0;
            player.grounded = true;

        } else if (groundY < player.y - 0.65) {
            player.grounded = false;
        }

    } else {
        player.grounded = false;
    }

    // Nicht durch den untersten Boden fallen

    player.y = Math.max(player.y, -48 + 1.7);

    camera.position.set(
        player.x,
        player.y,
        player.z
    );

    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
}

// ==========================================
// FENSTERGRÖSSE
// ==========================================

window.addEventListener("resize", () => {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});

// ==========================================
// GAME LOOP
// ==========================================

const clock = new THREE.Clock();

function animate() {

    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.04);

    if (document.pointerLockElement === renderer.domElement) {
        updatePlayer(delta);
    }

    renderer.render(scene, camera);
}

animate();
