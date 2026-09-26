import { _decorator, Component, gfx, Mat4, MeshRenderer, v3, Vec3 } from "cc";

const { ccclass, property } = _decorator;

const _point = v3();

// A floor tile with a stream of slime running through it — a straight run, a bend, a
// crossing; turned by 90° and laid side by side they make a stream of any shape. What counts
// is the green slime itself, not the tile: its faces are found in the tile's own mesh by
// their palette slot, and the player whose body touches one of them wades (PlayerMovement
// slows down). So a new tile with slime of another shape works as it is.
@ccclass("SlimeStream")
export class SlimeStream extends Component {
	/** Every stream tile in the level. */
	static readonly all: SlimeStream[] = [];

	@property({ tooltip: "Palette slot of the slime in the tile's texture" })
	slot: number = 2;
	@property({ tooltip: "Slots across the palette texture" })
	paletteSize: number = 8;

	// The slime's triangles flat on the floor, in world space: x0, z0, x1, z1, x2, z2, …
	private _triangles: number[] = null;
	private _minX = 0;
	private _maxX = 0;
	private _minZ = 0;
	private _maxZ = 0;

	/** Is anything of radius `margin` at a point on the floor touching the slime of any tile? */
	static touching(x: number, z: number, margin: number): boolean {
		for (const stream of SlimeStream.all) {
			if (stream.touches(x, z, margin)) {
				return true;
			}
		}
		return false;
	}

	protected onEnable(): void {
		SlimeStream.all.indexOf(this) < 0 && SlimeStream.all.push(this);
	}

	protected onDisable(): void {
		const index = SlimeStream.all.indexOf(this);
		index >= 0 && SlimeStream.all.splice(index, 1);
	}

	/** Is anything of radius `margin` at a point on the floor touching this tile's slime? */
	touches(x: number, z: number, margin: number): boolean {
		const triangles = this._measure();
		if (x < this._minX - margin || x > this._maxX + margin || z < this._minZ - margin || z > this._maxZ + margin) {
			return false;
		}
		for (let i = 0; i < triangles.length; i += 6) {
			if (_nearTriangle(x, z, margin, triangles, i)) {
				return true;
			}
		}
		return false;
	}

	// The tiles stand still, so the slime is found once, the first time it is asked about.
	private _measure(): number[] {
		if (this._triangles) {
			return this._triangles;
		}
		this._triangles = [];
		this._minX = this._minZ = Infinity;
		this._maxX = this._maxZ = -Infinity;
		const renderer = this.getComponent(MeshRenderer) || this.getComponentInChildren(MeshRenderer);
		const mesh = renderer && renderer.mesh;
		if (!mesh) {
			return this._triangles;
		}
		const matrix: Mat4 = renderer.node.worldMatrix;
		for (let part = 0; part < mesh.struct.primitives.length; part++) {
			const positions = mesh.readAttribute(part, gfx.AttributeName.ATTR_POSITION);
			const uvs = mesh.readAttribute(part, gfx.AttributeName.ATTR_TEX_COORD);
			const indices = mesh.readIndices(part);
			if (!positions || !uvs || !indices) {
				continue;
			}
			for (let t = 0; t + 2 < indices.length; t += 3) {
				// A face lies wholly in one slot of the palette: its first corner tells which.
				if (Math.floor(uvs[indices[t] * 2] * this.paletteSize) !== this.slot) {
					continue;
				}
				for (let k = 0; k < 3; k++) {
					const index = indices[t + k] * 3;
					_point.set(positions[index], positions[index + 1], positions[index + 2]);
					Vec3.transformMat4(_point, _point, matrix);
					this._triangles.push(_point.x, _point.z);
					this._minX = Math.min(this._minX, _point.x);
					this._maxX = Math.max(this._maxX, _point.x);
					this._minZ = Math.min(this._minZ, _point.z);
					this._maxZ = Math.max(this._maxZ, _point.z);
				}
			}
		}
		return this._triangles;
	}
}

/** A point inside a flat triangle, or within `margin` of its edges. */
function _nearTriangle(x: number, z: number, margin: number, t: number[], i: number): boolean {
	const ax = t[i];
	const az = t[i + 1];
	const bx = t[i + 2];
	const bz = t[i + 3];
	const cx = t[i + 4];
	const cz = t[i + 5];
	const d1 = (bx - ax) * (z - az) - (bz - az) * (x - ax);
	const d2 = (cx - bx) * (z - bz) - (cz - bz) * (x - bx);
	const d3 = (ax - cx) * (z - cz) - (az - cz) * (x - cx);
	const negative = d1 < 0 || d2 < 0 || d3 < 0;
	const positive = d1 > 0 || d2 > 0 || d3 > 0;
	if (!(negative && positive)) {
		return true;
	}
	const reach = margin * margin;
	return _edge(x, z, ax, az, bx, bz) <= reach || _edge(x, z, bx, bz, cx, cz) <= reach || _edge(x, z, cx, cz, ax, az) <= reach;
}

/** Squared distance from a point to a segment. */
function _edge(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
	const dx = bx - ax;
	const dz = bz - az;
	const length = dx * dx + dz * dz;
	const share = length > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length)) : 0;
	const px = ax + dx * share - x;
	const pz = az + dz * share - z;
	return px * px + pz * pz;
}
