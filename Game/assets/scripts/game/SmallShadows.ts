import { director, MeshRenderer, Node } from "cc";
import { Furniture } from "./Furniture";

// Shadows only where they are seen. Every shadow caster is drawn a second time into the shadow
// map, and the small things of a level — bones on the floor, urns, braziers, what hangs on the
// walls, crates and chairs, potions, keys — cast shadows nobody makes out from the camera's
// height. Those are taken off at the start of a level; the characters, the walls, the columns and
// the big furniture keep theirs.

/** The level's decoration groups under World: all of it small, none of it casts a shadow. */
const DECOR = ["Decor", "DecorFloor", "DecorStand"];
/** Small things of the level itself: keys lying about. */
const SMALL_GROUPS = ["Keys"];

/** Takes the shadows off whatever `node` draws. */
export function noShadow(node: Node): void {
	if (!node || !node.isValid) {
		return;
	}
	for (const renderer of node.getComponentsInChildren(MeshRenderer)) {
		renderer.shadowCastingMode !== MeshRenderer.ShadowCastingMode.OFF && (renderer.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF);
	}
}

/** The small things of the level just started: no shadows. */
export function dropSmallShadows(): void {
	const world = director.getScene() && director.getScene().getChildByName("World");
	if (!world) {
		return;
	}
	for (const name of DECOR) {
		noShadow(world.getChildByName(name));
	}
	const level = world.getChildByName("Level");
	if (!level) {
		return;
	}
	for (const name of SMALL_GROUPS) {
		noShadow(level.getChildByName(name));
	}
	// Crates, chairs, candelabra — the ones thrown and kicked about; beds, tables, shelves and the
	// barrels, which the player looks out for, stay.
	for (const piece of level.getComponentsInChildren(Furniture)) {
		piece.small && !piece.explosive && noShadow(piece.node);
	}
}
