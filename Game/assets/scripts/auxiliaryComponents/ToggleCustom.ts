import {
	_decorator,
	AnimationClip,
	CCBoolean,
	Component,
	Animation,
} from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("ToggleCustom")
export class ToggleCustom extends Component {
	@property({ type: GameEvent }) triggerEvent = GameEvent.NONE;
	@property(CCBoolean) isActive: boolean = false;
	@property(CCBoolean) isInverse: boolean = false;

	@property(Animation) hideAnimation: Animation = null;
	@property({
		type: AnimationClip,
		visible() {
			return this.hideAnimation !== null;
		},
	})
	hideAnimationClip: AnimationClip = null;

	onLoad() {
		this._handleEvents(true);
	}

	onDestroy() {
		this._handleEvents(false);
	}

	start() {
		this.onTriggerEvent(this.isActive, true);
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		this.triggerEvent != GameEvent.NONE &&
			gameEventTarget[func](this.triggerEvent, this.onTriggerEvent, this);
	}

	private onTriggerEvent(active: boolean, isStart: boolean = false): void {
		active = this.isInverse ? !active : active;

		if ((active && this.node.active) || (!active && !this.node.active)) {
			return;
		}

		if (!active && this.hideAnimationClip && !isStart) {
			const animation = this.hideAnimation.getComponent(Animation);

			animation.play(this.hideAnimationClip.name);
			animation.once(Animation.EventType.FINISHED, () => {
				this.node.active = active;
			});
			return;
		}

		this.node.active = active;
	}
}
