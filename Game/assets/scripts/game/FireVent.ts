import { _decorator, Color, Component, Material, Mesh, MeshRenderer, Node, primitives, utils, v3, Vec3 } from "cc";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// builtin-unlit technique 2 — additive.
const ADD = 2;

interface Tongue {
	node: Node;
	renderer: MeshRenderer;
	ember: boolean;
	band: number;
	age: number;
	life: number;
	size: number;
	velocity: Vec3;
	spin: Vec3;
}

const _color = new Color();
const _at = v3();

// A pipe in a floor tile that breathes fire. Quiet for `offTime`, then a column of flame for
// `onTime`, round and round for good. The flame swells up out of the pipe and dies down
// smoothly, never at once. While it burns strong the player anywhere near the pipe dies —
// the circle reaches past the tile's middle, so a row of pipes is a wall of fire with no gap
// to slip through. The flame is tongues of fire — spinning cubes that rise, shrink and go from
// white-hot to red as they burn out — with sparks flying higher out of it and a glow over the
// mouth, flickering; all of it ready in a set and reused.
@ccclass("FireVent")
export class FireVent extends Component {
	@property({ tooltip: "Seconds without fire" })
	offTime: number = 2;
	@property({ tooltip: "Seconds of fire, fading in and out included" })
	onTime: number = 3;
	@property({ tooltip: "Seconds the flame takes to swell up, and as long to die down" })
	fadeTime: number = 0.4;
	@property({ tooltip: "Seconds into the cycle it starts at, so neighbouring vents can take turns" })
	phase: number = 0;

	@property({ tooltip: "The player within this of the pipe's centre, on the floor, burns; past 0.5 a row of pipes has no gap" })
	killRadius: number = 0.7;
	@property({ tooltip: "How strong the flame has to be to kill, 0..1" })
	killStrength: number = 0.5;

	@property({ tooltip: "Height above the tile the tongues start at — the mouth of the pipe" })
	mouthHeight: number = 0.03;
	@property({ tooltip: "Radius of the mouth the tongues come out of" })
	mouthRadius: number = 0.28;
	@property({ tooltip: "How high the flame reaches" })
	flameHeight: number = 1.1;
	@property({ tooltip: "Seconds a tongue of fire lives" })
	tongueLife: number = 0.55;
	@property({ tooltip: "Size of a tongue at its largest" })
	tongueSize: number = 0.26;
	@property({ tooltip: "Tongues burning at once, at full strength" })
	tongues: number = 34;
	@property({ tooltip: "Turns per second a tongue spins at, degrees" })
	spinSpeed: number = 420;

	@property({ tooltip: "Sparks in the air at once, at full strength" })
	sparks: number = 12;
	@property({ tooltip: "Size of a spark" })
	sparkSize: number = 0.05;
	@property({ tooltip: "How much higher than the flame the sparks fly" })
	sparkReach: number = 1.6;
	@property({ tooltip: "Width of the glow over the mouth, against the mouth's" })
	glowScale: number = 2.6;

	@property coreColor: Color = new Color(255, 240, 170, 255);
	@property midColor: Color = new Color(255, 140, 30, 255);
	@property tailColor: Color = new Color(220, 40, 10, 255);
	@property glowColor: Color = new Color(255, 110, 20, 150);

	private static _box: Mesh = null;
	private static _disc: Mesh = null;

	private _time = 0;
	private _strength = 0;
	private _shownStrength = -1;
	private _debt = 0;
	private _sparkDebt = 0;
	private _pool: Tongue[] = [];
	private _materials: Material[] = [];
	private _glow: Node = null;
	private _glowMaterial: Material = null;

	/** How strong the flame is now: 0 — out, 1 — full. */
	get strength(): number {
		return this._strength;
	}

	protected start(): void {
		const root = new Node("Fire");
		this.node.addChild(root);
		if (!FireVent._box) {
			FireVent._box = utils.MeshUtils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
			FireVent._disc = utils.MeshUtils.createMesh(primitives.cylinder(0.5, 0.5, 1, { radialSegments: 12, capped: true }));
		}
		for (let band = 0; band < 3; band++) {
			this._materials.push(this._additive(true));
		}
		for (let i = 0; i < this.tongues + this.sparks; i++) {
			const node = new Node(i < this.tongues ? "Tongue" : "Spark");
			root.addChild(node);
			const renderer = this._renderer(node, FireVent._box, this._materials[0]);
			node.active = false;
			this._pool.push({ node, renderer, ember: i >= this.tongues, band: 0, age: 0, life: 0, size: 0, velocity: v3(), spin: v3() });
		}
		// The glow: a flat disc of light just over the mouth.
		this._glow = new Node("Glow");
		root.addChild(this._glow);
		this._glowMaterial = this._additive(false);
		this._renderer(this._glow, FireVent._disc, this._glowMaterial);
		this._glow.setPosition(0, this.mouthHeight + 0.02, 0);
		this._glow.active = false;
		this._time = this.phase;
	}

	protected update(dt: number): void {
		this._time += dt;
		this._strength = this._cycle();
		this._tint();
		this._emit(dt);
		this._burn(dt);
		this._flicker();
		if (this._strength >= this.killStrength) {
			this._scorch();
		}
	}

	/** Strength of the flame at this point of the cycle, with its smooth rise and fall. */
	private _cycle(): number {
		const cycle = this.offTime + this.onTime;
		const t = cycle > 0 ? this._time % cycle : 0;
		if (t < this.offTime) {
			return 0;
		}
		const on = t - this.offTime;
		const fade = Math.max(1e-4, Math.min(this.fadeTime, this.onTime / 2));
		const share = Math.min(1, on / fade, (this.onTime - on) / fade);
		return share * share * (3 - 2 * share); // smoothstep
	}

	/** The whole flame dims and brightens with its strength. */
	private _tint(): void {
		if (Math.abs(this._strength - this._shownStrength) < 0.01) {
			return;
		}
		this._shownStrength = this._strength;
		const colors = [this.coreColor, this.midColor, this.tailColor];
		for (let band = 0; band < 3; band++) {
			const color = colors[band];
			_color.set(color.r, color.g, color.b, Math.round(color.a * this._strength));
			this._materials[band].setProperty("mainColor", _color);
		}
	}

	/** New tongues out of the mouth, and sparks — as many a second as keep the set burning, fewer while it is weak. */
	private _emit(dt: number): void {
		if (this._strength <= 0) {
			this._debt = this._sparkDebt = 0;
			return;
		}
		this._debt += (this.tongues / Math.max(this.tongueLife, 0.05)) * this._strength * dt;
		this._sparkDebt += (this.sparks / Math.max(this.tongueLife * 1.5, 0.05)) * this._strength * this._strength * dt;
		while (this._debt >= 1) {
			this._debt -= 1;
			if (!this._launch(false)) {
				this._debt = 0;
			}
		}
		while (this._sparkDebt >= 1) {
			this._sparkDebt -= 1;
			if (!this._launch(true)) {
				this._sparkDebt = 0;
			}
		}
	}

	private _launch(ember: boolean): boolean {
		const tongue = this._pool.find((t) => t.ember === ember && !t.node.active);
		if (!tongue) {
			return false;
		}
		const angle = Math.random() * Math.PI * 2;
		const reach = Math.sqrt(Math.random()) * this.mouthRadius * (ember ? 0.6 : 1);
		const x = Math.cos(angle) * reach;
		const z = Math.sin(angle) * reach;
		tongue.node.setPosition(x, this.mouthHeight, z);
		tongue.age = 0;
		if (ember) {
			// A spark: small, white-hot, shot up fast and drifting aside.
			tongue.life = this.tongueLife * (1.1 + Math.random() * 0.8);
			tongue.size = this.sparkSize * (0.7 + Math.random() * 0.6);
			const rise = ((this.flameHeight * this.sparkReach) / tongue.life) * (0.8 + Math.random() * 0.4);
			const drift = this.mouthRadius * 1.5;
			tongue.velocity.set((Math.random() - 0.5) * drift, rise, (Math.random() - 0.5) * drift);
		} else {
			tongue.life = this.tongueLife * (0.75 + Math.random() * 0.5);
			tongue.size = this.tongueSize * (0.7 + Math.random() * 0.5) * (0.5 + 0.5 * this._strength);
			const rise = (this.flameHeight / tongue.life) * (0.8 + Math.random() * 0.4) * (0.4 + 0.6 * this._strength);
			// Drawn in towards the middle as it rises: the column narrows to a tip.
			tongue.velocity.set(-x / tongue.life, rise, -z / tongue.life);
		}
		tongue.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(this.spinSpeed * (ember ? 2 : 1));
		tongue.node.setRotationFromEuler(Math.random() * 360, Math.random() * 360, Math.random() * 360);
		this._band(tongue, 0);
		tongue.node.setScale(0, 0, 0);
		tongue.node.active = true;
		return true;
	}

	/** The tongues rise, spin, swell a moment, then shrink away, turning redder; sparks just burn out. */
	private _burn(dt: number): void {
		for (const tongue of this._pool) {
			if (!tongue.node.active) {
				continue;
			}
			tongue.age += dt;
			const share = tongue.age / tongue.life;
			if (share >= 1) {
				tongue.node.active = false;
				continue;
			}
			const node = tongue.node;
			Vec3.scaleAndAdd(_at, node.position, tongue.velocity, dt);
			node.setPosition(_at);
			const euler = node.eulerAngles;
			node.setRotationFromEuler(euler.x + tongue.spin.x * dt, euler.y + tongue.spin.y * dt, euler.z + tongue.spin.z * dt);
			if (tongue.ember) {
				const size = tongue.size * (1 - share);
				node.setScale(size, size, size);
				this._band(tongue, share < 0.6 ? 0 : 1);
				continue;
			}
			const size = tongue.size * (share < 0.15 ? share / 0.15 : 1 - (share - 0.15) / 0.85);
			node.setScale(size, size, size);
			this._band(tongue, share < 0.3 ? 0 : share < 0.65 ? 1 : 2);
		}
	}

	/** The glow over the mouth: as strong as the flame, flickering. */
	private _flicker(): void {
		if (!this._glow) {
			return;
		}
		const on = this._strength > 0;
		this._glow.active = on;
		if (!on) {
			return;
		}
		const flicker = 0.75 + 0.25 * Math.sin(this._time * 23) * Math.sin(this._time * 7.3 + 1.1);
		const width = this.mouthRadius * 2 * this.glowScale * (0.8 + 0.2 * flicker) * (0.6 + 0.4 * this._strength);
		this._glow.setScale(width, 0.01, width);
		const color = this.glowColor;
		_color.set(color.r, color.g, color.b, Math.round(color.a * this._strength * flicker));
		this._glowMaterial.setProperty("mainColor", _color);
	}

	private _band(tongue: Tongue, band: number): void {
		if (tongue.band !== band || tongue.renderer.sharedMaterial !== this._materials[band]) {
			tongue.band = band;
			tongue.renderer.setSharedMaterial(this._materials[band], 0);
		}
	}

	private _additive(instanced: boolean): Material {
		const material = new Material();
		material.initialize({ effectName: "builtin-unlit", technique: ADD, defines: instanced ? { USE_INSTANCING: true } : {} });
		return material;
	}

	private _renderer(node: Node, mesh: Mesh, material: Material): MeshRenderer {
		const renderer = node.addComponent(MeshRenderer);
		renderer.mesh = mesh;
		renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
		renderer.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
		renderer.setSharedMaterial(material, 0);
		return renderer;
	}

	/** The player near the pipe burns. */
	private _scorch(): void {
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			return;
		}
		const at = this.node.worldPosition;
		const them = player.node.worldPosition;
		if (Math.hypot(them.x - at.x, them.z - at.z) <= this.killRadius && them.y - at.y <= this.flameHeight) {
			// From below: the splash flies up out of the pipe.
			player.kill(new Vec3(them.x, them.y - 1, them.z));
		}
	}
}
