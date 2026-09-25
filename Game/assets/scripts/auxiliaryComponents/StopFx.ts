import { _decorator, ParticleSystemComponent, Node } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";

const { ccclass } = _decorator;

@ccclass("StopFx")
export class StopFx extends AuxiliaryComponent {
	onTriggerEvent() {
		const particleSystem = this.node.getComponent(ParticleSystemComponent);

		particleSystem?.clear();
		particleSystem?.stop();

		this.node.children.forEach((child: Node) => {
			const particleSystem = child.getComponent(ParticleSystemComponent);

			particleSystem?.clear();
			particleSystem?.stop();
		});
	}
}
