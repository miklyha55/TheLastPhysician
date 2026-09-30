import { Material, MeshRenderer, Node, Texture2D } from "cc";

// The kinds of potion the player shoots. Pink — the plain one: one life off whoever it lands on.
// Red — a bomb: it bursts like a barrel, half as wide, killing every zombie in the circle and
// setting off the barrels in it; the player it spares. Yellow — a drone: a life off the one it is
// thrown at, then it flies on round the walls to every other zombie that was on the screen the
// moment it was thrown, one after another, and takes a life off each; whoever comes into sight
// later it leaves.
//
// They come out of chests, as many of each as the level is reckoned to need, and fall from zombies
// by the dice; on the back they are shot in turn, the lowest first — the one right over the keys.
// A kind is only the colour of its liquid on the model: the potion's material with its palette's
// liquid cell painted over — glass, cork and rope stay as they are.

export enum PotionKind {
	Plain = 0,
	Bomb = 1,
	Drone = 2,
}

/** Chance of each special kind, for every potion a zombie drops. A chest's are set for its level (Chest). */
export const DROP_CHANCE = { bomb: 0.15, drone: 0.15 };

/** A potion's kind by the dice. */
export function rollPotionKind(chance: { bomb: number; drone: number } = DROP_CHANCE): PotionKind {
	const roll = Math.random();
	if (roll < chance.drone) {
		return PotionKind.Drone;
	}
	return roll < chance.drone + chance.bomb ? PotionKind.Bomb : PotionKind.Plain;
}

/** The palette cell the liquid takes (gun_albedo.png, 8 cells in a row). */
const LIQUID_CELL = 6;
/** The liquid of each kind; the plain one keeps the palette's own pink. */
const LIQUID: { [kind: number]: number[] } = {
	[PotionKind.Bomb]: [236, 44, 34],
	[PotionKind.Drone]: [255, 185, 25], // amber: an orange leaning to yellow
};
/** The palette as it is on disk, for when its pixels cannot be read back from the texture. */
const PALETTE = [
	[58, 64, 82],
	[196, 138, 52],
	[140, 86, 52],
	[168, 140, 92],
	[150, 205, 210],
	[86, 226, 110],
	[255, 105, 180],
	[46, 30, 20],
];

const _materials = new Map<Material, Map<number, Material>>();
const _base = new WeakMap<MeshRenderer, Material>();

/** Paints a potion's liquid the colour of its kind; the plain kind puts its own material back. */
export function paintPotion(node: Node, kind: PotionKind): void {
	if (!node || !node.isValid) {
		return;
	}
	for (const renderer of node.getComponentsInChildren(MeshRenderer)) {
		let base = _base.get(renderer);
		if (!base) {
			base = renderer.sharedMaterial;
			if (!base) {
				continue;
			}
			_base.set(renderer, base);
		}
		const material = kind === PotionKind.Plain ? base : kindMaterial(base, kind);
		material && renderer.sharedMaterial !== material && renderer.setSharedMaterial(material, 0);
	}
}

/** The potion's material with the liquid of `kind` — made once for every material and kind. */
function kindMaterial(base: Material, kind: PotionKind): Material {
	let byKind = _materials.get(base);
	if (!byKind) {
		byKind = new Map();
		_materials.set(base, byKind);
	}
	let material = byKind.get(kind);
	if (!material) {
		material = new Material();
		material.copy(base);
		material.setProperty("mainTexture", paletteWith(base, LIQUID[kind]));
		byKind.set(kind, material);
	}
	return material;
}

/** The base material's palette, its liquid cell painted `colour`. */
function paletteWith(base: Material, colour: number[]): Texture2D {
	const cells = readPalette(base);
	const data = new Uint8Array(cells.length * 4);
	cells.forEach((cell, i) => {
		const rgb = i === LIQUID_CELL ? colour : cell;
		data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
	});
	const texture = new Texture2D();
	texture.reset({ width: cells.length, height: 1, format: Texture2D.PixelFormat.RGBA8888 });
	texture.uploadData(data);
	// Each cell a flat colour: sampled as it is, never blended with its neighbour.
	texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
	texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
	return texture;
}

/** The palette's cells as they are in its picture; the known ones when it cannot be read. */
function readPalette(base: Material): number[][] {
	try {
		const texture = base.getProperty("mainTexture") as Texture2D;
		const image = texture && texture.image && (texture.image.data as unknown as CanvasImageSource & { width: number; height: number });
		if (image && typeof document !== "undefined" && image.width > 0) {
			const canvas = document.createElement("canvas");
			canvas.width = image.width;
			canvas.height = 1;
			const context = canvas.getContext("2d");
			context.drawImage(image, 0, 0, image.width, 1);
			const pixels = context.getImageData(0, 0, image.width, 1).data;
			const cells: number[][] = [];
			for (let i = 0; i < image.width; i++) {
				cells.push([pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]]);
			}
			if (cells.length > LIQUID_CELL) {
				return cells;
			}
		}
	} catch {
		// read back refused — the palette as known
	}
	return PALETTE;
}
