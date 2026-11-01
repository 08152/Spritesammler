
import * as RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js";

export class PhysicsSystem {

    constructor(options = {}) {

        this.maxBodies = options.maxBodies ?? 350;

        this.fixedTimeStep = 1 / 60;
        this.accumulator = 0;
        this.elapsed = 0;

        this.maxSubSteps = options.maxSubSteps ?? 8;

        this.world = null;
        this.eventQueue = null;

        this.initialized = false;

        // Aktive dynamische Münzen
        this.bodies = new Map();

        // Alle registrierten Münzen
        this.coins = new Map();

        // Statische Körper
        this.staticBodies = [];

        // Kollisionsflächen für Münzstapel
        this.coinPiles = new Map();

        this.nextId = 1;
        this.nextPileId = 1;

        this.gravity = options.gravity ?? -9.81;

        this.defaultCoinOptions = {
            radius: 0.188,
            thickness: 0.1,
            density: 2.5,
            friction: 0.95,
            restitution: 0.02
        };
    }

    // =====================================================
    // INITIALISIERUNG
    // =====================================================

    async init() {

        if (this.initialized) return;

        await RAPIER.init();

        this.world = new RAPIER.World({
            x: 0,
            y: this.gravity,
            z: 0
        });

        this.world.timestep = this.fixedTimeStep;

        const parameters = this.world.integrationParameters;

        if (parameters) {

            if ("numSolverIterations" in parameters) {
                parameters.numSolverIterations = 12;
            }

            if ("numInternalPgsIterations" in parameters) {
                parameters.numInternalPgsIterations = 4;
            }

        }

        this.eventQueue = new RAPIER.EventQueue(true);

        this.initialized = true;
    }

    // =====================================================
    // DYNAMISCHE MÜNZE
    // =====================================================

    createCoin(position, options = {}) {

        this.ensureInitialized();

        if (this.bodies.size >= this.maxBodies) {
            return null;
        }

        const id = this.nextId++;

        const radius =
            options.radius ??
            this.defaultCoinOptions.radius;

        const thickness =
            options.thickness ??
            this.defaultCoinOptions.thickness;

        const density =
            options.density ??
            this.defaultCoinOptions.density;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
                position.x,
                position.y,
                position.z
            )
            .setLinearDamping(options.linearDamping ?? 0.35)
            .setAngularDamping(options.angularDamping ?? 0.65)
            .setCanSleep(true)
            .setCcdEnabled(true);

        if (options.rotation) {
            bodyDesc.setRotation(options.rotation);
        }

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(
            thickness / 2,
            radius
        )
            .setDensity(density)
            .setFriction(options.friction ?? 0.95)
            .setRestitution(options.restitution ?? 0.02);

        const collider = this.world.createCollider(
            colliderDesc,
            body
        );

        const coin = {

            id,

            body,
            collider,

            active: true,

            savedState: null,

            radius,
            thickness,

            options,

            lastPlayerPush: -Infinity

        };

        this.bodies.set(id, coin);
        this.coins.set(id, coin);

        return coin;
    }

    // =====================================================
    // MÜNZE MIT BEWEGUNG ERSTELLEN
    // =====================================================

    createFlowCoin(position, direction = {}, options = {}) {

        const coin = this.createCoin(position, options);

        if (!coin) return null;

        const speed = options.speed ?? 2.5;

        coin.body.setLinvel({

            x: (direction.x ?? 0) * speed +
                (Math.random() - 0.5) * 0.5,

            y: (direction.y ?? 0) * speed +
                Math.random() * 0.5,

            z: (direction.z ?? 0) * speed +
                (Math.random() - 0.5) * 0.5

        }, true);

        coin.body.setAngvel({

            x: (Math.random() - 0.5) * 3,
            y: (Math.random() - 0.5) * 3,
            z: (Math.random() - 0.5) * 3

        }, true);

        return coin;
    }

    // =====================================================
    // MÜNZENSTAPEL-KOLLISION
    // =====================================================

    /*
        Erstellt eine statische Kollisionsfläche
        für einen Münzstapel.

        position:
            x und z = Position des Stapels
            y = Höhe der untersten Münze

        count:
            Anzahl der Münzen im Stapel

        Die Kollisionsfläche liegt auf Höhe
        der obersten Münze.

        Es wird nur eine Kollisionsfläche pro Stapel
        benötigt, nicht eine pro Münze.
    */

    createCoinPile(position, count, options = {}) {

        this.ensureInitialized();

        const id = this.nextPileId++;

        const radius =
            options.radius ??
            this.defaultCoinOptions.radius;

        const thickness =
            options.thickness ??
            this.defaultCoinOptions.thickness;

        const safeCount = Math.max(
            0,
            Math.floor(count)
        );

        const pile = {

            id,

            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },

            count: safeCount,

            radius,
            thickness,

            body: null,
            collider: null,

            options

        };

        this.coinPiles.set(id, pile);

        this.updateCoinPile(pile, safeCount);

        return pile;
    }

    // =====================================================
    // MÜNZENSTAPEL AKTUALISIEREN
    // =====================================================

    updateCoinPile(pile, count) {

        this.ensureInitialized();

        if (!pile) return false;

        const safeCount = Math.max(
            0,
            Math.floor(count)
        );

        // Alten Körper entfernen.
        if (pile.body) {

            this.world.removeRigidBody(pile.body);

            pile.body = null;
            pile.collider = null;
        }

        pile.count = safeCount;

        // Leerer Stapel benötigt keine Hitbox.
        if (safeCount <= 0) {
            return true;
        }

        const topY =
            pile.position.y +
            (safeCount - 1) * pile.thickness;

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(
                pile.position.x,
                topY,
                pile.position.z
            );

        const body = this.world.createRigidBody(bodyDesc);

        /*
            Die oberste Münze wird als flache
            Kollisionsfläche dargestellt.
        */

        const colliderDesc = RAPIER.ColliderDesc.cylinder(
            pile.thickness / 2,
            pile.radius
        )
            .setFriction(pile.options.friction ?? 0.95)
            .setRestitution(pile.options.restitution ?? 0.02);

        const collider = this.world.createCollider(
            colliderDesc,
            body
        );

        pile.body = body;
        pile.collider = collider;

        return true;
    }

    // =====================================================
    // MÜNZENSTAPEL ENTFERNEN
    // =====================================================

    removeCoinPile(pile) {

        if (!pile) return;

        if (pile.body) {

            this.world.removeRigidBody(pile.body);

        }

        this.coinPiles.delete(pile.id);

        pile.body = null;
        pile.collider = null;
    }

    // =====================================================
    // MÜNZENSTAPEL AKTIVIEREN / DEAKTIVIEREN
    // =====================================================

    setCoinPileEnabled(pile, enabled) {

        if (!pile) return;

        if (enabled && !pile.body && pile.count > 0) {

            this.updateCoinPile(pile, pile.count);

        }

        if (!enabled && pile.body) {

            this.world.removeRigidBody(pile.body);

            pile.body = null;
            pile.collider = null;
        }
    }

    // =====================================================
    // FESTE BOX
    // =====================================================

    createStaticBox(position, size, options = {}) {

        this.ensureInitialized();

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(
                position.x,
                position.y,
                position.z
            );

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(
            size.x / 2,
            size.y / 2,
            size.z / 2
        )
            .setFriction(options.friction ?? 0.9)
            .setRestitution(options.restitution ?? 0.02);

        const collider = this.world.createCollider(
            colliderDesc,
            body
        );

        const entry = {
            body,
            collider
        };

        this.staticBodies.push(entry);

        return entry;
    }

    // =====================================================
    // IMPULS AUF MÜNZE
    // =====================================================

    pushCoin(coin, impulse) {

        if (!coin?.active || !coin.body) return;

        coin.body.applyImpulse({

            x: impulse.x ?? 0,
            y: impulse.y ?? 0,
            z: impulse.z ?? 0

        }, true);
    }

    // =====================================================
    // BEREICHSDRUCK
    // =====================================================

    pushArea(center, radius, strength, direction = {}) {

        for (const coin of this.bodies.values()) {

            if (!coin.body) continue;

            const p = coin.body.translation();

            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const dz = p.z - center.z;

            const distance = Math.sqrt(
                dx * dx + dy * dy + dz * dz
            );

            if (distance >= radius || distance < 0.001) {
                continue;
            }

            const falloff = 1 - distance / radius;

            let nx = direction.x ?? dx / distance;
            let ny = direction.y ?? dy / distance;
            let nz = direction.z ?? dz / distance;

            const length = Math.sqrt(
                nx * nx + ny * ny + nz * nz
            ) || 1;

            nx /= length;
            ny /= length;
            nz /= length;

            const force = strength * falloff;

            coin.body.applyImpulse({

                x: nx * force,
                y: ny * force + force * 0.12,
                z: nz * force

            }, true);
        }
    }

    // =====================================================
    // SPIELER STÖSST MÜNZEN AN
    // =====================================================

    pushCoinsNearPlayer(position, velocity, radius = 1.25) {

        const horizontalSpeed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.z * velocity.z
        );

        if (horizontalSpeed < 0.15) return;

        const moveX = velocity.x / horizontalSpeed;
        const moveZ = velocity.z / horizontalSpeed;

        const strength = Math.min(
            horizontalSpeed * 2.5,
            7
        );

        for (const coin of this.bodies.values()) {

            if (!coin.body) continue;

            const p = coin.body.translation();

            const dx = p.x - position.x;
            const dy = p.y - position.y;
            const dz = p.z - position.z;

            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance > radius) continue;
            if (Math.abs(dy) > 1.1) continue;

            if (this.elapsed - coin.lastPlayerPush < 0.15) {
                continue;
            }

            const safeDistance = Math.max(distance, 0.05);

            const falloff = 1 - distance / radius;

            const awayX = dx / safeDistance;
            const awayZ = dz / safeDistance;

            const force = strength * falloff;

            coin.body.applyImpulse({

                x: (moveX * 0.55 + awayX * 0.45) * force,
                y: force * 0.08,
                z: (moveZ * 0.55 + awayZ * 0.45) * force

            }, true);

            coin.lastPlayerPush = this.elapsed;
        }
    }

    // =====================================================
    // FÖRDERBAND
    // =====================================================

    applyConveyor(position, size, velocity, strength = 0.08) {

        const minX = position.x - size.x / 2;
        const maxX = position.x + size.x / 2;

        const minY = position.y - size.y / 2;
        const maxY = position.y + size.y / 2;

        const minZ = position.z - size.z / 2;
        const maxZ = position.z + size.z / 2;

        const amount = Math.max(
            0,
            Math.min(strength, 1)
        );

        for (const coin of this.bodies.values()) {

            if (!coin.body) continue;

            const p = coin.body.translation();

            if (
                p.x < minX || p.x > maxX ||
                p.y < minY || p.y > maxY ||
                p.z < minZ || p.z > maxZ
            ) {
                continue;
            }

            const current = coin.body.linvel();

            coin.body.setLinvel({

                x: current.x +
                    (velocity.x - current.x) * amount,

                y: current.y,

                z: current.z +
                    (velocity.z - current.z) * amount

            }, true);
        }
    }

    // =====================================================
    // ZUSTAND SPEICHERN
    // =====================================================

    saveState(coin) {

        if (!coin?.body) return;

        const p = coin.body.translation();
        const r = coin.body.rotation();

        const v = coin.body.linvel();
        const a = coin.body.angvel();

        coin.savedState = {

            position: {
                x: p.x,
                y: p.y,
                z: p.z
            },

            rotation: {
                x: r.x,
                y: r.y,
                z: r.z,
                w: r.w
            },

            velocity: {
                x: v.x,
                y: v.y,
                z: v.z
            },

            angularVelocity: {
                x: a.x,
                y: a.y,
                z: a.z
            }
        };
    }

    // =====================================================
    // MÜNZE EINFRIEREN
    // =====================================================

    freezeCoin(coin) {

        if (!coin?.active || !coin.body) return;

        this.saveState(coin);

        this.world.removeRigidBody(coin.body);

        this.bodies.delete(coin.id);

        coin.body = null;
        coin.collider = null;
        coin.active = false;
    }

    // =====================================================
    // MÜNZE WIEDER AKTIVIEREN
    // =====================================================

    resumeCoin(coin) {

        this.ensureInitialized();

        if (!coin || coin.active || !coin.savedState) {
            return false;
        }

        if (this.bodies.size >= this.maxBodies) {
            return false;
        }

        const state = coin.savedState;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
                state.position.x,
                state.position.y,
                state.position.z
            )
            .setRotation(state.rotation)
            .setLinvel(
                state.velocity.x,
                state.velocity.y,
                state.velocity.z
            )
            .setAngvel(
                state.angularVelocity.x,
                state.angularVelocity.y,
                state.angularVelocity.z
            )
            .setLinearDamping(coin.options.linearDamping ?? 0.35)
            .setAngularDamping(coin.options.angularDamping ?? 0.65)
            .setCanSleep(true)
            .setCcdEnabled(true);

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(
            coin.thickness / 2,
            coin.radius
        )
            .setDensity(coin.options.density ?? 2.5)
            .setFriction(coin.options.friction ?? 0.95)
            .setRestitution(coin.options.restitution ?? 0.02);

        const collider = this.world.createCollider(
            colliderDesc,
            body
        );

        coin.body = body;
        coin.collider = collider;
        coin.active = true;

        this.bodies.set(coin.id, coin);

        return true;
    }

    // =====================================================
    // MEHRERE MÜNZEN EINFRIEREN
    // =====================================================

    freezeMany(coins) {

        for (const coin of coins) {
            this.freezeCoin(coin);
        }
    }

    // =====================================================
    // PHYSIK UPDATE
    // =====================================================

    update(deltaTime) {

        if (!this.initialized) return;

        const dt = Math.min(
            Math.max(deltaTime, 0),
            0.1
        );

        this.elapsed += dt;
        this.accumulator += dt;

        let steps = 0;

        while (
            this.accumulator >= this.fixedTimeStep &&
            steps < this.maxSubSteps
        ) {

            this.world.step(this.eventQueue);

            this.accumulator -= this.fixedTimeStep;

            steps++;
        }

        if (steps >= this.maxSubSteps) {
            this.accumulator = 0;
        }
    }

    // =====================================================
    // TRANSFORM ABFRAGEN
    // =====================================================

    getTransform(coin) {

        if (!coin?.body || !coin.active) {

            return coin?.savedState
                ? {
                    position: coin.savedState.position,
                    rotation: coin.savedState.rotation
                }
                : null;
        }

        const p = coin.body.translation();
        const r = coin.body.rotation();

        return {

            position: {
                x: p.x,
                y: p.y,
                z: p.z
            },

            rotation: {
                x: r.x,
                y: r.y,
                z: r.z,
                w: r.w
            }
        };
    }

    // =====================================================
    // MÜNZE ENTFERNEN
    // =====================================================

    removeCoin(coin) {

        if (!coin) return;

        if (coin.body) {
            this.world.removeRigidBody(coin.body);
        }

        this.bodies.delete(coin.id);
        this.coins.delete(coin.id);

        coin.body = null;
        coin.collider = null;
        coin.active = false;
    }

    // =====================================================
    // ANZAHLEN
    // =====================================================

    getActiveCount() {
        return this.bodies.size;
    }

    getCoinCount() {
        return this.coins.size;
    }

    getCoinPileCount() {
        return this.coinPiles.size;
    }

    // =====================================================
    // INITIALISIERUNG PRÜFEN
    // =====================================================

    ensureInitialized() {

        if (!this.initialized) {

            throw new Error(
                "PhysicsSystem ist nicht initialisiert. " +
                "Bitte zuerst await physics.init() aufrufen."
            );
        }
    }

    // =====================================================
    // AUFRÄUMEN
    // =====================================================

    destroy() {

        if (!this.initialized) return;

        this.world.free();

        this.eventQueue?.free();

        this.bodies.clear();
        this.coins.clear();
        this.coinPiles.clear();

        this.staticBodies = [];

        this.world = null;
        this.eventQueue = null;

        this.initialized = false;

        this.accumulator = 0;
        this.elapsed = 0;
    }
}
