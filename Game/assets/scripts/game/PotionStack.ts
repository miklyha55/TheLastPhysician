import { _decorator, Component, instantiate, math, Node, Prefab, tween, Tween, v3, Vec3 } from "cc";

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
		this._adopt(node, this.itemScale, 0, this._height(this._items.length));
		this._items.push({ node, key: false, color: -1, height: this.step });
	}

	/** A key of a colour, laid flat on top. */
	pushKey(node: Node, color: number): void {
		if (!this.anchor) {
			node.destroy();
			return;
		}
		this._adopt(node, this.keyScale, 90, this._height(this._items.length));
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

	/** Where the next potion will lie, in the world — what a potion flying in aims at. */
	nextSlot(out: Vec3): Vec3 {
		return this._slot(this._items.length, out);
	}

	private _slot(index: number, out: Vec3): Vec3 {
		if (!this.anchor) {
			return out.set(this.node.worldPosition);
		}
		this._at.set(0, this._height(index) / this._anchorScale(), 0);
		return Vec3.transformMat4(out, this._at, this.anchor.worldMatrix);
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
		let height = this._height(from);
		for (let i = from; i < this._items.length; i++) {
			const node = this._items[i].node;
			Tween.stopAllByTarget(node);
			tween(node)
				.to(this.shiftTime, { position: v3(0, height / this._anchorScale(), 0) }, { easing: "quadOut" })
				.start();
			height += this._items[i].height;
		}
	}

	private _anchorScale(): number {
		return (this.anchor && this.anchor.worldScale.y) || 1;
	}
}
