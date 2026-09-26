import { _decorator, Color, Component, Material, MeshRenderer, Node, primitives, Quat, utils, v3, Vec3 } from "cc";

const { ccclass, property } = _decorator;

interface Drop {
	node: Node;
	velocity: Vec3;
	spin: Vec3;
	size: number;
	life: number;
	full: number;
}

const _direction = v3();
const _rotation = new Quat();

// Splashes from a hit, the way ThroughTheDeadCity does them: little cubes burst out of the
// wound, fly on along the blow in an arc, and land; on the ground they stay until their time
// is up and shrink away rather than vanish. All drops share one mesh and one instanced
// material, so however many are flying they draw as one batch. The set is a ring: when it runs
// out, new drops take over the oldest. Sizes are ThroughTheDeadCity's scaled to this game's
// smaller characters.
@ccclass("Blood")
export class Blood extends Component {
	@property color: Color = new Color(111, 191, 58, 255);
	@property({ tooltip: "Slight glow so drops read in the shade, share of the colour" })
	glow: number = 0.12;
	@property({ tooltip: "Drops kept ready; new splashes take over the oldest when they run out" })
	poolSize: number = 200;
	@property({ tooltip: "Drops per hit" })
	minDrops: number = 16;
	@property maxDrops: number = 24;
	@property({ tooltip: "Drop size, units" })
	minSize: number = 0.012;
	@property maxSize: number = 0.026;
	@property({ tooltip: "Units per second along the blow" })
	speed: number = 1.35;
	@property({ tooltip: "Scatter to the sides" })
	scatter: number = 0.8;
	@property({ tooltip: "Toss upwards" })
	lift: number = 1.05;
	@property({ tooltip: "How far round the wound the drops start" })
	spread: number = 0.09;
	@property gravity: number = 4;
	@property({ tooltip: "Seconds a drop lives" })
	life: number = 1.15;
	@property({ tooltip: "Drops do not fall below this height" })
	floorY: number = 0.01;

	private _drops: Drop[] = [];
	private _next = 0;

	protected start(): void {
		const root = new Node(`Blood ${this.color.toHEX()}`);
		(this.node.parent || this.node).addChild(root);
		const mesh = utils.MeshUtils.createMesh(primitives.box());
		const material = new Material();
		material.initialize({ effectName: "builtin-standard", defines: { USE_INSTANCING: true } });
		material.setProperty("mainColor", this.color);
		material.setProperty("roughness", 0.45);
		material.setProperty("metallic", 0);
		const glow = new Color(this.color.r * this.glow, this.color.g * this.glow, this.color.b * this.glow, 255);
		material.setProperty("emissive", glow);
		for (let i = 0; i < this.poolSize; i++) {
			const node = new Node("Drop");
			root.addChild(node);
			const renderer = node.addComponent(MeshRenderer);
			renderer.mesh = mesh;
			renderer.setSharedMaterial(material, 0);
			renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
			node.setScale(0, 0, 0);
			node.active = false;
			this._drops.push({ node, velocity: v3(), spin: v3(), size: 0, life: 0, full: 1 });
		}
	}

	/**
	 * A splash out of the point that was hit, flying on the way the blow came from `from`.
	 * `scale` makes it bigger — a killing blow splashes more.
	 */
	splash(at: Vec3, from: Vec3, scale: number = 1): void {
		if (!this._drops.length) {
			return;
		}
		_direction.set(at.x - from.x, 0, at.z - from.z);
		if (_direction.lengthSqr() < 1e-6) {
			_direction.set(0, 0, 1);
		}
		_direction.normalize();
		const count = Math.round((this.minDrops + Math.floor(Math.random() * (this.maxDrops - this.minDrops + 1))) * scale);
		for (let i = 0; i < count; i++) {
			const drop = this._drops[this._next];
			this._next = (this._next + 1) % this._drops.length;
			// A little apart round the wound, or they would come out in one jet.
			drop.node.setWorldPosition(
				at.x + (Math.random() - 0.5) * this.spread,
				at.y + (Math.random() - 0.5) * this.spread,
				at.z + (Math.random() - 0.5) * this.spread,
			);
			// Most of it flies on along the blow, the rest to the sides and up.
			Vec3.multiplyScalar(drop.velocity, _direction, this.speed * (0.5 + Math.random()));
			drop.velocity.x += (Math.random() - 0.5) * this.scatter;
			drop.velocity.y += Math.random() * this.lift;
			drop.velocity.z += (Math.random() - 0.5) * this.scatter;
			drop.spin.set(Math.random() * 360, Math.random() * 360, Math.random() * 360);
			drop.size = (this.minSize + Math.random() * (this.maxSize - this.minSize)) * scale;
			drop.life = drop.full = this.life * (0.7 + Math.random() * 0.6);
			// Its own size and turn from the very first frame: a new drop would otherwise be drawn
			// once at the unit size of the mesh, a cube as big as a floor tile.
			drop.node.setScale(drop.size, drop.size, drop.size);
			Quat.fromEuler(_rotation, drop.spin.x, drop.spin.y, drop.spin.z);
			drop.node.setWorldRotation(_rotation);
			drop.node.active = true;
		}
	}

	protected update(dt: number): void {
		for (const drop of this._drops) {
			if (drop.life <= 0) {
				continue;
			}
			drop.life -= dt;
			if (drop.life <= 0) {
				drop.node.active = false;
				continue;
			}
			const at = drop.node.worldPosition;
			let y = at.y;
			drop.velocity.y -= this.gravity * dt;
			y += drop.velocity.y * dt;
			// Landed: it stays there for the rest of its life.
			if (y <= this.floorY) {
				y = this.floorY;
				drop.velocity.set(0, 0, 0);
			}
			drop.node.setWorldPosition(at.x + drop.velocity.x * dt, y, at.z + drop.velocity.z * dt);
			drop.spin.x += dt * 230;
			drop.spin.z += dt * 170;
			Quat.fromEuler(_rotation, drop.spin.x, drop.spin.y, drop.spin.z);
			drop.node.setWorldRotation(_rotation);
			// Shrinks towards the end, so it goes without popping out.
			const size = drop.size * Math.min(1, (drop.life / drop.full) * 2);
			drop.node.setScale(size, size, size);
		}
	}
}
