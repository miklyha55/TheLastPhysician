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
	private _cooldown = 0;
	private _dir = v3();
	private _probe = v3();
	private _at = v3();

	/** Throwing or in the air. */
	get busy(): boolean {
		return !!(this._throw || this._jump);
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
		const length = this.animationController ? this.animationController.override(this.throwClip, "throw", this.throwSpeed) : 0;
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
		this._lock(false);
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
		Debris.instance.launch(toss.body, dirX / length, dirZ / length, this.throwPower, this.throwLift, this.throwSpin, this.node, this.throwGrace);
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
