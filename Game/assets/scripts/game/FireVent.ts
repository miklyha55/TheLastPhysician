import { _decorator, Color, Component, Material, Mesh, MeshRenderer, Node, primitives, screen, utils, v3, Vec3 } from "cc";
import { CameraManager } from "../managers/camera/CameraManager";
import { Prewarm } from "../managers/Prewarm";
import { HazardVictims } from "./HazardVictims";
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
	euler: Vec3;
}

const _color = new Color();
const _at = v3();
const _screen = v3();

// A pipe in a floor tile that breathes fire. Quiet for `offTime`, then a column of flame for
// `onTime`, round and round for good. The flame swells up out of the pipe and dies down
// smoothly, never at once. While it burns strong the player anywhere near the pipe dies —
// the circle reaches past the tile's middle, so a row of pipes is a wall of fire with no gap
// to slip through. The flame is tongues of fire — spinning cubes that rise and shrink — white-hot
// low in the column, red at its top, with sparks flying higher out of it and a glow over the
// mouth, flickering.
//
// Cheap to draw however many vents burn: a tongue keeps its colour for its whole life (the hot
// ones short-lived and low, the red ones starting higher), so no tongue ever changes material;
// the materials are shared by every vent alike, so all the fire of a level goes in three
// instanced batches; and the tongues are made once and their nodes stay on — only a tongue's
// model is switched off while it waits to be lit again, which costs nothing, where switching
// nodes on and off by the dozen a second did.
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
	tongueSize: number = 0.3;
	@property({ tooltip: "Tongues burning at once, at full strength" })
	tongues: number = 22;
	@property({ tooltip: "Turns per second a tongue spins at, degrees" })
	spinSpeed: number = 420;

	@property({ tooltip: "Sparks in the air at once, at full strength" })
	sparks: number = 8;
	@property({ tooltip: "Size of a spark" })
	sparkSize: number = 0.05;
	@property({ tooltip: "How much higher than the flame the sparks fly" })
	sparkReach: number = 1.6;
	@property({ tooltip: "Width of the glow over the mouth, against the mouth's" })
	glowScale: number = 2.6;

	@property({ tooltip: "Share of the screen past its edges a vent still burns in: off the screen further, its flame is not drawn (the fire still kills)" })
	screenMargin: number = 0.2;
	@property({ tooltip: "Seconds between looks whether the vent is on the screen" })
	lookEvery: number = 0.2;

	@property coreColor: Color = new Color(255, 240, 170, 255);
	@property midColor: Color = new Color(255, 140, 30, 255);
	@property tailColor: Color = new Color(220, 40, 10, 255);
	@property glowColor: Color = new Color(255, 110, 20, 150);

	private static _box: Mesh = null;
	private static _disc: Mesh = null;
	/** The tongues' materials, one a colour, shared by every vent of those colours. */
	private static _shared = new Map<string, Material>();

	private _time = 0;
	private _strength = 0;
	private _debt = 0;
	private _sparkDebt = 0;
	private _pool: Tongue[] = [];
	private _live: Tongue[] = [];
	private _free: Tongue[] = [];
	private _freeSparks: Tongue[] = [];
	private _materials: Material[] = [];
	private _glow: Node = null;
	private _glowMaterial: Material = null;
	/** Is it on the screen — last looked: only then are its tongues moved and drawn. */
	private _onScreen = true;
	private _lookIn = 0;

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
		this._materials = [this.coreColor, this.midColor, this.tailColor].map((color) => FireVent._material(color));
		for (let i = 0; i < this.tongues + this.sparks; i++) {
			const ember = i >= this.tongues;
			const node = new Node(ember ? "Spark" : "Tongue");
			root.addChild(node);
			// Sparks are white-hot; a tongue's colour is dealt out here, once, by thirds.
			const band = ember ? 0 : i % 3;
			const renderer = this._renderer(node, FireVent._box, this._materials[band]);
			renderer.model && (renderer.model.enabled = false);
			const tongue: Tongue = { node, renderer, ember, band, age: 0, life: 0, size: 0, velocity: v3(), spin: v3(), euler: v3() };
			this._pool.push(tongue);
			(ember ? this._freeSparks : this._free).push(tongue);
		}
		// The glow: a flat disc of light just over the mouth; its own material, for its own strength.
		this._glow = new Node("Glow");
		root.addChild(this._glow);
		this._glowMaterial = this._additive(false);
		this._renderer(this._glow, FireVent._disc, this._glowMaterial);
		this._glow.setPosition(0, this.mouthHeight + 0.02, 0);
		this._glow.active = false;
		this._time = this.phase;
		// The looks spread out over the vents, not all in one frame.
		this._lookIn = Math.random() * this.lookEvery;
	}

	protected update(dt: number): void {
		this._time += dt;
		this._strength = this._cycle();
		// Off the screen the fire burns unseen: it still kills, but no tongue is moved or drawn —
		// a level's dozens of vents cost only those in sight. Back in sight, it swells up in a
		// moment, past the screen's edge where the margin hides it.
		if (!this._visible(dt)) {
			this._putOut();
			if (this._strength >= this.killStrength) {
				this._scorch();
			}
			return;
		}
		if (this._strength <= 0 && !this._live.length) {
			// Out, and every tongue burnt away: nothing to do until it lights again.
			this._debt = this._sparkDebt = 0;
			this._glow.active && (this._glow.active = false);
			return;
		}
		this._emit(dt);
		this._burn(dt);
		this._flicker();
		if (this._strength >= this.killStrength) {
			this._scorch();
		}
	}

	/** Is the vent on the screen, or near its edge — looked every `lookEvery`; always during the warm-up (Prewarm). */
	private _visible(dt: number): boolean {
		if (Prewarm.active) {
			return (this._onScreen = true);
		}
		if ((this._lookIn -= dt) > 0) {
			return this._onScreen;
		}
		this._lookIn = this.lookEvery;
		const manager = CameraManager.instance;
		const camera = manager && manager.cameras[0];
		if (!camera || !camera.camera) {
			return (this._onScreen = true);
		}
		const size = screen.windowSize;
		const mx = size.width * this.screenMargin, my = size.height * this.screenMargin;
		const at = this.node.worldPosition;
		// The mouth and the top of the flame: either in sight is enough.
		for (const lift of [0, this.flameHeight]) {
			_at.set(at.x, at.y + lift, at.z);
			camera.worldToScreen(_at, _screen);
			if (_screen.x >= -mx && _screen.x <= size.width + mx && _screen.y >= -my && _screen.y <= size.height + my) {
				return (this._onScreen = true);
			}
		}
		return (this._onScreen = false);
	}

	/** Every tongue out at once and the glow off: the vent has gone off the screen. */
	private _putOut(): void {
		if (this._live.length) {
			for (const tongue of this._live) {
				tongue.renderer.model && (tongue.renderer.model.enabled = false);
				(tongue.ember ? this._freeSparks : this._free).push(tongue);
			}
			this._live.length = 0;
		}
		this._debt = this._sparkDebt = 0;
		this._glow.active && (this._glow.active = false);
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
			if (!this._launch(this._free)) {
				this._debt = 0;
			}
		}
		while (this._sparkDebt >= 1) {
			this._sparkDebt -= 1;
			if (!this._launch(this._freeSparks)) {
				this._sparkDebt = 0;
			}
		}
	}

	private _launch(free: Tongue[]): boolean {
		// Of the free ones, any: a hot one lit out of turn only means a little more white in the flame.
		const tongue = free.length ? free.splice(Math.floor(Math.random() * free.length), 1)[0] : null;
		if (!tongue) {
			return false;
		}
		const ember = tongue.ember;
		const angle = Math.random() * Math.PI * 2;
		const reach = Math.sqrt(Math.random()) * this.mouthRadius * (ember ? 0.6 : 1);
		const x = Math.cos(angle) * reach;
		const z = Math.sin(angle) * reach;
		tongue.age = 0;
		if (ember) {
			// A spark: small, white-hot, shot up fast and drifting aside.
			tongue.node.setPosition(x, this.mouthHeight, z);
			tongue.life = this.tongueLife * (1.1 + Math.random() * 0.8);
			tongue.size = this.sparkSize * (0.7 + Math.random() * 0.6);
			const rise = ((this.flameHeight * this.sparkReach) / tongue.life) * (0.8 + Math.random() * 0.4);
			const drift = this.mouthRadius * 1.5;
			tongue.velocity.set((Math.random() - 0.5) * drift, rise, (Math.random() - 0.5) * drift);
		} else {
			// The colours by height, as one tongue used to go through them: white-hot and short low
			// in the column, orange from a little up, red from higher and living longest.
			const band = tongue.band;
			const from = [0, 0.15, 0.35][band] * this.flameHeight * (0.4 + 0.6 * this._strength);
			tongue.node.setPosition(x * (band === 0 ? 0.7 : 1), this.mouthHeight + from, z * (band === 0 ? 0.7 : 1));
			tongue.life = this.tongueLife * [0.45, 0.75, 0.8][band] * (0.75 + Math.random() * 0.5);
			tongue.size = this.tongueSize * [0.85, 1, 0.9][band] * (0.7 + Math.random() * 0.5) * (0.5 + 0.5 * this._strength);
			const rise = (this.flameHeight / this.tongueLife) * (0.8 + Math.random() * 0.4) * (0.4 + 0.6 * this._strength);
			// Drawn in towards the middle as it rises: the column narrows to a tip.
			tongue.velocity.set(-x / tongue.life, rise, -z / tongue.life);
		}
		tongue.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(this.spinSpeed * (ember ? 2 : 1));
		tongue.euler.set(Math.random() * 360, Math.random() * 360, Math.random() * 360);
		tongue.node.setRotationFromEuler(tongue.euler.x, tongue.euler.y, tongue.euler.z);
		tongue.node.setScale(0, 0, 0);
		tongue.renderer.model && (tongue.renderer.model.enabled = true);
		this._live.push(tongue);
		return true;
	}

	/** The tongues rise, spin, swell a moment, then shrink away; sparks just burn out. */
	private _burn(dt: number): void {
		const live = this._live;
		for (let i = live.length - 1; i >= 0; i--) {
			const tongue = live[i];
			tongue.age += dt;
			const share = tongue.age / tongue.life;
			const node = tongue.node;
			if (share >= 1) {
				tongue.renderer.model && (tongue.renderer.model.enabled = false);
				live[i] = live[live.length - 1];
				live.pop();
				(tongue.ember ? this._freeSparks : this._free).push(tongue);
				continue;
			}
			Vec3.scaleAndAdd(_at, node.position, tongue.velocity, dt);
			node.setPosition(_at);
			const euler = tongue.euler;
			Vec3.scaleAndAdd(euler, euler, tongue.spin, dt);
			node.setRotationFromEuler(euler.x, euler.y, euler.z);
			const size = tongue.ember ? tongue.size * (1 - share) : tongue.size * (share < 0.15 ? share / 0.15 : 1 - (share - 0.15) / 0.85);
			node.setScale(size, size, size);
		}
	}

	/** The glow over the mouth: as strong as the flame, flickering. */
	private _flicker(): void {
		const on = this._strength > 0;
		if (this._glow.active !== on) {
			this._glow.active = on;
		}
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

	/** An additive instanced material of a colour — the same one for every vent that asks for it. */
	private static _material(color: Color): Material {
		const key = `${color.r},${color.g},${color.b},${color.a}`;
		let material = FireVent._shared.get(key);
		if (!material || !material.isValid) {
			material = new Material();
			material.initialize({ effectName: "builtin-unlit", technique: ADD, defines: { USE_INSTANCING: true } });
			material.setProperty("mainColor", color);
			FireVent._shared.set(key, material);
		}
		return material;
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

	/** The player near the pipe burns — and so do the zombies there the camera sees. */
	private _scorch(): void {
		const at = this.node.worldPosition;
		const near = (them: Vec3) => Math.hypot(them.x - at.x, them.z - at.z) <= this.killRadius && them.y - at.y <= this.flameHeight;
		const player = PlayerAttack.instance;
		if (player && !player.isDead) {
			const them = player.node.worldPosition;
			// From below: the splash flies up out of the pipe.
			near(them) && player.kill(new Vec3(them.x, them.y - 1, them.z));
		}
		for (const zombie of HazardVictims.zombies()) {
			const them = zombie.node.worldPosition;
			near(them) && HazardVictims.kill(zombie, new Vec3(them.x, them.y - 1, them.z));
		}
	}
}
