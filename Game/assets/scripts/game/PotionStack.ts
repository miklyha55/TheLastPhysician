import { _decorator, Component, instantiate, math, Node, Prefab, tween, Tween, v3, Vec3 } from "cc";
import { Debris } from "./Debris";

const { ccclass, property } = _decorator;

interface Entry {
	node: Node;
	key: boolean;
	color: number;
	height: number;
}

// What the player carries, in sight: a stack on the back growing upwards. Everything picked up
// goes on top — potions, one for every shot left, and keys, laid flat. A shot takes the
// topmost potion away, a door takes a key of its colour, and whatever lay above settles down.
@ccclass("PotionStack")
export class PotionStack extends Component {
	@property({ type: Node, tooltip: "Where the stack stands — a node on the back socket; the stack grows along its +Y" })
	anchor: Node = null;
	@property({ type: Prefab, tooltip: "What lies in the stack" })
	item: Prefab = null;
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

	/** Potions in the stack. */
	get count(): number {
		return this._items.filter((entry) => !entry.key).length;
	}

	/** As many potions as the player has, made at once — the start. */
	fill(count: number): void {
		while (this.count < count) {
			this.push();
		}
	}

	/** A new potion on top; `node` — one that has just flown in and stays — or a fresh one. */
	push(node: Node = null): void {
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
		this._adopt(node, this.itemScale, 0, this._centre(this._items.length, this.step));
		this._items.push({ node, key: false, color: -1, height: this.step });
	}

	/** A key of a colour, laid flat on top. */
	pushKey(node: Node, color: number): void {
		if (!this.anchor) {
			node.destroy();
			return;
		}
		this._adopt(node, this.keyScale, 90, this._centre(this._items.length, this.keyStep));
		this._items.push({ node, key: true, color, height: this.keyStep });
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

	/** The topmost potion goes — a shot; what lay above it settles down. Keys stay. */
	pop(): void {
		let index = this._items.length - 1;
		while (index >= 0 && this._items[index].key) {
			index--;
		}
		if (index < 0) {
			return;
		}
		const node = this._items.splice(index, 1)[0].node;
		this._layout(index);
		Tween.stopAllByTarget(node);
		tween(node)
			.to(this.popTime, { scale: v3() })
			.call(() => node.destroy())
			.start();
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
		return Vec3.transformMat4(out, this._at, this.anchor.worldMatrix);
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
		node.setParent(this.anchor, false);
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
		return (this.anchor && this.anchor.worldScale.y) || 1;
	}
}
