import InputCommand from "./core/InputCommand";
import GameEvent from "../../../enums/GameEvent";
import { gameEventTarget } from "../../../plugins/GameEventTarget";

export default class RedirectCommand extends InputCommand {
	constructor() {
		super();
	}

	onUp(): void {
		gameEventTarget.emit(GameEvent.REDIRECT);
	}
}
