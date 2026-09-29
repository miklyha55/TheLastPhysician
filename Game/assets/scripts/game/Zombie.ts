import { _decorator, AnimationClip, Component, math, SkeletalAnimation, tween, v3, Vec3 } from "cc";
import { PathFinder } from "./PathFinder";
import { HazardMap } from "./HazardMap";
import { HitFlash } from "./HitFlash";
import { PlayerAttack } from "./PlayerAttack";
import { WallCollision } from "./WallCollision";
import { LevelStats } from "../managers/LevelStats";
import { Sfx } from "../managers/audio/Sfx";

const { ccclass, property } = _decorator;

const IDLE = "idle";
const RUN = "run";
const ATTACK = "attack";
// A second state of the same strike: blow after blow they take turns, so the next one blends in
// out of the end of the last instead of the one state jumping back to its first frame.
const ATTACK_AGAIN = "attack2";
const HURT = "hurt";
const DEATH = "death";

export enum Mode {
	Idle,
	Wander,
	Return,
	Chase,
	Attack,
	Hurt,
	Dead,
	/** A kind of zombie of its own after the player its own way (ZombieGirl). */
	Hunt,
}

// A zombie. Until it notices the player it wanders: runs a little way in a random direction,
// stands for a while, and again, never far from where it was put. Once the player is within
// `detectRadius` and in plain sight it runs at them the shortest way round the walls, and
// gives up when they get further than `loseRadius`, stay hidden behind walls for
// `loseSightTime`, or fall — and goes back to its own
// place to wander there again. Up close it strikes; the hit kills the player. Each potion that hits it takes one of its lives: while some are left it reels,
// then looks round for the player again; the last one knocks it down, it sinks through the
// floor and is gone. Zombies keep out of each other's way.
@ccclass("Zombie")
export class Zombie extends Component {
	/** Every zombie still on its feet. */
	static readonly all: Zombie[] = [];
	/** Called with every zombie the moment it dies — what drops from it, and the like. */
	static readonly deathListeners: ((zombie: Zombie) => void)[] = [];

	@property(SkeletalAnimation) animation: SkeletalAnimation = null;
	@property({
		tooltip:
			"Baked animation while the level runs — cheap, many zombies at once. The prefab keeps it off, so the editor shows the model by its bones, standing where its nodes are: the model's own bind pose is off to one side.",
	})
	bakeInPlay: boolean = true;
	@property({ tooltip: "Chance it groans when it sets off a new way wandering, 0..1", slide: true, range: [0, 1, 0.05] })
	wanderSpeakChance: number = 0.35;
	@property({ tooltip: "Seconds at the least between two of its sounds" })
	speakGap: number = 1.5;
	@property({ tooltip: "Volume of its sounds, on top of their own in the mix (Sfx)" })
	speakVolume: number = 1;
	@property(AnimationClip) idleClip: AnimationClip = null;
	@property(AnimationClip) runClip: AnimationClip = null;
	@property({ type: AnimationClip, tooltip: "The strike at the player" })
	attackClip: AnimationClip = null;
	@property({ type: AnimationClip, tooltip: "Reeling from a hit that did not kill" })
	hurtClip: AnimationClip = null;
	@property(AnimationClip) deathClip: AnimationClip = null;
	@property({ tooltip: "Seconds a hit stops the zombie for; the reeling clip is cut short after that" })
	hurtTime: number = 0.6;
	@property({ tooltip: "Playback speed of the reeling clip" })
	hurtSpeed: number = 2;
	@property({ tooltip: "Playback speed of the strike clip" })
	attackSpeed: number = 2;

	@property lives: number = 3;
	@property({ tooltip: "Units per second while wandering" })
	wanderSpeed: number = 0.5;
	@property({ tooltip: "Units per second while running at the player" })
	chaseSpeed: number = 1;
	@property({ tooltip: "Degrees per second" })
	turnSpeed: number = 540;
	@property({ tooltip: "Extra yaw if the model's front is not its local +Z" })
	yawOffset: number = 0;
	@property({ tooltip: "How far from where it was put a wandering zombie may go" })
	wanderRadius: number = 1.5;
	@property({ tooltip: "Shortest and longest wandering run, units" })
	wanderDistance: Vec3 = v3(0.5, 1.5, 0);
	@property({ tooltip: "Shortest and longest stand between runs, seconds" })
	idleTime: Vec3 = v3(1, 3, 0);
	@property({ tooltip: "The player is noticed within this distance, if nothing is in between" })
	detectRadius: number = 3;
	@property({ tooltip: "A chased player further than this is lost" })
	loseRadius: number = 3.5;
	@property({ tooltip: "A chased player hidden behind walls this long, seconds, is lost; the short wait keeps a door jamb from breaking the chase" })
	loseSightTime: number = 0.5;
	@property({ tooltip: "How tall the zombie stands: a table, a chest — anything lower does not hide the player from it, nor it from the player" })
	height: number = 0.75;
	@property({ tooltip: "Distance from the player at which the zombie strikes" })
	attackDistance: number = 0.45;
	@property({ tooltip: "Point of the strike clip, 0..1, at which the hit lands", slide: true, range: [0, 1, 0.05] })
	hitMoment: number = 0.5;
	@property({ tooltip: "Keeps this far from other zombies' centres" })
	radius: number = 0.2;
	@property({ tooltip: "How often the way to the player is worked out again, seconds" })
	repathInterval: number = 0.4;
	@property({ tooltip: "Grid step of the path search, units" })
	pathCell: number = 0.25;
	@property({ tooltip: "How deep it sinks after dying, units" })
	sinkDepth: number = 0.6;
	@property({ tooltip: "Seconds to sink out of sight" })
	sinkDuration: number = 2;
	@property({ tooltip: "Blend between clips, seconds" })
	crossFade: number = 0.2;

	private static _pathFinder: PathFinder = null;
	private static _pathWalls: WallCollision = null;

	protected _mode: Mode = Mode.Idle;
	protected _current: string = null;
	protected _home: Vec3 = v3();
	protected _timer: number = 0;
	private _struck: boolean = false;
	protected _path: Vec3[] = [];
	/** When it last made a sound, seconds. */
	private _spokeAt = -Infinity;
	protected _repath: number = 0;
	protected _unseen: number = 0;
	private _homeTries: number = 0;
	protected _goal: Vec3 = v3();
	protected _step: Vec3 = v3();
	protected _next: Vec3 = v3();
	protected _euler: Vec3 = v3();
	/** Which of the two strike states is swinging now. */
	private _strike = ATTACK;
	private _flashOf: HitFlash = null;

	/** The red blink of a blow, on its own meshes. */
	private get _flash(): HitFlash {
		return this._flashOf || (this._flashOf = new HitFlash(this.node));
	}

	get isDead(): boolean {
		return this._mode === Mode.Dead;
	}

	/**
	 * A green potion's drone is on its way to it: as good as dead, so the player does not shoot at
	 * it again. Taken off if the drone leaves it after all.
	 */
	doomed = false;

	/** Is it in the air (Bat): over the floor's traps and furniture, out of the walkers' way. */
	get flies(): boolean {
		return false;
	}

	/** How high over its feet a potion is aimed at it; below 0 — the thrower's own aim. */
	get aimLift(): number {
		return -1;
	}

	protected onLoad(): void {
		this.animation = this.animation || this.getComponentInChildren(SkeletalAnimation);
		// Baked in play — before any clip is set up on it.
		if (this.animation && this.bakeInPlay && !this.animation.useBakedAnimation) {
			this.animation.useBakedAnimation = true;
		}
		this._createStates();
	}

	/** Its clips as states of its own names on the animation, at their speeds. */
	private _createStates(): void {
		this._createState(this.idleClip, IDLE, true);
		this._createState(this.runClip, RUN, true);
		this._createState(this.attackClip, ATTACK, false);
		this._createState(this.attackClip, ATTACK_AGAIN, false);
		this._createState(this.hurtClip, HURT, false);
		const hurt = this.animation && this.animation.getState(HURT);
		hurt && (hurt.speed = this.hurtSpeed);
		for (const name of [ATTACK, ATTACK_AGAIN]) {
			const attack = this.animation && this.animation.getState(name);
			attack && (attack.speed = this.attackSpeed);
		}
		this._createState(this.deathClip, DEATH, false);
	}

	protected onEnable(): void {
		if (!this.isDead && Zombie.all.indexOf(this) < 0) {
			Zombie.all.push(this);
		}
	}

	protected onDisable(): void {
		this._forget();
	}

	protected start(): void {
		// The animation's own start-up, coming after this one's (it sits lower in the tree), lays its
		// states out afresh from its list of clips — and drops those made of a clip on that list: a
		// bat's clips come in its model's file. Made again now, with everything loaded.
		if (this.animation && !this.animation.getState(IDLE)) {
			this._createStates();
		}
		this._home.set(this.node.worldPosition);
		this._stand();
	}

	/** The red of a blow on, or off: the warm-up behind the loading screen (Prewarm) builds it early. */
	prewarmFlash(on: boolean): void {
		!this.isDead && this._flash.wear(on);
	}

	/** Killed outright, whatever lives are left — a heavy thing flying into it. */
	kill(): void {
		if (this.isDead) {
			return;
		}
		this.lives = 0;
		this._die();
	}

	/** A potion hit: one life less — reel, or fall. */
	takeHit(): void {
		if (this.isDead) {
			return;
		}
		this.lives--;
		if (this.lives <= 0) {
			this._die();
			return;
		}
		// A life lost but not the last: it blinks red. Not on the killing blow — then it falls.
		this._flash.trigger();
		// A blow already on its way lands anyway: the hit costs a life, not the strike.
		if (this._mode === Mode.Attack) {
			return;
		}
		this._interrupt();
		this._mode = Mode.Hurt;
		this._timer = Math.min(this.hurtTime, this._duration(HURT));
		this._play(HURT, true);
	}

	protected update(dt: number): void {
		this._flash.update(dt);
		const player = PlayerAttack.instance;
		switch (this._mode) {
			case Mode.Idle:
				if (this._notices(player)) {
					return this._aggro();
				}
				if ((this._timer -= dt) <= 0) {
					this._wander();
				}
				break;
			case Mode.Wander:
				if (this._notices(player)) {
					return this._aggro();
				}
				this._timer -= dt;
				if (this._follow(this.wanderSpeed, dt) || this._timer <= 0) {
					this._stand();
				}
				break;
			case Mode.Return:
				if (this._notices(player)) {
					return this._aggro();
				}
				if (this._follow(this.wanderSpeed, dt)) {
					// Home, or stuck on the way: a stuck zombie looks for the way again, a few times.
					if (Vec3.distance(this.node.worldPosition, this._home) <= this.wanderRadius || ++this._homeTries > 3) {
						this._stand();
					} else {
						this._goHome(false);
					}
				}
				break;
			case Mode.Chase:
				this._updateChase(player, dt);
				break;
			case Mode.Attack:
				this._updateAttack(player, dt);
				break;
			case Mode.Hurt:
				if ((this._timer -= dt) <= 0) {
					this._lookAround(player);
				}
				break;
			case Mode.Hunt:
				this._updateHunt(player, dt);
				break;
		}
	}

	// --- wandering

	protected _stand(): void {
		this._mode = Mode.Idle;
		this._timer = math.randomRange(this.idleTime.x, this.idleTime.y);
		this._play(IDLE);
	}

	/** Off in a random direction, turning back towards home when it has strayed. */
	private _wander(): void {
		const at = this.node.worldPosition;
		for (let attempt = 0; attempt < 8; attempt++) {
			const distance = math.randomRange(this.wanderDistance.x, this.wanderDistance.y);
			const angle = Math.random() * Math.PI * 2;
			this._goal.set(at.x + Math.sin(angle) * distance, at.y, at.z + Math.cos(angle) * distance);
			if (Vec3.distance(this._goal, this._home) > this.wanderRadius) {
				// Too far out: head back past home instead.
				Vec3.subtract(this._step, this._home, at);
				this._step.y = 0;
				if (this._step.length() > 1e-3) {
					this._step.normalize();
					this._goal.set(at.x + this._step.x * distance, at.y, at.z + this._step.z * distance);
				}
			}
			const walls = this._walls();
			// Nowhere near a trap: not into one, not across one.
			if ((!walls || walls.isPathClear(at, this._goal)) && HazardMap.lineClear(at, this._goal)) {
				this._path.length = 0;
				this._path.push(this._goal.clone());
				this._mode = Mode.Wander;
				// Off another way: now and then it groans.
				this._speak(this.wanderSpeakChance);
				// Long enough to get there; bumping into another zombie ends it early.
				this._timer = (distance / Math.max(this.wanderSpeed, 0.01)) * 1.5 + 0.5;
				this._play(RUN);
				return;
			}
		}
		this._stand();
	}

	// --- the player

	/** Is the player alive, close and in plain sight? */
	protected _notices(player: PlayerAttack): boolean {
		if (!player || player.isDead) {
			return false;
		}
		const at = player.node.worldPosition;
		if (Vec3.distance(at, this.node.worldPosition) > this.detectRadius) {
			return false;
		}
		const walls = this._walls();
		return !walls || walls.lineOfSight(this.node.worldPosition, at, this.height);
	}

	/** After reeling: after the player if they are near, back to wandering if not. */
	protected _lookAround(player: PlayerAttack): void {
		if (this._notices(player)) {
			this._aggro();
		} else {
			this._goHome();
		}
	}

	/** Back to where it was put, the shortest way round the walls, to wander there again. */
	protected _goHome(fresh: boolean = true): void {
		if (fresh) {
			this._homeTries = 0;
		}
		const at = this.node.worldPosition;
		if (Vec3.distance(at, this._home) <= this.wanderRadius) {
			return this._stand();
		}
		const finder = this._finder();
		if (!finder || !finder.find(at, this._home, this._path)) {
			this._path.length = 0;
			this._path.push(this._home.clone());
		}
		this._mode = Mode.Return;
		this._play(RUN);
	}

	/** The player noticed: a growl, and after them. */
	protected _aggro(): void {
		this._speak(1);
		this._engage();
	}

	/**
	 * A zombie's voice from where it stands, at random of its set — `chance` of it, and not
	 * sooner than `speakGap` after its last.
	 */
	protected _speak(chance: number): void {
		const now = Date.now() / 1000;
		if (now - this._spokeAt < this.speakGap || Math.random() > chance) {
			return;
		}
		this._spokeAt = now;
		Sfx.at(this._voice(), this.node, this.speakVolume);
	}

	/** What it says: a zombie's groans; other kinds their own. */
	protected _voice(): string | string[] {
		return Sfx.zombie;
	}

	/** The player noticed: after them. A plain zombie runs at them; other kinds do their own thing. */
	protected _engage(): void {
		this._chase();
	}

	/** Each frame of a hunt of a kind of its own; a plain zombie never hunts. */
	protected _updateHunt(player: PlayerAttack, dt: number): void {}

	/** Whatever it was in the middle of is cut short — a hit, or death. */
	protected _interrupt(): void {}

	protected _chase(): void {
		this._mode = Mode.Chase;
		this._repath = 0;
		this._unseen = 0;
		this._path.length = 0;
		this._play(RUN);
	}

	private _updateChase(player: PlayerAttack, dt: number): void {
		if (!player || player.isDead) {
			return this._goHome();
		}
		const target = player.node.worldPosition;
		const distance = Vec3.distance(target, this.node.worldPosition);
		if (distance > this.loseRadius) {
			return this._goHome();
		}
		// Out of sight behind the walls for long enough — the zombie loses them.
		const walls = this._walls();
		if (walls && !walls.lineOfSight(this.node.worldPosition, target, this.height)) {
			if ((this._unseen += dt) >= this.loseSightTime) {
				return this._goHome();
			}
		} else {
			this._unseen = 0;
		}
		if (distance <= this.attackDistance) {
			return this._attack();
		}
		if ((this._repath -= dt) <= 0) {
			this._repath = this.repathInterval;
			const finder = this._finder();
			if (!finder || !finder.find(this.node.worldPosition, target, this._path)) {
				this._path.length = 0;
				this._path.push(target.clone());
			}
		} else if (this._path.length) {
			// The player moves between searches; the last leg always ends where they are now.
			this._path[this._path.length - 1].set(target);
		}
		this._follow(this.chaseSpeed, dt);
	}

	private _attack(): void {
		this._mode = Mode.Attack;
		this._timer = 0;
		this._struck = false;
		// The other of the two strike states from the last one swung — even with a moment of running
		// between them, that one may still be fading out: a blend, not a jump to its start.
		this._strike = this._strike === ATTACK ? ATTACK_AGAIN : ATTACK;
		this._play(this._strike);
		// The swing's sound with the swing, ahead of the blow.
		Sfx.at(Sfx.zombieAttack, this.node, this.speakVolume);
	}

	private _updateAttack(player: PlayerAttack, dt: number): void {
		const duration = this._duration(this._strike);
		this._timer += dt;
		if (player && !player.isDead) {
			this._turnTo(player.node.worldPosition, dt);
			if (!this._struck && this._timer >= duration * this.hitMoment) {
				this._struck = true;
				// Only if the player is still within reach when the blow lands.
				if (Vec3.distance(player.node.worldPosition, this.node.worldPosition) <= this.attackDistance * 1.3) {
					player.takeHit(this.node.worldPosition);
				}
			}
		}
		// On a blend's length before the strike ends: its last frames still play under the blend into
		// what comes next. Left to its very end, the finished clip had nothing to blend from, and the
		// pose jerked.
		if (this._timer >= Math.max(duration * this.hitMoment, duration - this.crossFade)) {
			this._lookAround(player);
		}
	}

	// --- dying

	protected _die(): void {
		// Dying, it does not blink: a flash still going is put out.
		this._flash.stop();
		this._interrupt();
		this._mode = Mode.Dead;
		// Nothing thinks any more: no update, no chasing, no hits. Only the fall and the
		// sinking below run, on a tween of the node's own.
		this.unscheduleAllCallbacks();
		this.enabled = false;
		this._forget();
		this._play(DEATH, true);
		LevelStats.killed++;
		// Its last sound, whatever it said a moment ago.
		this._spokeAt = -Infinity;
		this._speak(1);
		for (const listener of Zombie.deathListeners.slice()) {
			listener(this);
		}
		this._vanish();
	}

	/** After the fall: lies there, then sinks through the floor and is gone. */
	protected _vanish(): void {
		const node = this.node;
		const down = node.position.clone();
		down.y -= this.sinkDepth;
		// Lie there for the rest of the fall, then sink and go — the node takes its skeleton,
		// meshes and materials with it.
		tween(node)
			.delay(this._duration(DEATH))
			.to(this.sinkDuration, { position: down })
			.call(() => node.destroy())
			.start();
	}

	private _forget(): void {
		const index = Zombie.all.indexOf(this);
		if (index >= 0) {
			Zombie.all.splice(index, 1);
		}
	}

	// --- moving

	/** Runs along the path; true when the end of it is reached or the way is blocked. */
	protected _follow(speed: number, dt: number): boolean {
		const at = this.node.worldPosition;
		// Corners already reached drop off; the last point is the end of the way.
		while (this._path.length > 1 && Math.hypot(this._path[0].x - at.x, this._path[0].z - at.z) < 0.05) {
			this._path.shift();
		}
		if (!this._path.length) {
			return true;
		}
		Vec3.subtract(this._step, this._path[0], at);
		this._step.y = 0;
		if (this._step.length() < 0.05) {
			this._path.length = 0;
			return true;
		}
		const point = this._path[0];
		const left = this._step.length();
		this._step.multiplyScalar(Math.min(speed * dt, left) / left);
		this._next.set(at.x + this._step.x, at.y, at.z + this._step.z);
		this._keepApart(this._next);
		const moved = this._settle(at, this._next);
		this._turnTo(point, dt);
		if (!moved) {
			// Wandering or going home, a blocked way ends the run; chasing, the next search finds another.
			return this._mode !== Mode.Chase;
		}
		this.node.setWorldPosition(this._next);
		return false;
	}

	/** Pushes the point out of other zombies. */
	protected _keepApart(point: Vec3): void {
		for (const other of Zombie.all) {
			// The ones in the air and the ones on the floor pass over and under each other.
			if (other === this || other.flies !== this.flies) {
				continue;
			}
			const them = other.node.worldPosition;
			const dx = point.x - them.x;
			const dz = point.z - them.z;
			const reach = this.radius + other.radius;
			const distance = Math.hypot(dx, dz);
			if (distance >= reach) {
				continue;
			}
			if (distance < 1e-4) {
				point.x += reach;
				continue;
			}
			point.x += (dx / distance) * (reach - distance);
			point.z += (dz / distance) * (reach - distance);
		}
	}

	/** Keeps a step out of the walls: the whole step, one axis of it, or none. */
	protected _settle(from: Vec3, to: Vec3): boolean {
		const walls = this._walls();
		if (!walls || !walls.isBlocked(to.x, to.z)) {
			return true;
		}
		if (!walls.isBlocked(to.x, from.z)) {
			to.z = from.z;
			return true;
		}
		if (!walls.isBlocked(from.x, to.z)) {
			to.x = from.x;
			return true;
		}
		return false;
	}

	protected _turnTo(point: Vec3, dt: number): void {
		const at = this.node.worldPosition;
		const dx = point.x - at.x;
		const dz = point.z - at.z;
		if (dx * dx + dz * dz < 1e-6) {
			return;
		}
		const wanted = math.toDegree(Math.atan2(dx, dz)) + this.yawOffset;
		const current = this.node.eulerAngles.y;
		const delta = ((wanted - current + 540) % 360) - 180;
		const step = this.turnSpeed * dt;
		const yaw = Math.abs(delta) <= step ? wanted : current + Math.sign(delta) * step;
		this._euler.set(0, yaw, 0);
		this.node.setRotationFromEuler(this._euler);
	}

	// --- helpers

	protected _walls(): WallCollision {
		const player = PlayerAttack.instance;
		return player ? player.walls : null;
	}

	/** One path search shared by all zombies, on the walls the player collides with. */
	protected _finder(): PathFinder {
		const walls = this._walls();
		if (!walls) {
			return null;
		}
		if (Zombie._pathWalls !== walls) {
			Zombie._pathWalls = walls;
			// Zombies keep out of the traps' reach where there is a way round.
			Zombie._pathFinder = new PathFinder(walls, this.pathCell, true);
		}
		return Zombie._pathFinder;
	}

	protected _createState(clip: AnimationClip, name: string, loop: boolean): void {
		if (!this.animation || !clip) {
			return;
		}
		const state = this.animation.createState(clip, name);
		state.wrapMode = loop ? AnimationClip.WrapMode.Loop : AnimationClip.WrapMode.Normal;
	}

	protected _duration(name: string): number {
		const state = this.animation && this.animation.getState(name);
		return state ? state.duration / (state.speed || 1) : 0;
	}

	/** Blends into a clip; `restart` plays a one-shot clip again even if it is the current one. */
	protected _play(name: string, restart: boolean = false): void {
		if (!this.animation || !this.animation.getState(name) || (this._current === name && !restart)) {
			return;
		}
		if (this._current === name) {
			// Again from the start: a blend into the same state would only carry on.
			this.animation.play(name);
			return;
		}
		this._current = name;
		this.animation.crossFade(name, this.crossFade);
	}
}
