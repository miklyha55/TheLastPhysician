import { _decorator, Component, EventTarget, Node } from "cc";
import GameEvent from "../../enums/GameEvent";
import { gameEventTarget } from "../../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("AuxiliaryComponent")
export class AuxiliaryComponent extends Component {
	@property({}) isStartFromEnable: boolean = false;
	@property({}) isStartFromLoad: boolean = false;
	@property({}) isEventToNode: boolean = false;

	@property({ type: GameEvent }) triggerEvent = GameEvent.NONE;

	protected targetEvent: Node | EventTarget = this.node;

	protected onEnable() {
		this.isStartFromEnable && this.onTriggerEvent();
		this.handleEvents(true);
	}

	protected onDisable() {
		this.handleEvents(false);
	}

	protected start() {
		this.scheduleOnce(() => {
			this.isStartFromLoad && this.onTriggerEvent();
		})
	}

	protected handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";
		this.targetEvent = this.isEventToNode ? this.node : gameEventTarget;

		this.triggerEvent != GameEvent.NONE &&
			this.targetEvent[func](this.triggerEvent, this.onTriggerEvent, this);
	}

	protected onTriggerEvent() {}
}
