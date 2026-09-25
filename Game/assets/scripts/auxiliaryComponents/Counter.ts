import { _decorator, Component, Label, Animation, CCBoolean } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("Counter")
export class Counter extends Component {
	@property({ type: GameEvent }) setCounter = GameEvent.NONE;
	@property({ type: GameEvent }) getCounter = GameEvent.NONE;
	@property(Label) label = null;
	@property(CCBoolean) isAccumulate: boolean = false;

	private _value: number = 0;

	onEnable() {
		this._handleEvents(true);
	}

	onDisable() {
		this._handleEvents(false);
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		this.setCounter !== GameEvent.NONE &&
		gameEventTarget[func](this.setCounter, this.onSetCounter, this);
		this.getCounter !== GameEvent.NONE &&
			gameEventTarget[func](this.getCounter, this.onGetCounter, this);
	}

	onSetCounter(value: number): void {
		this._value = this.isAccumulate ? this._value + value : value;

		if (this.label) {
			this.label.string = String(this._value);
		}

		this.label.node.getComponent(Animation)?.play();
	}

	onGetCounter(callback: (value: number) => void): void {
		callback instanceof Function && callback(this._value);
	}
}
