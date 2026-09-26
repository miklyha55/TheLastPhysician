import { _decorator, Component } from "cc";

const { ccclass } = _decorator;

// The keys the player carries, counted by colour. One key opens one door: it is spent on it.
@ccclass("PlayerKeys")
export class PlayerKeys extends Component {
	static instance: PlayerKeys = null;

	private _counts = new Map<number, number>();

	protected onLoad(): void {
		PlayerKeys.instance = this;
	}

	protected onDestroy(): void {
		if (PlayerKeys.instance === this) {
			PlayerKeys.instance = null;
		}
	}

	has(color: number): boolean {
		return (this._counts.get(color) || 0) > 0;
	}

	add(color: number): void {
		this._counts.set(color, (this._counts.get(color) || 0) + 1);
	}

	/** Spends a key of this colour; false when there is none. */
	take(color: number): boolean {
		if (!this.has(color)) {
			return false;
		}
		this._counts.set(color, this._counts.get(color) - 1);
		return true;
	}
}
