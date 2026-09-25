import { _decorator, Component, EventTouch, Node } from "cc";
import GameEvent from "../../enums/GameEvent";
import InputDirection from "./InputDirection";
import InputType from "./InputType";
import { gameEventTarget } from "../../plugins/GameEventTarget";

import { CustomCommandProps } from "./commands/CustomCommand";
import { RedirectWithCounterCommandProps } from "./commands/RedirectWithCounterCommand";

const { ccclass, property } = _decorator;

@ccclass("InputCatcher")
export class InputCatcher extends Component {
	@property({ type: InputDirection }) direction = InputDirection.None;

	@property({
		type: CustomCommandProps,
		visible() {
			return this.direction === InputDirection.Custom;
		},
	})
	curtomProps = new CustomCommandProps();

	@property({
		type: RedirectWithCounterCommandProps,
		visible() {
			return this.direction === InputDirection.RedirectWithCounter;
		},
	})
	redirectWithCounterProps = new RedirectWithCounterCommandProps();

	private _props: any = null;

	protected onEnable() {
		this._handleEvents(true);
	}

	protected onDisable() {
		this._handleEvents(false);
	}

	protected onLoad(): void {
		switch (this.direction) {
			case InputDirection.Custom:
				this._props = this.curtomProps;
				break;
			case InputDirection.RedirectWithCounter:
				this._props = this.redirectWithCounterProps;
				break;
		}
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		this.node[func](Node.EventType.TOUCH_START, this.onDown, this);
		this.node[func](Node.EventType.TOUCH_MOVE, this.onMove, this);
		this.node[func](Node.EventType.TOUCH_END, this.onUp, this);
		this.node[func](Node.EventType.TOUCH_CANCEL, this.onUp, this);
	}

	private onDown(event: EventTouch): void {
		gameEventTarget.emit(GameEvent.INPUT, {
			type: InputType.Down,
			area: this.direction,
			touch: event.touch,
			place: this,
			props: this._props,
		});
	}

	private onMove(event: EventTouch): void {
		gameEventTarget.emit(GameEvent.INPUT, {
			type: InputType.Move,
			area: this.direction,
			touch: event.touch,
			place: this,
			props: this._props,
		});
	}

	private onUp(event: EventTouch): void {
		gameEventTarget.emit(GameEvent.INPUT, {
			type: InputType.Up,
			area: this.direction,
			touch: event.touch,
			place: this,
			props: this._props,
		});
	}
}
