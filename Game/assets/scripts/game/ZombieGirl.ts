import { _decorator, AnimationClip, Node, v3, Vec3 } from "cc";
import { Body, Debris } from "./Debris";
import { PlayerAttack } from "./PlayerAttack";
import { Mode, Zombie } from "./Zombie";

const { ccclass, property } = _decorator;

const THROW = "throw";

enum Hunt {
	/** On the way to the thing picked. */
	Fetch,
	/** Nothing to throw anywhere near: keeps her distance and looks round now and then. */
	Stand,
	/** Picking it up and throwing it. */
	Throw,
	/** A breath after a throw before the next. */
	Rest,
}

interface Carry {
	body: Body;
	/** Where it lay: from here it rises to the hand. */
	from: Vec3;
	time: number;
	length: number;
	grabbed: boolean;
	released: boolean;
}

const _hand = v3();
const _at = v3();

// A zombie girl: she never comes to blows — she throws things at the player, the way
// ThroughTheDeadCity's boss does. Wandering like any zombie, once she sees the player she picks
// a thing to throw, in this order: the nearest lying on the way between her and the player;
// failing that, the nearest in her room — in plain sight of her. She runs to it, picks it up
// with the player's own throw and sends it at the player in a high arc, leading them a little.
// A thing she threw is deadly to the player while it flies — the only way she kills. With
// nothing to throw she keeps her distance and looks round now and then. Small furniture only:
// barrels stay the player's weapon.
@ccclass("ZombieGirl")
export class ZombieGirl extends Zombie {
	/** Things some girl is already going for or holding: two do not run for the same one. */
	private static readonly _claimed = new Set<Body>();

	@property({ type: AnimationClip, tooltip: "The throw — the player's clip; the skeleton is the same" })
	throwClip: AnimationClip = null;
	@property({ tooltip: "Playback speed of the throw clip" })
	throwSpeed: number = 3;
	@property({ tooltip: "Point of the throw clip, 0..1, where the hand reaches the thing on the floor", slide: true, range: [0, 1, 0.01] })
	grabMoment: number = 0.2;
	@property({ tooltip: "Point of the throw clip, 0..1, where the thing leaves the hand", slide: true, range: [0, 1, 0.01] })
	releaseMoment: number = 0.493;
	@property({ tooltip: "Name of the hand bone a thing is held in; found in the skeleton as it is when the level runs" })
	handBone: string = "mixamorig:RightHand";

	@property({ tooltip: "Half the width of the way between her and the player a thing counts as lying on" })
	corridor: number = 0.6;
	@property({ tooltip: "How far behind her a thing still counts as on the way" })
	behind: number = 0.3;
	@property({ tooltip: "She picks a thing up this close to it, past both their radii" })
	reach: number = 0.15;
	@property({ tooltip: "With nothing to throw she stays about this far from the player" })
	keepAway: number = 2.5;
	@property({ tooltip: "Seconds between looks round for something to throw, with nothing in sight" })
	lookEvery: number = 0.8;
	@property({ tooltip: "Seconds of getting nowhere on the way to a thing before she gives it up" })
	stuckFor: number = 1.2;
	@property({ tooltip: "Seconds a given-up thing is left alone" })
	forgetFor: number = 3;
	@property({ tooltip: "Seconds she stands after a throw" })
	rest: number = 0.8;

	@property({ tooltip: "How high the arc rises over her hand and the target" })
	arcHeight: number = 0.5;
	@property({ tooltip: "Height above the player's feet she throws at" })
	aimHeight: number = 0.35;
	@property({ tooltip: "Share of the player's run she throws ahead of them, 0..1", slide: true, range: [0, 1, 0.05] })
	lead: number = 0.5;
	@property({ tooltip: "Seconds past the planned landing a thrown thing is still deadly" })
	lethalAfter: number = 0.25;
	@property({ tooltip: "Tumble of a thrown thing, radians per second" })
	throwSpin: number = 8;
	@property({ tooltip: "Seconds a thrown thing does not touch her" })
	throwGrace: number = 0.5;

	private _handNode: Node = null;
	private _hunt = Hunt.Stand;
	private _item: Body = null;
	private _carry: Carry = null;
	private _clock = 0;
	private _stuck = 0;
	private _look = 0;
	private _skipped = new Map<Body, number>();
	private _last = v3();
	private _playerLast = v3();
	private _playerVelocity = v3();

	protected onLoad(): void {
		super.onLoad();
		this._createState(this.throwClip, THROW, false);
		const state = this.animation && this.animation.getState(THROW);
		state && (state.speed = this.throwSpeed);
	}

	protected onDisable(): void {
		super.onDisable();
		this._interrupt();
	}

	// --- the hunt

	protected _engage(): void {
		this._mode = Mode.Hunt;
		this._unseen = 0;
		this._choose();
	}

	protected _updateHunt(player: PlayerAttack, dt: number): void {
		this._clock += dt;
		this._trackPlayer(player, dt);
		if (this._carry) {
			this._throwStep(player, dt);
			return;
		}
		if (!this._stillSees(player, dt)) {
			this._release();
			this._goHome();
			return;
		}
		switch (this._hunt) {
			case Hunt.Rest:
				this._face(player, dt);
				if ((this._timer -= dt) <= 0) {
					this._choose();
				}
				break;
			case Hunt.Fetch:
				this._fetch(dt);
				break;
			case Hunt.Stand:
				this._keepDistance(player, dt);
				break;
		}
	}

	/** Still after the player: alive, near enough, and not out of sight for long. */
	private _stillSees(player: PlayerAttack, dt: number): boolean {
		if (!player || player.isDead) {
			return false;
		}
		const at = player.node.worldPosition;
		if (Vec3.distance(at, this.node.worldPosition) > this.loseRadius) {
			return false;
		}
		const walls = this._walls();
		if (walls && !walls.lineOfSight(this.node.worldPosition, at, this.height)) {
			return (this._unseen += dt) < this.loseSightTime;
		}
		this._unseen = 0;
		return true;
	}

	/** What to throw: on the way to the player first, then the nearest in her room. */
	private _choose(): void {
		this._release();
		const player = PlayerAttack.instance;
		const items = this._usable();
		const item = (player && this._between(items, player.node.worldPosition)) || this._nearest(items);
		this._look = this.lookEvery;
		if (!item) {
			this._hunt = Hunt.Stand;
			return;
		}
		this._item = item;
		ZombieGirl._claimed.add(item);
		this._hunt = Hunt.Fetch;
		this._stuck = 0;
		this._repath = 0;
		this._path.length = 0;
		this._play("run");
	}

	/** Lying still, not in anyone's hands, not a barrel, not given up on, not another girl's. */
	private _usable(): Body[] {
		const debris = Debris.instance;
		if (!debris) {
			return [];
		}
		return debris.bodies.filter((body) => {
			if (body.held || !body.node.isValid || !body.furniture || body.furniture.explosive || ZombieGirl._claimed.has(body)) {
				return false;
			}
			if (!body.asleep && body.velocity.lengthSqr() > 1) {
				return false; // still flying
			}
			const until = this._skipped.get(body);
			return !(until && until > this._clock);
		});
	}

	/** The nearest of those lying in the strip between her and the player. */
	private _between(items: Body[], target: Vec3): Body {
		const from = this.node.worldPosition;
		const dx = target.x - from.x;
		const dz = target.z - from.z;
		const length = Math.hypot(dx, dz);
		if (length < 1e-3) {
			return null;
		}
		const ux = dx / length;
		const uz = dz / length;
		let best: Body = null;
		let bestAway = Infinity;
		for (const item of items) {
			const p = item.node.worldPosition;
			const ox = p.x - from.x;
			const oz = p.z - from.z;
			const along = ox * ux + oz * uz;
			if (along < -this.behind || along > length || Math.abs(ox * uz - oz * ux) > this.corridor) {
				continue;
			}
			const away = Math.hypot(ox, oz);
			if (away < bestAway && this._inRoom(p)) {
				best = item;
				bestAway = away;
			}
		}
		return best;
	}

	/** The nearest in her room — whatever she can see. */
	private _nearest(items: Body[]): Body {
		const from = this.node.worldPosition;
		let best: Body = null;
		let bestAway = Infinity;
		for (const item of items) {
			const p = item.node.worldPosition;
			const away = Math.hypot(p.x - from.x, p.z - from.z);
			if (away < bestAway && this._inRoom(p)) {
				best = item;
				bestAway = away;
			}
		}
		return best;
	}

	private _inRoom(point: Vec3): boolean {
		const walls = this._walls();
		return !walls || walls.lineOfSight(this.node.worldPosition, point, this.height);
	}

	/** To the thing picked, round the walls; there — she picks it up. */
	private _fetch(dt: number): void {
		const item = this._item;
		if (!item || item.held || !item.node.isValid || !Debris.instance || Debris.instance.bodies.indexOf(item) < 0) {
			// Taken from under her nose: kicked away, blown up, picked up by the player.
			this._choose();
			return;
		}
		const p = item.node.worldPosition;
		const at = this.node.worldPosition;
		if (Math.hypot(p.x - at.x, p.z - at.z) <= this.radius + item.radius + this.reach) {
			this._grab(item);
			return;
		}
		if ((this._repath -= dt) <= 0 || !this._path.length) {
			this._repath = this.repathInterval;
			const finder = this._finder();
			if (!finder || !finder.find(at, p, this._path)) {
				this._path.length = 0;
				this._path.push(p.clone());
			}
		}
		this._last.set(at);
		this._follow(this.chaseSpeed, dt);
		const moved = Vec3.distance(this._last, this.node.worldPosition);
		// Getting nowhere: this thing is left alone a while, and another is looked for.
		this._stuck = moved >= this.chaseSpeed * dt * 0.3 ? 0 : this._stuck + dt;
		if (this._stuck >= this.stuckFor) {
			this._skipped.set(item, this._clock + this.forgetFor);
			this._choose();
		}
	}

	/** Nothing to throw: near the player, not too near, looking round for something. */
	private _keepDistance(player: PlayerAttack, dt: number): void {
		if ((this._look -= dt) <= 0) {
			this._choose();
			if (this._hunt !== Hunt.Stand) {
				return;
			}
		}
		const target = player.node.worldPosition;
		if (Vec3.distance(target, this.node.worldPosition) > this.keepAway) {
			if ((this._repath -= dt) <= 0 || !this._path.length) {
				this._repath = this.repathInterval;
				const finder = this._finder();
				if (!finder || !finder.find(this.node.worldPosition, target, this._path)) {
					this._path.length = 0;
					this._path.push(target.clone());
				}
			}
			this._play("run");
			this._follow(this.chaseSpeed, dt);
		} else {
			this._play("idle");
			this._face(player, dt);
		}
	}

	// --- the throw

	private _grab(item: Body): void {
		Debris.instance.hold(item);
		this._item = null;
		const length = this._duration(THROW);
		this._carry = { body: item, from: item.node.worldPosition.clone(), time: 0, length, grabbed: false, released: false };
		this._hunt = Hunt.Throw;
		this._play(THROW, true);
	}

	private _throwStep(player: PlayerAttack, dt: number): void {
		const carry = this._carry;
		carry.time += dt;
		this._face(player, dt);
		const share = carry.length > 0 ? carry.time / carry.length : 1;
		if (!carry.released) {
			if (share >= this.grabMoment) {
				carry.grabbed = true;
			}
			// Down to it, the thing rising to the hand; once in the hand, it goes with it.
			const from = this.grabMoment * 0.5;
			const k = carry.grabbed ? 1 : Math.max(0, (share - from) / Math.max(this.grabMoment - from, 1e-3));
			this._handPoint(_hand);
			Vec3.lerp(_at, carry.from, _hand, k * k * (3 - 2 * k));
			carry.body.node.setWorldPosition(_at);
			if (share >= this.releaseMoment) {
				this._launch(carry, player);
			}
		}
		if (carry.time < carry.length) {
			return;
		}
		this._carry = null;
		ZombieGirl._claimed.delete(carry.body);
		this._hunt = Hunt.Rest;
		this._timer = this.rest;
		this._play("idle");
	}

	/**
	 * Out of the hand at the player, in a high arc: the top of it is `arcHeight` over the hand and
	 * the target, which gives the time in the air, and that — the speed along the floor. Aimed
	 * a little ahead of a running player. Deadly to them while it flies.
	 */
	private _launch(carry: Carry, player: PlayerAttack): void {
		carry.released = true;
		const debris = Debris.instance;
		const body = carry.body;
		if (!debris || !player || player.isDead) {
			debris && debris.launch(body, 0, 0, 0, 0, 0, this.node, this.throwGrace);
			return;
		}
		const from = body.node.worldPosition;
		const target = player.node.worldPosition;
		const aimY = target.y + this.aimHeight;
		const peak = Math.max(from.y, aimY) + this.arcHeight;
		const up = Math.sqrt(2 * debris.gravity * Math.max(0.01, peak - from.y));
		const time = this._flightTime(up, from.y, aimY, debris);
		const aimX = target.x + this._playerVelocity.x * time * this.lead;
		const aimZ = target.z + this._playerVelocity.z * time * this.lead;
		const dx = aimX - from.x;
		const dz = aimZ - from.z;
		const length = Math.hypot(dx, dz);
		const ux = length > 1e-3 ? dx / length : 0;
		const uz = length > 1e-3 ? dz / length : 0;
		// Drag eats the speed along the floor as well: the way covered is v·(1 − e^(−k·t))/k.
		const k = debris.linearDamping;
		const reach = k * time > 1e-3 ? (1 - Math.exp(-k * time)) / k : time;
		const along = Math.max(0.01, length / reach);
		debris.launch(body, ux, uz, along, up / along, this.throwSpin, this.node, this.throwGrace);
		body.lethalFor = time + this.lethalAfter;
	}

	/** Seconds a thing thrown up at `up` takes to come down to `aimY`, stepped as the physics steps it. */
	private _flightTime(up: number, fromY: number, aimY: number, debris: Debris): number {
		const step = 1 / 120;
		const keep = Math.exp(-debris.linearDamping * step);
		let y = fromY;
		let vy = up;
		let time = 0;
		while (time < 5) {
			vy = (vy - debris.gravity * step) * keep;
			y += vy * step;
			time += step;
			if (vy < 0 && y <= aimY) {
				break;
			}
		}
		return time;
	}

	/** A hit or death mid-throw: the thing drops where it is; a thing she was going for is free again. */
	protected _interrupt(): void {
		const carry = this._carry;
		this._carry = null;
		if (carry) {
			ZombieGirl._claimed.delete(carry.body);
			if (!carry.released && Debris.instance && Debris.instance.bodies.indexOf(carry.body) >= 0) {
				Debris.instance.launch(carry.body, 0, 0, 0, 0, 0, this.node, this.throwGrace);
			}
		}
		this._release();
	}

	private _release(): void {
		this._item && ZombieGirl._claimed.delete(this._item);
		this._item = null;
	}

	// --- helpers

	private _handPoint(out: Vec3): Vec3 {
		const hand = this._hand();
		if (hand) {
			return out.set(hand.worldPosition);
		}
		const at = this.node.worldPosition;
		return out.set(at.x, at.y + 0.5, at.z);
	}

	/**
	 * The hand bone, looked up by name in the skeleton the animation drives. Not a reference
	 * kept in the prefab: the model is a prefab within a prefab, rebuilt as the level loads, and
	 * a kept reference ends up on a copy of the bones nothing moves.
	 */
	private _hand(): Node {
		if (this._handNode && this._handNode.isValid && this._isMine(this._handNode)) {
			return this._handNode;
		}
		const root = this.animation ? this.animation.node : this.node;
		this._handNode = this._find(root, this.handBone);
		return this._handNode;
	}

	/** Hangs from the animated root for real: every parent on the way up still has it among its children. */
	private _isMine(node: Node): boolean {
		const root = this.animation ? this.animation.node : this.node;
		for (let at = node; at; at = at.parent) {
			if (at === root) {
				return true;
			}
			if (!at.parent || at.parent.children.indexOf(at) < 0) {
				return false;
			}
		}
		return false;
	}

	private _find(node: Node, name: string): Node {
		if (node.name === name) {
			return node;
		}
		for (const child of node.children) {
			const found = this._find(child, name);
			if (found) {
				return found;
			}
		}
		return null;
	}

	private _face(player: PlayerAttack, dt: number): void {
		player && this._turnTo(player.node.worldPosition, dt);
	}

	/** How fast the player runs, for leading the throw. */
	private _trackPlayer(player: PlayerAttack, dt: number): void {
		if (!player || dt <= 0) {
			return;
		}
		const at = player.node.worldPosition;
		this._playerVelocity.set((at.x - this._playerLast.x) / dt, 0, (at.z - this._playerLast.z) / dt);
		if (this._playerVelocity.length() > 10) {
			this._playerVelocity.set(0, 0, 0); // a jump across the level — a restart, not a run
		}
		this._playerLast.set(at);
	}
}
