import { Color, Material, MeshRenderer, Node, Vec3 } from "cc";

// The answer to a blow, the way ThroughTheDeadCity gives it: whoever is hit blinks red — a flash,
// a pause, a flash — so that a hit that takes a life but not the last one reads at a glance.
//
// The materials are shared: every zombie is drawn with the same few. Colouring a material would
// turn the whole crowd red at once; so it is the one hit that changes, putting on a "hurt twin"
// of each of its materials for the flash and taking it off after. One twin a material, not one a
// zombie; and its shader is the same — only the glow, a parameter, differs — so nothing is built
// anew on the first hit.

/** Seconds the whole answer lasts. */
const DURATION = 0.32;
/** Seconds of one flash and one pause: it blinks, it does not turn red for good. */
const BLINK = 0.08;
/**
 * The twin's colour, and a red glow over it. Red all over, not only a glow: added to a zombie's
 * green, a red glow alone came out pale yellow, and no one read it as a hit.
 */
const COLOR = new Color(255, 48, 40, 255);
const GLOW = new Color(150, 12, 6, 255);

const twins = new Map<Material, Material>();

function hurtOf(material: Material): Material {
	let twin = twins.get(material);
	if (!twin || !twin.isValid) {
		twin = new Material();
		twin.copy(material);
		twin.setProperty("mainColor", COLOR);
		twin.setProperty("emissive", GLOW);
		twin.setProperty("emissiveScale", new Vec3(1, 1, 1));
		twins.set(material, twin);
	}
	return twin;
}

export class HitFlash {
	private _root: Node;
	private _left = 0;
	private _lit = false;
	/** The renderers with their own materials, found on the first flash. */
	private _meshes: { renderer: MeshRenderer; base: Material[] }[] = null;

	/** @param root — whose meshes blink */
	constructor(root: Node) {
		this._root = root;
	}

	/** A blow: it blinks at once; another one mid-answer starts it over. */
	trigger(): void {
		this._left = DURATION;
	}

	update(dt: number): void {
		if (this._left <= 0) {
			return;
		}
		this._left = Math.max(0, this._left - dt);
		const passed = DURATION - this._left;
		this._light(this._left > 0 && Math.floor(passed / BLINK) % 2 === 0);
	}

	/**
	 * The twins put on or taken off by hand, for the warm-up behind the loading screen: a skinned
	 * model makes its own copy of a material's passes when it is given one, and that on the first
	 * blow would be a hitch. No blink, only the materials.
	 */
	wear(on: boolean): void {
		this._light(on);
	}

	/** Off at once: it dies, or goes. */
	stop(): void {
		this._left = 0;
		this._light(false);
	}

	private _light(on: boolean): void {
		if (on === this._lit || !this._root || !this._root.isValid) {
			return;
		}
		this._lit = on;
		if (!this._meshes) {
			this._meshes = this._root.getComponentsInChildren(MeshRenderer).map((renderer) => ({ renderer, base: renderer.sharedMaterials.slice() }));
		}
		for (const { renderer, base } of this._meshes) {
			if (!renderer.isValid) {
				continue;
			}
			base.forEach((material, i) => material && renderer.setSharedMaterial(on ? hurtOf(material) : material, i));
		}
	}
}
