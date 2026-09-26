import { _decorator, Color, Component, Material, Mesh, MeshRenderer, Node, primitives, utils, v3, Vec3 } from "cc";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// builtin-unlit technique 2 — additive.
const ADD = 2;

interface Tongue {
	node: Node;
	renderer: MeshRenderer;
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
// smoothly, never at once. While it burns strong the player standing over the pipe dies.
// The flame is tongues of fire — spinning cubes that rise, shrink and go from white-hot to
// red as they burn out; they are ready in a set and reused.
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

	@property({ tooltip: "The player within this of the pipe's centre, on the floor, burns" })
	killRadius: number = 0.32;
	@property({ tooltip: "How strong the flame has to be to kill, 0..1" })
	killStrength: number = 0.5;

	@property({ tooltip: "Height above the tile the tongues start at — the mouth of the pipe" })
	mouthHeight: number = 0.03;
	@property({ tooltip: "Radius of the mouth the tongues come out of" })
	mouthRadius: number = 0.16;
	@property({ tooltip: "How high the flame reaches" })
	flameHeight: number = 0.75;
	@property({ tooltip: "Seconds a tongue of fire lives" })
	tongueLife: number = 0.45;
	@property({ tooltip: "Size of a tongue at its largest" })
	tongueSize: number = 0.16;
	@property({ tooltip: "Tongues burning at once, at full strength" })
	tongues: number = 18;
	@property({ tooltip: "Turns per second a tongue spins at, degrees" })
	spinSpeed: number = 360;

	@property coreColor: Color = new Color(255, 236, 150, 255);
	@property midColor: Color = new Color(255, 128, 32, 255);
	@property tailColor: Color = new Color(200, 36, 12, 255);

	private static _mesh: Mesh = null;

	private _time = 0;
	private _strength = 0;
	private _shownStrength = -1;
	private _debt = 0;
	private _pool: Tongue[] = [];
	private _materials: Material[] = [];

	/** How strong the flame is now: 0 — out, 1 — full. */
	get strength(): number {
		return this._strength;
	}

	protected start(): void {
		const root = new Node("Fire");
		this.node.addChild(root);
		if (!FireVent._mesh) {
			FireVent._mesh = utils.MeshUtils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
		}
		for (let band = 0; band < 3; band++) {
			const material = new Material();
			material.initialize({ effectName: "builtin-unlit", technique: ADD, defines: { USE_INSTANCING: true } });
			this._materials.push(material);
		}
		for (let i = 0; i < this.tongues; i++) {
			const node = new Node("Tongue");
			root.addChild(node);
			const renderer = node.addComponent(MeshRenderer);
			renderer.mesh = FireVent._mesh;
			renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
			renderer.receiveShadow = MeshRenderer.ShadowReceivingMode.OFF;
			renderer.setSharedMaterial(this._materials[0], 0);
			node.active = false;
			this._pool.push({ node, renderer, band: 0, age: 0, life: 0, size: 0, velocity: v3(), spin: v3() });
		}
		this._time = this.phase;
	}

	protected update(dt: number): void {
		this._time += dt;
		this._strength = this._cycle();
		this._tint();
		this._emit(dt);
		this._burn(dt);
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

	/** New tongues out of the mouth — as many a second as keep the set burning, fewer while it is weak. */
	private _emit(dt: number): void {
		if (this._strength <= 0) {
			this._debt = 0;
			return;
		}
		this._debt += (this._pool.length / Math.max(this.tongueLife, 0.05)) * this._strength * dt;
		while (this._debt >= 1) {
			this._debt -= 1;
			const tongue = this._pool.find((t) => !t.node.active);
			if (!tongue) {
				this._debt = 0;
				break;
			}
			const angle = Math.random() * Math.PI * 2;
			const reach = Math.sqrt(Math.random()) * this.mouthRadius;
			tongue.node.setPosition(Math.cos(angle) * reach, this.mouthHeight, Math.sin(angle) * reach);
			tongue.life = this.tongueLife * (0.75 + Math.random() * 0.5);
			tongue.age = 0;
			tongue.size = this.tongueSize * (0.7 + Math.random() * 0.5) * (0.5 + 0.5 * this._strength);
			const rise = (this.flameHeight / tongue.life) * (0.8 + Math.random() * 0.4) * (0.4 + 0.6 * this._strength);
			// Drawn in towards the middle as it rises: the column narrows to a tip.
			tongue.velocity.set((-Math.cos(angle) * reach) / tongue.life, rise, (-Math.sin(angle) * reach) / tongue.life);
			tongue.spin.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(this.spinSpeed);
			tongue.node.setRotationFromEuler(Math.random() * 360, Math.random() * 360, Math.random() * 360);
			this._band(tongue, 0);
			tongue.node.setScale(0, 0, 0);
			tongue.node.active = true;
		}
	}

	/** The tongues rise, spin, swell a moment, then shrink away, turning redder. */
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
			const size = tongue.size * (share < 0.15 ? share / 0.15 : 1 - (share - 0.15) / 0.85);
			node.setScale(size, size, size);
			this._band(tongue, share < 0.3 ? 0 : share < 0.65 ? 1 : 2);
		}
	}

	private _band(tongue: Tongue, band: number): void {
		if (tongue.band !== band || tongue.renderer.sharedMaterial !== this._materials[band]) {
			tongue.band = band;
			tongue.renderer.setSharedMaterial(this._materials[band], 0);
		}
	}

	/** The player over the pipe burns. */
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
