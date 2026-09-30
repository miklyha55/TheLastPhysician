import { _decorator, Component, instantiate, math, Node, Prefab, Quat, tween, v3, Vec3 } from "cc";
import { PlayerAttack } from "./PlayerAttack";
import { paintPotion, PotionKind } from "./PotionKind";
import { Sfx } from "../managers/audio/Sfx";

const { ccclass, property } = _decorator;

interface Flight {
	node: Node;
	/** Plain, or seldom a bomb or a drone. */
	kind: PotionKind;
	start: Vec3;
	time: number;
	duration: number;
}

// A chest of potions. It stands open with its potions inside, in sight. When the player comes
// within `giveRadius` they start flying out one after another in an arc to the player — each
// one that arrives is a potion more to shoot with — for as long as the player stays there;
// walking off stops the stream, coming back resumes it. Once the last has arrived the lid
// shuts, the chest shrinks away and is gone.
@ccclass("Chest")
export class Chest extends Component {
	@property({ type: Node, tooltip: "The lid, turning on its hinge around X" })
	lid: Node = null;
	@property({ type: [Node], tooltip: "The potions lying in the chest; they are what flies out" })
	potions: Node[] = [];
	@property({ type: Prefab, tooltip: "What flies when no potions are laid in the chest" })
	potion: Prefab = null;
	@property({ tooltip: "Potions it gives, reckoned for the level: those laid in it first, the rest flying out of its mouth" })
	count: number = 5;
	@property({ tooltip: "Of them, red ones — bombs" })
	bombs: number = 0;
	@property({ tooltip: "Of them, yellow ones — drones" })
	drones: number = 0;
	@property({ tooltip: "Potions over those laid in it are heaped on top of them: the height each layer of the heap adds" })
	heapStep: number = 0.05;
	@property({ tooltip: "Lid angle when open, degrees around X; negative tips it back" })
	openAngle: number = -105;
	@property({ tooltip: "Seconds the lid takes to shut" })
	closeTime: number = 0.3;
	@property({ tooltip: "Seconds the chest takes to fade away once shut; then it is gone" })
	vanishTime: number = 0.5;
	@property({ tooltip: "Potions fly to the player while they are within this distance; outside it the flying stops until they come back" })
	giveRadius: number = 0.75;
	@property({ tooltip: "Seconds between potions" })
	interval: number = 0.2;
	@property({ tooltip: "Potion speed along the ground, units per second" })
	speed: number = 3.75;
	@property({ tooltip: "How high the arc rises" })
	arcHeight: number = 0.45;
	@property({ tooltip: "Height above the chest's base the potions leave from" })
	mouthHeight: number = 0.25;
	@property({ tooltip: "Height above the player's feet the potions fly to" })
	catchHeight: number = 0.35;
	@property({ tooltip: "How fast a potion tumbles, degrees per second" })
	spinSpeed: number = 720;

	private _given = false;
	private _closing = false;
	private _left = 0;
	private _timer = 0;
	private _flights: Flight[] = [];
	/** The kinds of the potions it gives, in the order they fly: the special ones first, so they are seen lying in it. */
	private _kinds: PotionKind[] = [];
	private _to = v3();
	private _rotation = new Quat();

	protected onLoad(): void {
		// Open from the start.
		this.lid && this.lid.setRotationFromEuler(this.openAngle, 0, 0);
		// What it gives is set for the level, not left to the dice: the special ones first — they lie
		// in sight, on top of the pile — then the plain ones.
		const kinds: PotionKind[] = [];
		const count = Math.max(0, Math.floor(this.count));
		let drones = Math.min(this.drones, count);
		let bombs = Math.min(this.bombs, count - drones);
		while (drones > 0 || bombs > 0) {
			drones-- > 0 && kinds.push(PotionKind.Drone);
			bombs-- > 0 && kinds.push(PotionKind.Bomb);
		}
		while (kinds.length < count) {
			kinds.push(PotionKind.Plain);
		}
		this._kinds = kinds;
		// More than it holds: the rest heaped on top, in sight — a chest is never seen empty with
		// potions coming out of it. They leave from the top down, the heap first.
		const laid = this.potions.filter((node) => node && node.isValid);
		const heap = this._heap(laid, count - laid.length);
		const order = heap.reverse().concat(laid);
		// The first to go shows what comes first; any over the count are not there.
		order.forEach((node, i) => (i < count ? paintPotion(node, kinds[i]) : (node.active = false)));
		this.potions = order.slice(0, count);
	}

	protected update(dt: number): void {
		const player = PlayerAttack.instance;
		if (!this._given) {
			if (this._near(player, this.giveRadius)) {
				this._given = true;
				this._left = this._kinds.length;
				this._timer = 0;
			}
			return;
		}
		// Only while the player stays near; walking off stops the stream, coming back resumes it.
		if (this._left > 0 && this._near(player, this.giveRadius) && (this._timer -= dt) <= 0) {
			this._timer = this.interval;
			this._left--;
			this._throw();
		}
		this._fly(player, dt);
	}

	/**
	 * `extra` potions heaped over the laid ones, bottom layer first: each layer narrower and higher —
	 * four, three, two, then one on one — lying on their sides like the laid ones, a little askew.
	 */
	private _heap(laid: Node[], extra: number): Node[] {
		const made: Node[] = [];
		if (extra <= 0 || !this.potion) {
			return made;
		}
		// The laid ones' bed: its middle, its height, and how far it spreads across.
		let x = 0, y = 0, z = 0, spread = 0.13;
		if (laid.length) {
			laid.forEach((node) => {
				x += node.position.x;
				y = Math.max(y, node.position.y);
				z += node.position.z;
			});
			x /= laid.length;
			z /= laid.length;
			spread = Math.max(...laid.map((node) => Math.abs(node.position.x - x)), 0.05);
		} else {
			y = this.mouthHeight * 0.5;
		}
		const widths = [4, 3, 2, 1];
		let layer = 0;
		while (made.length < extra) {
			const width = Math.min(widths[Math.min(layer, widths.length - 1)], extra - made.length);
			const height = y + this.heapStep * (layer + 1);
			const half = spread * (1 - layer * 0.25);
			for (let i = 0; i < width; i++) {
				const node = instantiate(this.potion);
				this.node.addChild(node);
				const across = width > 1 ? -half + (2 * half * i) / (width - 1) : 0;
				node.setPosition(x + across, height, z + math.randomRange(-0.03, 0.03));
				node.setRotationFromEuler(math.randomRange(-8, 8), math.randomRange(0, 360), 90);
				made.push(node);
			}
			layer++;
		}
		return made;
	}

	private _near(player: PlayerAttack, radius: number): boolean {
		if (!player || player.isDead) {
			return false;
		}
		const at = this.node.worldPosition;
		const them = player.node.worldPosition;
		return Math.hypot(them.x - at.x, them.z - at.z) <= radius;
	}

	private _throw(): void {
		const laid = this.potions.shift();
		const kind = this._kinds.shift() || PotionKind.Plain;
		if (laid && laid.isValid) {
			// Out of the chest, into the level, from where it lay.
			const start = laid.worldPosition.clone();
			laid.setParent(this.node.parent, true);
			this._flights.push({ node: laid, kind, start, time: 0, duration: 0.1 });
			return;
		}
		if (!this.potion) {
			// Nothing to show flying: the potion is simply handed over.
			const player = PlayerAttack.instance;
			player && player.addAmmo(1, null, kind);
			this._closeWhenDone();
			return;
		}
		const node = instantiate(this.potion);
		paintPotion(node, kind);
		node.setParent(this.node.parent);
		const at = this.node.worldPosition;
		const start = v3(at.x, at.y + this.mouthHeight, at.z);
		node.setWorldPosition(start);
		this._flights.push({ node, kind, start, time: 0, duration: 0.1 });
	}

	/** Each potion arcs to the top of the player's stack as it is now; on arrival it lies there. */
	private _fly(player: PlayerAttack, dt: number): void {
		for (let i = this._flights.length - 1; i >= 0; i--) {
			const flight = this._flights[i];
			if (player) {
				player.catchPoint(this._to, this.catchHeight);
			}
			const distance = Math.hypot(this._to.x - flight.start.x, this._to.z - flight.start.z);
			flight.duration = Math.max(0.15, distance / Math.max(this.speed, 0.01));
			flight.time += dt;
			const t = Math.min(1, flight.time / flight.duration);
			if (t >= 1) {
				this._flights.splice(i, 1);
				if (player && !player.isDead) {
					player.addAmmo(1, flight.node, flight.kind);
				} else {
					flight.node.destroy();
				}
				this._closeWhenDone();
				continue;
			}
			const at = Vec3.lerp(v3(), flight.start, this._to, t);
			at.y += this.arcHeight * 4 * t * (1 - t);
			flight.node.setWorldPosition(at);
			const yaw = math.toDegree(Math.atan2(this._to.x - flight.start.x, this._to.z - flight.start.z));
			Quat.fromEuler(this._rotation, 0, yaw - 90, -this.spinSpeed * flight.time);
			flight.node.setWorldRotation(this._rotation);
		}
	}

	/** The lid shuts once every potion has left and arrived. */
	private _closeWhenDone(): void {
		if (this._left > 0 || this._flights.length || !this.lid) {
			return;
		}
		if (this._closing) {
			return;
		}
		this._closing = true;
		// Every potion taken: the lid slams shut, then it shrinks away and the node goes, with everything in it.
		Sfx.at(Sfx.chestClose, this.node);
		tween(this.lid)
			.to(this.closeTime, { eulerAngles: v3(0, 0, 0) }, { easing: "backIn" })
			.call(() => {
				tween(this.node)
					.to(this.vanishTime, { scale: v3(0, 0, 0) }, { easing: "quadIn" })
					.call(() => this.node.destroy())
					.start();
			})
			.start();
	}
}
