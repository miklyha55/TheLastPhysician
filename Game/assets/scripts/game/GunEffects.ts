import { _decorator, Camera, Color, Component, Material, Mesh, MeshRenderer, Node, primitives, SphereLight, utils, v3, Vec3 } from "cc";

const { ccclass, property } = _decorator;

// builtin-unlit techniques: 2 — additive, 3 — alpha blend.
const ADD = 2;
const BLEND = 3;

interface Item {
	node: Node;
	material: Material;
	life: number;
	full: number;
	size: number;
	velocity: Vec3;
}

const _side = v3();
const _toss = v3();
const _color = new Color();

// What a shot looks like at the gun, the way ThroughTheDeadCity does it: a ball of light at
// the muzzle that swells and dies, a brief flare of the light around it, a handful of sparks
// thrown forward along the line of fire, and a puff of smoke that rises once the rest is out.
// All of it is plain meshes taken from ready sets and put back — shots come often, and making
// geometry on every one would stall at the worst moment. Sparks and smoke are flat and always
// face the camera: edge-on they would vanish. Sizes are ThroughTheDeadCity's scaled to this
// game's smaller player.
@ccclass("GunEffects")
export class GunEffects extends Component {
	@property(Camera) camera: Camera = null;
	@property({ type: SphereLight, tooltip: "Light that flares up on a shot — the player's own, so no extra light is paid for" })
	light: SphereLight = null;

	@property({ tooltip: "Shots that may be burning at once" })
	poolSize: number = 4;
	@property flashColor: Color = new Color(255, 240, 192, 255);
	@property({ tooltip: "Radius of the flash" })
	flashSize: number = 0.045;
	@property flashOpacity: number = 0.9;
	@property({ tooltip: "Seconds" })
	flashLife: number = 0.09;
	@property({ tooltip: "How many times it swells while fading" })
	flashGrowth: number = 1.5;

	@property({ tooltip: "How many times brighter the light gets at the shot" })
	lightBoost: number = 4;
	@property({ tooltip: "Seconds the flare lasts" })
	lightLife: number = 0.1;

	@property sparkPool: number = 24;
	@property sparkMin: number = 5;
	@property sparkMax: number = 9;
	@property sparkColor: Color = new Color(255, 210, 122, 255);
	@property sparkOpacity: number = 0.95;
	@property sparkMinSize: number = 0.02;
	@property sparkMaxSize: number = 0.035;
	@property({ tooltip: "Speed forward, units per second" })
	sparkMinSpeed: number = 2.5;
	@property sparkMaxSpeed: number = 5.5;
	@property({ tooltip: "Scatter to the sides, units per second" })
	sparkSpread: number = 1.1;
	@property({ tooltip: "And a slight rise" })
	sparkRise: number = 0.34;
	@property sparkGravity: number = 3.8;
	@property({ tooltip: "Seconds: short, or it is no longer a spark" })
	sparkLife: number = 0.16;
	@property({ tooltip: "Share of its size a spark shrinks to by the end" })
	sparkShrink: number = 0.35;

	@property smokePool: number = 4;
	@property smokeColor: Color = new Color(154, 147, 132, 255);
	@property smokeOpacity: number = 0.3;
	@property smokeSize: number = 0.07;
	@property({ tooltip: "How many times it spreads while fading" })
	smokeGrowth: number = 2.2;
	@property({ tooltip: "Units per second upwards" })
	smokeRise: number = 0.3;
	@property({ tooltip: "And a little to the sides" })
	smokeDrift: number = 0.15;
	@property smokeLife: number = 0.5;

	private _flashes: Item[] = [];
	private _sparks: Item[] = [];
	private _smokes: Item[] = [];
	private _lightLife = 0;
	private _lightBase = 0;

	protected start(): void {
		const root = new Node("GunEffects");
		(this.node.parent || this.node).addChild(root);
		const sphere = utils.MeshUtils.createMesh(primitives.sphere(1, { segments: 8 }));
		const quad = utils.MeshUtils.createMesh(primitives.quad());
		for (let i = 0; i < this.poolSize; i++) {
			this._flashes.push(this._make(root, sphere, ADD));
		}
		for (let i = 0; i < this.sparkPool; i++) {
			this._sparks.push(this._make(root, quad, ADD));
		}
		for (let i = 0; i < this.smokePool; i++) {
			this._smokes.push(this._make(root, quad, BLEND));
		}
		if (this.light) {
			this._lightBase = this.light.luminance;
		}
	}

	/** A shot from the muzzle towards a point. */
	fire(from: Vec3, to: Vec3): void {
		const flash = this._take(this._flashes);
		flash.node.setWorldPosition(from);
		flash.node.setScale(this.flashSize, this.flashSize, this.flashSize);
		flash.life = flash.full = this.flashLife;
		this._show(flash, this.flashColor, this.flashOpacity);

		if (this.light) {
			this.light.luminance = this._lightBase * this.lightBoost;
			this._lightLife = this.lightLife;
		}

		this._sparkle(from, to);
		this._smoke(from);
	}

	/** A handful of sparks forward along the line of fire, scattered. */
	private _sparkle(from: Vec3, to: Vec3): void {
		_side.set(to.x - from.x, 0, to.z - from.z);
		if (_side.lengthSqr() < 1e-8) {
			return;
		}
		_side.normalize();
		const count = this.sparkMin + Math.floor(Math.random() * (this.sparkMax - this.sparkMin + 1));
		const spread = () => (Math.random() - 0.5) * this.sparkSpread;
		for (let i = 0; i < count; i++) {
			const spark = this._take(this._sparks);
			spark.size = this.sparkMinSize + Math.random() * (this.sparkMaxSize - this.sparkMinSize);
			spark.node.setWorldPosition(from);
			spark.node.setScale(spark.size, spark.size, spark.size);
			const speed = this.sparkMinSpeed + Math.random() * (this.sparkMaxSpeed - this.sparkMinSpeed);
			Vec3.multiplyScalar(spark.velocity, _side, speed);
			spark.velocity.add(_toss.set(spread(), spread() * 0.6 + this.sparkRise, spread()));
			spark.life = spark.full = this.sparkLife * (0.6 + Math.random() * 0.8);
			this._show(spark, this.sparkColor, this.sparkOpacity);
		}
	}

	/** A puff of smoke at the muzzle. */
	private _smoke(from: Vec3): void {
		const smoke = this._take(this._smokes);
		smoke.node.setWorldPosition(from);
		smoke.node.setScale(this.smokeSize, this.smokeSize, this.smokeSize);
		smoke.velocity.set((Math.random() - 0.5) * this.smokeDrift, this.smokeRise, (Math.random() - 0.5) * this.smokeDrift);
		smoke.life = smoke.full = this.smokeLife;
		this._show(smoke, this.smokeColor, this.smokeOpacity);
	}

	/** Puts out what has burnt down. */
	protected update(dt: number): void {
		const facing = this.camera ? this.camera.node.worldRotation : null;

		for (const flash of this._flashes) {
			if (!this._age(flash, dt)) {
				continue;
			}
			const t = flash.life / flash.full;
			this._fade(flash, this.flashColor, this.flashOpacity * t);
			// the flash swells as it dies
			const size = this.flashSize * (1 + (1 - t) * this.flashGrowth);
			flash.node.setScale(size, size, size);
		}

		if (this._lightLife > 0 && this.light) {
			this._lightLife -= dt;
			const t = Math.max(0, this._lightLife / this.lightLife);
			this.light.luminance = this._lightBase * (1 + (this.lightBoost - 1) * t);
		}

		for (const spark of this._sparks) {
			if (!this._age(spark, dt)) {
				continue;
			}
			spark.velocity.y -= this.sparkGravity * dt;
			this._move(spark, dt);
			// A spark dims faster than it lives, so a handful looks like it crumbles away
			// rather than melting at once.
			const t = spark.life / spark.full;
			this._fade(spark, this.sparkColor, this.sparkOpacity * t * t);
			const size = spark.size * (this.sparkShrink + (1 - this.sparkShrink) * t);
			spark.node.setScale(size, size, size);
			facing && spark.node.setWorldRotation(facing);
		}

		for (const smoke of this._smokes) {
			if (!this._age(smoke, dt)) {
				continue;
			}
			this._move(smoke, dt);
			const t = smoke.life / smoke.full;
			this._fade(smoke, this.smokeColor, this.smokeOpacity * t);
			const size = this.smokeSize * (1 + (1 - t) * this.smokeGrowth);
			smoke.node.setScale(size, size, size);
			facing && smoke.node.setWorldRotation(facing);
		}
	}

	private _make(root: Node, mesh: Mesh, technique: number): Item {
		const node = new Node("Fx");
		root.addChild(node);
		const material = new Material();
		material.initialize({ effectName: "builtin-unlit", technique });
		const meshRenderer = node.addComponent(MeshRenderer);
		meshRenderer.mesh = mesh;
		meshRenderer.setSharedMaterial(material, 0);
		meshRenderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
		node.active = false;
		return { node, material, life: 0, full: 1, size: 1, velocity: v3() };
	}

	/** A free one from the set; when all are busy, the one nearest its end. */
	private _take(pool: Item[]): Item {
		let oldest = pool[0];
		for (const item of pool) {
			if (item.life <= 0) {
				return item;
			}
			if (item.life < oldest.life) {
				oldest = item;
			}
		}
		return oldest;
	}

	private _show(item: Item, color: Color, opacity: number): void {
		// Facing the camera from the first frame, not only from the next update.
		this.camera && item.node.setWorldRotation(this.camera.node.worldRotation);
		item.node.active = true;
		this._fade(item, color, opacity);
	}

	private _fade(item: Item, color: Color, opacity: number): void {
		_color.set(color.r, color.g, color.b, Math.round(Math.max(0, Math.min(1, opacity)) * 255));
		item.material.setProperty("mainColor", _color);
	}

	/** One frame older; false (and hidden) once it is out. */
	private _age(item: Item, dt: number): boolean {
		if (item.life <= 0) {
			return false;
		}
		item.life -= dt;
		if (item.life <= 0) {
			item.life = 0;
			item.node.active = false;
			return false;
		}
		return true;
	}

	private _move(item: Item, dt: number): void {
		const at = item.node.worldPosition;
		item.node.setWorldPosition(at.x + item.velocity.x * dt, at.y + item.velocity.y * dt, at.z + item.velocity.z * dt);
	}
}
