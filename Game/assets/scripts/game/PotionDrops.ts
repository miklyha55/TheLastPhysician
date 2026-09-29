import { _decorator, Component, instantiate, math, MeshRenderer, Node, Prefab, v3, Vec3 } from "cc";
import { DroppedPotion, DropSettings } from "./DroppedPotion";
import { PlayerAttack } from "./PlayerAttack";
import { Zombie } from "./Zombie";
import { DROP_CHANCE, paintPotion, rollPotionKind } from "./PotionKind";

const { ccclass, property } = _decorator;

// What a zombie drops as it dies — now and then two or three potions, flying out of it in arcs
// to spots around it and lying there for the player to pick up (DroppedPotion). It sits on the
// zombie prefab, so every zombie in every level has it.
@ccclass("PotionDrops")
export class PotionDrops extends Component {
	@property({ type: Prefab, tooltip: "The potion; empty — the one the player's stack is made of" })
	potion: Prefab = null;
	@property({ tooltip: "Chance the zombie drops potions as it dies, 0..1", slide: true, range: [0, 1, 0.05] })
	chance: number = 0.25;
	@property({ tooltip: "Fewest potions a drop has" })
	minCount: number = 1;
	@property({ tooltip: "Most potions a drop has" })
	maxCount: number = 2;
	@property({ tooltip: "Height above the zombie's feet they fly out from" })
	dropHeight: number = 0.5;
	@property({ tooltip: "Nearest and farthest from the zombie they land" })
	scatter: Vec3 = v3(0.35, 0.9, 0);
	@property({ tooltip: "World size of a dropped potion" })
	size: number = 2;
	@property({ tooltip: "Height of the floor's top: a lying potion rests on it, its middle one potion-radius higher" })
	floorHeight: number = 0.018;
	@property({ tooltip: "How high their arc rises over the straight line" })
	arcHeight: number = 0.55;
	@property({ tooltip: "Seconds the arc takes" })
	fallTime: number = 0.5;
	@property({ tooltip: "Height of the hop on the floor" })
	bounceHeight: number = 0.08;
	@property({ tooltip: "Seconds the hop takes" })
	bounceTime: number = 0.18;
	@property({ tooltip: "How fast they tumble in the air, degrees per second" })
	spinSpeed: number = 720;
	@property({ tooltip: "The player takes a potion within this of it, on the floor" })
	pickupRadius: number = 0.4;
	@property({ tooltip: "Speed of a taken potion's flight to the stack, units per second" })
	collectSpeed: number = 3.75;
	@property({ tooltip: "How high a taken potion's flight arcs" })
	collectArc: number = 0.4;
	@property({ tooltip: "Height above the player's feet a taken potion flies to when there is no stack" })
	catchHeight: number = 0.35;

	private _zombie: Zombie = null;
	private _listener = (zombie: Zombie) => zombie === this._zombie && this._drop();

	protected onLoad(): void {
		this._zombie = this.getComponent(Zombie);
	}

	protected onEnable(): void {
		Zombie.deathListeners.push(this._listener);
	}

	protected onDisable(): void {
		const index = Zombie.deathListeners.indexOf(this._listener);
		index >= 0 && Zombie.deathListeners.splice(index, 1);
	}

	/** Potions out of the zombie that has just died — if the dice say so. */
	private _drop(): void {
		if (Math.random() >= this.chance) {
			return;
		}
		const prefab = this._prefab();
		const parent = this.node.parent;
		if (!prefab || !parent) {
			return;
		}
		const settings: DropSettings = {
			fallTime: this.fallTime,
			arcHeight: this.arcHeight,
			bounceHeight: this.bounceHeight,
			bounceTime: this.bounceTime,
			spinSpeed: this.spinSpeed,
			pickupRadius: this.pickupRadius,
			collectSpeed: this.collectSpeed,
			collectArc: this.collectArc,
			catchHeight: this.catchHeight,
		};
		const at = this.node.worldPosition;
		const count = math.randomRangeInt(this.minCount, this.maxCount + 1);
		// Spread round the zombie, each its own way, so they do not land in a heap.
		const turn = Math.random() * Math.PI * 2;
		for (let i = 0; i < count; i++) {
			const angle = turn + (i / count) * Math.PI * 2 + math.randomRange(-0.4, 0.4);
			const reach = math.randomRange(this.scatter.x, this.scatter.y);
			const node = instantiate(prefab);
			// Now and then a red or a green one: seen as such on the floor.
			const kind = rollPotionKind(DROP_CHANCE);
			paintPotion(node, kind);
			// Next to the zombie, not under it: it sinks away and is gone, the potions stay.
			parent.addChild(node);
			node.setWorldScale(this.size, this.size, this.size);
			const lie = this.floorHeight + this._radius(node);
			node.addComponent(DroppedPotion).launch(
				v3(at.x, at.y + this.dropHeight, at.z),
				v3(at.x + Math.cos(angle) * reach, at.y + lie, at.z + Math.sin(angle) * reach),
				settings,
				kind,
			);
		}
	}

	/** How far a potion lying along the floor reaches up from it: its mesh's half-thickness, in the world. */
	private _radius(node: Node): number {
		const renderer = node.getComponentInChildren(MeshRenderer);
		const struct = renderer && renderer.mesh && renderer.mesh.struct;
		if (!struct || !struct.minPosition || !struct.maxPosition) {
			return 0.05;
		}
		const half = Math.max(Math.abs(struct.minPosition.y), Math.abs(struct.maxPosition.y), Math.abs(struct.minPosition.z), Math.abs(struct.maxPosition.z));
		return half * renderer.node.worldScale.y;
	}

	private _prefab(): Prefab {
		if (this.potion) {
			return this.potion;
		}
		const player = PlayerAttack.instance;
		return player && player.stack ? player.stack.item : null;
	}
}
