import { _decorator, Color, Component, Material, MeshRenderer, Node, primitives, utils, Vec3 } from "cc";

const { ccclass, property } = _decorator;

// builtin-unlit techniques: 2 — additive, 3 — alpha blend.
const ADD = 2;
const BLEND = 3;

interface Blast {
	core: Node;
	smoke: Node;
	coreMaterial: Material;
	smokeMaterial: Material;
	life: number;
}

const _color = new Color();

// A burst of fire, the way ThroughTheDeadCity's Explosions does it: a glowing core that swells
// and dies away, and a shell of smoke that swells with it and fades more slowly, so a smoky
// ball is what is left at the end. Faceted spheres, to match the game. The shells are ready
// in a set and reused — a blast comes in the thick of a fight, no time to make meshes then.
// The same component, with other colours and sizes, is a potion bursting.
@ccclass("Explosions")
export class Explosions extends Component {
	@property flashColor: Color = new Color(255, 178, 74, 255);
	@property smokeColor: Color = new Color(42, 38, 34, 255);
	@property({ tooltip: "Radius it starts at" })
	startRadius: number = 0.21;
	@property({ tooltip: "Radius it swells to" })
	endRadius: number = 2.1;
	@property({ tooltip: "Seconds it lives" })
	life: number = 0.45;
	@property({ tooltip: "Opacity of the smoke at its thickest, halfway through" })
	smokeOpacity: number = 0.55;
	@property({ tooltip: "How many can burn at once" })
	pool: number = 6;
	@property({ tooltip: "Facets of the spheres" })
	segments: number = 10;

	private _blasts: Blast[] = [];
	private _next = 0;

	protected start(): void {
		const root = new Node(`Explosions ${this.node.name}`);
		(this.node.parent || this.node).addChild(root);
		const sphere = utils.MeshUtils.createMesh(primitives.sphere(1, { segments: this.segments }));
		for (let i = 0; i < this.pool; i++) {
			const core = this._shell(root, sphere, ADD);
			const smoke = this._shell(root, sphere, BLEND);
			this._blasts.push({ core: core.node, smoke: smoke.node, coreMaterial: core.material, smokeMaterial: smoke.material, life: 0 });
		}
	}

	/** Sets off a burst at a point. */
	burst(at: Vec3): void {
		if (!this._blasts.length) {
			return;
		}
		const blast = this._blasts[this._next];
		this._next = (this._next + 1) % this._blasts.length;
		blast.core.setWorldPosition(at);
		blast.smoke.setWorldPosition(at);
		blast.life = this.life;
		blast.core.active = true;
		blast.smoke.active = true;
		this._draw(blast);
	}

	protected update(dt: number): void {
		for (const blast of this._blasts) {
			if (blast.life <= 0) {
				continue;
			}
			blast.life -= dt;
			if (blast.life <= 0) {
				blast.core.active = false;
				blast.smoke.active = false;
				continue;
			}
			this._draw(blast);
		}
	}

	private _draw(blast: Blast): void {
		const share = Math.max(0, blast.life / this.life); // 1 at the start, 0 at the end
		const grown = this.startRadius + (this.endRadius - this.startRadius) * (1 - share);
		// The core swells and dies faster than the shell: a ball of smoke is what stays.
		const core = grown * 0.75;
		blast.core.setScale(core, core, core);
		this._fade(blast.coreMaterial, this.flashColor, share * share);
		blast.smoke.setScale(grown, grown, grown);
		// The smoke thickens as the fire dies: none at the flash, thickest halfway, gone at the end —
		// so the first frames are fire, not a grey ball over it.
		this._fade(blast.smokeMaterial, this.smokeColor, 4 * share * (1 - share) * this.smokeOpacity);
	}

	private _shell(root: Node, mesh: any, technique: number): { node: Node; material: Material } {
		const node = new Node("Blast");
		root.addChild(node);
		const material = new Material();
		material.initialize({ effectName: "builtin-unlit", technique });
		const renderer = node.addComponent(MeshRenderer);
		renderer.mesh = mesh;
		renderer.setSharedMaterial(material, 0);
		renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
		node.active = false;
		return { node, material };
	}

	private _fade(material: Material, color: Color, opacity: number): void {
		_color.set(color.r, color.g, color.b, Math.round(Math.max(0, Math.min(1, opacity)) * 255));
		material.setProperty("mainColor", _color);
	}
}
