import { v3, Vec3 } from "cc";
import { WallCollision } from "./WallCollision";

// Neighbours on the grid: straight ones cost 1, diagonal ones √2.
const STEPS = [
	[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
	[1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
// A search that has looked at this many cells gives up rather than stall a frame.
const MAX_VISITS = 6000;

// The shortest way round the walls between two points on the floor: A* over a coarse grid
// laid on the walls' own blocked map, then straightened, so a zombie runs in straight lines
// from corner to corner instead of zigzagging from cell to cell. Cells are asked about lazily
// and the answer lives for one search only, so a door that opened is seen at once.
export class PathFinder {
	private _walls: WallCollision;
	private _cell: number;
	private _cols = 0;
	private _rows = 0;
	private _x = 0;
	private _z = 0;
	private _walkable: Int8Array = null;
	private _cost: Float32Array = null;
	private _from: Int32Array = null;
	private _closed: Uint8Array = null;
	private _heap: number[] = [];
	private _heapScores: number[] = [];
	private _point = v3();

	constructor(walls: WallCollision, cell: number) {
		this._walls = walls;
		this._cell = cell;
	}

	/**
	 * Fills `out` with the corners to run through from `from` to `to`, ending at `to`, and
	 * returns true; false when there is no way (then `out` is left empty).
	 */
	find(from: Vec3, to: Vec3, out: Vec3[]): boolean {
		out.length = 0;
		if (!this._prepare(from, to)) {
			out.push(to.clone());
			return true;
		}
		if (this._walls.isPathClear(from, to)) {
			out.push(to.clone());
			return true;
		}
		const start = this._nearestWalkable(from);
		const goal = this._nearestWalkable(to);
		if (start < 0 || goal < 0) {
			return false;
		}
		const cells = this._search(start, goal);
		if (!cells) {
			return false;
		}
		// Straighten: from each kept point, jump to the farthest cell still reachable in a line.
		let at = from.clone();
		let i = 0;
		while (i < cells.length) {
			let far = i;
			for (let k = cells.length - 1; k > i; k--) {
				if (this._walls.isPathClear(at, this._centre(cells[k], this._point))) {
					far = k;
					break;
				}
			}
			const corner = this._centre(cells[far], v3());
			if (this._walls.isPathClear(corner, to)) {
				out.push(corner);
				break;
			}
			out.push(corner);
			at = corner;
			i = far + 1;
		}
		out.push(to.clone());
		return true;
	}

	/**
	 * Lays the grid over the walls and both ends of the way, with a margin: past the walls'
	 * own map nothing blocks, and a way may well lead out there and back in through a door.
	 */
	private _prepare(from: Vec3, to: Vec3): boolean {
		const area = this._walls.area;
		if (!area) {
			return false;
		}
		const margin = this._cell * 4;
		const x0 = Math.min(area.x, from.x, to.x) - margin;
		const z0 = Math.min(area.z, from.z, to.z) - margin;
		const x1 = Math.max(area.x + area.width, from.x, to.x) + margin;
		const z1 = Math.max(area.z + area.depth, from.z, to.z) + margin;
		const cols = Math.ceil((x1 - x0) / this._cell);
		const rows = Math.ceil((z1 - z0) / this._cell);
		if (cols * rows > (this._walkable ? this._walkable.length : 0)) {
			const count = cols * rows;
			this._walkable = new Int8Array(count);
			this._cost = new Float32Array(count);
			this._from = new Int32Array(count);
			this._closed = new Uint8Array(count);
		}
		this._cols = cols;
		this._rows = rows;
		this._x = x0;
		this._z = z0;
		this._walkable.fill(-1);
		return true;
	}


	private _search(start: number, goal: number): number[] {
		const cols = this._cols;
		this._cost.fill(Infinity);
		this._closed.fill(0);
		this._from.fill(-1);
		this._heap.length = 0;
		this._heapScores.length = 0;
		this._cost[start] = 0;
		this._push(start, this._guess(start, goal));
		let visits = 0;
		while (this._heap.length && visits++ < MAX_VISITS) {
			const current = this._pop();
			if (current === goal) {
				const cells: number[] = [];
				for (let at = goal; at !== start; at = this._from[at]) {
					cells.push(at);
				}
				return cells.reverse();
			}
			if (this._closed[current]) {
				continue;
			}
			this._closed[current] = 1;
			const c = current % cols;
			const r = (current - c) / cols;
			for (const [dc, dr, step] of STEPS) {
				const nc = c + dc;
				const nr = r + dr;
				if (!this._isWalkable(nc, nr)) {
					continue;
				}
				// No cutting a corner diagonally past a wall.
				if (dc && dr && (!this._isWalkable(c + dc, r) || !this._isWalkable(c, r + dr))) {
					continue;
				}
				const next = nr * cols + nc;
				const cost = this._cost[current] + step;
				if (cost < this._cost[next]) {
					this._cost[next] = cost;
					this._from[next] = current;
					this._push(next, cost + this._guess(next, goal));
				}
			}
		}
		return null;
	}

	private _guess(a: number, b: number): number {
		const ac = a % this._cols;
		const bc = b % this._cols;
		const dx = Math.abs(ac - bc);
		const dz = Math.abs((a - ac) / this._cols - (b - bc) / this._cols);
		return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
	}

	private _isWalkable(c: number, r: number): boolean {
		if (c < 0 || r < 0 || c >= this._cols || r >= this._rows) {
			return false;
		}
		const at = r * this._cols + c;
		if (this._walkable[at] < 0) {
			this._centre(at, this._point);
			this._walkable[at] = this._walls.isBlocked(this._point.x, this._point.z) ? 0 : 1;
		}
		return this._walkable[at] === 1;
	}

	/** The walkable cell nearest to a point, looking a few rings out; -1 when there is none. */
	private _nearestWalkable(point: Vec3): number {
		const c0 = Math.floor((point.x - this._x) / this._cell);
		const r0 = Math.floor((point.z - this._z) / this._cell);
		for (let ring = 0; ring <= 3; ring++) {
			let best = -1;
			let bestDistance = Infinity;
			for (let r = r0 - ring; r <= r0 + ring; r++) {
				for (let c = c0 - ring; c <= c0 + ring; c++) {
					if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== ring || !this._isWalkable(c, r)) {
						continue;
					}
					const at = r * this._cols + c;
					this._centre(at, this._point);
					const distance = Vec3.squaredDistance(this._point, point);
					if (distance < bestDistance) {
						bestDistance = distance;
						best = at;
					}
				}
			}
			if (best >= 0) {
				return best;
			}
		}
		return -1;
	}

	private _centre(at: number, out: Vec3): Vec3 {
		const c = at % this._cols;
		const r = (at - c) / this._cols;
		return out.set(this._x + (c + 0.5) * this._cell, 0, this._z + (r + 0.5) * this._cell);
	}

	// A binary heap of cells ordered by score; a cell may be in it more than once, each copy
	// with the score it was pushed with, and the stale ones are skipped as closed.
	private _push(at: number, score: number): void {
		const heap = this._heap;
		const scores = this._heapScores;
		let i = heap.length;
		heap.push(at);
		scores.push(score);
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (scores[parent] <= score) {
				break;
			}
			heap[i] = heap[parent];
			scores[i] = scores[parent];
			i = parent;
		}
		heap[i] = at;
		scores[i] = score;
	}

	private _pop(): number {
		const heap = this._heap;
		const scores = this._heapScores;
		const top = heap[0];
		const last = heap.pop();
		const score = scores.pop();
		if (heap.length) {
			let i = 0;
			for (;;) {
				let child = i * 2 + 1;
				if (child >= heap.length) {
					break;
				}
				if (child + 1 < heap.length && scores[child + 1] < scores[child]) {
					child++;
				}
				if (scores[child] >= score) {
					break;
				}
				heap[i] = heap[child];
				scores[i] = scores[child];
				i = child;
			}
			heap[i] = last;
			scores[i] = score;
		}
		return top;
	}
}
