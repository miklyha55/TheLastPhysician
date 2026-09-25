import { _decorator, Animation } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";

const { ccclass } = _decorator;

@ccclass("PauseAnimation")
export class PauseAnimation extends AuxiliaryComponent {
	onTriggerEvent() {
		const animation = this.node.getComponent(Animation);

		if (animation) {
			animation.pause();
		}
	}
}
