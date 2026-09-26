import { _decorator, Component, MeshRenderer, Node, Quat, v3, Vec3 } from "cc";
import { Furniture } from "./Furniture";
import { PlayerAttack } from "./PlayerAttack";
import { WallCollision } from "./WallCollision";
import { Zombie } from "./Zombie";

const { ccclass, property } = _decorator;

/** A loose thing as a rigid body. `node` is a holder at its centre of mass; the furniture hangs under it. */
export interface Body {
	node: Node;
	furniture: Furniture;
	mass: number;
	invMass: number;
	invInertia: Vec3;
	boxMin: Vec3;
	boxMax: Vec3;
	radius: number;
	velocity: Vec3;
	angular: Vec3;
	idle: number;
	asleep: boolean;
	held: boolean;
	ignore: Node;
	ignoreFor: number;
	safeX: number;
	safeZ: number;
}

interface Mover {
	node: Node;
	radius: number;
	speed: number;
	zombie: Zombie;
}

const _r = v3();
const _point = v3();
const _pointVelocity = v3();
const _tangent = v3();
const _impulse = v3();
const _tmp = v3();
const _spin = new Quat();
const _inverse = new Quat();

// Loose things — small furniture — as rigid bodies, the way ThroughTheDeadCity's Debris does it.
// Each has its own centre of mass and inertia, and the floor is met at the corners that really
// touch it, so whether a thing tips over or stays up is not a rule but what gravity does. The
// player and the zombies kick them as they walk into them; a thing flying fast enough into a
// zombie kills it. The player may instead pick one up and throw it (PlayerActions): while it is
// held, physics leaves it alone. Numbers are ThroughTheDeadCity's scaled to this game's size.
@ccclass("Debris")
export class Debris extends Component {
	static instance: Debris = null;

	@property({ tooltip: "Mass per unit of box volume" })
	density: number = 300;
	@property minMass: number = 2;
	@property({ tooltip: "Kick from someone walking into a thing, speed per unit of mass" })
	kick: number = 0.76;
	@property({ tooltip: "Share of the kick even someone standing still gives" })
	minKickShare: number = 0.35;
	@property({ tooltip: "Upward part of a kick: the thing slides off rather than flies" })
	lift: number = 0.19;
	@property({ tooltip: "Fastest a foot sends a thing" })
	maxKickSpeed: number = 1.1;
	@property maxKickSpin: number = 6;
	@property gravity: number = 7.5;
	@property({ tooltip: "Bounce off the floor" })
	bounce: number = 0.28;
	@property({ tooltip: "Slower than this it lies down instead of bouncing" })
	bounceThreshold: number = 0.5;
	@property friction: number = 0.55;
	@property({ tooltip: "How hard a thing sunk into the floor is pushed out" })
	correction: number = 0.4;
	@property allowedOverlap: number = 0.0005;
	@property iterations: number = 4;
	@property linearDamping: number = 0.35;
	@property angularDamping: number = 0.9;
	@property({ tooltip: "Bounce off a wall" })
	restitution: number = 0.4;
	@property({ tooltip: "Speed kept after hitting a wall" })
	wallDamping: number = 0.75;
	@property({ tooltip: "Share of a push handed on to a neighbour" })
	transfer: number = 0.45;
	@property spinWeight: number = 0.08;
	@property sleepEnergy: number = 0.0035;
	@property sleepDelay: number = 0.35;
	@property wakeSpeed: number = 0.084;
	@property({ tooltip: "Closing speed at which a flying thing kills a zombie outright" })
	lethalSpeed: number = 2.3;
	@property({ tooltip: "Radius of the player and of a zombie, for touching things" })
	moverRadius: number = 0.2;
	@property({ tooltip: "Height of a body, for telling a thing flying over a head from one hitting it" })
	bodyHeight: number = 0.75;

	readonly bodies: Body[] = [];

	/** Offered a thing the player touches: returns true when it is taken into the hand, and so not kicked. */
	grab: (body: Body) => boolean = null;

	private _walls: WallCollision = null;
	private _last = new Map<Node, Vec3>();
	private _movers: Mover[] = [];
	private _before = v3();
	private _normal = v3();

	protected onLoad(): void {
		Debris.instance = this;
	}

	protected onDestroy(): void {
		if (Debris.instance === this) {
			Debris.instance = null;
		}
	}

	protected start(): void {
		this._walls = this.getComponent(WallCollision);
		for (const furniture of this.node.scene.getComponentsInChildren(Furniture)) {
			if (furniture.small) {
				this._add(furniture);
			}
		}
	}

	/**
	 * Any node with a mesh made a loose thing — say, what falls off the player's back. Its box
	 * comes from its mesh at its world size. It starts asleep; `launch` sends it flying.
	 */
	addLoose(node: Node, parent: Node): Body {
		const renderer = node.getComponent(MeshRenderer) || node.getComponentInChildren(MeshRenderer);
		const struct = renderer && renderer.mesh && renderer.mesh.struct;
		const scale = node.worldScale;
		const min = struct && struct.minPosition ? Vec3.multiply(v3(), struct.minPosition, scale) : v3(-0.03, -0.03, -0.03);
		const max = struct && struct.maxPosition ? Vec3.multiply(v3(), struct.maxPosition, scale) : v3(0.03, 0.03, 0.03);
		node.setParent(parent, true);
		return this._addBody(node, min, max, null);
	}

	private _add(furniture: Furniture): void {
		this._addBody(furniture.node, furniture.boxMin, furniture.boxMax, furniture);
	}

	/** Puts a holder at the thing's centre of mass and hangs the thing under it: rotation turns it about its middle. */
	private _addBody(node: Node, min: Vec3, max: Vec3, furniture: Furniture): Body {
		const centre = v3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
		const holder = new Node(`${node.name} body`);
		node.parent.addChild(holder);
		const world = v3();
		Vec3.transformQuat(world, centre, node.worldRotation);
		holder.setWorldPosition(node.worldPosition.x + world.x, node.worldPosition.y + world.y, node.worldPosition.z + world.z);
		holder.setWorldRotation(node.worldRotation);
		node.setParent(holder, true);

		const size = v3(Math.max(max.x - min.x, 1e-3), Math.max(max.y - min.y, 1e-3), Math.max(max.z - min.z, 1e-3));
		const mass = Math.max(this.minMass, size.x * size.y * size.z * this.density);
		const ix = (mass / 12) * (size.y * size.y + size.z * size.z);
		const iy = (mass / 12) * (size.x * size.x + size.z * size.z);
		const iz = (mass / 12) * (size.x * size.x + size.y * size.y);
		const body: Body = {
			node: holder,
			furniture,
			mass,
			invMass: 1 / mass,
			invInertia: v3(1 / ix, 1 / iy, 1 / iz),
			boxMin: Vec3.subtract(v3(), min, centre),
			boxMax: Vec3.subtract(v3(), max, centre),
			radius: Math.max(size.x, size.z) / 2,
			velocity: v3(),
			angular: v3(),
			idle: 0,
			asleep: true,
			held: false,
			ignore: null,
			ignoreFor: 0,
			safeX: null,
			safeZ: null,
		};
		this.bodies.push(body);
		return body;
	}

	/** Into the hand: physics lets go of it until it is launched. */
	hold(body: Body): void {
		body.held = true;
		body.velocity.set(0, 0, 0);
		body.angular.set(0, 0, 0);
		body.asleep = true;
		body.idle = 0;
	}

	/**
	 * Out of the hand, flying: `speed` along the floor towards (dirX, dirZ), `lift` of it
	 * upwards, tumbling at `spin`. `by` does not touch it for `grace` seconds.
	 */
	launch(body: Body, dirX: number, dirZ: number, speed: number, lift: number, spin: number, by: Node = null, grace = 0): void {
		body.held = false;
		body.ignore = by;
		body.ignoreFor = grace;
		body.velocity.set(dirX * speed, speed * lift, dirZ * speed);
		body.angular.set(-dirZ * spin, 0, dirX * spin);
		body.asleep = false;
		body.idle = 0;
	}

	/** The loose thing the player is touching now, or null. */
	touching(at: Vec3): Body {
		for (const body of this.bodies) {
			if (body.held || !body.node.isValid) {
				continue;
			}
			const position = body.node.worldPosition;
			if (Math.hypot(position.x - at.x, position.z - at.z) > body.radius + this.moverRadius) {
				continue;
			}
			if (position.y - at.y < -body.radius || position.y - at.y > this.bodyHeight) {
				continue;
			}
			return body;
		}
		return null;
	}

	protected update(dt: number): void {
		if (dt <= 0) {
			return;
		}
		this._gatherMovers(dt);
		for (const body of this.bodies) {
			if (body.held || !body.node.isValid) {
				continue;
			}
			if (body.ignoreFor > 0) {
				body.ignoreFor -= dt;
			}
			for (const mover of this._movers) {
				if (body.ignoreFor > 0 && mover.node === body.ignore) {
					continue;
				}
				this._crush(body, mover);
				// The player may take it into the hand instead of kicking it.
				if (!mover.zombie && this.grab && this._touches(body, mover) && this.grab(body)) {
					break;
				}
				this._kick(body, mover);
			}
			if (body.asleep) {
				continue;
			}
			this._integrate(body, dt);
			for (let i = 0; i < this.iterations; i++) {
				this._resolveGround(body);
			}
			this._liftFromFloor(body);
			this._collideWalls(body);
			this._checkSleep(body, dt);
		}
		this._separate();
	}

	/** Who can touch a thing this frame, and how fast each is going. */
	private _gatherMovers(dt: number): void {
		this._movers.length = 0;
		const player = PlayerAttack.instance;
		if (player && !player.isDead) {
			this._movers.push(this._mover(player.node, null, dt));
		}
		for (const zombie of Zombie.all) {
			this._movers.push(this._mover(zombie.node, zombie, dt));
		}
	}

	private _mover(node: Node, zombie: Zombie, dt: number): Mover {
		const at = node.worldPosition;
		let last = this._last.get(node);
		if (!last) {
			last = at.clone();
			this._last.set(node, last);
		}
		const speed = Math.hypot(at.x - last.x, at.z - last.z) / dt;
		last.set(at);
		return { node, radius: this.moverRadius, speed, zombie };
	}

	private _touches(body: Body, mover: Mover): boolean {
		const position = body.node.worldPosition;
		const at = mover.node.worldPosition;
		return Math.hypot(position.x - at.x, position.z - at.z) <= body.radius + mover.radius && !this._pastHeight(body, mover);
	}

	/** Out of reach up or down: a thing flying over a head does not touch it. */
	private _pastHeight(body: Body, mover: Mover): boolean {
		const high = body.node.worldPosition.y - mover.node.worldPosition.y;
		return high < -body.radius || high > this.bodyHeight;
	}

	/**
	 * A thing flying fast at a zombie kills it. What counts is the speed at which it closes on
	 * the zombie, not its full speed: one the zombie kicked away from itself is harmless to it.
	 */
	private _crush(body: Body, mover: Mover): void {
		if (body.asleep || !mover.zombie || mover.zombie.isDead) {
			return;
		}
		const position = body.node.worldPosition;
		const at = mover.node.worldPosition;
		const dx = position.x - at.x;
		const dz = position.z - at.z;
		const gap = Math.hypot(dx, dz);
		if (gap > body.radius + mover.radius || gap < 1e-4 || this._pastHeight(body, mover)) {
			return;
		}
		const closing = -(body.velocity.x * dx + body.velocity.z * dz) / gap;
		if (closing < this.lethalSpeed) {
			return;
		}
		const player = PlayerAttack.instance;
		const blood = player && player.zombieBlood;
		blood && blood.splash(v3(at.x, at.y + 0.4, at.z), position, player.killSplash);
		mover.zombie.kill();
	}

	/** A kick lands on the side of a thing, not its middle — so it spins as well. */
	private _kick(body: Body, mover: Mover): void {
		const position = body.node.worldPosition;
		const at = mover.node.worldPosition;
		let dx = position.x - at.x;
		let dz = position.z - at.z;
		const distance = Math.hypot(dx, dz);
		const touch = body.radius + mover.radius;
		if (distance > touch || this._pastHeight(body, mover)) {
			return;
		}
		if (distance > 1e-4) {
			dx /= distance;
			dz /= distance;
		} else {
			dx = 1;
			dz = 0;
		}
		const share = this.minKickShare + (1 - this.minKickShare) * Math.min(1, mover.speed / 2);
		const power = this.kick * share * body.mass;
		// At foot height, on the side of the thing.
		_point.set(-dx * body.radius, Math.max(body.boxMin.y, -body.radius) * 0.5, -dz * body.radius);
		_impulse.set(dx * power, this.lift * body.mass * share, dz * power);
		this._applyImpulse(body, _impulse, _point);

		const speed = body.velocity.length();
		if (speed > this.maxKickSpeed) {
			body.velocity.multiplyScalar(this.maxKickSpeed / speed);
		}
		const spin = body.angular.length();
		if (spin > this.maxKickSpin) {
			body.angular.multiplyScalar(this.maxKickSpin / spin);
		}
		body.asleep = false;
		body.idle = 0;

		// Out of the kicker's body at once — but not through a wall; the push stays either way.
		const nextX = at.x + dx * touch;
		const nextZ = at.z + dz * touch;
		if (this._walls && this._walls.isBlocked(nextX, nextZ)) {
			return;
		}
		body.node.setWorldPosition(nextX, position.y, nextZ);
	}

	/** An impulse at r from the centre of mass: changes both the speed and the spin. */
	private _applyImpulse(body: Body, impulse: Vec3, r: Vec3): void {
		Vec3.scaleAndAdd(body.velocity, body.velocity, impulse, body.invMass);
		Vec3.cross(_tmp, r, impulse);
		body.angular.add(this._applyInvInertia(body, _tmp));
	}

	/** Multiplying by the inverse inertia tensor: into the body's axes and back. */
	private _applyInvInertia(body: Body, vector: Vec3): Vec3 {
		const q = body.node.worldRotation;
		Quat.invert(_inverse, q);
		Vec3.transformQuat(vector, vector, _inverse);
		Vec3.multiply(vector, vector, body.invInertia);
		return Vec3.transformQuat(vector, vector, q);
	}

	private _integrate(body: Body, dt: number): void {
		body.velocity.y -= this.gravity * dt;
		body.velocity.multiplyScalar(Math.exp(-this.linearDamping * dt));
		body.angular.multiplyScalar(Math.exp(-this.angularDamping * dt));
		const at = body.node.worldPosition;
		body.node.setWorldPosition(at.x + body.velocity.x * dt, at.y + body.velocity.y * dt, at.z + body.velocity.z * dt);
		// q += ½·ω·q·dt
		const q = body.node.worldRotation.clone();
		_spin.set(body.angular.x, body.angular.y, body.angular.z, 0);
		Quat.multiply(_spin, _spin, q);
		q.x += _spin.x * 0.5 * dt;
		q.y += _spin.y * 0.5 * dt;
		q.z += _spin.z * 0.5 * dt;
		q.w += _spin.w * 0.5 * dt;
		Quat.normalize(q, q);
		body.node.setWorldRotation(q);
	}

	/** Meets the floor at the eight corners of its box: corners gone under push up and lose speed — which tips it over. */
	private _resolveGround(body: Body): void {
		const position = body.node.worldPosition;
		const q = body.node.worldRotation;
		for (let cx = 0; cx < 2; cx++) {
			for (let cy = 0; cy < 2; cy++) {
				for (let cz = 0; cz < 2; cz++) {
					_r.set(cx ? body.boxMax.x : body.boxMin.x, cy ? body.boxMax.y : body.boxMin.y, cz ? body.boxMax.z : body.boxMin.z);
					Vec3.transformQuat(_r, _r, q);
					if (position.y + _r.y >= 0) {
						continue;
					}
					Vec3.cross(_pointVelocity, body.angular, _r).add(body.velocity);
					const normalSpeed = _pointVelocity.y;
					if (normalSpeed >= 0) {
						continue;
					}
					const bounce = normalSpeed < -this.bounceThreshold ? this.bounce : 0;
					const denominator = body.invMass + this._normalDenominator(body, _r);
					const j = (-(1 + bounce) * normalSpeed) / denominator;
					_impulse.set(0, j, 0);
					this._applyImpulse(body, _impulse, _r);
					// Friction: slide along the floor dies down, no more than Coulomb allows.
					Vec3.cross(_pointVelocity, body.angular, _r).add(body.velocity);
					_tangent.set(_pointVelocity.x, 0, _pointVelocity.z);
					const slide = _tangent.length();
					if (slide > 1e-4) {
						_tangent.multiplyScalar(1 / slide);
						const jt = Math.min(slide / denominator, this.friction * j);
						Vec3.multiplyScalar(_impulse, _tangent, -jt);
						this._applyImpulse(body, _impulse, _r);
					}
				}
			}
		}
	}

	/** Out of the floor by the deepest corner, in its own step — corrected inside the solver it would jitter. */
	private _liftFromFloor(body: Body): void {
		const position = body.node.worldPosition;
		const q = body.node.worldRotation;
		let deepest = 0;
		for (let cx = 0; cx < 2; cx++) {
			for (let cy = 0; cy < 2; cy++) {
				for (let cz = 0; cz < 2; cz++) {
					_r.set(cx ? body.boxMax.x : body.boxMin.x, cy ? body.boxMax.y : body.boxMin.y, cz ? body.boxMax.z : body.boxMin.z);
					Vec3.transformQuat(_r, _r, q);
					deepest = Math.min(deepest, position.y + _r.y);
				}
			}
		}
		const depth = -deepest - this.allowedOverlap;
		if (depth > 0) {
			body.node.setWorldPosition(position.x, position.y + depth * this.correction, position.z);
		}
	}

	/** Denominator of the impulse along the vertical: 1/m + n·(I⁻¹(r×n))×r. */
	private _normalDenominator(body: Body, r: Vec3): number {
		_tmp.set(-r.z, 0, r.x);
		this._applyInvInertia(body, _tmp);
		Vec3.cross(_point, _tmp, r);
		return Math.max(0, _point.y);
	}

	/** Off the walls: pushed out, bounced back, and never left inside one. */
	private _collideWalls(body: Body): void {
		if (!this._walls) {
			return;
		}
		const position = body.node.worldPosition.clone();
		this._before.set(position);
		this._walls.pushOut(position);
		if (this._walls.isBlocked(position.x, position.z)) {
			// Still inside after the push: back to where it last stood clear, and stopped.
			if (body.safeX !== null) {
				body.node.setWorldPosition(body.safeX, position.y, body.safeZ);
				body.velocity.x = 0;
				body.velocity.z = 0;
			}
			return;
		}
		body.safeX = position.x;
		body.safeZ = position.z;
		body.node.setWorldPosition(position);
		this._normal.set(position.x - this._before.x, 0, position.z - this._before.z);
		const pushed = this._normal.length();
		if (pushed < 1e-5) {
			return;
		}
		this._normal.multiplyScalar(1 / pushed);
		const along = Vec3.dot(body.velocity, this._normal);
		if (along < 0) {
			Vec3.scaleAndAdd(body.velocity, body.velocity, this._normal, -along * (1 + this.restitution));
			body.velocity.multiplyScalar(this.wallDamping);
			body.angular.multiplyScalar(this.wallDamping);
		}
	}

	/** Asleep only after being calm for a few frames running. */
	private _checkSleep(body: Body, dt: number): void {
		const energy = body.velocity.lengthSqr() + body.angular.lengthSqr() * this.spinWeight;
		if (energy > this.sleepEnergy) {
			body.idle = 0;
			return;
		}
		body.idle += dt;
		if (body.idle < this.sleepDelay) {
			return;
		}
		body.velocity.set(0, 0, 0);
		body.angular.set(0, 0, 0);
		body.asleep = true;
	}

	/** Things push each other apart — a heap scatters as a whole. */
	private _separate(): void {
		const bodies = this.bodies;
		for (let i = 0; i < bodies.length; i++) {
			const a = bodies[i];
			if (a.held || !a.node.isValid) {
				continue;
			}
			for (let j = i + 1; j < bodies.length; j++) {
				const b = bodies[j];
				if (b.held || !b.node.isValid || (a.asleep && b.asleep)) {
					continue;
				}
				const pa = a.node.worldPosition.clone();
				const pb = b.node.worldPosition.clone();
				const dx = pb.x - pa.x;
				const dz = pb.z - pa.z;
				const gap = a.radius + b.radius;
				const distanceSq = dx * dx + dz * dz;
				if (distanceSq > gap * gap || distanceSq < 1e-8 || Math.abs(pb.y - pa.y) > gap) {
					continue;
				}
				const distance = Math.sqrt(distanceSq);
				const nx = dx / distance;
				const nz = dz / distance;
				const overlap = (gap - distance) / 2;
				a.node.setWorldPosition(pa.x - nx * overlap, pa.y, pa.z - nz * overlap);
				b.node.setWorldPosition(pb.x + nx * overlap, pb.y, pb.z + nz * overlap);
				// A neighbour is woken only when it is really being driven into.
				const approach = (a.velocity.x - b.velocity.x) * nx + (a.velocity.z - b.velocity.z) * nz;
				if (approach > this.wakeSpeed) {
					a.asleep = b.asleep = false;
					a.idle = b.idle = 0;
				}
				if (approach > 0) {
					const exchange = (approach * this.transfer * 2) / (a.invMass + b.invMass);
					_impulse.set(-nx * exchange, 0, -nz * exchange);
					Vec3.scaleAndAdd(a.velocity, a.velocity, _impulse, a.invMass);
					Vec3.scaleAndAdd(b.velocity, b.velocity, _impulse, -b.invMass);
				}
			}
		}
	}
}
