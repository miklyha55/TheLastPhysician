import { _decorator, CCInteger } from "cc";
import InputCommand from "./core/InputCommand";
import GameEvent from "../../../enums/GameEvent";
import { gameEventTarget } from "../../../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("RedirectWithCounterCommandProps")
export class RedirectWithCounterCommandProps {
	@property(CCInteger) amount = 0;
}

export default class RedirectWithCounterCommand extends InputCommand {
	_counter: number = 0;

	constructor() {
		super();
	}

	onUp(props: any): void {
		this._counter++;

		this._counter >= props.amount && gameEventTarget.emit(GameEvent.REDIRECT);
	}
}
