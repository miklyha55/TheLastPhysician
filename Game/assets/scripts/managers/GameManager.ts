import { _decorator, Component, director } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("GameManager")
export class GameManager extends Component {
	@property({}) iosUrl: string = "";
	@property({}) androidUrl: string = "";

	protected onEnable() {
		this._handleEvents(true);
	}

	protected onDisable() {
		this._handleEvents(false);
	}

	private static _instance: GameManager = null;

	protected onLoad(): void {
		// Every level scene has one; the first lives on through them all, the others go.
		if (GameManager._instance && GameManager._instance.isValid) {
			this.node.destroy();
			return;
		}
		GameManager._instance = this;
		director.addPersistRootNode(this.node);
	}

	protected start(): void {
		if (GameManager._instance !== this) {
			return;
		}
		const body = document.body;
		const loaderElement = Array.from(
			body.getElementsByClassName("loader_c")
		)[0];
		try {
			body.removeChild(loaderElement);
		} catch (e) {
			console.log("remove loader");
		}

		//@ts-ignore
		window.gameReady && window.gameReady();
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		gameEventTarget[func](GameEvent.REDIRECT, this.onRedirect, this);
	}

	private onRedirect(): void {
		//@ts-ignore
		window.gameEnd && window.gameEnd();

		const userAgent: string = navigator.userAgent;
		const isAndroid: boolean = /android/i.test(userAgent);
		const url: string = isAndroid ? this.androidUrl : this.iosUrl;

		try {
			//@ts-ignore
			window.callToAction();
		} catch (e) {
			console.log("Have error in redirect", e);

			if (isAndroid) {
				window.open(url, "_blank");
			} else {
				window.location.href = url;
			}
		}
	}
}
