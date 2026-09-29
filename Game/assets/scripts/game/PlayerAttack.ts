import { _decorator, AnimationClip, Component, instantiate, math, Node, Prefab, SkeletalAnimation, v3, Vec3, Vec2 } from "cc";
import GameEvent from "../enums/GameEvent";
import { CameraManager } from "../managers/camera/CameraManager";
import { GameState, StackItem } from "../managers/GameState";
import { Prewarm } from "../managers/Prewarm";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { AnimationController } from "./AnimationController";
import { Blood } from "./Blood";
import type { Body } from "./Debris";
import { FaceDirection } from "./FaceDirection";
import { Explosives } from "./Explosives";
import { GunEffects } from "./GunEffects";
import { OcclusionFade } from "./OcclusionFade";
import { PotionStack } from "./PotionStack";
import { GunSocket } from "./GunSocket";
import { PlayerKeys } from "./PlayerKeys";
import { PlayerMovement } from "./PlayerMovement";
import { WallCollision } from "./WallCollision";
import { Zombie } from "./Zombie";
import { LevelStats } from "../managers/LevelStats";
import { Sfx } from "../managers/audio/Sfx";
import { Footsteps } from "./Footsteps";
import { HazardVictims } from "./HazardVictims";
import { PathFinder } from "./PathFinder";
import { PotionDrone } from "./PotionDrone";
import { paintPotion, PotionKind } from "./PotionKind";

const { ccclass, property } = _decorator;

const DEATH = "death";

/**
 * The potions the game starts with, from the bottom — the first shot — up: the second a green one,
 * the third a red one, so the player meets both early; the rest plain.
 */
const START_KINDS = [PotionKind.Plain, PotionKind.Drone, PotionKind.Bomb];

interface Shot {
	node: Node;
	/** The zombie it is thrown at — or null for a shot at a barrel in flight. */
	target: Zombie;
	/** The barrel it is shot at, flying; it goes off when the potion reaches it. */
	barrel: Body;
	/** What it is: plain, a bomb, a drone. */
	kind: PotionKind;
	/** A drone's prey: the zombies on the screen when it was thrown. */
	prey: Zombie[];
	start: Vec3;
	aim: Vec3;
	time: number;
	duration: number;
	height: number;
}

// The player's fight. Standing still, the player picks the nearest zombie within
// `shootRadius` that is in plain sight, turns to it and shoots: one shot, one potion, lobbed
// in an arc at the zombie, taking one of its lives when it lands. The next shot waits for
// `fireInterval` and for the potion in the air to land, so there is never more than one; each
// shot takes one potion from `ammo`, and with none left there is no shot. The
// target is picked afresh before every shot: whichever is nearest then. Running
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
	@property({ type: PotionStack, tooltip: "The potions on the back: one for every shot left" })
	stack: PotionStack = null;
	@property({ type: GunEffects, tooltip: "Flash, sparks and smoke at the muzzle on every shot" })
	gunEffects: GunEffects = null;
	@property({ type: Blood, tooltip: "Splash where a potion hits a zombie" })
	zombieBlood: Blood = null;
	@property({ type: Blood, tooltip: "Splash where a zombie's blow hits the player" })
	playerBlood: Blood = null;
	@property({ tooltip: "Height above the player's feet their splash comes from" })
	woundHeight: number = 0.35;
	@property({ tooltip: "How much bigger the splash of a killing blow is" })
	killSplash: number = 1.6;
	@property({ type: Node, tooltip: "Where flying potions live; empty — the player's parent" })
	projectileParent: Node = null;

	@property lives: number = 1;
	@property({ tooltip: "Potions carried; every shot takes one, and with none left the player cannot shoot" })
	ammo: number = 5;
	@property({ tooltip: "Zombies nearer than this are shot at" })
	shootRadius: number = 3;
	@property({ tooltip: "Seconds from one shot to the next" })
	fireInterval: number = 0.5;
	@property({ tooltip: "Point of the shooting clip, 0..1, at which the potion is thrown", slide: true, range: [0, 1, 0.05] })
	shotMoment: number = 0.4;
	@property({ tooltip: "Potion speed along the ground, units per second" })
	projectileSpeed: number = 4;
	@property({ tooltip: "Speed of a potion shot at a thrown barrel: straight and fast, it catches it in the air" })
	barrelShotSpeed: number = 10;
	@property({ tooltip: "How high the potion's arc rises over a throw across the whole shoot radius, units; shorter throws rise less" })
	arcHeight: number = 0.5;
	@property({ tooltip: "How fast the potion tumbles in flight, degrees per second" })
	spinSpeed: number = 720;
	@property({ tooltip: "Height above a zombie's feet the potion flies at" })
	aimHeight: number = 0.4;
	@property({ tooltip: "A green potion's drone: units per second" })
	droneSpeed: number = 5;
	@property({ tooltip: "A green potion's drone: height over the floor it flies at" })
	droneHeight: number = 0.5;
	@property({ tooltip: "A green potion's drone: how near it comes to a zombie to kill it" })
	droneReach: number = 0.35;
	@property({ tooltip: "A zombie shot down this near, units, and the player cries \"yes!\"" })
	closeKillDistance: number = 0.9;
	@property({ tooltip: "Seconds at the least between two of the player's \"yes!\" — a chain of barrels says it once" })
	cheerGap: number = 1;
	@property({ tooltip: "Degrees per second the camera circles the fallen player" })
	orbitSpeed: number = 20;
	@property({ tooltip: "Height above the fallen player's feet the camera looks at" })
	orbitLookHeight: number = 0.2;
	@property({ tooltip: "Seconds from dying to the card with \"again\" and \"from the start\" — the fall and the camera circling are seen first" })
	restartDelay: number = 3;

	private _walls: WallCollision = null;
	private _occlusion: OcclusionFade = null;
	private _target: Zombie = null;
	private _pressed = false;
	private _cooldown = 0;
	private _throwIn = -1;
	private _throwAt: Zombie = null;
	private _dead = false;
	private _shots: Shot[] = [];
	/** When the last potion-in sound went out, ms. */
	private _potionSoundAt = 0;
	/** When the player last cried "yes!", ms. */
	private _cheeredAt = -Infinity;
	private _spare: Node[] = [];
	private _drones: PotionDrone[] = [];
	private _droneFinder: PathFinder = null;
	private _to = v3();

	get isDead(): boolean {
		return this._dead;
	}

	/** Set while the player throws something or jumps: no shot is started meanwhile. */
	busy = false;

	/** The zombie being aimed at now, or null. */
	get target(): Zombie {
		return this._target && this._target.isValid && !this._target.isDead ? this._target : null;
	}

	/** The nearest zombie that could be shot at now, or null — what a throw is aimed at. */
	nearestTarget(): Zombie {
		return this._nearest();
	}

	/** The walls the player collides with, which the zombies find their way round too. */
	get walls(): WallCollision {
		return this._walls;
	}

	protected onLoad(): void {
		PlayerAttack.instance = this;
		this._walls = this.getComponent(WallCollision);
		this._occlusion = this.getComponent(OcclusionFade);
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
		gameEventTarget[func](GameEvent.MOVE_DIRECTION, this.onDirection, this);
	}

	/** Moving is running, even if the stick's "down" went unheard: no turning to a zombie then. */
	private onDirection(direction: Vec2): void {
		direction.lengthSqr() > 0 && (this._pressed = true);
	}

	private onDown(): void {
		this._pressed = true;
	}

	private onUp(): void {
		this._pressed = false;
	}

	protected start(): void {
		// Brought from the last level: potions and keys, as they lay on the stack. Otherwise
		// the level's own start — `ammo` potions.
		const carried = GameState.enter();
		// Steps in time with the feet; the sounds that play often, loaded ahead.
		this.getComponent(Footsteps) || this.addComponent(Footsteps);
		Sfx.preload();
		// A fresh count for the level: every zombie in it has registered by now (their onLoad).
		LevelStats.begin(Zombie.all.length);
		// Everything drawn once behind the loading screen before the level is played.
		Prewarm.run(GameState.title);
		if (!carried) {
			this.stack && this.stack.fill(this.ammo, START_KINDS);
			return;
		}
		this.ammo = carried.filter((item) => !item.key).length;
		const keys = PlayerKeys.instance;
		for (const item of carried) {
			item.key && keys && keys.add(item.color);
		}
		this.stack && this.stack.restore(carried);
	}

	/** What the player carries on, bottom to top: the stack, or just the potions left without one. */
	carried(): StackItem[] {
		if (this.stack) {
			return this.stack.contents();
		}
		const items: StackItem[] = [];
		for (let i = 0; i < this.ammo; i++) {
			items.push({ key: false, color: -1 });
		}
		return items;
	}

	/**
	 * Potions handed to the player — from a chest. `visual`, a potion that has flown in, goes
	 * onto the stack on the back as it is; the rest are laid there fresh.
	 */
	addAmmo(count: number, visual: Node = null, kind: PotionKind = PotionKind.Plain): void {
		this.ammo += count;
		LevelStats.collected += count;
		// A clink for each potion in; a stream of them from a chest not all at once.
		const now = Date.now();
		if (now - this._potionSoundAt >= 60) {
			this._potionSoundAt = now;
			Sfx.at(Sfx.getPotion, this.node);
		}
		for (let i = 0; i < count; i++) {
			if (this.stack) {
				this.stack.push(i === 0 ? visual : null, kind);
			} else if (i === 0 && visual) {
				visual.destroy();
			}
		}
	}

	/** Where a potion flying to the player should go: the top of the stack, or the chest. */
	catchPoint(out: Vec3, height: number): Vec3 {
		if (this.stack) {
			return this.stack.nextSlot(out);
		}
		const at = this.node.worldPosition;
		return out.set(at.x, at.y + height, at.z);
	}

	/** Killed outright, however many lives are left — a blast. */
	kill(from: Vec3 = null): void {
		if (this._dead) {
			return;
		}
		this.lives = 1;
		this.takeHit(from);
	}

	/** A zombie's blow, struck from `from`. */
	takeHit(from: Vec3 = null): void {
		if (this._dead) {
			return;
		}
		this.lives--;
		if (this.playerBlood) {
			const at = this.node.worldPosition;
			this._to.set(at.x, at.y + this.woundHeight, at.z);
			this.playerBlood.splash(this._to, from || at, this.lives <= 0 ? this.killSplash : 1);
		}
		if (this.lives <= 0) {
			this._die();
		}
	}

	protected update(dt: number): void {
		this._updateShots(dt);
		this._updateDrones(dt);
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
				// The potion is spent only now, as it leaves the gun: a shot broken off costs nothing.
				if (this._throwAt && this._throwAt.isValid && !this._throwAt.isDead && this.ammo > 0) {
					this.ammo--;
					LevelStats.thrown++;
					// The lowest goes, whatever it is: its kind is the shot's.
					const kind = this.stack ? this.stack.pop() : PotionKind.Plain;
					this._throw(this._throwAt, kind);
				}
			}
		}
		const ready = this._cooldown <= 0 && this._throwIn < 0 && !this._shots.length && this.ammo > 0 && !this.busy;
		// Before every shot the nearest zombie is taken afresh; between shots the player keeps
		// facing the one being shot at, so it does not twitch between two at the same distance.
		this._target = ready || !this._canShoot(this._target) ? this._nearest() : this._target;
		// Walls between the camera and the target dissolve just as they do for the player.
		this._occlusion && this._occlusion.setTarget(this._target ? this._target.node : null);
		if (this._pressed || !this._target) {
			return;
		}
		this.faceDirection && this.faceDirection.faceTowards(this._target.node.worldPosition);
		if (!ready) {
			return;
		}
		this._cooldown = this.fireInterval;
		const duration = this.animationController ? this.animationController.shoot() : 0;
		this._throwAt = this._target;
		this._throwIn = duration * this.shotMoment;
	}

	/** The nearest zombie within reach and in plain sight. */
	private _nearest(): Zombie {
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
		// One a drone is already after is as good as dead: no potion spent on it.
		if (!zombie || !zombie.isValid || zombie.isDead || zombie.doomed) {
			return false;
		}
		const at = zombie.node.worldPosition;
		if (Vec3.distance(at, this.node.worldPosition) > this.shootRadius) {
			return false;
		}
		// Over what is lower than the zombie: it stands out above a table, and is seen.
		return !this._walls || this._walls.lineOfSight(this.node.worldPosition, at, zombie.height);
	}

	// --- potions

	private _throw(target: Zombie, kind: PotionKind = PotionKind.Plain): void {
		// A drone takes note, as it leaves, of every zombie on the screen: those, and no others.
		const prey = kind === PotionKind.Drone ? HazardVictims.zombies().filter((zombie) => zombie !== target) : null;
		// Marked at once, while it is still in the air: the next shots go to the others.
		if (prey) {
			target.doomed = true;
			prey.forEach((zombie) => (zombie.doomed = true));
		}
		if (!this.projectile) {
			// Nothing to throw: the hit lands at once.
			this._hit(target, this.muzzle ? this.muzzle.worldPosition : this.node.worldPosition, this._aim(target, v3()), kind);
			return;
		}
		const node = this._spare.pop() || instantiate(this.projectile);
		node.setParent(this.projectileParent || this.node.parent);
		node.active = true;
		paintPotion(node, kind);
		const start = (this.muzzle ? this.muzzle.worldPosition : this.node.worldPosition).clone();
		node.setWorldPosition(start);
		const aim = this._aim(target, v3());
		this.gunEffects && this.gunEffects.fire(start, aim);
		Sfx.at(Sfx.shoot, start);
		const distance = Math.hypot(aim.x - start.x, aim.z - start.z);
		const duration = Math.max(0.1, distance / Math.max(this.projectileSpeed, 0.01));
		// Point-blank the potion barely rises; lobbed across the whole radius it rises to arcHeight.
		const height = this.arcHeight * Math.min(1, distance / Math.max(this.shootRadius, 0.01));
		this._shots.push({ node, target, barrel: null, kind, prey, start, aim, time: 0, duration, height });
	}

	/**
	 * A shot at a barrel the player has just thrown, the way ThroughTheDeadCity finishes a
	 * throw of an explosive: PlayerActions has the player aim and play the shot, and at its
	 * moment calls this — a potion flies out of the muzzle straight and fast into the barrel — it goes off in the air, over the zombies it was thrown at. The potion is
	 * a real one, taken off the stack. False when there is none to shoot.
	 */
	shootBarrel(barrel: Body): boolean {
		if (this._dead || this.ammo <= 0 || !barrel || !barrel.node.isValid) {
			return false;
		}
		this.ammo--;
		LevelStats.thrown++;
		this.stack && this.stack.pop();
		const at = barrel.node.worldPosition;
		const start = (this.muzzle ? this.muzzle.worldPosition : this.node.worldPosition).clone();
		const aim = at.clone();
		this.gunEffects && this.gunEffects.fire(start, aim);
		Sfx.at(Sfx.shoot, start);
		const duration = Math.max(0.05, Vec3.distance(start, aim) / Math.max(this.barrelShotSpeed, 0.01));
		if (!this.projectile) {
			Explosives.instance && Explosives.instance.explode(barrel);
			return true;
		}
		const node = this._spare.pop() || instantiate(this.projectile);
		node.setParent(this.projectileParent || this.node.parent);
		node.active = true;
		node.setWorldPosition(start);
		this._shots.push({ node, target: null, barrel, kind: PotionKind.Plain, prey: null, start, aim, time: 0, duration, height: 0 });
		return true;
	}

	private _aim(target: Zombie, out: Vec3): Vec3 {
		const at = target.node.worldPosition;
		// A bat is aimed at where it hangs or flies, not at the floor under it.
		const lift = target.aimLift;
		return out.set(at.x, at.y + (lift >= 0 ? lift : this.aimHeight), at.z);
	}

	/**
	 * Moves the potions along their arcs: a straight line from the gun to the zombie, lifted
	 * by a parabola that peaks at `arcHeight` halfway. The end follows the zombie while it
	 * lives, so a running one is still hit. A potion that lands hits its zombie.
	 */
	private _updateShots(dt: number): void {
		for (let i = this._shots.length - 1; i >= 0; i--) {
			const shot = this._shots[i];
			if (shot.barrel) {
				this._barrelShot(shot, dt, i);
				continue;
			}
			if (shot.target.isValid && !shot.target.isDead) {
				this._aim(shot.target, shot.aim);
			}
			shot.time += dt;
			const t = Math.min(1, shot.time / shot.duration);
			if (t >= 1) {
				if (shot.target.isValid) {
					this._hit(shot.target, shot.start, shot.aim, shot.kind);
				}
				this._shots.splice(i, 1);
				// A drone flies on from here to the rest of its prey; any other potion is spent.
				shot.kind === PotionKind.Drone && shot.prey && shot.prey.length ? this._launchDrone(shot.node, shot.prey) : this._release(shot.node);
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

	/** A potion after a flying barrel: it keeps after it, and it goes off when caught. */
	private _barrelShot(shot: Shot, dt: number, index: number): void {
		// Explosives.explode itself does nothing for a barrel already gone off.
		const alive = shot.barrel.node.isValid;
		if (alive) {
			shot.aim.set(shot.barrel.node.worldPosition);
		}
		shot.time += dt;
		const t = Math.min(1, shot.time / shot.duration);
		if (t >= 1) {
			// Gone already — set off by something else — and the potion just flies on out of sight.
			alive && Explosives.instance && Explosives.instance.explode(shot.barrel);
			this._release(shot.node);
			this._shots.splice(index, 1);
			return;
		}
		Vec3.lerp(this._to, shot.start, shot.aim, t);
		shot.node.setWorldPosition(this._to);
		const yaw = math.toDegree(Math.atan2(shot.aim.x - shot.start.x, shot.aim.z - shot.start.z));
		shot.node.setRotationFromEuler(0, yaw - 90, -this.spinSpeed * shot.time);
	}

	/**
	 * A potion lands: it bursts, and with Explosives in the scene everyone round the spot loses
	 * a life and a barrel near it goes off; without it, just the zombie hit loses one.
	 */
	private _hit(target: Zombie, from: Vec3, at: Vec3, kind: PotionKind = PotionKind.Plain): void {
		// Shot down at arm's length: the player's "yes!".
		const alive = target.isValid && !target.isDead;
		const near = alive && Vec3.distance(target.node.worldPosition, this.node.worldPosition) <= this.closeKillDistance;
		const explosives = Explosives.instance;
		if (kind === PotionKind.Bomb && explosives) {
			// Red: a barrel's blast, smaller.
			explosives.bomb(at, from);
		} else if (kind === PotionKind.Drone) {
			// Green: the one it was thrown at dies, whatever lives it had.
			alive && this._killBy(target, from);
		} else if (explosives) {
			explosives.potionBurst(at, from, target);
		} else if (alive) {
			target.takeHit();
			this.zombieBlood && this.zombieBlood.splash(at, from, target.isDead ? this.killSplash : 1);
		}
		near && target.isDead && this.cheer();
	}

	/** The player's "yes!" — a close kill, a barrel gone off; not twice within `cheerGap`. */
	cheer(): void {
		const now = Date.now();
		if (this._dead || now - this._cheeredAt < this.cheerGap * 1000) {
			return;
		}
		this._cheeredAt = now;
		Sfx.at(Sfx.yes, this.node);
	}

	/** A zombie killed outright by a potion: its blood, and down it goes. */
	private _killBy(zombie: Zombie, from: Vec3): void {
		if (!zombie.isValid || zombie.isDead) {
			return;
		}
		if (this.zombieBlood) {
			const at = zombie.node.worldPosition;
			this.zombieBlood.splash(v3(at.x, at.y + this.aimHeight, at.z), from, this.killSplash);
		}
		zombie.kill();
	}

	/** A green potion's first kill done: on it flies to the rest of what it saw. */
	private _launchDrone(node: Node, prey: Zombie[]): void {
		if (!this._droneFinder && this._walls) {
			this._droneFinder = new PathFinder(this._walls, 0.25);
		}
		this._drones.push(
			new PotionDrone(
				node,
				prey.slice(),
				this._droneFinder,
				{ speed: this.droneSpeed, height: this.droneHeight, reach: this.droneReach, repath: 0.3, giveUp: 5, spin: this.spinSpeed },
				(zombie, from) => this._killBy(zombie, from),
				(done) => done.isValid && done.destroy(),
			),
		);
	}

	private _updateDrones(dt: number): void {
		for (let i = this._drones.length - 1; i >= 0; i--) {
			this._drones[i].update(dt) && this._drones.splice(i, 1);
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
		Sfx.at(Sfx.playerDie, this.node);
		this._throwIn = -1;
		this._occlusion && this._occlusion.setTarget(null);
		// What the player carried falls off their back and scatters over the floor.
		this.stack && this.stack.scatter(this.node.parent);
		// Potions in the air are gone with the thrower — and what a drone was to kill is free again.
		for (const shot of this._shots) {
			this._release(shot.node);
			shot.target && shot.target.isValid && (shot.target.doomed = false);
			shot.prey && shot.prey.forEach((zombie) => zombie.isValid && (zombie.doomed = false));
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
		// The component is off now, so the wait is kept outside it.
		// After the fall has been seen: the card with "again" and "from the start".
		setTimeout(() => GameState.died(), Math.max(0, this.restartDelay) * 1000);
	}
}
