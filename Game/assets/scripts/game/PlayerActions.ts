import { _decorator, AnimationClip, Component, Node, v3, Vec3 } from "cc";
import { AnimationController } from "./AnimationController";
import { Body, Debris } from "./Debris";
import { FaceDirection } from "./FaceDirection";
import { Furniture } from "./Furniture";
import { PlayerAttack } from "./PlayerAttack";
import { PlayerMovement } from "./PlayerMovement";
import { WallCollision } from "./WallCollision";
import { Zombie } from "./Zombie";

const { ccclass, property } = _decorator;

interface Throw {
	body: Body;
	target: Zombie;
	time: number;
	length: number;
	picked: boolean;
	released: boolean;
}

/** A thrown barrel on its arc to the zombie, to be shot in the air over it. */
interface Blast {
	body: Body;
	/** The zombie it was thrown at: the arc ends on it, and follows it. */
	target: Zombie;
	/** Seconds since it left the hand. */
	time: number;
	/** Seconds the arc takes. */
	duration: number;
	from: Vec3;
	to: Vec3;
	/** How high the arc rises over the straight line from the hand to the target. */
	height: number;
	spin: Vec3;
	/** Seconds until the potion leaves the gun, once the shooting clip plays on; below zero — not yet fired. */
	fireIn: number;
	/** The potion is on its way. */
	shot: boolean;
	/** Seconds left of standing still after the blast; below zero — not yet. */
	settle: number;
}

interface Jump {
	from: Vec3;
	to: Vec3;
	arc: number;
	time: number;
	takeoff: number;
	landing: number;
}

// What the player does with furniture, the way ThroughTheDeadCity's Player does it.
// Walking into a small piece with a zombie in sight, they pick it up and throw it at the
// zombie: the throw clip runs three times faster, the piece is taken from the floor where the
// hand reaches it and leaves the hand where the swing is fastest — both found on the clip's own
// timeline — and flies on its own physics (Debris). Running into a large piece, they jump over
// it: the jump clip runs twice as fast, the arc starts where the hips leave the ground and ends
// where they touch it again, rises over the piece's height, and lands just past its far edge —
// or there is no jump when that spot is a wall or the piece is too tall or too deep.
// An explosive piece — a barrel — is taken even standing next to it. With potions left it goes
// on an arc of its own onto the zombie, tumbling, and the player, the gun already up, shoots it
// over it — the way ThroughTheDeadCity finishes the throw; its blast spares the player.
// Without potions it just flies like any other piece.
@ccclass("PlayerActions")
export class PlayerActions extends Component {
	static instance: PlayerActions = null;

	@property(AnimationController) animationController: AnimationController = null;
	@property(FaceDirection) faceDirection: FaceDirection = null;
	@property({ type: Node, tooltip: "Where a piece is held — the right hand's socket" })
	hand: Node = null;

	@property(AnimationClip) throwClip: AnimationClip = null;
	@property({ tooltip: "Playback speed of the throw clip" })
	throwSpeed: number = 6;
	@property({ tooltip: "Point of the throw clip, 0..1, where the hand takes the piece off the floor — its lowest reach" })
	throwPickup: number = 0.2;
	@property({ tooltip: "Point of the throw clip, 0..1, where the piece leaves the hand — the fastest swing forward" })
	throwRelease: number = 0.493;
	@property({ tooltip: "Speed the piece leaves the hand at, along the floor" })
	throwPower: number = 5;
	@property({ tooltip: "Share of that speed upwards: the piece arcs" })
	throwLift: number = 0.32;
	@property({ tooltip: "Tumble of a thrown piece, radians per second" })
	throwSpin: number = 8;
	@property({ tooltip: "Seconds after a throw before the next piece is picked up" })
	throwCooldown: number = 0.45;
	@property({ tooltip: "Seconds a thrown piece does not touch the thrower" })
	throwGrace: number = 0.5;
	@property({ tooltip: "A barrel this close, gap between it and the player, is taken even standing still" })
	grabNear: number = 0.38;
	@property({ tooltip: "Playback speed of the throw clip when it is a barrel" })
	barrelThrowSpeed: number = 9;
	@property({ tooltip: "Point of the shooting clip, 0..1, the aim is held at while a barrel flies — the gun at the shoulder, just short of the shot" })
	aimMoment: number = 0.3;
	@property({ tooltip: "How many times faster than a plain shot the shot at a thrown barrel plays" })
	barrelShotRate: number = 2;
	@property({ tooltip: "Seconds a barrel's arc takes, and how much longer per unit of distance" })
	barrelFlight: number = 0.45;
	@property({ tooltip: "Extra seconds of a barrel's arc per unit of distance" })
	barrelFlightPerUnit: number = 0.08;
	@property({ tooltip: "How high a barrel's arc rises over the straight line to the target" })
	barrelArc: number = 0.9;
	@property({ tooltip: "Height above the zombie's feet the arc ends at" })
	barrelAimHeight: number = 0.35;
	@property({ tooltip: "Tumble of a thrown barrel, degrees per second" })
	barrelSpin: number = 540;
	@property({ tooltip: "Seconds after a barrel leaves the hand before the shot at it may come" })
	shootAfter: number = 0.15;
	@property({ tooltip: "Without potions: speed a barrel leaves the hand at along the floor, and share of it upwards — thrown like any piece" })
	barrelPower: number = 4;
	@property({ tooltip: "Share of that speed upwards" })
	barrelLift: number = 0.5;
	@property({ tooltip: "Seconds the player stands still after the blast" })
	settleAfter: number = 0.5;
	@property({ tooltip: "Where a held piece sits against the hand, world units" })
	holdOffset: Vec3 = v3(0, -0.05, 0);

	@property(AnimationClip) jumpClip: AnimationClip = null;
	@property({ tooltip: "Playback speed of the jump clip" })
	jumpSpeed: number = 2;
	@property({ tooltip: "Point of the jump clip, 0..1, where the hips leave the ground" })
	jumpTakeoff: number = 0.298;
	@property({ tooltip: "Point of the jump clip, 0..1, where they touch it again" })
	jumpLanding: number = 0.544;
	@property({ tooltip: "How far above the piece's top the arc passes" })
	jumpClear: number = 0.15;
	@property({ tooltip: "How far ahead, past the player's radius, a piece to jump is felt for" })
	vaultProbe: number = 0.15;
	@property({ tooltip: "How far past the piece's far edge the feet come down" })
	vaultClearance: number = 0.3;
	@property({ tooltip: "Taller than this — no jump" })
	vaultMaxHeight: number = 1;
	@property({ tooltip: "Deeper than this across — no jump" })
	vaultMaxDepth: number = 1.35;
	@property({ tooltip: "The player's radius on the floor" })
	radius: number = 0.2;

	private _attack: PlayerAttack = null;
	private _movement: PlayerMovement = null;
	private _walls: WallCollision = null;
	private _throw: Throw = null;
	private _jump: Jump = null;
	private _blast: Blast = null;
	private _cooldown = 0;
	private _dir = v3();
	private _probe = v3();
	private _at = v3();

	/** Throwing, shooting a thrown barrel, or in the air. */
	get busy(): boolean {
		return !!(this._throw || this._jump || this._blast);
	}

	protected onLoad(): void {
		PlayerActions.instance = this;
	}

	protected onDestroy(): void {
		if (PlayerActions.instance === this) {
			PlayerActions.instance = null;
		}
	}

	protected start(): void {
		this._attack = this.getComponent(PlayerAttack);
		this._movement = this.getComponent(PlayerMovement);
		this._walls = this.getComponent(WallCollision);
		const debris = Debris.instance;
		if (debris) {
			debris.grab = (body) => this._grab(body);
		}
	}

	protected update(dt: number): void {
		// A barrel in the air: its shot is timed from the moment it left the hand, while the
		// throw clip may still be playing out.
		if (this._blast) {
			this._blastStep(dt);
			return;
		}
		if (this._throw) {
			this._throwStep(dt);
			return;
		}
		if (this._jump) {
			this._jumpStep(dt);
			return;
		}
		this._cooldown -= dt;
		if (this._attack && this._attack.isDead) {
			return;
		}
		if (this._movement && this._movement.moveDirection(this._dir)) {
			this._tryVault();
		} else {
			this._grabNearby();
		}
	}

	protected lateUpdate(): void {
		// The piece rides in the hand from the moment it is picked up until it is let go.
		const toss = this._throw;
		if (toss && toss.picked && !toss.released && this.hand) {
			Vec3.add(this._at, this.hand.worldPosition, this.holdOffset);
			toss.body.node.setWorldPosition(this._at);
		}
	}

	// --- throw

	/** Offered a piece the player walked into: taken when there is someone to throw it at. */
	private _grab(body: Body): boolean {
		if (this.busy || this._cooldown > 0 || !this.throwClip || !this._attack || this._attack.isDead) {
			return false;
		}
		const target = this._attack.target || this._attack.nearestTarget();
		if (!target) {
			return false;
		}
		Debris.instance.hold(body);
		const speed = this._explosive(body) ? this.barrelThrowSpeed : this.throwSpeed;
		const length = this.animationController ? this.animationController.override(this.throwClip, "throw", speed) : 0;
		this._throw = { body, target, time: 0, length, picked: false, released: false };
		this._lock(true);
		return true;
	}

	private _throwStep(dt: number): void {
		const toss = this._throw;
		toss.time += dt;
		if (this._attack.isDead) {
			this._drop();
			return;
		}
		// The body turns to the target through the swing: it is thrown at the one chosen.
		if (toss.target.isValid && !toss.target.isDead) {
			this.faceDirection && this.faceDirection.faceTowards(toss.target.node.worldPosition);
		}
		if (!toss.picked && toss.time >= toss.length * this.throwPickup) {
			toss.picked = true;
		}
		if (!toss.released && toss.time >= toss.length * this.throwRelease) {
			this._release();
		}
		if (toss.time < toss.length) {
			return;
		}
		this._throw = null;
		this._cooldown = this.throwCooldown;
		// Hands free; a barrel still to be shot keeps the player where they are.
		if (!this._blast) {
			this._lock(false);
		}
	}

	/** The hand opens: off it goes at the target — or straight ahead if the target is gone. */
	private _release(): void {
		const toss = this._throw;
		toss.released = true;
		toss.picked = true;
		const from = this.hand ? Vec3.add(this._at, this.hand.worldPosition, this.holdOffset) : this._at.set(this.node.worldPosition);
		toss.body.node.setWorldPosition(from);
		let dirX = 0;
		let dirZ = 1;
		const facing = this.faceDirection ? this.faceDirection.node.worldRotation : this.node.worldRotation;
		Vec3.transformQuat(this._probe, Vec3.FORWARD, facing);
		dirX = -this._probe.x;
		dirZ = -this._probe.z;
		if (toss.target.isValid && !toss.target.isDead) {
			const at = toss.target.node.worldPosition;
			dirX = at.x - from.x;
			dirZ = at.z - from.z;
		}
		const length = Math.hypot(dirX, dirZ) || 1;
		const barrel = this._explosive(toss.body);
		// With a potion to spare, a barrel goes on an arc of its own onto the zombie, to be shot
		// over it; the player brings the gun up at once and has it covered all the way.
		if (barrel && this._attack.ammo > 0 && toss.target.isValid && !toss.target.isDead) {
			const to = this._arcEnd(toss.target, v3());
			const distance = Vec3.distance(from, to);
			const spin = v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(this.barrelSpin);
			this._blast = {
				body: toss.body,
				target: toss.target,
				time: 0,
				duration: this.barrelFlight + distance * this.barrelFlightPerUnit,
				from: from.clone(),
				to,
				height: this.barrelArc,
				spin,
				fireIn: -1,
				shot: false,
				settle: -1,
			};
			this.animationController && this.animationController.aim(this.aimMoment);
			return;
		}
		Debris.instance.launch(
			toss.body,
			dirX / length,
			dirZ / length,
			barrel ? this.barrelPower : this.throwPower,
			barrel ? this.barrelLift : this.throwLift,
			this.throwSpin,
			this.node,
			this.throwGrace,
		);
	}

	// --- a thrown barrel, shot in the air

	private _blastStep(dt: number): void {
		const blast = this._blast;
		// The throw's own timing plays out alongside; the aim is already over its clip.
		if (this._throw) {
			this._throwStep(dt);
		}
		blast.time += dt;
		if (blast.settle >= 0) {
			if ((blast.settle -= dt) <= 0) {
				this._endBlast();
			}
			return;
		}
		const node = blast.body.node;
		const debris = Debris.instance;
		if (!node.isValid || !debris || debris.bodies.indexOf(blast.body) < 0) {
			// Gone off — the potion caught it, or another blast reached it first.
			blast.settle = this.settleAfter;
			return;
		}
		if (this._attack.isDead) {
			this._dropBarrel();
			this._endBlast();
			return;
		}
		this._fly(blast, dt);
		this.faceDirection && this.faceDirection.faceTowards(node.worldPosition);
		if (blast.shot) {
			return;
		}
		if (blast.fireIn >= 0) {
			// The clip is playing the shot: the potion leaves at the same point of it as any other.
			if ((blast.fireIn -= dt) < 0) {
				blast.shot = this._attack.shootBarrel(blast.body);
				!blast.shot && this._dropBarrel();
			}
			return;
		}
		// The shot is let go early enough for the potion to catch the barrel at the end of its
		// arc: the clip's run-up to the shot, then the potion's flight to where the arc ends.
		const muzzle = this._attack.muzzle ? this._attack.muzzle.worldPosition : this.node.worldPosition;
		const catchUp = this._shotDelay() + Vec3.distance(muzzle, blast.to) / Math.max(this._attack.barrelShotSpeed, 0.01);
		if (blast.time >= this.shootAfter && blast.time >= blast.duration - catchUp) {
			blast.fireIn = this.animationController ? this.animationController.fire(this.barrelShotRate, this._attack.shotMoment) : 0;
		}
	}

	/** Along the arc: a straight line from the hand to the zombie, lifted by a parabola, tumbling; it waits at the end for the potion. */
	private _fly(blast: Blast, dt: number): void {
		if (blast.target.isValid && !blast.target.isDead) {
			this._arcEnd(blast.target, blast.to);
		}
		const t = Math.min(1, blast.time / Math.max(blast.duration, 0.05));
		Vec3.lerp(this._at, blast.from, blast.to, t);
		this._at.y += blast.height * 4 * t * (1 - t);
		const node = blast.body.node;
		node.setWorldPosition(this._at);
		if (t < 1) {
			const euler = node.eulerAngles;
			node.setRotationFromEuler(euler.x + blast.spin.x * dt, euler.y + blast.spin.y * dt, euler.z + blast.spin.z * dt);
		}
	}

	private _arcEnd(target: Zombie, out: Vec3): Vec3 {
		const at = target.node.worldPosition;
		return out.set(at.x, at.y + this.barrelAimHeight, at.z);
	}

	/** No shot after all: the barrel falls where it is, a loose thing again. */
	private _dropBarrel(): void {
		const blast = this._blast;
		if (blast && blast.body.node.isValid && Debris.instance && Debris.instance.bodies.indexOf(blast.body) >= 0) {
			Debris.instance.launch(blast.body, 0, 0, 0, 0, 0, this.node, this.throwGrace);
		}
	}

	/** Seconds from letting the held aim go to the potion leaving the gun. */
	private _shotDelay(): number {
		const length = this.animationController ? this.animationController.shotLength(this.barrelShotRate) : 0;
		return length * Math.max(0, this._attack.shotMoment - this.aimMoment);
	}

	private _endBlast(): void {
		this._blast = null;
		if (!this._throw) {
			this._lock(false);
		}
	}

	private _explosive(body: Body): boolean {
		return !!(body && body.furniture && body.furniture.explosive);
	}

	/** Standing next to a barrel: it is taken first, before any shooting. */
	private _grabNearby(): void {
		const debris = Debris.instance;
		if (!debris || this.busy || this._cooldown > 0) {
			return;
		}
		const at = this.node.worldPosition;
		let best: Body = null;
		let bestGap = this.grabNear;
		for (const body of debris.bodies) {
			if (body.held || !this._explosive(body) || !body.node.isValid) {
				continue;
			}
			if (!body.asleep && body.velocity.lengthSqr() > 1) {
				continue; // still flying
			}
			const p = body.node.worldPosition;
			const gap = Math.hypot(p.x - at.x, p.z - at.z) - body.radius - this.radius;
			if (gap <= bestGap) {
				best = body;
				bestGap = gap;
			}
		}
		best && this._grab(best);
	}

	/** The player fell mid-throw: the piece drops where it is. */
	private _drop(): void {
		const toss = this._throw;
		this._throw = null;
		if (!toss.released) {
			Debris.instance.launch(toss.body, 0, 0, 0, 0, 0, this.node, this.throwGrace);
		}
		this._lock(false);
	}

	// --- jump

	/** Running into a large piece: over it, if there is somewhere to land. */
	private _tryVault(): void {
		const at = this.node.worldPosition;
		const dir = this._dir;
		const probe = this.radius + this.vaultProbe;
		const px = at.x + dir.x * probe;
		const pz = at.z + dir.z * probe;
		for (const piece of Furniture.large) {
			if (!piece.isValid || !piece.covers(px, pz)) {
				continue;
			}
			if (piece.height > this.vaultMaxHeight) {
				return;
			}
			// Step on until out of its footprint, then a little more for the feet.
			const step = 0.05;
			let travelled = probe;
			while (travelled < this.vaultMaxDepth + probe) {
				travelled += step;
				if (piece.covers(at.x + dir.x * travelled, at.z + dir.z * travelled)) {
					continue;
				}
				const landX = at.x + dir.x * (travelled + this.vaultClearance);
				const landZ = at.z + dir.z * (travelled + this.vaultClearance);
				if (this._walls && this._walls.isBlocked(landX, landZ)) {
					return; // a wall there
				}
				if (Furniture.large.some((other) => other !== piece && other.covers(landX, landZ, this.radius))) {
					return; // another piece there
				}
				this._startJump(v3(landX, at.y, landZ), piece.height + this.jumpClear);
				return;
			}
			return; // too deep: that is gone round, not over
		}
	}

	private _startJump(to: Vec3, arc: number): void {
		const length = this.animationController ? this.animationController.override(this.jumpClip, "jump", this.jumpSpeed) : 0.5;
		this._jump = {
			from: this.node.worldPosition.clone(),
			to,
			arc,
			time: 0,
			takeoff: length * this.jumpTakeoff,
			landing: length * this.jumpLanding,
		};
		this._lock(true);
		// Through the piece in the air: the walls would hold the player back.
		this._walls && (this._walls.enabled = false);
		this.faceDirection && this.faceDirection.faceTowards(to);
	}

	private _jumpStep(dt: number): void {
		const jump = this._jump;
		jump.time += dt;
		if (jump.time < jump.takeoff) {
			return; // crouching for the jump
		}
		const share = Math.min(1, (jump.time - jump.takeoff) / Math.max(jump.landing - jump.takeoff, 1e-3));
		Vec3.lerp(this._at, jump.from, jump.to, share);
		this._at.y += jump.arc * 4 * share * (1 - share);
		this.node.setWorldPosition(this._at);
		if (share < 1) {
			return;
		}
		// Down: from here on running or standing, whichever the stick says.
		this._jump = null;
		this.node.setWorldPosition(jump.to);
		this._walls && (this._walls.enabled = true);
		this._lock(false);
	}

	/** Hands and feet taken by a throw or a jump: no running, no turning by the stick, no shots. */
	private _lock(locked: boolean): void {
		this._movement && (this._movement.locked = locked);
		this.faceDirection && (this.faceDirection.locked = locked);
		this._attack && (this._attack.busy = locked);
		if (!locked && this.animationController && !(this._attack && this._attack.isDead)) {
			this.animationController.release();
		}
	}
}
