import { _decorator, CCFloat } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";
import GameEvent from "../enums/GameEvent";

const { ccclass, property } = _decorator;

@ccclass("SetScheduleOnce")
export class SetScheduleOnce extends AuxiliaryComponent {
	@property(CCFloat) delay: number = 0;
	@property({ type: GameEvent }) handlerEvent = GameEvent.NONE;

	onTriggerEvent() {
		this.scheduleOnce(() => {
			this.handlerEvent !== GameEvent.NONE &&
				this.targetEvent.emit(String(this.handlerEvent));
		}, this.delay);
	}
}
