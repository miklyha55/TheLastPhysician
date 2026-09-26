import { _decorator, Camera, Component, geometry, Material, MeshRenderer, Node, screen, v3, Vec3 } from "cc";

const { ccclass, property } = _decorator;

const DITHER = "ditherAmount";
const GRAIN = "ditherGrain";
// A mesh whose top is below this is floor. It never fades: under a floor tile there is
// nothing, and a dissolved one would open a black hole — SeeThrough fades only things taller
// than a person for the same reason.
const FLOOR_TOP = 0.1;

interface Item {
	root: Node;
	renderers: MeshRenderer[];
	shared: Material[][];
	amount: number;
}

// Whatever stands between the camera and the player dissolves as a whole — a port of
// ThroughTheDeadCity's SeeThrough. Every frame one ray goes from the camera to the player at
// `aimHeight`; each thing it meets before the player is faded, the whole placed object with
// all its meshes. The player's current target, when there is one, gets a ray of its own the
// same way, so the zombie being shot at is never hidden behind a wall either. Fading is screen-door dissolving with a noise pattern (the standard-dither
// effect), not alpha: the material stays opaque, needs no sorting and never shows its inside.
// It dissolves fast and comes back slower, since a flicker at the edge shows more than a delay.
@ccclass("OcclusionFade")
export class OcclusionFade extends Component {
	@property(Camera) camera: Camera = null;
	@property({ type: Node, tooltip: "Where the things that may hide the player are; empty — the whole scene" })
	root: Node = null;
	@property({ tooltip: "Height above the player's feet the ray aims at" })
	aimHeight: number = 0.4;
	@property({ tooltip: "How much of a hiding thing is thrown away when faded, 0..1", slide: true, range: [0, 1, 0.05] })
	fadeAmount: number = 0.78;
	@property({ tooltip: "How fast a hiding thing dissolves, per second" })
	fadeOutSpeed: number = 6;
	@property({ tooltip: "How fast it comes back, per second" })
	fadeInSpeed: number = 2.5;
	@property({ tooltip: "Size of one grain of the haze, in layout pixels; scaled to the screen's density" })
	grain: number = 1;

	private _items: Item[] = [];
	private _itemOf = new Map<MeshRenderer, Item>();
	private _blocking = new Set<Item>();
	private _ray = new geometry.Ray();
	private _local = new geometry.AABB();
	private _bounds = new geometry.AABB();
	private _aim = v3();
	private _target: Node = null;

	/** Something else to keep in sight besides the player — the target being shot at; null for none. */
	setTarget(target: Node): void {
		this._target = target;
	}

	protected start(): void {
		// Placed things are watched whole: a hit on any of their meshes fades all of them.
		const own = new Set(this.node.getComponentsInChildren(MeshRenderer));
		const scope = this.root || this.node.scene;
		const byRoot = new Map<Node, Item>();
		for (const renderer of scope.getComponentsInChildren(MeshRenderer)) {
			if (own.has(renderer) || !this._canFade(renderer) || this._isFloor(renderer)) {
				continue;
			}
			const root = this._placedRoot(renderer.node, scope);
			let item = byRoot.get(root);
			if (!item) {
				item = { root, renderers: [], shared: [], amount: 0 };
				byRoot.set(root, item);
				this._items.push(item);
			}
			item.renderers.push(renderer);
			item.shared.push(renderer.sharedMaterials.slice());
			this._itemOf.set(renderer, item);
		}
	}

	protected update(dt: number): void {
		this._findBlockers();
		for (const item of this._items) {
			const wanted = this._blocking.has(item) ? this.fadeAmount : 0;
			if (item.amount === wanted) {
				continue;
			}
			const step = (wanted > item.amount ? this.fadeOutSpeed : this.fadeInSpeed) * dt;
			item.amount = Math.abs(wanted - item.amount) <= step ? wanted : item.amount + Math.sign(wanted - item.amount) * step;
			this._apply(item);
		}
	}

	/** What stands between the camera and the player, and between the camera and the target. */
	private _findBlockers(): void {
		this._blocking.clear();
		if (!this.camera) {
			return;
		}
		this._findBlockersOf(this.node);
		if (this._target && this._target.isValid && this._target.activeInHierarchy) {
			this._findBlockersOf(this._target);
		}
	}

	private _findBlockersOf(node: Node): void {
		const eye = this.camera.node.worldPosition;
		const at = node.worldPosition;
		this._aim.set(at.x, at.y + this.aimHeight, at.z);
		const reach = Vec3.distance(eye, this._aim);
		geometry.Ray.fromPoints(this._ray, eye, this._aim);
		for (const [renderer, item] of this._itemOf) {
			if (!renderer.enabledInHierarchy || !renderer.model || this._blocking.has(item)) {
				continue;
			}
			const near = geometry.intersect.rayAABB(this._ray, this._tightBounds(renderer, this._bounds));
			if (!near || near >= reach) {
				continue;
			}
			const hit = geometry.intersect.rayModel(this._ray, renderer.model);
			if (hit > 0 && hit < reach) {
				this._blocking.add(item);
			}
		}
	}


	private _apply(item: Item): void {
		item.renderers.forEach((renderer, index) => {
			if (item.amount <= 0) {
				// Solid again: back to the shared materials, so it batches with its neighbours.
				// forceUpdate, since the shared material is the same one and the renderer
				// would otherwise keep the faded instance.
				item.shared[index].forEach((material, slot) => renderer.setSharedMaterial(material, slot, true));
				return;
			}
			for (let slot = 0; slot < renderer.sharedMaterials.length; slot++) {
				const material = renderer.getMaterialInstance(slot);
				if (!material || !material.passes[0].getHandle(DITHER)) {
					continue;
				}
				// Only a fading instance carries the discard; the shared material stays without it.
				if (!material.passes[0].defines.USE_DITHER) {
					material.recompileShaders({ USE_DITHER: true });
				}
				material.setProperty(DITHER, item.amount);
				if (material.passes[0].getHandle(GRAIN)) {
					// Per layout pixel, so a dense phone screen does not get a grain half as big.
					material.setProperty(GRAIN, this.grain * (screen.devicePixelRatio || 1));
				}
			}
		});
	}

	/** The placed thing a mesh belongs to: its prefab instance root, or the node right under the scope. */
	private _placedRoot(node: Node, scope: Node): Node {
		let top = node;
		for (let at = node; at && at !== scope; at = at.parent) {
			// @ts-ignore prefab info is internal, but it is what marks a placed prefab
			const info = at._prefab;
			if (info && info.root === at) {
				return at;
			}
			top = at;
		}
		return top;
	}

	private _isFloor(renderer: MeshRenderer): boolean {
		const bounds = this._tightBounds(renderer, this._bounds);
		return !!bounds && bounds.center.y + bounds.halfExtents.y < FLOOR_TOP;
	}

	/**
	 * The renderer's box in the world, from its own mesh. Not `model.worldBounds`: those may be
	 * blown up on purpose (ShadowCullMargin grows them so planar shadows are not culled at the
	 * screen's edge), and a box twenty units wide would lie in front of everything.
	 */
	private _tightBounds(renderer: MeshRenderer, out: geometry.AABB): geometry.AABB {
		const struct = renderer.mesh && renderer.mesh.struct;
		if (!struct || !struct.minPosition || !struct.maxPosition) {
			return renderer.model ? renderer.model.worldBounds : null;
		}
		geometry.AABB.fromPoints(this._local, struct.minPosition, struct.maxPosition);
		const node = renderer.node;
		this._local.transform(node.worldMatrix, node.worldPosition, node.worldRotation, node.worldScale, out);
		return out;
	}


	private _canFade(renderer: MeshRenderer): boolean {
		return renderer.sharedMaterials.some((material) => material && material.passes[0].getHandle(DITHER));
	}
}
