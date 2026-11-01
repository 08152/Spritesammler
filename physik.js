
import * as RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js";

export class PhysicsSystem {
    constructor(options = {}) {
        this.maxBodies = options.maxBodies ?? 350;
        this.fixedTimeStep = 1 / 60;
        this.accumulator = 0;
        this.elapsed = 0;

        this.world = null;
        this.eventQueue = null;
        this.initialized = false;

        // Nur aktive Münzen befinden sich in dieser Map.
        this.bodies = new Map();

        // Alle bekannten Münzen bleiben hier registriert.
        this.coins = new Map();

        this.staticBodies = [];
        this.nextId = 1;

        this.gravity = options.gravity ?? -9.81;
    }

    async init() {
        if (this.initialized) return;

        await RAPIER.init();

        this.world = new RAPIER.World({
            x: 0,
            y: this.gravity,
            z: 0
        });

        this.world.timestep = this.fixedTimeStep;

        if (this.world.integrationParameters) {
            const parameters = this.world.integrationParameters;

            if ("numSolverIterations" in parameters) {
                parameters.numSolverIterations = 8;
            }

            if ("numInternalPgsIterations" in parameters) {
                parameters.numInternalPgsIterations = 2;
            }
        }

        this.eventQueue = new RAPIER.EventQueue(true);
        this.initialized = true;
    }

    createCoin(position, options = {}) {
        this.ensureInitialized();

        if (this.bodies.size >= this.maxBodies) {
            return null;
        }

        const id = this.nextId++;

        const radius = options.radius ?? 0.18;
        const thickness = options.thickness ?? 0.035;
        const density = options.density ?? 2.5;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(position.x, position.y, position.z)
            .setLinearDamping(options.linearDamping ?? 0.12)
            .setAngularDamping(options.angularDamping ?? 0.18)
            .setCcdEnabled(true);

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(
            thickness / 2,
            radius
        )
            .setDensity(density)
            .setFriction(options.friction ?? 0.85)
            .setRestitution(options.restitution ?? 0.18);

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

    createFlowCoin(position, direction = {}, options = {}) {
        const coin = this.createCoin(position, options);

        if (!coin) return null;

        const speed = options.speed ?? 2.5;

        const dx = direction.x ?? 0;
        const dy = direction.y ?? 0;
        const dz = direction.z ?? 0;

        coin.body.setLinvel({
            x: dx * speed + (Math.random() - 0.5) * 0.8,
            y: dy * speed + Math.random() * 1.2,
            z: dz * speed + (Math.random() - 0.5) * 0.8
        }, true);

        coin.body.setAngvel({
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8,
            z: (Math.random() - 0.5) * 8
        }, true);

        return coin;
    }

    createStaticBox(position, size, options = {}) {
        this.ensureInitialized();

        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(position.x, position.y, position.z);

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(
            size.x / 2,
            size.y / 2,
            size.z / 2
        )
            .setFriction(options.friction ?? 0.9)
            .setRestitution(options.restitution ?? 0.05);

        const collider = this.world.createCollider(
            colliderDesc,
            body
        );

        this.staticBodies.push(body);

        return { body, collider };
    }

    pushCoin(coin, impulse) {
        if (!coin?.active || !coin.body) return;

        coin.body.applyImpulse({
            x: impulse.x ?? 0,
            y: impulse.y ?? 0,
            z: impulse.z ?? 0
        }, true);
    }

    pushArea(center, radius, strength, direction = {}) {
        for (const coin of this.bodies.values()) {
            if (!coin.body) continue;

            const p = coin.body.translation();

            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const dz = p.z - center.z;

            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance >= radius || distance < 0.001) continue;

            const falloff = 1 - distance / radius;

            const nx = direction.x ?? dx / distance;
            const ny = direction.y ?? dy / distance;
            const nz = direction.z ?? dz / distance;

            const force = strength * falloff;

            coin.body.applyImpulse({
                x: nx * force,
                y: ny * force + force * 0.12,
                z: nz * force
            }, true);

            coin.body.applyTorqueImpulse({
                x: (Math.random() - 0.5) * force,
                y: (Math.random() - 0.5) * force,
                z: (Math.random() - 0.5) * force
            }, true);
        }
    }

    // Spieler stößt Münzen beim Laufen weg.
    pushCoinsNearPlayer(position, velocity, radius = 1.25) {
        const speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );

        if (speed < 0.15) return;

        const horizontalSpeed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.z * velocity.z
        );

        if (horizontalSpeed < 0.01) return;

        const moveX = velocity.x / horizontalSpeed;
        const moveZ = velocity.z / horizontalSpeed;

        const strength = Math.min(speed * 2.5, 9);

        for (const coin of this.bodies.values()) {
            if (!coin.body) continue;

            const p = coin.body.translation();

            const dx = p.x - position.x;
            const dy = p.y - position.y;
            const dz = p.z - position.z;

            const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

            if (horizontalDistance > radius) continue;
            if (Math.abs(dy) > 1.1) continue;

            // Verhindert, dass dieselbe Münze pro Frame
            // immer wieder einen starken Stoß erhält.
            if (this.elapsed - coin.lastPlayerPush < 0.12) {
                continue;
            }

            const distance = Math.max(horizontalDistance, 0.05);
            const falloff = 1 - horizontalDistance / radius;

            // Mischung aus Laufrichtung und Richtung vom Spieler weg.
            const awayX = dx / distance;
            const awayZ = dz / distance;

            const dirX = moveX * 0.65 + awayX * 0.35;
            const dirZ = moveZ * 0.65 + awayZ * 0.35;

            const force = strength * falloff;

            coin.body.applyImpulse({
                x: dirX * force,
                y: 0.25 * force,
                z: dirZ * force
            }, true);

            coin.body.applyTorqueImpulse({
                x: (Math.random() - 0.5) * force * 0.8,
                y: (Math.random() - 0.5) * force * 0.5,
                z: (Math.random() - 0.5) * force * 0.8
            }, true);

            coin.lastPlayerPush = this.elapsed;
        }
    }

    // Bewegung auf einem Förderband.
    applyConveyor(position, size, velocity, strength = 0.08) {
        const minX = position.x - size.x / 2;
        const maxX = position.x + size.x / 2;
        const minY = position.y - size.y / 2;
        const maxY = position.y + size.y / 2;
        const minZ = position.z - size.z / 2;
        const maxZ = position.z + size.z / 2;

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
                x: current.x + (velocity.x - current.x) * strength,
                y: current.y,
                z: current.z + (velocity.z - current.z) * strength
            }, true);

            coin.body.applyTorqueImpulse({
                x: velocity.z * 0.015,
                y: 0,
                z: -velocity.x * 0.015
            }, true);
        }
    }

    saveState(coin) {
        if (!coin?.body) return;

        const p = coin.body.translation();
        const r = coin.body.rotation();
        const v = coin.body.linvel();
        const a = coin.body.angvel();

        coin.savedState = {
            position: { x: p.x, y: p.y, z: p.z },
            rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
            velocity: { x: v.x, y: v.y, z: v.z },
            angularVelocity: { x: a.x, y: a.y, z: a.z }
        };
    }

    freezeCoin(coin) {
        if (!coin?.active || !coin.body) return;

        this.saveState(coin);

        this.world.removeRigidBody(coin.body);

        this.bodies.delete(coin.id);

        coin.body = null;
        coin.collider = null;
        coin.active = false;
    }

    resumeCoin(coin) {
        this.ensureInitialized();

        if (!coin || coin.active || !coin.savedState) return false;

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
            .setLinearDamping(coin.options.linearDamping ?? 0.12)
            .setAngularDamping(coin.options.angularDamping ?? 0.18)
            .setCcdEnabled(true);

        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cylinder(
            coin.thickness / 2,
            coin.radius
        )
            .setDensity(coin.options.density ?? 2.5)
            .setFriction(coin.options.friction ?? 0.85)
            .setRestitution(coin.options.restitution ?? 0.18);

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

    freezeMany(coins) {
        for (const coin of coins) {
            this.freezeCoin(coin);
        }
    }

    update(deltaTime) {
        if (!this.initialized) return;

        const dt = Math.min(deltaTime, 0.1);

        this.elapsed += dt;
        this.accumulator += dt;

        let steps = 0;
        const maxSteps = 5;

        while (
            this.accumulator >= this.fixedTimeStep &&
            steps < maxSteps
        ) {
            this.world.step(this.eventQueue);

            this.accumulator -= this.fixedTimeStep;
            steps++;
        }

        // Verhindert große Nachhol-Simulationen nach langen Pausen.
        if (steps >= maxSteps) {
            this.accumulator = 0;
        }
    }

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
            position: { x: p.x, y: p.y, z: p.z },
            rotation: { x: r.x, y: r.y, z: r.z, w: r.w }
        };
    }

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

    getActiveCount() {
        return this.bodies.size;
    }

    getCoinCount() {
        return this.coins.size;
    }

    ensureInitialized() {
        if (!this.initialized) {
            throw new Error(
                "PhysicsSystem wurde noch nicht initialisiert. Erst await physics.init() aufrufen."
            );
        }
    }

    destroy() {
        if (!this.initialized) return;

        this.world.free();
        this.eventQueue?.free();

        this.bodies.clear();
        this.coins.clear();
        this.staticBodies = [];

        this.world = null;
        this.eventQueue = null;
        this.initialized = false;
    }
}
