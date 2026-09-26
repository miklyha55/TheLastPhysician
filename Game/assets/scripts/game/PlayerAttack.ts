import { _decorator, AnimationClip, Component, instantiate, math, Node, Prefab, SkeletalAnimation, v3, Vec3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { CameraManager } from "../managers/camera/CameraManager";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { AnimationController } from "./AnimationController";
import { FaceDirection } from "./FaceDirection";
import { GunSocket } from "./GunSocket";
import { PlayerMovement } from "./PlayerMovement";
import { WallCollision } from "./WallCollision";
import { Zombie } from "./Zombie";

const { ccclass, property } = _decorator;

const DEATH = "death";

interface Shot {
	node: Node;
	target: Zombie;
	start: Vec3;
	aim: Vec3;
	time: number;
	duration: number;
	height: number;
}

// The player's fight. Standing still, the player picks the nearest zombie within
// `shootRadius` that is in plain sight, turns to it and shoots: one shot, one potion, lobbed
// in an arc at the zombie, taking one of its lives when it lands. The next shot waits for
// `fireInterval` and for the potion in the air to land, so there is never more than one. The
// target is kept until it dies or gets away, then the nearest other one is taken. Running
// stops the shooting. The player has one life; a zombie's blow takes it — the player falls,
// lies still, and the camera circles round them.
@ccclass("PlayerAttack")
export class PlayerAttack extends Component {
	static instance: PlayerAttack = null;

	@property(SkeletalAnimation) animation: SkeletalAnimation = null;
	@property(AnimationController) animationController: AnimationController = null;
	@property(FaceDirection) faceDirection: FaceDirection = null;
	@property(AnimationClip) deathClip: AnimationClip = null;
	@property({ type: Prefab, tooltip: "What flies at the zombie" })
	projectile: Prefab = null;
	@property({ type: Node, tooltip: "Where the potion leaves from — the gun's muzzle, a child of the gun" })
	muzzle: Node = null;
	@property({ type: Node, tooltip: "Where flying potions live; empty — the player's parent" })
	projectileParent: Node = null;

	@property lives: number = 1;
	@property({ tooltip: "Zombies nearer than this are shot at" })
	shootRadius: number = 3;
	@property({ tooltip: "Seconds from one shot to the next" })
	fireInterval: number = 0.75;
	@property({ tooltip: "Point of the shooting clip, 0..1, at which the potion is thrown", slide: true, range: [0, 1, 0.05] })
	shotMoment: number = 0.4;
	@property({ tooltip: "Potion speed along the ground, units per second" })
	projectileSpeed: number = 4;
	@property({ tooltip: "How high the potion's arc rises over a throw across the whole shoot radius, units; shorter throws rise less" })
	arcHeight: number = 0.5;
	@property({ tooltip: "How fast the potion tumbles in flight, degrees per second" })
	spinSpeed: number = 720;
	@property({ tooltip: "Height above a zombie's feet the potion flies at" })
	aimHeight: number = 0.4;
	@property({ tooltip: "Degrees per second the camera circles the fallen player" })
	orbitSpeed: number = 20;
	@property({ tooltip: "Height above the fallen player's feet the camera looks at" })
	orbitLookHeight: number = 0.2;

	private _walls: WallCollision = null;
	private _target: Zombie = null;
	private _pressed = false;
	private _cooldown = 0;
	private _throwIn = -1;
	private _throwAt: Zombie = null;
	private _dead = false;
	private _shots: Shot[] = [];
	private _spare: Node[] = [];
	private _to = v3();

	get isDead(): boolean {
		return this._dead;
	}

	/** The walls the player collides with, which the zombies find their way round too. */
	get walls(): WallCollision {
		return this._walls;
	}

	protected onLoad(): void {
		PlayerAttack.instance = this;
		this._walls = this.getComponent(WallCollision);
		if (this.animation && this.deathClip) {
			const state = this.animation.createState(this.deathClip, DEATH);
			state.wrapMode = AnimationClip.WrapMode.Normal;
		}
	}

	protected onDestroy(): void {
		if (PlayerAttack.instance === this) {
			PlayerAttack.instance = null;
		}
	}

	protected onEnable() {
		this._handleEvents(true);
	}

	protected onDisable() {
		this._handleEvents(false);
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		gameEventTarget[func](GameEvent.JOYSTICK_DOWN, this.onDown, this);
		gameEventTarget[func](GameEvent.JOYSTICK_UP, this.onUp, this);
	}

	private onDown(): void {
		this._pressed = true;
	}

	private onUp(): void {
		this._pressed = false;
	}

	/** A zombie's blow. */
	takeHit(): void {
		if (this._dead) {
			return;
		}
		this.lives--;
		if (this.lives <= 0) {
			this._die();
		}
	}

	protected update(dt: number): void {
		this._updateShots(dt);
		if (this._dead) {
			return;
		}
		this._cooldown -= dt;
		// A shot under way throws its potion at the right point of the clip — unless the
		// player broke off and ran.
		if (this._throwIn >= 0) {
			if (this._pressed) {
				this._throwIn = -1;
			} else if ((this._throwIn -= dt) < 0) {
				this._throwIn = -1;
				if (this._throwAt && this._throwAt.isValid && !this._throwAt.isDead) {
					this._throw(this._throwAt);
				}
			}
		}
		this._target = this._pickTarget();
		if (this._pressed || !this._target) {
			return;
		}
		this.faceDirection && this.faceDirection.faceTowards(this._target.node.worldPosition);
		if (this._cooldown > 0 || this._throwIn >= 0 || this._shots.length) {
			return;
		}
		this._cooldown = this.fireInterval;
		const duration = this.animationController ? this.animationController.shoot() : 0;
		this._throwAt = this._target;
		this._throwIn = duration * this.shotMoment;
	}

	/** The current target while it is still fair game, otherwise the nearest one that is. */
	private _pickTarget(): Zombie {
		if (this._target && this._canShoot(this._target)) {
			return this._target;
		}
		let best: Zombie = null;
		let bestDistance = Infinity;
		for (const zombie of Zombie.all) {
			if (!this._canShoot(zombie)) {
				continue;
			}
			const distance = Vec3.squaredDistance(zombie.node.worldPosition, this.node.worldPosition);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = zombie;
			}
		}
		return best;
	}

	private _canShoot(zombie: Zombie): boolean {
		if (!zombie || !zombie.isValid || zombie.isDead) {
			return false;
		}
		const at = zombie.node.worldPosition;
		if (Vec3.distance(at, this.node.worldPosition) > this.shootRadius) {
			return false;
		}
		return !this._walls || this._walls.lineOfSight(this.node.worldPosition, at);
	}

	// --- potions

	private _throw(target: Zombie): void {
		if (!this.projectile) {
			// Nothing to throw: the hit lands at once.
			target.takeHit();
			return;
		}
		const node = this._spare.pop() || instantiate(this.projectile);
		node.setParent(this.projectileParent || this.node.parent);
		node.active = true;
		const start = (this.muzzle ? this.muzzle.worldPosition : this.node.worldPosition).clone();
		node.setWorldPosition(start);
		const aim = this._aim(target, v3());
		const distance = Math.hypot(aim.x - start.x, aim.z - start.z);
		const duration = Math.max(0.1, distance / Math.max(this.projectileSpeed, 0.01));
		// Point-blank the potion barely rises; lobbed across the whole radius it rises to arcHeight.
		const height = this.arcHeight * Math.min(1, distance / Math.max(this.shootRadius, 0.01));
		this._shots.push({ node, target, start, aim, time: 0, duration, height });
	}

	private _aim(target: Zombie, out: Vec3): Vec3 {
		const at = target.node.worldPosition;
		return out.set(at.x, at.y + this.aimHeight, at.z);
	}

	/**
	 * Moves the potions along their arcs: a straight line from the gun to the zombie, lifted
	 * by a parabola that peaks at `arcHeight` halfway. The end follows the zombie while it
	 * lives, so a running one is still hit. A potion that lands hits its zombie.
	 */
	private _updateShots(dt: number): void {
		for (let i = this._shots.length - 1; i >= 0; i--) {
			const shot = this._shots[i];
			if (shot.target.isValid && !shot.target.isDead) {
				this._aim(shot.target, shot.aim);
			}
			shot.time += dt;
			const t = Math.min(1, shot.time / shot.duration);
			if (t >= 1) {
				if (shot.target.isValid) {
					shot.target.takeHit();
				}
				this._release(shot.node);
				this._shots.splice(i, 1);
				continue;
			}
			Vec3.lerp(this._to, shot.start, shot.aim, t);
			this._to.y += shot.height * 4 * t * (1 - t);
			shot.node.setWorldPosition(this._to);
			// Tumbling end over end: long side along the heading, turned about the side axis.
			const yaw = math.toDegree(Math.atan2(shot.aim.x - shot.start.x, shot.aim.z - shot.start.z));
			shot.node.setRotationFromEuler(0, yaw - 90, -this.spinSpeed * shot.time);
		}
	}

	/** A potion that landed waits for the next throw instead of being made again. */
	private _release(node: Node): void {
		node.active = false;
		this._spare.push(node);
	}

	// --- dying

	private _die(): void {
		this._dead = true;
		this._throwIn = -1;
		// Potions in the air are gone with the thrower.
		for (const shot of this._shots) {
			this._release(shot.node);
		}
		this._shots.length = 0;
		// All of the player's logic stops: no running, turning, colliding, shooting or
		// switching the gun — the player lies where they fell. A scheduled return to idle
		// could otherwise still fire on a disabled controller.
		const gun = this.muzzle && (this.muzzle.getComponent(GunSocket) || this.muzzle.parent.getComponent(GunSocket));
		if (gun) {
			gun.stow();
			gun.enabled = false;
		}
		if (this.animationController) {
			this.animationController.unscheduleAllCallbacks();
			this.animationController.enabled = false;
		}
		this.faceDirection && (this.faceDirection.enabled = false);
		const movement = this.getComponent(PlayerMovement);
		movement && (movement.enabled = false);
		this._walls && (this._walls.enabled = false);
		// Straight into the fall, with nothing else left playing under it.
		if (this.animation && this.animation.getState(DEATH)) {
			this.animation.stop();
			this.animation.play(DEATH);
		}
		const camera = CameraManager.instance;
		camera && camera.orbit(this.node, this.orbitSpeed, v3(0, this.orbitLookHeight, 0));
		this.enabled = false;
	}
}
