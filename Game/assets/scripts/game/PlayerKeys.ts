import { _decorator, Component } from "cc";

const { ccclass } = _decorator;

// The keys the player carries. A key stays once picked up and opens every door of its colour.
@ccclass("PlayerKeys")
export class PlayerKeys extends Component {
	static instance: PlayerKeys = null;

	private _colors = new Set<number>();

	protected onLoad(): void {
		PlayerKeys.instance = this;
	}

	protected onDestroy(): void {
		if (PlayerKeys.instance === this) {
			PlayerKeys.instance = null;
		}
	}

	has(color: number): boolean {
		return this._colors.has(color);
	}

	add(color: number): void {
		this._colors.add(color);
	}
}
