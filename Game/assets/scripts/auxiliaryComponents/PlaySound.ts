import { _decorator, CCString } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";
import { AudioManager } from "../managers/audio/AudioManager";

const { ccclass, property } = _decorator;

@ccclass("PlaySound")
export class PlaySound extends AuxiliaryComponent {
	@property(CCString) soundName: string = "";

	onTriggerEvent() {
		AudioManager.instance.play(this.soundName);
	}
}
