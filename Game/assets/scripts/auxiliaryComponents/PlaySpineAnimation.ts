import { _decorator, Animation, AnimationClip } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";
import GameEvent from "../enums/GameEvent";

const { ccclass, property } = _decorator;

@ccclass("PlaySpineAnimation")
export class PlaySpineAnimation extends AuxiliaryComponent {
	@property(AnimationClip) animationClip: AnimationClip = null;
	@property({ type: GameEvent }) handlerEvent = GameEvent.NONE;

	onTriggerEvent() {
		const animation = this.node.getComponent(Animation);

		if (animation && this.animationClip) {
			animation.play(this.animationClip.name);
			animation.once(Animation.EventType.FINISHED, () => {
				this.handlerEvent !== GameEvent.NONE &&
					this.targetEvent.emit(String(this.handlerEvent));
			});
		}
	}
}
