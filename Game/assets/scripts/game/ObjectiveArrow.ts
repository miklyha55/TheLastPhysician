import { _decorator, Color, Component, director, Material, Mesh, MeshRenderer, Node, utils, v3, Vec3 } from "cc";
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

// builtin-unlit technique 3 — alpha blend.
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
	@property color: Color = new Color(255, 214, 64, 235);
	@property({ tooltip: "Degrees a second it turns to a new way" })
	turnSpeed: number = 540;
	@property({ tooltip: "Seconds between choosing the goal again" })
	chooseEvery: number = 0.5;
	@property({ tooltip: "Seconds between finding the way to it again" })
	routeEvery: number = 0.15;
	@property({ tooltip: "Cell of the grid the way is found on" })
	pathCell: number = 0.25;
	@property({ tooltip: "How much it swells and shrinks, a beat a second" })
	pulse: number = 0.08;

	private _node: Node = null;
	private _material: Material = null;
	private _finder: PathFinder = null;
	private _goal: Vec3 = null;
	private _next = v3();
	private _hasWay = false;
	private _yaw = 0;
	private _shown = 0;
	private _chooseIn = 0;
	private _routeIn = 0;
	private _time = 0;
	private _path: Vec3[] = [];

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
	}

	protected onDestroy(): void {
		this._node && this._node.isValid && this._node.destroy();
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
		const far = !!this._goal && Math.hypot(this._goal.x - at.x, this._goal.z - at.z) > this.hideDistance;
		const want = alive && far && this._hasWay ? 1 : 0;
		// Comes and goes quickly, not at once.
		this._shown += Math.sign(want - this._shown) * Math.min(Math.abs(want - this._shown), dt * 6);
		if (this._hasWay) {
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
	}

	// --- what is wanted next

	/** The goal: the first of gate, lever, door, key, button that there is and can be walked to. */
	private _choose(): void {
		const scene = director.getScene();
		const gate = scene.getComponentsInChildren(Gate)[0];
		this._goal = null;
		if (gate && gate.isOpen) {
			this._set((gate.exit || gate.node).worldPosition);
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
		const pickups = scene.getComponentsInChildren(KeyPickup).filter((key) => key.isValid && !key.taken);
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
					this._set(spot);
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

	private _set(at: Vec3): void {
		this._goal = at.clone();
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
			this._chooseIn = 0;
			return;
		}
		this._next.set(this._path[0]);
		this._hasWay = true;
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
