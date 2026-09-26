import { _decorator, Component, Enum, MeshRenderer, v3, Vec3 } from "cc";

const { ccclass, property } = _decorator;

export const FurnitureSize = Enum({
	/** Decided by its footprint: `smallMaxSize` or less across is small. */
	Auto: 0,
	/** Picked up and thrown, kicked about — a loose thing with physics of its own. */
	Small: 1,
	/** Stands where it was put; the player jumps over it. */
	Large: 2,
});

// A piece of furniture. Small ones are loose things: the player throws them at zombies and
// anyone kicks them about (Debris moves them). Large ones stand still as obstacles, and the
// player jumps over them (PlayerActions). Its box — from its own mesh, in its own axes — is
// what both go by.
@ccclass("Furniture")
export class Furniture extends Component {
	/** Every large piece in the level: what a jump looks for. */
	static readonly large: Furniture[] = [];

	@property({ type: FurnitureSize, tooltip: "Small — thrown and kicked; large — jumped over" })
	size: number = FurnitureSize.Auto;
	@property({ tooltip: "With size Auto: this wide or less, across either side, counts as small" })
	smallMaxSize: number = 0.45;
	@property({ tooltip: "Blows up when a potion bursts near it or another blast reaches it (Explosives)" })
	explosive: boolean = false;

	/** Its box in its own axes, relative to its origin, scaled. */
	readonly boxMin = v3();
	readonly boxMax = v3();

	private _ready = false;

	get small(): boolean {
		this._measure();
		if (this.size !== FurnitureSize.Auto) {
			return this.size === FurnitureSize.Small;
		}
		return Math.max(this.boxMax.x - this.boxMin.x, this.boxMax.z - this.boxMin.z) <= this.smallMaxSize;
	}

	/** Height of its top above its base. */
	get height(): number {
		this._measure();
		return this.boxMax.y - this.boxMin.y;
	}

	protected onEnable(): void {
		if (!this.small && Furniture.large.indexOf(this) < 0) {
			Furniture.large.push(this);
		}
	}

	protected onDisable(): void {
		const index = Furniture.large.indexOf(this);
		index >= 0 && Furniture.large.splice(index, 1);
	}

	/** Is a point on the floor inside its footprint, grown by `margin`? */
	covers(x: number, z: number, margin: number = 0): boolean {
		this._measure();
		const at = this.node.worldPosition;
		const yaw = (this.node.eulerAngles.y * Math.PI) / 180;
		const dx = x - at.x;
		const dz = z - at.z;
		// Into its own axes: the inverse of its turn around Y.
		const cos = Math.cos(yaw);
		const sin = Math.sin(yaw);
		const lx = dx * cos - dz * sin;
		const lz = dx * sin + dz * cos;
		return lx >= this.boxMin.x - margin && lx <= this.boxMax.x + margin && lz >= this.boxMin.z - margin && lz <= this.boxMax.z + margin;
	}

	private _measure(): void {
		if (this._ready) {
			return;
		}
		this._ready = true;
		const renderer = this.getComponent(MeshRenderer) || this.getComponentInChildren(MeshRenderer);
		const struct = renderer && renderer.mesh && renderer.mesh.struct;
		if (!struct || !struct.minPosition || !struct.maxPosition) {
			this.boxMin.set(-0.2, 0, -0.2);
			this.boxMax.set(0.2, 0.4, 0.2);
			return;
		}
		const scale = this.node.scale;
		Vec3.multiply(this.boxMin, struct.minPosition, scale);
		Vec3.multiply(this.boxMax, struct.maxPosition, scale);
	}
}
