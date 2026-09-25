import { _decorator, Component, EventTouch } from "cc";
import GameEvent from "../../enums/GameEvent";
import InputDirection from "./InputDirection";
import InputType from "./InputType";
import { InputCatcher } from "./InputCatcher";
import { gameEventTarget } from "../../plugins/GameEventTarget";

import InputCommand from "./commands/core/InputCommand";
import CustomCommand from "./commands/CustomCommand";
import RedirectCommand from "./commands/RedirectCommand";
import RedirectWithCounterCommand from "./commands/RedirectWithCounterCommand";

const { ccclass } = _decorator;

interface IROInputParams {
	readonly type: (typeof InputType)[keyof typeof InputType];
	readonly area: (typeof InputDirection)[keyof typeof InputDirection];
	readonly touch: EventTouch;
	readonly place: InputCatcher;
	readonly props: any;
}

@ccclass("InputManager")
export class InputManager extends Component {
	private _commands = [];
	private _isFirstTap = false;

	protected onLoad() {
		gameEventTarget.on(GameEvent.INPUT, this.onInput, this);

		this._commands[InputDirection.Custom] = new CustomCommand();
		this._commands[InputDirection.Redirect] = new RedirectCommand();
		this._commands[InputDirection.RedirectWithCounter] =
			new RedirectWithCounterCommand();
	}

	protected onDestroy() {
		gameEventTarget.off(GameEvent.INPUT, this.onInput, this);
	}

	private onInput(params: IROInputParams): void {
		const { type, area, touch, place, props } = params;

		if (!this._isFirstTap) {
			this._isFirstTap = true;

			gameEventTarget.emit(GameEvent.FIRST_TAP);
		}

		const command: InputCommand = this._commands[area];

		switch (type) {
			case InputType.Down:
				if (command) {
					command.onDown(props, touch, place);
				}
				break;

			case InputType.Move:
				if (command) {
					command.onMove(props, touch, place);
				}
				break;

			case InputType.Up:
				if (command) {
					command.onUp(props, touch, place);
				}
				break;
		}
	}
}
