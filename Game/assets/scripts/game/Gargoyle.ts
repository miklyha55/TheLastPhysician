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

	private _time = 0;
	private _fired = false;
	private _root: Node = null;
	private _balls: Ball[] = [];
	private _pool: Tongue[] = [];
	private _materials: Material[] = [];
	private _coreMaterial: Material = null;
	private _haloMaterial: Material = null;
	private _glow: Node = null;
	private _glowMaterial: Material = null;
	private _debt = 0;

	protected start(): void {
		if (!Gargoyle._box) {
			Gargoyle._box = utils.MeshUtils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
			Gargoyle._sphere = utils.MeshUtils.createMesh(primitives.sphere(0.5, { segments: 12 }));
		}
		// The fire lives in the world, not in the head: the trail stays where the ball has been.
		this._root = new Node("GargoyleFire");
		this.node.scene.addChild(this._root);
		for (let band = 0; band < 3; band++) {
			this._materials.push(this._additive(true));
			const color = [this.coreColor, this.midColor, this.tailColor][band];
			this._materials[band].setProperty("mainColor", color);
		}
		this._coreMaterial = this._additive(true);
		this._coreMaterial.setProperty("mainColor", this.coreColor);
		this._haloMaterial = this._additive(true);
		this._haloMaterial.setProperty("mainColor", this.midColor);
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
			const renderer = this._renderer(node, Gargoyle._box, this._materials[0]);
			node.active = false;
			this._pool.push({ node, renderer, band: 0, age: 0, life: 0, size: 0, velocity: v3(), spin: v3() });
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
		const tongue = this._pool.find((t) => !t.node.active);
		if (!tongue) {
			return;
		}
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
			tongue.life = this.tongueLife * (0.7 + Math.random() * 0.6);
			tongue.size = this.tongueSize * (0.6 + Math.random() * 0.5);
			// Left behind, rising a little as it burns out.
			tongue.velocity.set((Math.random() - 0.5) * 0.3, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
		}
		tongue.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(this.spinSpeed);
		tongue.node.setRotationFromEuler(Math.random() * 360, Math.random() * 360, Math.random() * 360);
		this._band(tongue, 0);
		tongue.node.setScale(0, 0, 0);
		tongue.node.active = true;
	}

	/** The tongues drift, spin, swell a moment, then shrink away, turning redder. */
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
			Vec3.scaleAndAdd(_at, node.worldPosition, tongue.velocity, dt);
			node.setWorldPosition(_at);
			const euler = node.eulerAngles;
			node.setRotationFromEuler(euler.x + tongue.spin.x * dt, euler.y + tongue.spin.y * dt, euler.z + tongue.spin.z * dt);
			const size = tongue.size * (share < 0.15 ? share / 0.15 : 1 - (share - 0.15) / 0.85);
			node.setScale(size, size, size);
			this._band(tongue, share < 0.3 ? 0 : share < 0.65 ? 1 : 2);
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
}
