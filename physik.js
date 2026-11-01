import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js";

export class PhysicsSystem {

    constructor(options = {}) {
        this.maxBodies = options.maxBodies ?? 300;
        this.fixedTimeStep = 1 / 60;

        this.world = null;
        this.bodies = new Map();
        this.nextId = 1;

        this.accumulator = 0;
        this.ready = false;

        this.gravity = {
            x: 0,
            y: -9.81,
            z: 0
        };
    }

    // =========================================
    // INITIALISIERUNG
    // =========================================

    async init() {
        await RAPIER.init();

        this.world = new RAPIER.World(this.gravity);

        this.world.timestep = this.fixedTimeStep;

        const params = this.world.integrationParameters;

        if (params) {
            params.numSolverIterations = 12;
            params.numInternalPgsIterations = 4;
            params.dt = this.fixedTimeStep;
        }

        this.ready = true;

        return this;
    }

    // =========================================
    // MÜNZE ERSTELLEN
    // =========================================

    createCoin(position, options = {}) {

        if (!this.ready) {
            throw new Error("PhysicsSystem wurde noch nicht initialisiert.");
        }

        if (this.bodies.size >= this.maxBodies) {
            return null;
        }

        const radius = options.radius ?? 0.188;
        const thickness = options.thickness ?? 0.1;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(
                position.x,
                position.y,
                position.z
            )
            .setLinearDamping(options.linearDamping ?? 0.08)
            .setAngularDamping(options.angularDamping ?? 0.12)
            .setCanSleep(true)
            .setCcdEnabled(true);

        const body = this.world.createRigidBody(bodyDesc);

        const collider = RAPIER.ColliderDesc.cylinder(
            thickness / 2,
            radius
        )
            .setDensity(options.density ?? 7)
            .setFriction(options.friction ?? 0.75)
            .setRestitution(options.restitution ?? 0.08);

        this.world.createCollider(collider, body);

        const id = this.nextId++;

        const coin = {
            id,
            body,
            active: true,
            frozen: false,
            type: options.type ?? "coin",

            lastPosition: {
                x: position.x,
                y: position.y,
                z: position.z
            },

            lastRotation: {
                x: 0,
                y: 0,
                z: 0,
                w: 1
            },

            linearVelocity: {
                x: 0,
                y: 0,
                z: 0
            },

            angularVelocity: {
                x: 0,
                y: 0,
                z: 0
            }
        };

        this.bodies.set(id, coin);

        if (options.velocity) {
            body.setLinvel(options.velocity, true);
        }

        if (options.angularVelocity) {
            body.setAngvel(options.angularVelocity, true);
        }

        if (options.impulse) {
            body.applyImpulse(options.impulse, true);
        }

        return coin;
    }

    // =========================================
    // MÜNZEN ALS STRÖMUNG ERZEUGEN
    // =========================================

    createFlowCoin(position, direction = {}) {

        const spread = 0.8;

        const velocity = {
            x: (direction.x ?? 0) + (Math.random() - 0.5) * spread,
            y: (direction.y ?? 0) + Math.random() * 0.8,
            z: (direction.z ?? 0) + (Math.random() - 0.5) * spread
        };

        const angularVelocity = {
            x: (Math.random() - 0.5) * 5,
            y: (Math.random() - 0.5) * 5,
            z: (Math.random() - 0.5) * 5
        };

        return this.createCoin(position, {
            velocity,
            angularVelocity,
            friction: 0.65,
            restitution: 0.06,
            linearDamping: 0.06,
            angularDamping: 0.1
        });
    }

    // =========================================
    // FESTE KOLLISIONSOBJEKTE
    // =========================================

    createStaticBox(position, size, options = {}) {

        const body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed()
                .setTranslation(
                    position.x,
                    position.y,
                    position.z
                )
        );

        const collider = RAPIER.ColliderDesc.cuboid(
            size.x / 2,
            size.y / 2,
            size.z / 2
        )
            .setFriction(options.friction ?? 0.8)
            .setRestitution(options.restitution ?? 0.02);

        this.world.createCollider(collider, body);

        return body;
    }

    // =========================================
    // IMPULSE / SCHUB
    // =========================================

    pushCoin(coin, impulse) {

        if (!coin || !coin.active || !coin.body) return;

        coin.body.applyImpulse(impulse, true);
    }

    pushArea(center, radius, strength, direction = {}) {

        const radiusSq = radius * radius;

        for (const coin of this.bodies.values()) {

            if (!coin.active || !coin.body) continue;

            const p = coin.body.translation();

            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const dz = p.z - center.z;

            const distanceSq =
                dx * dx + dy * dy + dz * dz;

            if (distanceSq > radiusSq || distanceSq < 0.0001) {
                continue;
            }

            const distance = Math.sqrt(distanceSq);
            const power = strength * (1 - distance / radius);

            const impulse = {
                x: (direction.x ?? dx / distance) * power,
                y: (direction.y ?? 0.15) * power,
                z: (direction.z ?? dz / distance) * power
            };

            coin.body.applyImpulse(impulse, true);
        }
    }

    // =========================================
    // FÖRDERBAND
    // =========================================

    applyConveyor(position, size, velocity, strength = 0.08) {

        const minX = position.x - size.x / 2;
        const maxX = position.x + size.x / 2;

        const minY = position.y - size.y / 2;
        const maxY = position.y + size.y / 2;

        const minZ = position.z - size.z / 2;
        const maxZ = position.z + size.z / 2;

        for (const coin of this.bodies.values()) {

            if (!coin.active || !coin.body) continue;

            const p = coin.body.translation();

            if (
                p.x < minX || p.x > maxX ||
                p.y < minY || p.y > maxY ||
                p.z < minZ || p.z > maxZ
            ) continue;

            const current = coin.body.linvel();

            coin.body.setLinvel({
                x: current.x + (velocity.x - current.x) * strength,
                y: current.y,
                z: current.z + (velocity.z - current.z) * strength
            }, true);
        }
    }

    // =========================================
    // MÜNZE EINFIEREN
    // =========================================

    freezeCoin(coin) {

        if (!coin || !coin.active || !coin.body) return;

        this.saveState(coin);

        this.world.removeRigidBody(coin.body);

        coin.body = null;
        coin.active = false;
        coin.frozen = true;
    }

    // =========================================
    // PHYSIKZUSTAND SPEICHERN
    // =========================================

    saveState(coin) {

        if (!coin.body) return;

        const p = coin.body.translation();
        const r = coin.body.rotation();

        const v = coin.body.linvel();
        const a = coin.body.angvel();

        coin.lastPosition = {
            x: p.x,
            y: p.y,
            z: p.z
        };

        coin.lastRotation = {
            x: r.x,
            y: r.y,
            z: r.z,
            w: r.w
        };

        coin.linearVelocity = {
            x: v.x,
            y: v.y,
            z: v.z
        };

        coin.angularVelocity = {
            x: a.x,
            y: a.y,
            z: a.z
        };
    }

    // =========================================
    // PHYSIK FORTSETZEN
    // =========================================

    resumeCoin(coin) {

        if (!coin || !coin.frozen) return false;

        if (this.bodies.size >= this.maxBodies) {
            return false;
        }

        const p = coin.lastPosition;

        const restored = this.createCoin(
            p,
            {
                velocity: coin.linearVelocity,
                angularVelocity: coin.angularVelocity
            }
        );

        if (!restored) return false;

        const body = restored.body;
        const r = coin.lastRotation;

        body.setRotation(r, true);

        this.bodies.delete(restored.id);

        coin.body = body;
        coin.active = true;
        coin.frozen = false;

        return true;
    }

    // =========================================
    // CHUNK EINFIEREN
    // =========================================

    freezeMany(coins) {

        for (const coin of coins) {
            this.freezeCoin(coin);
        }
    }

    // =========================================
    // PHYSIK-UPDATE
    // =========================================

    update(deltaTime) {

        if (!this.ready) return;

        this.accumulator += Math.min(deltaTime, 0.05);

        let steps = 0;

        while (
            this.accumulator >= this.fixedTimeStep &&
            steps < 4
        ) {

            this.world.step();

            this.accumulator -= this.fixedTimeStep;
            steps++;
        }

        if (steps === 4) {
            this.accumulator = 0;
        }
    }

    // =========================================
    // POSITION ABFRAGEN
    // =========================================

    getTransform(coin) {

        if (!coin) return null;

        if (coin.body && coin.active) {

            const p = coin.body.translation();
            const r = coin.body.rotation();

            coin.lastPosition = {
                x: p.x,
                y: p.y,
                z: p.z
            };

            coin.lastRotation = {
                x: r.x,
                y: r.y,
                z: r.z,
                w: r.w
            };
        }

        return {
            position: coin.lastPosition,
            rotation: coin.lastRotation
        };
    }

    // =========================================
    // MÜNZE ENTFERNEN
    // =========================================

    removeCoin(coin) {

        if (!coin) return;

        if (coin.body) {
            this.world.removeRigidBody(coin.body);
        }

        this.bodies.delete(coin.id);

        coin.body = null;
        coin.active = false;
        coin.frozen = false;
    }

    // =========================================
    // AKTIVE MÜNZEN
    // =========================================

    getActiveCount() {
        return this.bodies.size;
    }

    // =========================================
    // AUFRÄUMEN
    // =========================================

    destroy() {

        if (this.world) {
            this.world.free();
        }

        this.bodies.clear();
        this.world = null;
        this.ready = false;
    }
}
