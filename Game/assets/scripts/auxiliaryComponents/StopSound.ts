import { _decorator, CCString } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";
import { AudioManager } from "../managers/audio/AudioManager";

const { ccclass, property } = _decorator;

@ccclass("StopSound")
export class StopSound extends AuxiliaryComponent {
	@property(CCString) soundName: string = "";

	onTriggerEvent() {
		AudioManager.instance.stop(this.soundName);
	}
}
