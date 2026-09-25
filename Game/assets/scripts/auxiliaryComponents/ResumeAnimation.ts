import { _decorator, Animation } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";

const { ccclass } = _decorator;

@ccclass("ResumeAnimation")
export class ResumeAnimation extends AuxiliaryComponent {
	onTriggerEvent() {
		const animation = this.node.getComponent(Animation);

		if (animation) {
			animation.resume();
		}
	}
}
