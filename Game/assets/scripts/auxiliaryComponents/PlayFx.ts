import { _decorator, ParticleSystemComponent, Node } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";

const { ccclass } = _decorator;

@ccclass("PlayFx")
export class PlayFx extends AuxiliaryComponent {
	onTriggerEvent() {
		this.node.getComponent(ParticleSystemComponent)?.play();

		this.node.children.forEach((child: Node) => {
			child.getComponent(ParticleSystemComponent)?.play();
		});
	}
}
