
import * as RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js";

export class PhysicsSystem {

    constructor(options = {}) {

        this.gravity = options.gravity ?? -9.81;

        this.maxBodies = options.maxBodies ?? 350;

        this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
        this.maxSubSteps = options.maxSubSteps ?? 8;
        this.maxFrameTime = options.maxFrameTime ?? 0.1;

        this.accumulator = 0;
        this.elapsed = 0;

        this.world = null;
        this.eventQueue = null;

        this.initialized = false;
        this.initializing = null;

        this.nextId = 1;

        this.bodies = new Map();
        this.coins = new Map();
        this.coinPiles = new Map();
        this.staticBodies = new Set();

        this.stats = {
            steps: 0,
            activeBodies: 0,
            totalCoins: 0,
            pileColliders: 0,
            droppedTime: 0
        };

        this.defaultCoinOptions = {
            radius: 0.188,
            thickness: 0.1,
            density: 2.5,
            friction: 0.95,
            restitution: 0.02
        };
    }

    // --------------------------------------------------
    // INITIALISIERUNG
    // --------------------------------------------------

    async init() {

        if (this.initialized) return true;

        if (this.initializing) {
            return this.initializing;
        }

        this.initializing = (async () => {

            await RAPIER.init();

            this.world = new RAPIER.World({
                x: 0,
                y: this.gravity,
                z: 0
            });

            this.eventQueue = new RAPIER.EventQueue(true);

            const parameters = this.world.integrationParameters;

            if (parameters) {
                parameters.numSolverIterations = 16;
                parameters.numInternalPgsIterations = 4;
            }

            this.world.timestep = this.fixedTimeStep;

            this.initialized = true;

            return true;

        })();

        try {
            return await this.initializing;
        } finally {
            this.initializing = null;
        }
    }

    ensureInitialized() {

        if (!this.initialized || !this.world) {
            throw new Error(
                "PhysicsSystem wurde noch nicht initialisiert. Zuerst await physics.init() aufrufen."
            );
        }
    }

    // --------------------------------------------------
    // HILFSFUNKTIONEN
    // --------------------------------------------------

    createId() {
        return this.nextId++;
    }

    vector(value = {}) {

        return {
            x: Number.isFinite(value.x) ? value.x : 0,
            y: Number.isFinite(value.y) ? value.y : 0,
            z: Number.isFinite(value.z) ? value.z : 0
        };
    }

    validNumber(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }

    getActiveCount() {
        return this.coins.size;
    }

    getCoinCount() {
        return this.coins.size;
    }

    getTotalBodyCount() {
        return this.bodies.size;
    }

    getStats() {

        this.stats.activeBodies = this.coins.size;
        this.stats.totalCoins = this.coins.size;
        this.stats.pileColliders = this.coinPiles.size;

        return { ...this.stats };
    }

    // --------------------------------------------------
    // DYNAMISCHE MÜNZEN
    // --------------------------------------------------

    createCoin(position, options = {}) {

        this.ensureInitialized();

        if (this.coins.size >= this.maxBodies) {
            return null;
        }

        const pos = this.vector(position);

        const settings = {
            ...this.defaultCoinOptions,
            ...options
        };

        const radius = Math.max(0.01, settings.radius);
        const thickness = Math.max(0.01, settings.thickness);

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setLinearDamping(options.linearDamping ?? 0.35)
            .setAngularDamping(options.angularDamping ?? 0.65)
            .setCanSleep(true)
            .setCcdEnabled(true);

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(
            thickness / 2,
            radius
        )
            .setDensity(settings.density)
            .setFriction(settings.friction)
            .setRestitution(settings.restitution)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

        const collider = this.world.createCollider(
            colliderDesc,
            body
        );

        const coin = {
            id: this.createId(),
            body,
            collider,
            active: true,
            savedState: null,
            radius,
            thickness,
            options: settings,
            lastPlayerPush: 0
        };

        this.coins.set(coin.id, coin);
        this.bodies.set(coin.id, coin);

        return coin;
    }

    createFlowCoin(position, options = {}) {

        const coin = this.createCoin(position, {
            ...options,
            linearDamping: 0.08,
            angularDamping: 0.15,
            restitution: 0.04
        });

        if (coin) {
            coin.body.wakeUp();
        }

        return coin;
    }

    // --------------------------------------------------
    // MÜNZENSTAPEL
    // --------------------------------------------------

    /*
       Erstellt nur eine Kollisionsfläche am oberen Ende
       einer vertikalen Münzsäule.

       position.y = Mittelpunkt der untersten Münze.
       count = Anzahl der Münzen in der Säule.

       Keine dynamischen Körper für jede einzelne Münze!
    */

    createCoinPile(position, count, options = {}) {

        this.ensureInitialized();

        const pos = this.vector(position);

        const radius = options.radius ?? 0.188;
        const thickness = options.thickness ?? 0.1;

        count = Math.max(0, Math.floor(count));

        const pile = {
            id: this.createId(),
            position: pos,
            count,
            radius,
            thickness,
            body: null,
            collider: null,
            enabled: true
        };

        this.coinPiles.set(pile.id, pile);

        this.buildPileCollider(pile);

        return pile;
    }

    buildPileCollider(pile) {

        if (pile.body) {
            this.world.removeRigidBody(pile.body);
            pile.body = null;
            pile.collider = null;
        }

        if (!pile.enabled || pile.count <= 0) {
            return;
        }

        const topY =
            pile.position.y +
            (pile.count - 1) * pile.thickness;

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(
                pile.position.x,
                topY,
                pile.position.z
            );

        pile.body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(
            pile.thickness / 2,
            pile.radius
        )
            .setFriction(0.95)
            .setRestitution(0.01);

        pile.collider = this.world.createCollider(
            colliderDesc,
            pile.body
        );
    }

    updateCoinPile(pile, count) {

        this.ensureInitialized();

        if (!pile || !this.coinPiles.has(pile.id)) {
            return false;
        }

        count = Math.max(0, Math.floor(count));

        if (pile.count === count) {
            return true;
        }

        pile.count = count;

        this.buildPileCollider(pile);

        return true;
    }

    setCoinPileEnabled(pile, enabled) {

        this.ensureInitialized();

        if (!pile || !this.coinPiles.has(pile.id)) {
            return false;
        }

        pile.enabled = Boolean(enabled);

        this.buildPileCollider(pile);

        return true;
    }

    removeCoinPile(pile) {

        this.ensureInitialized();

        if (!pile || !this.coinPiles.has(pile.id)) {
            return false;
        }

        if (pile.body) {
            this.world.removeRigidBody(pile.body);
        }

        this.coinPiles.delete(pile.id);

        pile.body = null;
        pile.collider = null;

        return true;
    }

    // --------------------------------------------------
    // STATISCHE KOLLISIONEN
    // --------------------------------------------------

    createStaticBox(position, size, options = {}) {

        this.ensureInitialized();

        const pos = this.vector(position);
        const dimensions = this.vector(size);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z);

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(
            Math.max(0.001, dimensions.x / 2),
            Math.max(0.001, dimensions.y / 2),
            Math.max(0.001, dimensions.z / 2)
        )
            .setFriction(options.friction ?? 0.9)
            .setRestitution(options.restitution ?? 0.01);

        const collider = this.world.createCollider(
            colliderDesc,
            body
        );

        const entry = { body, collider };

        this.staticBodies.add(entry);

        return entry;
    }

    removeStaticBox(entry) {

        this.ensureInitialized();

        if (!entry || !this.staticBodies.has(entry)) {
            return false;
        }

        this.world.removeRigidBody(entry.body);
        this.staticBodies.delete(entry);

        return true;
    }

    // --------------------------------------------------
    // IMPULSE UND BEWEGUNG
    // --------------------------------------------------

    pushCoin(coin, impulse, point = null) {

        if (!coin || !coin.active || !coin.body) {
            return false;
        }

        const force = this.vector(impulse);

        coin.body.applyImpulse(force, true);

        if (point) {
            coin.body.applyImpulseAtPoint(
                force,
                this.vector(point),
                true
            );
        }

        coin.body.wakeUp();

        return true;
    }

    pushArea(position, radius, strength, direction = null) {

        this.ensureInitialized();

        const center = this.vector(position);

        const maxDistance = Math.max(0.01, radius);
        const force = this.validNumber(strength, 0);

        let affected = 0;

        for (const coin of this.coins.values()) {

            if (!coin.active || !coin.body) continue;

            const p = coin.body.translation();

            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const dz = p.z - center.z;

            const distance = Math.sqrt(
                dx * dx + dy * dy + dz * dz
            );

            if (distance >= maxDistance) continue;

            let nx, ny, nz;

            if (direction) {

                const dir = this.vector(direction);
                const length = Math.sqrt(
                    dir.x * dir.x +
                    dir.y * dir.y +
                    dir.z * dir.z
                ) || 1;

                nx = dir.x / length;
                ny = dir.y / length;
                nz = dir.z / length;

            } else {

                const length = distance || 1;

                nx = dx / length;
                ny = dy / length;
                nz = dz / length;
            }

            const falloff = 1 - distance / maxDistance;
            const impulse = force * falloff;

            coin.body.applyImpulse(
                {
                    x: nx * impulse,
                    y: ny * impulse,
                    z: nz * impulse
                },
                true
            );

            coin.body.wakeUp();

            affected++;
        }

        return affected;
    }

    pushCoinsNearPlayer(position, radius = 2, strength = 2) {

        return this.pushArea(
            position,
            radius,
            strength
        );
    }

    // --------------------------------------------------
    // FÖRDERBAND
    // --------------------------------------------------

    applyConveyor(position, size, velocity, strength = 0.2) {

        this.ensureInitialized();

        const center = this.vector(position);
        const half = this.vector(size);
        const target = this.vector(velocity);

        const amount = Math.max(
            0,
            Math.min(1, strength)
        );

        let affected = 0;

        for (const coin of this.coins.values()) {

            if (!coin.active || !coin.body) continue;

            const p = coin.body.translation();

            const inside =
                Math.abs(p.x - center.x) <= half.x / 2 &&
                Math.abs(p.y - center.y) <= half.y / 2 &&
                Math.abs(p.z - center.z) <= half.z / 2;

            if (!inside) continue;

            const current = coin.body.linvel();

            coin.body.setLinvel(
                {
                    x: current.x + (target.x - current.x) * amount,
                    y: current.y + (target.y - current.y) * amount,
                    z: current.z + (target.z - current.z) * amount
                },
                true
            );

            coin.body.wakeUp();

            affected++;
        }

        return affected;
    }

    // --------------------------------------------------
    // MÜNZEN EINFIEREN UND AKTIVIEREN
    // --------------------------------------------------

    saveState(coin) {

        if (!coin || !coin.body) return null;

        return {
            translation: { ...coin.body.translation() },
            rotation: { ...coin.body.rotation() },
            linvel: { ...coin.body.linvel() },
            angvel: { ...coin.body.angvel() }
        };
    }

    freezeCoin(coin) {

        this.ensureInitialized();

        if (!coin || !coin.active) return false;

        coin.savedState = this.saveState(coin);

        this.world.removeRigidBody(coin.body);

        coin.body = null;
        coin.collider = null;
        coin.active = false;

        this.coins.delete(coin.id);

        return true;
    }

    resumeCoin(coin, position = null) {

        this.ensureInitialized();

        if (!coin || coin.active) return false;

        if (this.coins.size >= this.maxBodies) {
            return false;
        }

        const state = coin.savedState;

        if (!state && !position) {
            return false;
        }

        const pos = position
            ? this.vector(position)
            : state.translation;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setLinearDamping(0.35)
            .setAngularDamping(0.65)
            .setCanSleep(true)
            .setCcdEnabled(true);

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(
            coin.thickness / 2,
            coin.radius
        )
            .setDensity(coin.options.density)
            .setFriction(coin.options.friction)
            .setRestitution(coin.options.restitution);

        const collider = this.world.createCollider(
            colliderDesc,
            body
        );

        if (state && !position) {

            body.setRotation(state.rotation, true);
            body.setLinvel(state.linvel, true);
            body.setAngvel(state.angvel, true);
        }

        coin.body = body;
        coin.collider = collider;
        coin.active = true;

        this.coins.set(coin.id, coin);

        body.wakeUp();

        return true;
    }

    freezeMany(coins) {

        let count = 0;

        for (const coin of coins) {
            if (this.freezeCoin(coin)) {
                count++;
            }
        }

        return count;
    }

    // --------------------------------------------------
    // TRANSFORM
    // --------------------------------------------------

    getTransform(coin) {

        if (!coin || !coin.active || !coin.body) {
            return null;
        }

        return {
            position: { ...coin.body.translation() },
            rotation: { ...coin.body.rotation() }
        };
    }

    // --------------------------------------------------
    // MÜNZE ENTFERNEN
    // --------------------------------------------------

    removeCoin(coin) {

        this.ensureInitialized();

        if (!coin) return false;

        if (coin.active && coin.body) {
            this.world.removeRigidBody(coin.body);
        }

        this.coins.delete(coin.id);
        this.bodies.delete(coin.id);

        coin.body = null;
        coin.collider = null;
        coin.active = false;
        coin.savedState = null;

        return true;
    }

    // --------------------------------------------------
    // PHYSIK-UPDATE
    // --------------------------------------------------

    update(deltaTime) {

        if (!this.initialized || !this.world) return;

        let dt = Number.isFinite(deltaTime)
            ? Math.max(0, deltaTime)
            : 0;

        if (dt > this.maxFrameTime) {
            this.stats.droppedTime += dt - this.maxFrameTime;
            dt = this.maxFrameTime;
        }

        this.accumulator += dt;

        let steps = 0;

        while (
            this.accumulator >= this.fixedTimeStep &&
            steps < this.maxSubSteps
        ) {

            this.world.timestep = this.fixedTimeStep;

            this.world.step(this.eventQueue);

            this.accumulator -= this.fixedTimeStep;

            steps++;
            this.stats.steps++;
        }

        if (
            steps >= this.maxSubSteps &&
            this.accumulator >= this.fixedTimeStep
        ) {

            this.stats.droppedTime += this.accumulator;
            this.accumulator = 0;
        }

        this.elapsed += dt;
    }

    // --------------------------------------------------
    // AUFRÄUMEN
    // --------------------------------------------------

    destroy() {

        if (!this.world) return;

        for (const pile of this.coinPiles.values()) {
            pile.body = null;
            pile.collider = null;
        }

        for (const coin of this.bodies.values()) {
            coin.body = null;
            coin.collider = null;
            coin.active = false;
        }

        this.coins.clear();
        this.bodies.clear();
        this.coinPiles.clear();
        this.staticBodies.clear();

        if (this.eventQueue) {
            this.eventQueue.free();
            this.eventQueue = null;
        }

        this.world.free();
        this.world = null;

        this.initialized = false;
        this.accumulator = 0;
        this.elapsed = 0;
    }
}
