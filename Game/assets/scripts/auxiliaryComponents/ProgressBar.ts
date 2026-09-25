import {
	_decorator,
	CCBoolean,
	Component,
	Node,
	Size,
	tween,
	UITransform,
	v3,
	Vec3,
} from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("ProgressBar")
export class ProgressBar extends Component {
	@property({ type: GameEvent }) setProgressValue = GameEvent.NONE;
	@property({ type: Node }) active = null;
	@property({ type: Node }) border = null;
	@property({ type: GameEvent }) handleEvent = GameEvent.NONE;
	@property(CCBoolean) isWidth = true;

	private _uITransform: UITransform;
	private _value: number = 0;

	onDestroy() {
		this._handleSubscription(false);
	}

	onLoad() {
		if (this.active) {
			this._uITransform = this.active.getComponent(UITransform)
				? this.active.getComponent(UITransform)
				: this.active.addComponent(UITransform);

			const size: Size = new Size(
				this._uITransform.width,
				this._uITransform.height
			);
			this._value = this.isWidth
				? this._uITransform.width
				: this._uITransform.height;
		}

		this._handleSubscription(true);
	}

	private _handleSubscription(active: boolean) {
		const func: string = active ? "on" : "off";

		if (this.setProgressValue !== GameEvent.NONE) {
			gameEventTarget[func](
				this.setProgressValue,
				this.onSetProgressValue,
				this
			);
		}
	}

	onSetProgressValue(value: number, delay: number = 0): void {
		value = Math.max(0, Math.min(1, value));

		if (this._uITransform) {
			const borderPosition: Vec3 = v3(-this._value / 2, -this._value / 2, 0)
				.clone()
				.multiply(v3(this.isWidth ? 1 : 0, !this.isWidth ? 0 : 1, 0));

			if (delay) {
				tween(this._uITransform)
					.to(delay, {
						[this.isWidth ? "width" : "height"]: value * this._value,
					})
					.call(() => {
						gameEventTarget.emit(this.handleEvent);
					})
					.start();

				if (this.border) {
					tween(this.border)
						.to(delay, {
							position: borderPosition
								.clone()
								.add(v3(value * this._value, value * this._value, 0))
								.clone()
								.multiply(v3(this.isWidth ? 1 : 0, !this.isWidth ? 0 : 1, 0)),
						})
						.start();
				}
			} else {
				this._uITransform[this.isWidth ? "width" : "height"] =
					value * this._value;

				if (this.border) {
					this.border.position = borderPosition;
				}
			}
		}
	}
}
