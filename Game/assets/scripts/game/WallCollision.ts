import { _decorator, Component, Mat4, MeshRenderer, Node, Prefab, v3, Vec3 } from "cc";

const { ccclass, property } = _decorator;

// Keeps the player out of the walls: every instance of a wall prefab found in the scene is
// flattened onto the floor as a grid of blocked cells, built from the walls' own geometry,
// so corners, crosses and doorways block exactly where they stand. After the player moves,
// a step into a wall is undone along the blocked axis only, which lets it slide along.
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

	private _cells: Uint8Array = null;
	private _cols: number = 0;
	private _rows: number = 0;
	private _originX: number = 0;
	private _originZ: number = 0;
	private _previous: Vec3 = null;
	private _next: Vec3 = v3();

	protected start(): void {
		this._build();
		this._previous = this.node.worldPosition.clone();
	}

	protected lateUpdate(): void {
		if (!this._cells) {
			return;
		}
		const current = this.node.worldPosition;
		const previous = this._previous;
		if (current.equals(previous)) {
			return;
		}
		if (this._blocked(current.x, current.z)) {
			// Keep whichever axis is still free, so the player slides along the wall.
			if (!this._blocked(current.x, previous.z)) {
				this._next.set(current.x, current.y, previous.z);
			} else if (!this._blocked(previous.x, current.z)) {
				this._next.set(previous.x, current.y, current.z);
			} else {
				this._next.set(previous.x, current.y, previous.z);
			}
			this.node.setWorldPosition(this._next);
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
		const triangles: number[] = [];
		const matrix = new Mat4();
		const a = v3();
		for (const wall of this._wallInstances()) {
			for (const renderer of wall.getComponentsInChildren(MeshRenderer)) {
				const mesh = renderer.mesh;
				if (!mesh) {
					continue;
				}
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
						for (let k = 0; k < 3; k++) {
							const at = (indices ? indices[i + k] : i + k) * 3;
							Vec3.transformMat4(a, a.set(positions[at], positions[at + 1], positions[at + 2]), matrix);
							tri.push(a.x, a.z);
							top = Math.max(top, a.y);
						}
						if (top > this.minHeight) {
							triangles.push(...tri);
						}
					}
				}
			}
		}
		if (!triangles.length) {
			return;
		}

		let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
		for (let i = 0; i < triangles.length; i += 2) {
			minX = Math.min(minX, triangles[i]);
			maxX = Math.max(maxX, triangles[i]);
			minZ = Math.min(minZ, triangles[i + 1]);
			maxZ = Math.max(maxZ, triangles[i + 1]);
		}
		const pad = this.radius + this.cellSize * 2;
		this._originX = minX - pad;
		this._originZ = minZ - pad;
		this._cols = Math.ceil((maxX - minX + pad * 2) / this.cellSize) + 1;
		this._rows = Math.ceil((maxZ - minZ + pad * 2) / this.cellSize) + 1;
		this._cells = new Uint8Array(this._cols * this._rows);

		for (let i = 0; i < triangles.length; i += 6) {
			this._fill(triangles[i], triangles[i + 1], triangles[i + 2], triangles[i + 3], triangles[i + 4], triangles[i + 5]);
		}
	}

	/** Marks every cell a triangle covers on the floor. A wall's side is a line there, so its edges are traced too. */
	private _fill(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): void {
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
						this._mark(c, r);
					}
				}
			}
		}
		this._trace(ax, az, bx, bz);
		this._trace(bx, bz, cx, cz);
		this._trace(cx, cz, ax, az);
	}

	private _trace(x0: number, z0: number, x1: number, z1: number): void {
		const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (this.cellSize * 0.5)));
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			this._mark(
				Math.floor((x0 + (x1 - x0) * t - this._originX) / this.cellSize),
				Math.floor((z0 + (z1 - z0) * t - this._originZ) / this.cellSize),
			);
		}
	}

	private _mark(c: number, r: number): void {
		if (c >= 0 && r >= 0 && c < this._cols && r < this._rows) {
			this._cells[r * this._cols + c] = 1;
		}
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
				if (!this._cells[r * this._cols + c]) {
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
