import { _decorator, Component, instantiate, math, Node, Prefab, Quat, tween, Tween, v3, Vec3 } from "cc";
import { StackItem } from "../managers/GameState";
import { Debris } from "./Debris";
import { paintPotion, PotionKind } from "./PotionKind";

const { ccclass, property } = _decorator;

interface Entry {
	node: Node;
	key: boolean;
	color: number;
	/** A potion's kind; keys are plain. */
	kind: PotionKind;
	height: number;
}

// What the player carries, in sight: a stack on the back growing upwards. Potions go on top,
// one for every shot left; keys, laid flat, always at the bottom, under the potions. A shot takes the
// lowest potion — the one right over the keys: the first in is the first out — a door takes a key
// of its colour, and whatever lay above settles down.
// The stack follows the back (`anchor`) but always stands straight up: it rides on a mount of
// its own that takes the anchor's place every frame and only the heading of the body — a lean,
// a crouch, a recoil leave it upright.
@ccclass("PotionStack")
export class PotionStack extends Component {
	@property({ type: Node, tooltip: "Where the stack stands — a node on the back socket; the stack grows along its +Y" })
	anchor: Node = null;
	@property({ type: Prefab, tooltip: "What lies in the stack" })
	item: Prefab = null;
	@property({ type: [Prefab], tooltip: "Keys by colour (KeyColor), for laying back the keys brought from the last level" })
	keyPrefabs: Prefab[] = [];
	@property({ tooltip: "World size of a potion in the stack" })
	itemScale: number = 1;
	@property({ tooltip: "World height each potion adds to the stack" })
	step: number = 0.055;
	@property({ tooltip: "World size of a key in the stack — the same as on the level" })
	keyScale: number = 2.4;
	@property({ tooltip: "World height each key adds to the stack" })
	keyStep: number = 0.05;
	@property({ tooltip: "Random turn of each item, degrees, so the stack does not look stamped" })
	jitter: number = 8;
	@property({ tooltip: "Seconds a potion takes to vanish off the top" })
	popTime: number = 0.12;
	@property({ tooltip: "When the player dies: slowest and fastest a piece flies off, along the floor" })
	scatterSpeed: Vec3 = v3(0.5, 1.5, 0);
	@property({ tooltip: "When the player dies: least and most of that speed upwards — how high each arcs" })
	scatterLift: Vec3 = v3(1, 2.2, 0);
	@property({ tooltip: "When the player dies: tumble of a piece, radians per second either way" })
	scatterSpin: number = 10;
	@property({ tooltip: "Seconds the items above take to settle when a potion under them is shot" })
	shiftTime: number = 0.15;

	private _items: Entry[] = [];
	private _at = v3();
	private _mount: Node = null;
	private _forward = v3();
	private _yaw = new Quat();

	protected lateUpdate(): void {
		this._follow();
	}

	/** Where the stack stands, upright: the anchor's place, turned only the way the body faces. */
	private _follow(): void {
		const mount = this._holder();
		if (!mount || !this.anchor) {
			return;
		}
		mount.setWorldPosition(this.anchor.worldPosition);
		// The heading: the way the body is turned (FaceDirection's node), flattened onto the floor.
		const facing = this._facing();
		Vec3.transformQuat(this._forward, Vec3.FORWARD, facing.worldRotation);
		const length = Math.hypot(this._forward.x, this._forward.z);
		if (length > 1e-4) {
			const yaw = Math.atan2(-this._forward.x, -this._forward.z);
			Quat.fromAxisAngle(this._yaw, Vec3.UNIT_Y, yaw);
			mount.setWorldRotation(this._yaw);
		}
	}

	private _facing(): Node {
		const face = (this.getComponent("FaceDirection") || this.getComponentInChildren("FaceDirection")) as Component;
		return face ? face.node : this.node;
	}

	/** The upright mount the items lie on, made on first use beside the anchor's owner. */
	private _holder(): Node {
		if (this._mount && this._mount.isValid) {
			return this._mount;
		}
		if (!this.anchor) {
			return null;
		}
		this._mount = new Node("StackMount");
		this.node.addChild(this._mount);
		this._mount.setWorldScale(1, 1, 1);
		this._follow();
		return this._mount;
	}

	/** Potions in the stack. */
	get count(): number {
		return this._items.filter((entry) => !entry.key).length;
	}

	/** What lies in the stack, bottom to top — what goes on to the next level. */
	contents(): StackItem[] {
		return this._items.map((entry) => ({ key: entry.key, color: entry.color, kind: entry.kind }));
	}

	/** The stack as it was brought from the last level, laid at once. */
	restore(items: StackItem[]): void {
		// Keys at the bottom, as they always lie.
		const ordered = items.filter((item) => item.key).concat(items.filter((item) => !item.key));
		for (const item of ordered) {
			if (!item.key) {
				this.push(null, item.kind || PotionKind.Plain);
				continue;
			}
			const prefab = this.keyPrefabs[item.color];
			if (!prefab) {
				continue;
			}
			// A key pickup is made only for its mesh; the pickup itself is not needed.
			const pickup = instantiate(prefab);
			const holder = pickup.getComponent("KeyPickup") as Component & { visual: Node };
			const visual = holder && holder.visual;
			if (visual) {
				holder.visual = null;
				this.pushKey(visual, item.color);
			}
			pickup.destroy();
		}
	}

	/**
	 * As many potions as the player has, made at once — the start. `kinds` — what they are, from
	 * the bottom (the first to be shot) up; past its end, and where it says nothing, plain.
	 */
	fill(count: number, kinds: PotionKind[] = []): void {
		while (this.count < count) {
			this.push(null, kinds[this.count] || PotionKind.Plain);
		}
	}

	/** A new potion of `kind` on top; `node` — one that has just flown in and stays — or a fresh one. */
	push(node: Node = null, kind: PotionKind = PotionKind.Plain): void {
		if (!this.anchor) {
			node && node.destroy();
			return;
		}
		if (!node) {
			if (!this.item) {
				return;
			}
			node = instantiate(this.item);
		}
		paintPotion(node, kind);
		this._adopt(node, this.itemScale, 0, this._centre(this._items.length, this.step));
		this._items.push({ node, key: false, color: -1, kind, height: this.step });
	}

	/** A key of a colour, laid flat on top. */
	pushKey(node: Node, color: number): void {
		if (!this.anchor) {
			node.destroy();
			return;
		}
		// Keys always go to the bottom, above the keys already there: the potions above rise.
		const index = this.keyCount;
		this._adopt(node, this.keyScale, 90, this._centre(index, this.keyStep));
		this._items.splice(index, 0, { node, key: true, color, kind: PotionKind.Plain, height: this.keyStep });
		this._layout(index + 1);
	}

	/** Keys in the stack — all at the bottom of it. */
	get keyCount(): number {
		let count = 0;
		while (count < this._items.length && this._items[count].key) {
			count++;
		}
		return count;
	}

	/** Where the next key will lie, in the world: at the bottom, above the keys already there. */
	keySlot(out: Vec3): Vec3 {
		if (!this.anchor) {
			return out.set(this.node.worldPosition);
		}
		this._at.set(0, this._centre(this.keyCount, this.keyStep) / this._anchorScale(), 0);
		return Vec3.transformMat4(out, this._at, this._holder().worldMatrix);
	}

	/** Is a key of this colour lying in the stack? */
	hasKey(color: number): boolean {
		return this._items.some((entry) => entry.key && entry.color === color);
	}

	/**
	 * Takes the topmost key of this colour out of the stack — it is off to a door — and lets
	 * what lay above it settle. Returns its node, still where it lay, or null when there is none.
	 */
	takeKey(color: number): Node {
		for (let i = this._items.length - 1; i >= 0; i--) {
			const entry = this._items[i];
			if (entry.key && entry.color === color) {
				this._items.splice(i, 1);
				this._layout(i);
				Tween.stopAllByTarget(entry.node);
				return entry.node;
			}
		}
		return null;
	}

	/** The kind of the potion that goes next — the lowest, right over the keys; plain when there is none. */
	get nextKind(): PotionKind {
		const index = this.keyCount;
		return index < this._items.length ? this._items[index].kind : PotionKind.Plain;
	}

	/** The lowest potion goes — a shot; what lay above it settles down. Keys stay. Its kind. */
	pop(): PotionKind {
		const index = this.keyCount;
		if (index >= this._items.length) {
			return PotionKind.Plain;
		}
		const entry = this._items.splice(index, 1)[0];
		const node = entry.node;
		this._layout(index);
		Tween.stopAllByTarget(node);
		tween(node)
			.to(this.popTime, { scale: v3() })
			.call(() => node.destroy())
			.start();
		return entry.kind;
	}

	/**
	 * Everything on the stack falls off — the player died: each piece flies its own arc, random
	 * in direction, height and tumble, and comes down on the floor under the loose-thing physics.
	 */
	scatter(parent: Node): void {
		const debris = Debris.instance;
		const items = this._items.splice(0);
		for (const entry of items) {
			const node = entry.node;
			if (!node.isValid) {
				continue;
			}
			Tween.stopAllByTarget(node);
			if (!debris) {
				node.destroy();
				continue;
			}
			const body = debris.addLoose(node, parent);
			const angle = Math.random() * Math.PI * 2;
			debris.launch(
				body,
				Math.sin(angle),
				Math.cos(angle),
				math.randomRange(this.scatterSpeed.x, this.scatterSpeed.y),
				math.randomRange(this.scatterLift.x, this.scatterLift.y),
				math.randomRange(-this.scatterSpin, this.scatterSpin),
			);
		}
	}

	/** Where the next potion will lie, in the world — what a potion flying in aims at. */
	nextSlot(out: Vec3): Vec3 {
		return this._slot(this._items.length, out);
	}

	private _slot(index: number, out: Vec3): Vec3 {
		if (!this.anchor) {
			return out.set(this.node.worldPosition);
		}
		this._at.set(0, this._centre(index, this.step) / this._anchorScale(), 0);
		return Vec3.transformMat4(out, this._at, this._holder().worldMatrix);
	}

	/**
	 * World height of the middle of an item `height` tall at this place: half its height above
	 * the top of what lies under it. Measured from the middle of a potion at the bottom, so a
	 * stack of potions stands where it always did; a thinner key sits lower, flat on the one below.
	 */
	private _centre(index: number, height: number): number {
		return this._height(index) + (height - this.step) / 2;
	}

	/** World height of the bottom of the item at this place in the stack. */
	private _height(index: number): number {
		let height = 0;
		for (let i = 0; i < index && i < this._items.length; i++) {
			height += this._items[i].height;
		}
		return height;
	}

	private _adopt(node: Node, scale: number, tilt: number, height: number): void {
		const local = scale / this._anchorScale();
		node.setParent(this._holder(), false);
		node.setScale(local, local, local);
		node.setPosition(0, height / this._anchorScale(), 0);
		node.setRotationFromEuler(tilt, math.randomRange(-this.jitter, this.jitter), math.randomRange(-this.jitter, this.jitter) * 0.5);
	}

	/** Moves the items from `from` on to where they now belong. */
	private _layout(from: number): void {
		let bottom = this._height(from);
		for (let i = from; i < this._items.length; i++) {
			const entry = this._items[i];
			const centre = bottom + (entry.height - this.step) / 2;
			Tween.stopAllByTarget(entry.node);
			tween(entry.node)
				.to(this.shiftTime, { position: v3(0, centre / this._anchorScale(), 0) }, { easing: "quadOut" })
				.start();
			bottom += entry.height;
		}
	}

	private _anchorScale(): number {
		const mount = this._holder();
		return (mount && mount.worldScale.y) || 1;
	}
}
