import { _decorator, Component, Mat4, MeshRenderer, Node, Prefab, v3, Vec3 } from "cc";
import { Door } from "./Door";

const { ccclass, property } = _decorator;

// How many times a step into a wall is pushed back out before falling back to axis sliding.
const PUSH_ITERATIONS = 4;
// Fractions of a slide tried when the full one would still touch a wall.
const SLIDE_SCALES = [1, 0.5, 0.25];

// Keeps the player out of the walls: every instance of a wall prefab found in the scene is
// flattened onto the floor as a grid of blocked cells, built from the walls' own geometry,
// so corners, crosses and doorways block exactly where they stand. After the player moves,
// a step into a wall is undone along the blocked axis only, which lets it slide along.
// A door leaf is kept on a layer of its own, laid out shut, and blocks only while its door
// is closed.
@ccclass("WallCollision")
export class WallCollision extends Component {
	@property({ type: [Prefab], tooltip: "Prefabs whose instances block the player" })
	wallPrefabs: Prefab[] = [];
	@property({ type: Node, tooltip: "Where to look for wall instances; empty — the whole scene" })
	root: Node = null;
	@property({ tooltip: "Player radius on the floor" })
	radius: number = 0.2;
	@property({ tooltip: "Size of one blocked-map cell" })
	cellSize: number = 0.05;
	@property({ tooltip: "Geometry lower than this (the floor under a wall) does not block" })
	minHeight: number = 0.05;
	@property({ tooltip: "Geometry entirely higher than this (a lintel over a doorway) does not block" })
	maxHeight: number = 0.9;
	@property({ tooltip: "How far to the side a blocked step looks for a way through — steers the player into a doorway it just missed; 0 — off" })
	cornerAssist: number = 0.3;

	private _cells: Uint8Array = null;
	private _doors: { door: Door; cells: Uint8Array }[] = [];
	private _cols: number = 0;
	private _rows: number = 0;
	private _originX: number = 0;
	private _originZ: number = 0;
	private _previous: Vec3 = null;
	private _next: Vec3 = v3();
	private _want: Vec3 = v3();
	private _normal: Vec3 = v3();
	private _probe: Vec3 = v3();
	private _slide: Vec3 = v3();
	private _sliding = false;
	private _input: Vec3 = v3();

	protected start(): void {
		this._build();
		this._previous = this.node.worldPosition.clone();
	}

	/**
	 * Where a move from `from` towards `to` may end: `to` when it is clear, otherwise pushed
	 * out along the walls, steered into a nearby opening, slid along one axis, or held at
	 * `from`. Movement code calls this before placing the player, so the player is never
	 * inside a wall, not even for the part of a frame a following camera looks at.
	 */
	resolve(from: Vec3, target: Vec3, out: Vec3): Vec3 {
		// `out` may be `target` itself; keep the wanted point apart from the working one.
		const to = this._want.set(target);
		out.set(to);
		const mx = to.x - from.x;
		const mz = to.z - from.z;
		const steady = this._sameInput(mx, mz);
		if (!this._cells || !this._blocked(to.x, to.z) || this._blocked(from.x, from.z)) {
			// Clear, or caught inside when a door shut on the player: let them walk out.
			this._sliding = false;
			return out;
		}
		// Slide: drop the part of the step that goes into the wall and keep the part along
		// it. The player stays as far from the wall as it already was, so sliding is one
		// smooth line instead of a step in and a push back out every other frame. At a door
		// jamb or a corner the normal leans sideways, which carries the player round it.
		if (this._normalAt(to, this._normal)) {
			const into = mx * this._normal.x + mz * this._normal.z;
			if (into < 0) {
				const sx = mx - this._normal.x * into;
				const sz = mz - this._normal.z * into;
				// Wedged in a corner, each wall in turn sends the slide back the other way. With
				// the stick held still, a slide that turns round means there is nowhere to go.
				if (steady && this._sliding && sx * this._slide.x + sz * this._slide.z < 0) {
					return out.set(from);
				}
				for (const scale of SLIDE_SCALES) {
					out.set(from.x + sx * scale, to.y, from.z + sz * scale);
					if (!this._blocked(out.x, out.z)) {
						this._slide.set(sx, 0, sz);
						this._sliding = true;
						return out;
					}
				}
			}
		}
		// Push back out along the normal, as long as that does not throw the player backwards.
		out.set(to);
		for (let i = 0; i < PUSH_ITERATIONS && this._pushOut(out); i++) {}
		if (!this._blocked(out.x, out.z) && (out.x - from.x) * mx + (out.z - from.z) * mz >= 0) {
			return out;
		}
		// Head-on into a jamb: if the way through is just to one side, step towards it.
		if (this._assist(from, to, out)) {
			return out;
		}
		// Otherwise keep whichever axis is still free, so the player slides along the wall.
		if (!this._blocked(to.x, from.z)) {
			return out.set(to.x, to.y, from.z);
		}
		if (!this._blocked(from.x, to.z)) {
			return out.set(from.x, to.y, to.z);
		}
		return out.set(from.x, to.y, from.z);
	}

	/** A safety net for anything else that moves the player straight into a wall. */
	protected lateUpdate(): void {
		if (!this._cells) {
			return;
		}
		const current = this.node.worldPosition;
		const previous = this._previous;
		// Only when something left the player inside a wall; the movement code has already
		// settled its own steps, and calling resolve again would reset the slide it keeps.
		if (!current.equals(previous) && this._blocked(current.x, current.z)) {
			this.resolve(previous, current, this._next);
			if (!this._next.equals(current)) {
				this.node.setWorldPosition(this._next);
			}
		}
		previous.set(this.node.worldPosition);
	}

	/** Walls found under the root: prefab instances of the listed assets, or nodes named like them. */
	private _wallInstances(): Node[] {
		const uuids = new Set<string>();
		const names = new Set<string>();
		for (const prefab of this.wallPrefabs) {
			if (!prefab) {
				continue;
			}
			uuids.add(prefab._uuid);
			prefab.data && names.add(prefab.data.name);
		}
		const found: Node[] = [];
		const walk = (node: Node) => {
			// @ts-ignore prefab info is internal, but it is what ties an instance to its asset
			const info = node._prefab;
			const isInstance = info && info.root === node && info.asset && uuids.has(info.asset._uuid);
			if (isInstance || names.has(node.name)) {
				found.push(node);
				return;
			}
			node.children.forEach(walk);
		};
		walk(this.root || this.node.scene);
		return found;
	}

	private _build(): void {
		const walls: number[] = [];
		const doors: { door: Door; triangles: number[] }[] = [];
		for (const wall of this._wallInstances()) {
			const leaves = new Map<Node, number[]>();
			for (const door of wall.getComponentsInChildren(Door)) {
				if (door.leaf) {
					const group = { door, triangles: [] as number[] };
					doors.push(group);
					leaves.set(door.leaf, group.triangles);
				}
			}
			for (const renderer of wall.getComponentsInChildren(MeshRenderer)) {
				const leaf = this._leafOf(renderer.node, leaves);
				if (!leaf) {
					this._collect(renderer, walls);
					continue;
				}
				// Laid out shut, whatever the door is doing right now.
				const door = doors.find((group) => group.door.leaf === leaf).door;
				const now = leaf.rotation.clone();
				leaf.setRotation(door.closedRotation);
				this._collect(renderer, leaves.get(leaf));
				leaf.setRotation(now);
			}
		}
		const all = walls.concat(...doors.map((group) => group.triangles));
		if (!all.length) {
			return;
		}

		let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
		for (let i = 0; i < all.length; i += 2) {
			minX = Math.min(minX, all[i]);
			maxX = Math.max(maxX, all[i]);
			minZ = Math.min(minZ, all[i + 1]);
			maxZ = Math.max(maxZ, all[i + 1]);
		}
		const pad = this.radius + this.cellSize * 2;
		this._originX = minX - pad;
		this._originZ = minZ - pad;
		this._cols = Math.ceil((maxX - minX + pad * 2) / this.cellSize) + 1;
		this._rows = Math.ceil((maxZ - minZ + pad * 2) / this.cellSize) + 1;

		this._cells = this._rasterize(walls);
		this._doors = doors.map((group) => ({ door: group.door, cells: this._rasterize(group.triangles) }));
	}

	/** The door leaf a renderer belongs to — the leaf itself or a node under it — or null. */
	private _leafOf(node: Node, leaves: Map<Node, number[]>): Node {
		for (let at = node; at; at = at.parent) {
			if (leaves.has(at)) {
				return at;
			}
		}
		return null;
	}

	/** A renderer's triangles on the floor, as x,z pairs, leaving out the floor under the walls and what is overhead. */
	private _collect(renderer: MeshRenderer, out: number[]): void {
		const mesh = renderer.mesh;
		if (!mesh) {
			return;
		}
		const matrix = new Mat4();
		const a = v3();
		renderer.node.getWorldMatrix(matrix);
		for (const sub of mesh.renderingSubMeshes) {
			const info = sub.geometricInfo;
			if (!info || !info.positions) {
				continue;
			}
			const positions = info.positions;
			const indices = info.indices;
			const count = indices ? indices.length : positions.length / 3;
			for (let i = 0; i + 2 < count; i += 3) {
				const tri: number[] = [];
				let top = -Infinity;
				let bottom = Infinity;
				for (let k = 0; k < 3; k++) {
					const at = (indices ? indices[i + k] : i + k) * 3;
					Vec3.transformMat4(a, a.set(positions[at], positions[at + 1], positions[at + 2]), matrix);
					tri.push(a.x, a.z);
					top = Math.max(top, a.y);
					bottom = Math.min(bottom, a.y);
				}
				if (top > this.minHeight && bottom < this.maxHeight) {
					out.push(...tri);
				}
			}
		}
	}

	private _rasterize(triangles: number[]): Uint8Array {
		const cells = new Uint8Array(this._cols * this._rows);
		for (let i = 0; i < triangles.length; i += 6) {
			this._fill(cells, triangles[i], triangles[i + 1], triangles[i + 2], triangles[i + 3], triangles[i + 4], triangles[i + 5]);
		}
		return cells;
	}

	/** Marks every cell a triangle covers on the floor. A wall's side is a line there, so its edges are traced too. */
	private _fill(cells: Uint8Array, ax: number, az: number, bx: number, bz: number, cx: number, cz: number): void {
		const size = this.cellSize;
		const c0 = Math.floor((Math.min(ax, bx, cx) - this._originX) / size);
		const c1 = Math.floor((Math.max(ax, bx, cx) - this._originX) / size);
		const r0 = Math.floor((Math.min(az, bz, cz) - this._originZ) / size);
		const r1 = Math.floor((Math.max(az, bz, cz) - this._originZ) / size);
		const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
		if (Math.abs(area) > 1e-9) {
			for (let r = r0; r <= r1; r++) {
				for (let c = c0; c <= c1; c++) {
					const px = this._originX + (c + 0.5) * size;
					const pz = this._originZ + (r + 0.5) * size;
					const w0 = (bx - ax) * (pz - az) - (bz - az) * (px - ax);
					const w1 = (cx - bx) * (pz - bz) - (cz - bz) * (px - bx);
					const w2 = (ax - cx) * (pz - cz) - (az - cz) * (px - cx);
					if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
						this._mark(cells, c, r);
					}
				}
			}
		}
		this._trace(cells, ax, az, bx, bz);
		this._trace(cells, bx, bz, cx, cz);
		this._trace(cells, cx, cz, ax, az);
	}

	private _trace(cells: Uint8Array, x0: number, z0: number, x1: number, z1: number): void {
		const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (this.cellSize * 0.5)));
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			this._mark(
				cells,
				Math.floor((x0 + (x1 - x0) * t - this._originX) / this.cellSize),
				Math.floor((z0 + (z1 - z0) * t - this._originZ) / this.cellSize),
			);
		}
	}

	private _mark(cells: Uint8Array, c: number, r: number): void {
		if (c >= 0 && r >= 0 && c < this._cols && r < this._rows) {
			cells[r * this._cols + c] = 1;
		}
	}

	/**
	 * A blocked step whose way forward opens up a little to the side: finds the nearest side
	 * offset, within cornerAssist, from which the step would be free, and moves one step's
	 * length sideways towards it. False when there is no such way nearby.
	 */
	private _assist(from: Vec3, to: Vec3, out: Vec3): boolean {
		if (this.cornerAssist <= 0) {
			return false;
		}
		const dx = to.x - from.x;
		const dz = to.z - from.z;
		const step = Math.hypot(dx, dz);
		if (step < 1e-6) {
			return false;
		}
		const px = -dz / step;
		const pz = dx / step;
		for (let offset = this.cellSize; offset <= this.cornerAssist + 1e-6; offset += this.cellSize) {
			for (const side of [1, -1]) {
				if (this._blocked(to.x + px * side * offset, to.z + pz * side * offset)) {
					continue;
				}
				const move = Math.min(step, offset);
				out.set(from.x + px * side * move, to.y, from.z + pz * side * move);
				if (!this._blocked(out.x, out.z)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Is this step heading the same way as the last one? Remembers it for the next call. */
	private _sameInput(mx: number, mz: number): boolean {
		const length = Math.hypot(mx, mz);
		if (length < 1e-6) {
			return true;
		}
		const x = mx / length;
		const z = mz / length;
		const same = x * this._input.x + z * this._input.z > 0.99;
		this._input.set(x, 0, z);
		return same;
	}

	/** The direction away from the walls a point overlaps, on the floor; false when it overlaps none. */
	private _normalAt(point: Vec3, out: Vec3): boolean {
		const probe = this._probe.set(point);
		if (!this._pushOut(probe)) {
			return false;
		}
		out.set(probe.x - point.x, 0, probe.z - point.z);
		const length = Math.hypot(out.x, out.z);
		if (length < 1e-6) {
			return false;
		}
		out.multiplyScalar(1 / length);
		return true;
	}

	/**
	 * Moves the point out of the blocked cells it overlaps, along the average direction away
	 * from them, by the deepest overlap. Returns false when nothing overlaps.
	 */
	private _pushOut(point: Vec3): boolean {
		const size = this.cellSize;
		const reach = this.radius + size * 0.5;
		const c0 = Math.max(0, Math.floor((point.x - reach - this._originX) / size));
		const c1 = Math.min(this._cols - 1, Math.floor((point.x + reach - this._originX) / size));
		const r0 = Math.max(0, Math.floor((point.z - reach - this._originZ) / size));
		const r1 = Math.min(this._rows - 1, Math.floor((point.z + reach - this._originZ) / size));
		let nx = 0;
		let nz = 0;
		let depth = 0;
		for (let r = r0; r <= r1; r++) {
			for (let c = c0; c <= c1; c++) {
				const at = r * this._cols + c;
				if (!this._cells[at] && !this._closedDoorAt(at)) {
					continue;
				}
				const dx = point.x - (this._originX + (c + 0.5) * size);
				const dz = point.z - (this._originZ + (r + 0.5) * size);
				const distance = Math.hypot(dx, dz);
				const overlap = reach - distance;
				if (overlap <= 0 || distance < 1e-6) {
					continue;
				}
				nx += (dx / distance) * overlap;
				nz += (dz / distance) * overlap;
				depth = Math.max(depth, overlap);
			}
		}
		const length = Math.hypot(nx, nz);
		if (depth <= 0 || length < 1e-6) {
			return false;
		}
		point.x += (nx / length) * depth;
		point.z += (nz / length) * depth;
		return true;
	}

	private _closedDoorAt(at: number): boolean {
		for (const layer of this._doors) {
			if (layer.cells[at] && !layer.door.isOpen) {
				return true;
			}
		}
		return false;
	}

	/** Would a circle of the player's radius at this point touch a blocked cell? */
	private _blocked(x: number, z: number): boolean {
		const size = this.cellSize;
		const reach = this.radius + size * 0.5;
		const c0 = Math.floor((x - reach - this._originX) / size);
		const c1 = Math.floor((x + reach - this._originX) / size);
		const r0 = Math.floor((z - reach - this._originZ) / size);
		const r1 = Math.floor((z + reach - this._originZ) / size);
		for (let r = Math.max(0, r0); r <= Math.min(this._rows - 1, r1); r++) {
			for (let c = Math.max(0, c0); c <= Math.min(this._cols - 1, c1); c++) {
				const at = r * this._cols + c;
				if (!this._cells[at] && !this._closedDoorAt(at)) {
					continue;
				}
				const dx = this._originX + (c + 0.5) * size - x;
				const dz = this._originZ + (r + 0.5) * size - z;
				if (dx * dx + dz * dz <= reach * reach) {
					return true;
				}
			}
		}
		return false;
	}
}
