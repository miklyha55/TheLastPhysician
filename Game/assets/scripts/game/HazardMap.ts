import { Component, director, Node, Scene, v3, Vec3 } from "cc";

// Where a level's traps can hurt, as a map on the floor, for the zombies to keep out of: a ring
// round every fire pipe, the square of floor spikes, the strip in front of wall spikes, the swing of
// a pendulum, the line a gargoyle fires along to the wall. Each widened by a zombie's girth. Built
// once a scene, from the traps themselves — they stand still, only the danger comes and goes, and a
// zombie keeps out of a trap whether it is working this moment or not: it is not waiting for it.
//
// The traps are found by name, not by import: they reach back to the zombies (HazardVictims), and
// the zombies' path search reaches here.

/** A zombie's girth: how much farther than the trap's own reach it keeps. */
const MARGIN = 0.2;

interface Zone {
	/** Circle: centre and radius. */
	x: number;
	z: number;
	r: number;
	/** Box (in place of the circle when set): its half sizes along its own axes, and its axes. */
	hx?: number;
	hz?: number;
	ax?: number;
	az?: number;
	/** Segment (for a line of fire): its far end, with `r` as half its width. */
	x2?: number;
	z2?: number;
}

type Trap = Component & { [key: string]: any };

const _a = v3();
const _b = v3();

export class HazardMap {
	private static _scene: Scene = null;
	private static _zones: Zone[] = [];
	private static _version = 0;

	/** Bumped whenever the map is built anew: what caches it knows to ask again. */
	static get version(): number {
		HazardMap._ensure();
		return HazardMap._version;
	}

	/** Is this point on the floor within a trap's reach. */
	static at(x: number, z: number): boolean {
		HazardMap._ensure();
		for (const zone of HazardMap._zones) {
			if (HazardMap._inside(zone, x, z)) {
				return true;
			}
		}
		return false;
	}

	/** Does the straight way from `a` to `b` keep out of every trap's reach. */
	static lineClear(a: Vec3, b: Vec3, step = 0.1): boolean {
		const length = Math.hypot(b.x - a.x, b.z - a.z);
		const parts = Math.max(1, Math.ceil(length / step));
		for (let i = 0; i <= parts; i++) {
			const t = i / parts;
			if (HazardMap.at(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) {
				return false;
			}
		}
		return true;
	}

	private static _inside(zone: Zone, x: number, z: number): boolean {
		if (zone.x2 !== undefined) {
			// Distance to the segment.
			const dx = zone.x2 - zone.x;
			const dz = zone.z2 - zone.z;
			const length = dx * dx + dz * dz;
			const t = length > 0 ? Math.max(0, Math.min(1, ((x - zone.x) * dx + (z - zone.z) * dz) / length)) : 0;
			return Math.hypot(x - (zone.x + dx * t), z - (zone.z + dz * t)) <= zone.r;
		}
		if (zone.hx !== undefined) {
			const px = x - zone.x;
			const pz = z - zone.z;
			// Along its own axes: `a` one way, the perpendicular the other.
			const u = px * zone.ax + pz * zone.az;
			const w = -px * zone.az + pz * zone.ax;
			return Math.abs(u) <= zone.hx && Math.abs(w) <= zone.hz;
		}
		return Math.hypot(x - zone.x, z - zone.z) <= zone.r;
	}

	/** The map of the scene playing now; made anew when the scene changes. */
	private static _ensure(): void {
		const scene = director.getScene();
		if (scene && scene === HazardMap._scene) {
			return;
		}
		HazardMap._zones = scene ? HazardMap._build(scene) : [];
		HazardMap._version++;
		// Kept only once the walls are laid out: the lines of fire are measured to them.
		const player = scene && (scene.getComponentsInChildren("PlayerAttack")[0] as Trap);
		const walls = player && player.walls;
		HazardMap._scene = walls && walls.area ? scene : null;
	}

	private static _build(scene: Scene): Zone[] {
		const zones: Zone[] = [];
		for (const vent of scene.getComponentsInChildren("FireVent") as Trap[]) {
			const at = vent.node.worldPosition;
			zones.push({ x: at.x, z: at.z, r: (vent.killRadius || 0.7) + MARGIN });
		}
		for (const spikes of scene.getComponentsInChildren("SpikeTrap") as Trap[]) {
			zones.push(HazardMap._spikes(spikes));
		}
		for (const pendulum of scene.getComponentsInChildren("Pendulum") as Trap[]) {
			const at = pendulum.node.worldPosition;
			// The blade sweeps its tile and a little past it either way.
			zones.push({ x: at.x, z: at.z, r: 0.7 + MARGIN });
		}
		for (const head of scene.getComponentsInChildren("Gargoyle") as Trap[]) {
			const line = HazardMap._lineOfFire(head);
			line && zones.push(line);
		}
		return zones;
	}

	/** Floor spikes hurt a square round the tile's middle; wall spikes a box in front of the wall. */
	private static _spikes(trap: Trap): Zone {
		const node: Node = trap.node;
		const at = node.worldPosition;
		// The tile's own axes on the floor: where its local X points.
		Vec3.transformQuat(_a, Vec3.UNIT_X, node.worldRotation);
		const len = Math.hypot(_a.x, _a.z) || 1;
		const ax = _a.x / len;
		const az = _a.z / len;
		if (trap.useBox && trap.boxMin && trap.boxMax) {
			// The box's middle, in the tile's axes, out into the world.
			const cx = (trap.boxMin.x + trap.boxMax.x) / 2;
			const cz = (trap.boxMin.z + trap.boxMax.z) / 2;
			_b.set(cx, 0, cz);
			Vec3.transformQuat(_b, _b, node.worldRotation);
			return {
				x: at.x + _b.x,
				z: at.z + _b.z,
				r: 0,
				hx: Math.abs(trap.boxMax.x - trap.boxMin.x) / 2 + MARGIN,
				hz: Math.abs(trap.boxMax.z - trap.boxMin.z) / 2 + MARGIN,
				ax,
				az,
			};
		}
		const half = (trap.halfSize || 0.4) + MARGIN;
		return { x: at.x, z: at.z, r: 0, hx: half, hz: half, ax, az };
	}

	/** A gargoyle's fire: from its mouth straight across the room to the first wall. */
	private static _lineOfFire(head: Trap): Zone {
		const mouth: Node = head.mouth;
		const player = director.getScene() && (director.getScene().getComponentsInChildren("PlayerAttack")[0] as Trap);
		const walls = player && player.walls;
		if (!mouth || !walls) {
			return null;
		}
		const from = mouth.worldPosition;
		Vec3.transformQuat(_a, Vec3.UNIT_Z, mouth.worldRotation);
		const len = Math.hypot(_a.x, _a.z) || 1;
		const dx = _a.x / len;
		const dz = _a.z / len;
		const clearance = head.clearance || 0.3;
		const range = head.maxRange || 20;
		let reach = clearance;
		while (reach < range && !walls.isBlocked(from.x + dx * reach, from.z + dz * reach)) {
			reach += 0.1;
		}
		return { x: from.x, z: from.z, r: (head.radius || 0.12) + MARGIN, x2: from.x + dx * reach, z2: from.z + dz * reach };
	}
}
