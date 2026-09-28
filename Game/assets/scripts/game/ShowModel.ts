import { MeshRenderer, Node } from "cc";

/**
 * Shows or hides what a node draws by switching its model, not the node. Switching a node on
 * runs its components' enabling and puts its model back into the scene — for effects lit and
 * put out by the dozen that cost whole frames; a model switched off costs nothing, is not culled
 * and not updated, and comes back as it was.
 */
export function showModel(node: Node, on: boolean): void {
	const renderer = node.getComponent(MeshRenderer);
	const model = renderer && renderer.model;
	if (model && model.enabled !== on) {
		model.enabled = on;
	}
}
