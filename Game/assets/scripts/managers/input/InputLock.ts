import { director, Node } from "cc";
import { KeyboardInput } from "./KeyboardInput";

// The player's controls held — the touch area (the Input node under the Canvas's UI) and the
// keyboard — while something must be heard or seen out first: the intro at the start of the
// game. Whatever is let go on unlock is what was locked: the same nodes, as they were.
export class InputLock {
	private static _locked = false;
	private static _nodes: Node[] = [];

	static get locked(): boolean {
		return InputLock._locked;
	}

	static lock(): void {
		if (InputLock._locked) {
			return;
		}
		InputLock._locked = true;
		InputLock._nodes = [];
		const scene = director.getScene();
		scene &&
			scene.walk((node: Node) => {
				// The touch area: the Input node in the UI (Canvas/Ui/Hiddable/Input).
				if (node.name === "Input" && node.active && node.parent && node.parent.name === "Hiddable") {
					InputLock._nodes.push(node);
				}
			});
		InputLock._nodes.forEach((node) => (node.active = false));
		KeyboardInput.setBlocked(true);
	}

	static unlock(): void {
		if (!InputLock._locked) {
			return;
		}
		InputLock._locked = false;
		InputLock._nodes.forEach((node) => node.isValid && (node.active = true));
		InputLock._nodes = [];
		KeyboardInput.setBlocked(false);
	}
}
