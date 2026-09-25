import { _decorator, Animation, AnimationClip } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";

const { ccclass, property } = _decorator;

@ccclass("StopAnimation")
export class StopAnimation extends AuxiliaryComponent {
	@property(AnimationClip) animationClip: AnimationClip = null;

	onTriggerEvent() {
		const animation = this.node.getComponent(Animation);

		if (animation && this.animationClip) {
			animation.stop(this.animationClip);
		}
	}
}
