import { _decorator, Component, Sprite, tween } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("RadialProgressSprite")
export class RadialProgressSprite extends Component {
	@property({ type: GameEvent })
	setProgressValue = GameEvent.NONE;

	@property({ type: GameEvent })
	handleEvent = GameEvent.NONE;

	@property(Sprite)
	sprite: Sprite | null = null;

	onLoad() {
		if (!this.sprite) {
			this.sprite = this.getComponent(Sprite);
		}

		this.initSprite();
		this.setProgress(0);
		this._handleSubscription(true);
	}

	onDestroy() {
		this._handleSubscription(false);
	}

	private initSprite() {
		if (!this.sprite) return;

		this.sprite.type = Sprite.Type.FILLED;
		this.sprite.fillType = Sprite.FillType.RADIAL;
		this.sprite.fillStart = 0.25;
		this.sprite.fillRange = 0;
	}

	private _handleSubscription(active: boolean) {
		const func: "on" | "off" = active ? "on" : "off";

		if (this.setProgressValue !== GameEvent.NONE) {
			gameEventTarget[func](
				this.setProgressValue,
				this.onSetProgressValue,
				this
			);
		}
	}

	onSetProgressValue(value: number, delay: number = 0) {
		value = Math.max(0, Math.min(1, value));

		if (delay > 0) {
			const props: { value: number } = {
				value: this.sprite.fillRange,
			};
			tween(props)
				.to(
					delay,
					{ value },
					{
						onUpdate: () => {
							this.setProgress(props.value);
						},
					}
				)
				.call(() => {
					gameEventTarget.emit(this.handleEvent);
				})
				.start();
		} else {
			this.setProgress(value);
		}
	}

	private setProgress(value: number) {
		if (this.sprite) {
			this.sprite.fillRange = value;
		}
	}
}
