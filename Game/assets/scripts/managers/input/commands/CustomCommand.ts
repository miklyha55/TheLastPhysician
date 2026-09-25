import { _decorator, Enum } from "cc";
import { EventTouch } from "cc";
import InputCommand from "./core/InputCommand";
import { InputCatcher } from "../InputCatcher";
import { gameEventTarget } from "../../../plugins/GameEventTarget";
import GameEvent from "../../../enums/GameEvent";

const { ccclass, property } = _decorator;

@ccclass("CustomCommandProps")
export class CustomCommandProps {
	@property({
		type: Enum(GameEvent),
	})
	downHandlerEvent = GameEvent.NONE;

	@property({
		type: Enum(GameEvent),
	})
	moveHandlerEvent = GameEvent.NONE;

	@property({
		type: Enum(GameEvent),
	})
	upHandlerEvent = GameEvent.NONE;
}

export default class CustomCommand extends InputCommand {
	constructor() {
		super();
	}

	onDown(props: any, touch: EventTouch, place: InputCatcher): void {
		props.downHandlerEvent &&
			gameEventTarget.emit(props.downHandlerEvent, touch, place);
	}

	onMove(props: any, touch: EventTouch, place: InputCatcher): void {
		props.moveHandlerEvent &&
			gameEventTarget.emit(props.moveHandlerEvent, touch, place);
	}

	onUp(props: any, touch: EventTouch, place: InputCatcher): void {
		props.upHandlerEvent &&
			gameEventTarget.emit(props.upHandlerEvent, touch, place);
	}
}
