import { _decorator, Camera, Component, Vec3, Node, UIOpacity } from "cc";
import { CameraManager } from "../managers/camera/CameraManager";
const { ccclass, property } = _decorator;

@ccclass("PinUiToWorld")
export class PinUiToWorld extends Component {
	@property(Node) worldNode: Node = null;
	@property(Camera) cameraWorld: Camera = null;
	@property(Camera) cameraUi: Camera = null;
	@property(Vec3) offset: Vec3 = new Vec3(0, 0, 0);

	protected onEnable(): void {
		const uiOpacity =
			this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);

		uiOpacity.opacity = 0;
		this.scheduleOnce(() => {
			uiOpacity.opacity = 255;
		}, 0.05);
	}

	protected update(): void {
		if (!this.worldNode || !this.cameraWorld || !this.worldNode.isValid) return;

		const coef: number =
			CameraManager.instance.fovDefault /
			this.cameraWorld.getComponent(Camera).fov;

		this.node.worldPosition = this.convertFromWorldToUiPosition(
			this.worldNode.worldPosition.clone().add(this.offset.clone())
		);
	}

	private convertFromWorldToUiPosition(worldPositon: Vec3): Vec3 {
		return this.cameraUi.screenToWorld(
			this.cameraWorld.worldToScreen(worldPositon)
		);
	}
}
