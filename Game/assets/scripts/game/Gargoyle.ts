import { _decorator, Color, Component, Material, Mesh, MeshRenderer, Node, primitives, utils, v3, Vec3 } from "cc";
import { Explosives } from "./Explosives";
import { HazardVictims } from "./HazardVictims";
import { PlayerAttack } from "./PlayerAttack";
import { Zombie } from "./Zombie";

const { ccclass, property } = _decorator;

// builtin-unlit technique 2 — additive.
const ADD = 2;

interface Ball {
	node: Node;
	core: Node;
	halo: Node;
	flying: boolean;
	start: Vec3;
	direction: Vec3;
	travelled: number;
}

interface Tongue {
	node: Node;
	renderer: MeshRenderer;
	band: number;
	age: number;
	life: number;
	size: number;
	velocity: Vec3;
	spin: Vec3;
	euler: Vec3;
}

const _at = v3();
const _step = v3();
const _color = new Color();
const FORWARD = v3(0, 0, 1);

// A stone head in a wall that spits fire. Round and round for good: its eyes and mouth glow up
// for `charge` seconds, then a fireball flies out of the mouth straight across the room, every
// `interval` seconds. The ball flies on until it meets a wall, a shut door or anything as tall
// as its flight — and bursts there in a puff of flame; a table below it it passes over. The
// player it touches dies in a blast, the way a barrel blows up, and the ball is gone. Balls and
// their tongues of flame come from a set made once and reused.
//
// Cheap to draw: a tongue keeps its colour for its whole life, the materials are shared by every
// head, so all their fire goes in a few instanced batches, and the tongues' nodes stay on — only
// a tongue's model is switched off while it waits to be lit again.
@ccclass("Gargoyle")
export class Gargoyle extends Component {
	@property({ type: Node, tooltip: "Where the balls come out, facing the way they fly (its +Z)" })
	mouth: Node = null;
	@property({ tooltip: "Seconds between shots" })
	interval: number = 2.6;
	@property({ tooltip: "Seconds into the cycle it starts at, so neighbouring heads can take turns" })
	phase: number = 0;
	@property({ tooltip: "Seconds the mouth glows up before a shot, as a warning" })
	charge: number = 0.6;
	@property({ tooltip: "Speed of a ball, units a second" })
	speed: number = 3.2;
	@property({ tooltip: "Radius of a ball: of its fire, and of what it hits" })
	radius: number = 0.12;
	@property({ tooltip: "Balls ready in the set — as many as can be in the air at once" })
	balls: number = 4;
	@property({ tooltip: "A ball gone this far with nothing hit goes out" })
	maxRange: number = 20;
	@property({ tooltip: "The first stretch out of the mouth, where the head's own wall is no obstacle" })
	clearance: number = 0.3;

	@property({ tooltip: "The player's radius on the floor" })
	playerRadius: number = 0.2;
	@property({ tooltip: "How tall the player is: a ball flying lower than this over them hits" })
	playerHeight: number = 0.85;

	@property({ tooltip: "Tongues of fire trailing a ball, a second" })
	trailRate: number = 45;
	@property({ tooltip: "Tongues of fire in the set, for all the balls and their bursts" })
	tongues: number = 90;
	@property({ tooltip: "Seconds a tongue of fire lives" })
	tongueLife: number = 0.35;
	@property({ tooltip: "Size of a tongue at its largest" })
	tongueSize: number = 0.14;
	@property({ tooltip: "Tongues a ball bursts into on a wall" })
	puff: number = 16;
	@property({ tooltip: "Turns per second a tongue spins at, degrees" })
	spinSpeed: number = 420;

	@property coreColor: Color = new Color(255, 236, 170, 255);
	@property midColor: Color = new Color(255, 130, 26, 220);
	@property tailColor: Color = new Color(210, 36, 10, 255);
	@property glowColor: Color = new Color(255, 110, 20, 170);

	private static _box: Mesh = null;
	private static _sphere: Mesh = null;
	/** Materials a colour, shared by every head of those colours. */
	private static _shared = new Map<string, Material>();

	private _time = 0;
	private _fired = false;
	private _root: Node = null;
	private _balls: Ball[] = [];
	private _live: Tongue[] = [];
	private _free: Tongue[] = [];
	private _materials: Material[] = [];
	private _coreMaterial: Material = null;
	private _haloMaterial: Material = null;
	private _glow: Node = null;
	private _glowMaterial: Material = null;
	private _debt = 0;
	private _prewarmPending = false;

	protected start(): void {
		if (!Gargoyle._box) {
			Gargoyle._box = utils.MeshUtils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
			Gargoyle._sphere = utils.MeshUtils.createMesh(primitives.sphere(0.5, { segments: 12 }));
		}
		// The fire lives in the world, not in the head: the trail stays where the ball has been.
		this._root = new Node("GargoyleFire");
		this.node.scene.addChild(this._root);
		this._materials = [this.coreColor, this.midColor, this.tailColor].map((color) => Gargoyle._material(color));
		this._coreMaterial = this._materials[0];
		this._haloMaterial = this._materials[1];
		for (let i = 0; i < this.balls; i++) {
			const node = new Node("Fireball");
			this._root.addChild(node);
			const halo = new Node("Halo");
			node.addChild(halo);
			this._renderer(halo, Gargoyle._sphere, this._haloMaterial);
			const core = new Node("Core");
			node.addChild(core);
			this._renderer(core, Gargoyle._sphere, this._coreMaterial);
			node.active = false;
			this._balls.push({ node, core, halo, flying: false, start: v3(), direction: v3(), travelled: 0 });
		}
		for (let i = 0; i < this.tongues; i++) {
			const node = new Node("Tongue");
			this._root.addChild(node);
			// Its colour dealt out here, once: white-hot, orange, red by turns.
			const band = i % 3;
			const renderer = this._renderer(node, Gargoyle._box, this._materials[band]);
			renderer.model && (renderer.model.enabled = false);
			this._free.push({ node, renderer, band, age: 0, life: 0, size: 0, velocity: v3(), spin: v3(), euler: v3() });
		}
		// The glow in the mouth as it gets ready to spit. With the fire, not in the head: the
		// walls are laid out from the head's meshes, and the glow is no wall.
		if (this.mouth) {
			this._glow = new Node("Glow");
			this._root.addChild(this._glow);
			this._glowMaterial = this._additive(false);
			this._renderer(this._glow, Gargoyle._sphere, this._glowMaterial);
			this._glow.active = false;
		}
		this._time = this.phase;
		this._fired = this._cycle() >= this.interval - this.charge;
		if (this._prewarmPending) {
			this._prewarmPending = false;
			this.prewarm();
		}
	}

	protected onDestroy(): void {
		this._root && this._root.isValid && this._root.destroy();
	}

	protected update(dt: number): void {
		this._time += dt;
		const t = this._cycle();
		const charging = t >= this.interval - this.charge;
		if (charging) {
			this._fired = false;
		} else if (!this._fired) {
			// The glow has built up and the cycle has turned over: out it comes.
			this._fired = true;
			this._shoot();
		}
		this._showGlow(charging ? (t - (this.interval - this.charge)) / Math.max(this.charge, 0.01) : 0);
		for (const ball of this._balls) {
			ball.flying && this._fly(ball, dt);
		}
		this._burn(dt);
	}

	/**
	 * The warm-up behind the loading screen: a puff of fire and a ball shown a moment at the
	 * mouth, so their shaders are built before the first shot, not at it.
	 */
	prewarm(): void {
		if (!this._balls.length) {
			// Asked before its set is made: done as soon as it is.
			this._prewarmPending = true;
			return;
		}
		if (!this.mouth) {
			return;
		}
		const at = this.mouth.worldPosition;
		_step.set(0, 0, 0);
		for (let i = 0; i < this.puff; i++) {
			this._launch(at, _step, true);
		}
		const ball = this._balls.find((b) => !b.flying);
		if (ball) {
			ball.node.setWorldPosition(at);
			ball.node.active = true;
			this.scheduleOnce(() => !ball.flying && (ball.node.active = false), 0.3);
		}
	}

	private _cycle(): number {
		const interval = Math.max(this.interval, 0.1);
		return ((this._time % interval) + interval) % interval;
	}

	/** A ball out of the mouth, from the set; none free — this shot is skipped. */
	private _shoot(): void {
		const ball = this._balls.find((b) => !b.flying);
		if (!ball || !this.mouth) {
			return;
		}
		Vec3.transformQuat(ball.direction, FORWARD, this.mouth.worldRotation);
		ball.direction.y = 0;
		ball.direction.normalize();
		ball.start.set(this.mouth.worldPosition);
		ball.travelled = 0;
		ball.flying = true;
		ball.node.setWorldPosition(ball.start);
		ball.node.active = true;
		this._debt = 0;
	}

	private _fly(ball: Ball, dt: number): void {
		const step = this.speed * dt;
		// In small steps, so a fast ball does not jump over a thin wall or the player.
		const parts = Math.max(1, Math.ceil(step / (this.radius * 0.5)));
		for (let i = 0; i < parts; i++) {
			ball.travelled += step / parts;
			Vec3.scaleAndAdd(_at, ball.start, ball.direction, ball.travelled);
			ball.node.setWorldPosition(_at);
			if (this._hitsPlayer(_at)) {
				this._blast(ball);
				return;
			}
			const zombie = this._hitsZombie(_at);
			if (zombie) {
				this._burst(ball, zombie);
				return;
			}
			if (ball.travelled >= this.maxRange || (ball.travelled > this.clearance && this._hitsWall(_at))) {
				this._fizzle(ball);
				return;
			}
		}
		// Alive: a flicker in its size, a spin, and a trail of fire behind it.
		const time = this._time;
		const flicker = 1 + 0.12 * Math.sin(time * 31 + ball.travelled) * Math.sin(time * 13);
		const size = this.radius * 2 * flicker;
		ball.core.setScale(size * 0.7, size * 0.7, size * 0.7);
		ball.halo.setScale(size * 1.15, size * 1.15, size * 1.15);
		this._debt += this.trailRate * dt;
		while (this._debt >= 1) {
			this._debt -= 1;
			this._launch(_at, ball.direction, false);
		}
	}

	private _hitsPlayer(at: Vec3): boolean {
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			return false;
		}
		const them = player.node.worldPosition;
		return (
			Math.hypot(them.x - at.x, them.z - at.z) <= this.radius + this.playerRadius &&
			at.y - this.radius <= them.y + this.playerHeight &&
			at.y + this.radius >= them.y
		);
	}

	/** A zombie the camera sees, in the ball's way; off screen they are flown through. */
	private _hitsZombie(at: Vec3): Zombie {
		for (const zombie of HazardVictims.zombies()) {
			const them = zombie.node.worldPosition;
			if (
				Math.hypot(them.x - at.x, them.z - at.z) <= this.radius + zombie.radius &&
				at.y - this.radius <= them.y + zombie.height &&
				at.y + this.radius >= them.y
			) {
				return zombie;
			}
		}
		return null;
	}

	/** On a zombie: the same blast, and it dies. */
	private _burst(ball: Ball, zombie: Zombie): void {
		const at = ball.node.worldPosition.clone();
		this._land(ball);
		const explosives = Explosives.instance;
		explosives && explosives.fireBlast(at);
		HazardVictims.kill(zombie, Vec3.subtract(v3(), at, ball.direction));
	}

	/** A wall, a shut door, anything standing as high as the ball flies. */
	private _hitsWall(at: Vec3): boolean {
		const player = PlayerAttack.instance;
		const walls = player && player.walls;
		if (!walls) {
			return false;
		}
		return walls.topNear(at.x, at.z, this.radius) >= at.y - this.radius;
	}

	/** On the player: the ball is gone in a blast like a barrel's, and they die. */
	private _blast(ball: Ball): void {
		const at = ball.node.worldPosition.clone();
		this._land(ball);
		const explosives = Explosives.instance;
		explosives && explosives.fireBlast(at);
		const player = PlayerAttack.instance;
		player && player.kill(Vec3.subtract(v3(), at, ball.direction));
	}

	/** On a wall: a puff of flame and it is out. */
	private _fizzle(ball: Ball): void {
		const at = ball.node.worldPosition.clone();
		this._land(ball);
		_step.set(-ball.direction.x, 0, -ball.direction.z);
		for (let i = 0; i < this.puff; i++) {
			this._launch(at, _step, true);
		}
	}

	private _land(ball: Ball): void {
		ball.flying = false;
		ball.node.active = false;
	}

	/** A tongue of fire at `at`: trailing a ball, or thrown out of a burst back the way `away` points. */
	private _launch(at: Vec3, away: Vec3, burst: boolean): void {
		const free = this._free;
		if (!free.length) {
			return;
		}
		// Of the free ones, any: the colours come mixed.
		const tongue = free.splice(Math.floor(Math.random() * free.length), 1)[0];
		const r = this.radius;
		tongue.node.setWorldPosition(at.x + (Math.random() - 0.5) * r, at.y + (Math.random() - 0.5) * r, at.z + (Math.random() - 0.5) * r);
		tongue.age = 0;
		if (burst) {
			tongue.life = this.tongueLife * (0.8 + Math.random() * 0.6);
			tongue.size = this.tongueSize * (0.8 + Math.random() * 0.6);
			const out = 1.2 + Math.random() * 1.2;
			tongue.velocity.set(
				away.x * out + (Math.random() - 0.5) * 1.6,
				0.4 + Math.random() * 1.2,
				away.z * out + (Math.random() - 0.5) * 1.6,
			);
		} else {
			// The hot ones short and close behind the ball, the red ones lingering.
			tongue.life = this.tongueLife * [0.6, 0.9, 1.2][tongue.band] * (0.7 + Math.random() * 0.6);
			tongue.size = this.tongueSize * (0.6 + Math.random() * 0.5);
			// Left behind, rising a little as it burns out.
			tongue.velocity.set((Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
		}
		tongue.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(this.spinSpeed);
		tongue.euler.set(Math.random() * 360, Math.random() * 360, Math.random() * 360);
		tongue.node.setRotationFromEuler(tongue.euler.x, tongue.euler.y, tongue.euler.z);
		tongue.node.setScale(0, 0, 0);
		tongue.renderer.model && (tongue.renderer.model.enabled = true);
		this._live.push(tongue);
	}

	/** The tongues drift, spin, swell a moment, then shrink away. */
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
				this._free.push(tongue);
				continue;
			}
			// The fire's root stands at the world's origin: local is world.
			Vec3.scaleAndAdd(_at, node.position, tongue.velocity, dt);
			node.setPosition(_at);
			const euler = tongue.euler;
			Vec3.scaleAndAdd(euler, euler, tongue.spin, dt);
			node.setRotationFromEuler(euler.x, euler.y, euler.z);
			const size = tongue.size * (share < 0.15 ? share / 0.15 : 1 - (share - 0.15) / 0.85);
			node.setScale(size, size, size);
		}
	}

	/** The mouth glowing up, 0..1, flickering. */
	private _showGlow(strength: number): void {
		if (!this._glow) {
			return;
		}
		const on = strength > 0;
		this._glow.active = on;
		if (!on) {
			return;
		}
		this._glow.setWorldPosition(this.mouth.worldPosition);
		const flicker = 0.8 + 0.2 * Math.sin(this._time * 29) * Math.sin(this._time * 7.1 + 0.7);
		const size = this.radius * 2 * (0.4 + 0.8 * strength) * flicker;
		this._glow.setScale(size, size, size);
		const color = this.glowColor;
		_color.set(color.r, color.g, color.b, Math.round(color.a * strength * flicker));
		this._glowMaterial.setProperty("mainColor", _color);
	}

	/** An additive instanced material of a colour — the same one for every head that asks for it. */
	private static _material(color: Color): Material {
		const key = `${color.r},${color.g},${color.b},${color.a}`;
		let material = Gargoyle._shared.get(key);
		if (!material || !material.isValid) {
			material = new Material();
			material.initialize({ effectName: "builtin-unlit", technique: ADD, defines: { USE_INSTANCING: true } });
			material.setProperty("mainColor", color);
			Gargoyle._shared.set(key, material);
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
}
