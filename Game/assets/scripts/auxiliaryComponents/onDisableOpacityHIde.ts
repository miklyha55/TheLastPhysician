import { _decorator, Component, UIOpacity, v3 } from "cc";
const { ccclass } = _decorator;

@ccclass("onDisableOpacityHIde")
export class onDisableOpacityHIde extends Component {
	protected onDisable() {
		const uiOpacity = this.node.getComponent(UIOpacity);
		uiOpacity && (uiOpacity.opacity = 0);
	}
}
