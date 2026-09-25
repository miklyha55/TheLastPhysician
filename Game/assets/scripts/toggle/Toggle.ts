import { _decorator, Component } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("Toggle")
export class Toggle extends Component {
	@property({ type: GameEvent }) triggerEvent = GameEvent.NONE;
	@property({}) isActive: boolean = false;

	onLoad() {
		this._handleEvents(true);
	}

	onDestroy() {
		this._handleEvents(false);
	}

	start() {
		this.onTriggerEvent(this.isActive);
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		this.triggerEvent != GameEvent.NONE &&
			gameEventTarget[func](this.triggerEvent, this.onTriggerEvent, this);
	}

	private onTriggerEvent(active: boolean): void {
		if ((active && this.node.active) || (!active && !this.node.active)) {
			return;
		}

		this.node.active = active;
	}
}
