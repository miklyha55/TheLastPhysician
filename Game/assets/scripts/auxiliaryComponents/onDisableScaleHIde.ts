import { _decorator, Component, v3 } from "cc";
const { ccclass } = _decorator;

@ccclass("onDisableScaleHIde")
export class onDisableScaleHIde extends Component {
	protected onDisable() {
		this.node.scale = v3();
	}
}
