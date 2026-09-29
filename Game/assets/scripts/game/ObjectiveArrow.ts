import { _decorator, Color, Component, director, Material, Mesh, MeshRenderer, Node, primitives, utils, v3, Vec3 } from "cc";
import { Prewarm } from "../managers/Prewarm";
import { Door } from "./Door";
import { FloorButton } from "./FloorButton";
import { Gate } from "./Gate";
import { KeyPickup } from "./KeyPickup";
import { LockedDoor } from "./LockedDoor";
import { PathFinder } from "./PathFinder";
import { PlayerAttack } from "./PlayerAttack";
import { PlayerKeys } from "./PlayerKeys";

const { ccclass, property } = _decorator;

// builtin-unlit techniques: 2 — additive, 3 — alpha blend.
const ADD = 2;
const BLEND = 3;

const _to = v3();
const _side = v3();
const _color = new Color();

// An arrow on the floor under the player, pointing the way to what the level wants next: the
// gate once it is open; the lever while it can be walked to; before that a locked door they
// hold the key for, a key they can reach, a floor button whose door stands shut — the nearest
// of what can be reached, by the way there, not as the crow flies. It points along that way,
// round the walls, to its first corner, and is gone while the player is close to the thing.
// What can be reached is what the walls leave open now: a shut door, a shut gate is a wall.
// The thing itself glows: a disc of light on the floor under it, the way a fire's mouth glows,
// breathing — there while it is the goal, near or far, and moving on with the goal. A door that
// was a goal of its own — unlocked with a key, or held open by a button — glows first when the
// way goes through it: the nearest one ahead, until the player is through. A plain door open from
// the start is only a doorway, and does not. While such a door is the glowing step, the arrow
// hides close to it as it does at the goal.
@ccclass("ObjectiveArrow")
export class ObjectiveArrow extends Component {
	@property({ tooltip: "Hidden while the player is this close to the goal, on the floor" })
	hideDistance: number = 1.1;
	@property({ tooltip: "How far from the player's middle the arrow starts" })
	offset: number = 0.34;
	@property({ tooltip: "Length of the arrow" })
	length: number = 0.3;
	@property({ tooltip: "Width of the arrow's head" })
	width: number = 0.26;
	@property({ tooltip: "Height above the floor it lies at: over the tiles' top" })
	height: number = 0.04;
	@property color: Color = new Color(96, 232, 112, 235);
	@property({ tooltip: "Degrees a second it turns to a new way" })
	turnSpeed: number = 540;
	@property({ tooltip: "Seconds between choosing the goal again" })
	chooseEvery: number = 0.5;
	@property({ tooltip: "Seconds between finding the way to it again" })
	routeEvery: number = 0.15;
	@property({ tooltip: "Cell of the grid the way is found on" })
	pathCell: number = 0.25;
	@property({ tooltip: "A point of the way this close to the player is passed by: the arrow points further on" })
	lead: number = 0.55;
	@property({ tooltip: "How far along the way the arrow points: at a point this far ahead, not the next corner" })
	ahead: number = 1.2;
	@property({ tooltip: "How much it swells and shrinks, a beat a second" })
	pulse: number = 0.08;
	@property({ tooltip: "Width of the glow on the floor under the goal" })
	markSize: number = 1;
	@property markColor: Color = new Color(80, 230, 110, 65);
	@property({ tooltip: "How much higher than the arrow the glow lies, off the floor" })
	markHeight: number = 0.03;
	@property({ tooltip: "How much higher the glow lies in the gateway than under the other goals; the gate has no threshold now" })
	gateLift: number = 0;
	@property({ tooltip: "An open door on the way stops glowing once the player is this close to it: going through" })
	passDistance: number = 0.45;

	private _node: Node = null;
	private _material: Material = null;
	private _finder: PathFinder = null;
	private _goal: Vec3 = null;
	private _next = v3();
	/** The way to the goal as last found; the arrow walks it on its own between searches. */
	private _way: Vec3[] = [];
	private _hasWay = false;
	private _yaw = 0;
	private _shown = 0;
	private _chooseIn = 0;
	private _routeIn = 0;
	private _time = 0;
	private _path: Vec3[] = [];
	private _mark: Node = null;
	private _markMaterial: Material = null;
	/** Where the goal's glow should be, and where it is — it fades out before it moves on. */
	private _markWant: Vec3 = null;
	private _markAt = v3();
	/** Raised off the floor — in the gateway, over the threshold. */
	private _markLift = 0;
	private _markWantLift = 0;
	/** The goal's own glow, when no open door on the way comes first. */
	private _goalMark: Vec3 = null;
	private _goalLift = 0;
	private _doors: Door[] = [];
	/** The door on the way that glows now, if one does: the arrow hides near it too. */
	private _wayDoor: Vec3 = null;
	private _markShown = 0;

	protected start(): void {
		this._node = new Node("ObjectiveArrow");
		director.getScene().addChild(this._node);
		const renderer = this._node.addComponent(MeshRenderer);
		renderer.mesh = this._arrowMesh();
		renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
		renderer.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
		this._material = new Material();
		this._material.initialize({ effectName: "builtin-unlit", technique: BLEND });
		renderer.setSharedMaterial(this._material, 0);
		this._node.setScale(0, 0, 0);
		// The goal's glow: a flat disc of light on the floor, like a fire's mouth.
		this._mark = new Node("ObjectiveMark");
		director.getScene().addChild(this._mark);
		const glow = this._mark.addComponent(MeshRenderer);
		glow.mesh = utils.MeshUtils.createMesh(primitives.cylinder(0.5, 0.5, 1, { radialSegments: 24, capped: true }));
		glow.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
		glow.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
		this._markMaterial = new Material();
		this._markMaterial.initialize({ effectName: "builtin-unlit", technique: ADD });
		glow.setSharedMaterial(this._markMaterial, 0);
		this._mark.setScale(0, 0, 0);
	}

	protected onDestroy(): void {
		this._node && this._node.isValid && this._node.destroy();
		this._mark && this._mark.isValid && this._mark.destroy();
	}

	protected lateUpdate(dt: number): void {
		if (!this._node) {
			return;
		}
		this._time += dt;
		const attack = PlayerAttack.instance;
		const alive = !Prewarm.active && attack && !attack.isDead;
		if (alive && (this._chooseIn -= dt) <= 0) {
			this._chooseIn = this.chooseEvery;
			this._choose();
			this._routeIn = 0;
		}
		if (alive && this._goal && (this._routeIn -= dt) <= 0) {
			this._routeIn = this.routeEvery;
			this._route();
		}
		const at = this.node.worldPosition;
		const near = this._wayDoor || this._goal;
		const far = !!near && Math.hypot(near.x - at.x, near.z - at.z) > this.hideDistance;
		const want = alive && far && this._hasWay ? 1 : 0;
		// Comes and goes quickly, not at once.
		this._shown += Math.sign(want - this._shown) * Math.min(Math.abs(want - this._shown), dt * 6);
		if (this._hasWay && this._aim(at)) {
			const yaw = (Math.atan2(this._next.x - at.x, this._next.z - at.z) * 180) / Math.PI;
			let turn = ((yaw - this._yaw + 540) % 360) - 180;
			const step = this.turnSpeed * dt;
			turn = Math.max(-step, Math.min(step, turn));
			this._yaw = this._shown <= 0 ? yaw : this._yaw + turn;
		}
		const size = this._shown * (1 + this.pulse * Math.sin(this._time * Math.PI * 2));
		this._node.setWorldPosition(at.x, this.height, at.z);
		this._node.setRotationFromEuler(0, this._yaw, 0);
		this._node.setScale(size, size, size);
		_color.set(this.color.r, this.color.g, this.color.b, Math.round(this.color.a * this._shown));
		this._material.setProperty("mainColor", _color);
		this._glow(alive && this._hasWay, dt);
	}

	/** The glow under the goal: breathing while it is the goal; out, then over to the next one. */
	private _glow(on: boolean, dt: number): void {
		const want = this._markWant;
		const moved = !!want && Math.hypot(want.x - this._markAt.x, want.z - this._markAt.z) > 0.05;
		const target = on && want && !moved ? 1 : 0;
		this._markShown += Math.sign(target - this._markShown) * Math.min(Math.abs(target - this._markShown), dt * 4);
		if (moved && this._markShown <= 0) {
			this._markAt.set(want.x, 0, want.z);
			this._markLift = this._markWantLift;
		}
		const breath = 0.5 + 0.5 * Math.sin(this._time * Math.PI * 2 * 0.8);
		const width = this.markSize * this._markShown * (0.9 + 0.1 * breath);
		this._mark.setWorldPosition(this._markAt.x, this.height - 0.01 + this.markHeight + this._markLift, this._markAt.z);
		this._mark.setScale(width, 0.01, width);
		const c = this.markColor;
		_color.set(c.r, c.g, c.b, Math.round(c.a * this._markShown * (0.7 + 0.3 * breath)));
		this._markMaterial.setProperty("mainColor", _color);
	}

	// --- what is wanted next

	/** The goal: the first of gate, lever, door, key, button that there is and can be walked to. */
	private _choose(): void {
		const scene = director.getScene();
		const gate = scene.getComponentsInChildren(Gate)[0];
		this._goal = null;
		this._goalMark = null;
		this._markWant = null;
		this._doors = scene.getComponentsInChildren(Door);
		// The open gate, when it can be walked to; shut off from it, what opens the way comes first.
		if (gate && gate.isOpen && this._reach((gate.exit || gate.node).worldPosition) >= 0) {
			// The way leads out behind it; the glow lies in the gateway.
			this._set((gate.exit || gate.node).worldPosition, gate.node.worldPosition, this.gateLift);
			return;
		}
		const lever = gate && gate.lever;
		if (lever && !lever.isOn && this._reach(lever.node.worldPosition) >= 0) {
			this._set(lever.node.worldPosition);
			return;
		}
		// A door they have the key for, then a key, then a button whose door is shut: the nearest by the way.
		const keys = PlayerKeys.instance;
		const doors = scene.getComponentsInChildren(LockedDoor).filter((lock) => {
			const door = lock.getComponent(Door);
			return door && !door.isOpen && keys && keys.has(lock.color);
		});
		if (this._nearest(doors.map((lock) => lock.node), true)) {
			return;
		}
		// Only keys that are keys: the warm-up (Prewarm) lays copies of them out for a frame with their
		// logic off, and one of those, nearest, was the goal for the first moment of the level.
		const pickups = scene.getComponentsInChildren(KeyPickup).filter((key) => key.isValid && key.enabledInHierarchy && !key.taken);
		if (this._nearest(pickups.map((key) => key.node), false)) {
			return;
		}
		const buttons = scene.getComponentsInChildren(FloorButton).filter((button) => !button.isDown && button.doors.some((door) => door && !door.isOpen));
		this._nearest(buttons.map((button) => button.node), false);
	}

	/** The nearest of these by the way there; a door is walked up to on either side of it. */
	private _nearest(nodes: Node[], door: boolean): boolean {
		let best = -1;
		for (const node of nodes) {
			const at = node.worldPosition;
			const spots = door ? this._beside(at) : [at];
			for (const spot of spots) {
				const length = this._reach(spot);
				if (length >= 0 && (best < 0 || length < best)) {
					best = length;
					this._set(spot, node.worldPosition);
				}
			}
		}
		return best >= 0;
	}

	/** Points a step out from a door on its four sides: the ones on the floor are where it is walked up to. */
	private _beside(at: Vec3): Vec3[] {
		const out: Vec3[] = [];
		for (const [dx, dz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) {
			_side.set(at.x + dx, at.y, at.z + dz);
			const walls = PlayerAttack.instance && PlayerAttack.instance.walls;
			if (!walls || !walls.isBlocked(_side.x, _side.z)) {
				out.push(_side.clone());
			}
		}
		return out;
	}

	/** The goal the way leads to, and the thing that glows — the same but at a door or the gate. */
	private _set(at: Vec3, mark: Vec3 = at, lift = 0): void {
		this._goal = at.clone();
		this._goalMark = mark.clone();
		this._goalLift = lift;
		this._markWant = this._goalMark;
		this._markWantLift = lift;
	}

	/** Length of the way from the player to `to`, or -1 when there is none. */
	private _reach(to: Vec3): number {
		const finder = this._pathFinder();
		if (!finder) {
			return -1;
		}
		const from = this.node.worldPosition;
		_to.set(to.x, from.y, to.z);
		if (!finder.find(from, _to, this._path) || !this._path.length) {
			return -1;
		}
		let length = 0;
		let x = from.x;
		let z = from.z;
		for (const point of this._path) {
			length += Math.hypot(point.x - x, point.z - z);
			x = point.x;
			z = point.z;
		}
		// Found, but ending short of it: the way stops at a wall between.
		const end = this._path[this._path.length - 1];
		return Math.hypot(end.x - _to.x, end.z - _to.z) > 0.5 ? -1 : length;
	}

	/** The way to the goal again: the arrow points to its first corner. */
	private _route(): void {
		if (!this._goal || this._reach(this._goal) < 0) {
			this._hasWay = false;
			this._wayDoor = null;
			this._chooseIn = 0;
			return;
		}
		this._way = this._path.map((point) => point.clone());
		this._hasWay = true;
		this._markOnWay();
	}

	/** A door that stood in the way: locked, or shut until a button opens it — not one open from the start. */
	private _wasGoal(door: Door): boolean {
		return !!door.getComponent(LockedDoor) || !door.startOpen;
	}

	/**
	 * Where the arrow points this frame: the first point of the way still ahead. Between two
	 * searches the player walks on, and the way found a moment ago starts behind them — at the
	 * middle of the cell they stood in, or at a corner they have just turned. Pointing there the
	 * arrow swung round for a split second. So points closer than `lead` are passed by, and so is a
	 * corner once the player is past it along the next leg. False when there is nowhere to point.
	 */
	private _aim(at: Vec3): boolean {
		const way = this._way;
		while (way.length > 1) {
			const first = way[0];
			const second = way[1];
			const close = Math.hypot(first.x - at.x, first.z - at.z) < this.lead;
			// Past the corner: it lies behind, looking along the leg that leaves it.
			const passed = (first.x - at.x) * (second.x - first.x) + (first.z - at.z) * (second.z - first.z) < 0;
			if (!close && !passed) {
				break;
			}
			way.shift();
		}
		if (!way.length) {
			return false;
		}
		// Not the next corner itself, but the point `ahead` along the way: at a doorway the corners lie
		// right by the player and each search puts them a little elsewhere — pointing at them the
		// arrow jerked by tens of degrees; a point further along barely moves.
		let left = this.ahead;
		let x = at.x;
		let z = at.z;
		for (const point of way) {
			const length = Math.hypot(point.x - x, point.z - z);
			if (length >= left) {
				const t = left / length;
				this._next.set(x + (point.x - x) * t, 0, z + (point.z - z) * t);
				return true;
			}
			left -= length;
			x = point.x;
			z = point.z;
		}
		const end = way[way.length - 1];
		if (Math.hypot(end.x - at.x, end.z - at.z) < 1e-3) {
			return false;
		}
		this._next.set(end);
		return true;
	}

	/** The glow on the first such open door the way goes through, if any lies ahead; else on the goal. */
	private _markOnWay(): void {
		const from = this.node.worldPosition;
		let x = from.x;
		let z = from.z;
		let along = 0;
		let best: Vec3 = null;
		let bestAlong = Infinity;
		for (const point of this._path) {
			const dx = point.x - x;
			const dz = point.z - z;
			const length = Math.hypot(dx, dz);
			for (const door of this._doors) {
				if (!door.isValid || !door.isOpen || !this._wasGoal(door)) {
					continue;
				}
				const at = door.node.worldPosition;
				// The one being walked through now is behind already.
				if (Math.hypot(at.x - from.x, at.z - from.z) < this.passDistance) {
					continue;
				}
				const t = length > 1e-6 ? Math.max(0, Math.min(1, ((at.x - x) * dx + (at.z - z) * dz) / (length * length))) : 0;
				if (Math.hypot(x + dx * t - at.x, z + dz * t - at.z) < 0.5 && along + t * length < bestAlong) {
					bestAlong = along + t * length;
					best = at;
				}
			}
			along += length;
			x = point.x;
			z = point.z;
		}
		if (best) {
			this._markWant = best.clone();
			this._markWantLift = 0;
			this._wayDoor = this._markWant;
		} else {
			this._markWant = this._goalMark;
			this._markWantLift = this._goalLift;
			this._wayDoor = null;
		}
	}

	private _pathFinder(): PathFinder {
		if (!this._finder) {
			const walls = PlayerAttack.instance && PlayerAttack.instance.walls;
			walls && (this._finder = new PathFinder(walls, this.pathCell));
		}
		return this._finder;
	}

	/** A flat arrow on the floor, pointing along +Z from `offset` out: a shaft and a head, seen from either side. */
	private _arrowMesh(): Mesh {
		const o = this.offset;
		const shaft = this.width * 0.36;
		const neck = o + this.length * 0.45;
		const tip = o + this.length;
		const h = this.width / 2;
		const s = shaft / 2;
		// prettier-ignore
		const positions = [
			-s, 0, o, s, 0, o, s, 0, neck, -s, 0, neck, // shaft
			-h, 0, neck, h, 0, neck, 0, 0, tip, // head
		];
		const up = [0, 1, 0];
		const normals = [...up, ...up, ...up, ...up, ...up, ...up, ...up];
		const uvs = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0.5, 1];
		const front = [0, 2, 1, 0, 3, 2, 4, 6, 5];
		const back = [0, 1, 2, 0, 2, 3, 4, 5, 6];
		return utils.MeshUtils.createMesh({ positions, normals, uvs, indices: [...front, ...back] });
	}
}
