import { _decorator, Color, Component, v3, Vec3 } from "cc";
import { CameraManager } from "../managers/camera/CameraManager";
import { Blood } from "./Blood";
import { Body, Debris } from "./Debris";
import { Explosions } from "./Explosions";
import { PlayerAttack } from "./PlayerAttack";
import { Zombie } from "./Zombie";
import { LevelStats } from "../managers/LevelStats";
import { Sfx } from "../managers/audio/Sfx";
import { potionColor, PotionKind } from "./PotionKind";

/** How loud a barrel goes off, against the explosion sound's own level in the mix (Sfx). */
const BARREL_VOLUME = 0.7;

const _plain = new Color();

const { ccclass, property } = _decorator;

// Potions bursting and barrels blowing up, the way ThroughTheDeadCity blows things up.
// A potion that lands bursts — a flash and glass flying in the colour of its liquid — and every zombie within
// `splashRadius` loses a life (the one it was thrown at splashes, the rest only reel); an explosive barrel in that circle goes off. A barrel's blast
// kills every zombie in `blastRadius` — the player it spares — throws the loose things
// about, shakes the camera, and sets off the barrels lying within `chainRadius` one after
// another, in a wave. Sizes are ThroughTheDeadCity's scaled to this game.
@ccclass("Explosives")
export class Explosives extends Component {
	static instance: Explosives = null;

	@property({ type: Explosions, tooltip: "The fire of a barrel" })
	barrelFire: Explosions = null;
	@property({ type: Blood, tooltip: "Pieces of the barrel flying" })
	barrelShards: Blood = null;
	@property({ type: Explosions, tooltip: "The flash of a potion bursting" })
	potionFlash: Explosions = null;
	@property({ type: Blood, tooltip: "Glass of the potion flying" })
	potionShards: Blood = null;

	@property({ tooltip: "Everyone within this of a bursting potion, on the floor, loses a life; a barrel in it goes off" })
	splashRadius: number = 0.6;
	@property({ tooltip: "Everyone within this of a barrel's blast dies" })
	blastRadius: number = 2.1;
	@property({ tooltip: "Loose things within this are thrown about" })
	kickRadius: number = 3.4;
	@property({ tooltip: "Push on the loose things, per unit of mass" })
	kick: number = 5.9;
	@property({ tooltip: "Share of the push upwards" })
	lift: number = 0.6;
	@property({ tooltip: "Barrels within this of a blast go off too" })
	chainRadius: number = 1.26;
	@property({ tooltip: "Seconds between blasts in a chain: they go off in a wave, not at once" })
	chainDelay: number = 0.12;
	@property({ tooltip: "How far the camera shakes at a blast" })
	shake: number = 0.23;
	@property({ tooltip: "Seconds the shake takes to die away" })
	shakeFor: number = 0.5;
	@property({ tooltip: "Radius of a zombie or the player, for being caught by the edge of a circle" })
	bodyRadius: number = 0.2;
	@property({ tooltip: "Height above the floor a barrel's fire centres at" })
	fireHeight: number = 0.2;

	private _pending = new Set<Body>();

	protected onLoad(): void {
		Explosives.instance = this;
	}

	protected onDestroy(): void {
		if (Explosives.instance === this) {
			Explosives.instance = null;
		}
	}

	/**
	 * A potion bursts at `at`, having flown from `from`, on `direct` — the zombie it was thrown
	 * at. Only that one splashes; the others caught by the burst just lose a life and reel.
	 */
	potionBurst(at: Vec3, from: Vec3, direct: Zombie = null, color: Color = null): void {
		this.glassBurst(at, from, color);
		const player = PlayerAttack.instance;
		for (const zombie of Zombie.all.slice()) {
			if (zombie.isDead || !this._within(zombie.node.worldPosition, at, this.splashRadius)) {
				continue;
			}
			zombie.takeHit();
			const blood = zombie === direct && player && player.zombieBlood;
			if (blood) {
				const z = zombie.node.worldPosition;
				blood.splash(v3(z.x, z.y + 0.4, z.z), from, zombie.isDead ? player.killSplash : 1);
			}
		}
		for (const body of this._barrelsNear(at, this.splashRadius)) {
			this.explode(body);
		}
	}

	/**
	 * The look of a potion breaking, nothing more: its flash and its glass flying, in `color` — the
	 * colour of its liquid; none — the scene's own. The yellow one breaks so on the one it is thrown at.
	 */
	glassBurst(at: Vec3, from: Vec3, color: Color = null): void {
		// Unsaid, the plain potion's: the scene's own colours are the old pink.
		color = color || potionColor(PotionKind.Plain, _plain);
		this.potionFlash && this.potionFlash.burst(at, color);
		this.potionShards && this.potionShards.splash(at, from, 1, color);
	}

	/** A barrel blows up — once; asking again for one already gone does nothing. */
	explode(body: Body): void {
		const debris = Debris.instance;
		if (!debris || debris.bodies.indexOf(body) < 0) {
			return;
		}
		this._pending.delete(body);
		LevelStats.barrels++;
		// A barrel gone off: the player's "yes!" (once for a chain of them).
		PlayerAttack.instance && PlayerAttack.instance.cheer();
		const ground = body.node.worldPosition.clone();
		const at = v3(ground.x, ground.y + this.fireHeight, ground.z);
		this.barrelFire && this.barrelFire.burst(at);
		// A barrel's blast a little under the explosion's own level in the mix; a red potion's keeps it.
		Sfx.at(Sfx.explosion, at, BARREL_VOLUME);
		this.barrelShards && this.barrelShards.splash(at, v3(at.x, at.y - 1, at.z), 1.5);
		const camera = CameraManager.instance;
		camera && camera.shake(this.shake, this.shakeFor);

		debris.remove(body);
		debris.blast(at, this.kickRadius, this.kick, this.lift);

		// In the circle no zombie lives. The player is spared: a barrel is their weapon.
		const player = PlayerAttack.instance;
		for (const zombie of Zombie.all.slice()) {
			if (!zombie.isDead && this._within(zombie.node.worldPosition, ground, this.blastRadius)) {
				const blood = player && player.zombieBlood;
				if (blood) {
					const z = zombie.node.worldPosition;
					blood.splash(v3(z.x, z.y + 0.4, z.z), ground, player.killSplash * 2);
				}
				LevelStats.byBarrels++;
				zombie.kill();
			}
		}
		this._chain(ground);
	}

	/** Share of a barrel's blast a red potion bursts with — its circle, and its shake. */
	@property({ tooltip: "A red potion bursts like a barrel this much of its size: the circle it kills in, and the shake" })
	bombScale: number = 0.5;

	/**
	 * A red potion bursts at `at`, having flown from `from`: a barrel's blast, `bombScale` of its
	 * size — every zombie in the circle dies, a barrel in it goes off; the player it spares.
	 */
	bomb(at: Vec3, from: Vec3, color: Color = null): void {
		const radius = this.blastRadius * this.bombScale;
		this.barrelFire && this.barrelFire.burst(at);
		// Over the fire, the red of the potion: its flash and its glass.
		this.glassBurst(at, from, color);
		Sfx.at(Sfx.explosion, at);
		const camera = CameraManager.instance;
		camera && camera.shake(this.shake * this.bombScale, this.shakeFor);
		const player = PlayerAttack.instance;
		for (const zombie of Zombie.all.slice()) {
			if (zombie.isDead || !this._within(zombie.node.worldPosition, at, radius)) {
				continue;
			}
			const blood = player && player.zombieBlood;
			if (blood) {
				const z = zombie.node.worldPosition;
				blood.splash(v3(z.x, z.y + 0.4, z.z), at, player.killSplash);
			}
			zombie.kill();
		}
		for (const body of this._barrelsNear(at, radius)) {
			this.explode(body);
		}
	}

	/** A blast with no barrel behind it — a fireball bursting: the barrel's fire and the shake, nothing thrown about. */
	fireBlast(at: Vec3, shake = true): void {
		this.barrelFire && this.barrelFire.burst(at);
		const camera = CameraManager.instance;
		shake && camera && camera.shake(this.shake, this.shakeFor);
	}

	/** Barrels lying near go off too, one after another. */
	private _chain(at: Vec3): void {
		const next = this._barrelsNear(at, this.chainRadius).filter((body) => !this._pending.has(body));
		next.forEach((body, i) => {
			this._pending.add(body);
			this.scheduleOnce(() => this.explode(body), (i + 1) * this.chainDelay);
		});
	}

	private _barrelsNear(at: Vec3, radius: number): Body[] {
		const debris = Debris.instance;
		if (!debris) {
			return [];
		}
		return debris.bodies.filter(
			(body) => body.furniture && body.furniture.explosive && !body.held && body.node.isValid && this._within(body.node.worldPosition, at, radius + body.radius),
		);
	}

	/** Within a circle on the floor, caught by its edge too. */
	private _within(point: Vec3, at: Vec3, radius: number): boolean {
		return Math.hypot(point.x - at.x, point.z - at.z) <= radius + this.bodyRadius;
	}
}
