import { _decorator, Component } from "cc";
const { ccclass } = _decorator;

@ccclass("World")
export class World extends Component {
	protected onEnable() {
		this._handleEvents(true);
	}

	protected onDisable() {
		this._handleEvents(false);
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";
	}
}
