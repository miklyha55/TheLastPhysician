import { _decorator, instantiate, Node, Prefab } from "cc";
import { AuxiliaryComponent } from "./core/AuxiliaryComponent";
import GameEvent from "../enums/GameEvent";

const { ccclass, property } = _decorator;

@ccclass("CreateNode")
export class CreateNode extends AuxiliaryComponent {
	@property(Prefab) prefab: Prefab = null;
	@property({ type: GameEvent }) removeEvent = GameEvent.NONE;

	onTriggerEvent() {
		const node: Node = instantiate(this.prefab);

		node.parent = this.node;
		node.worldPosition = this.node.worldPosition;
	}
}
