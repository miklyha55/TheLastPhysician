import { _decorator, Component, Node, v3, Vec3 } from "cc";
const { ccclass, property } = _decorator;

declare const CC_EDITOR: boolean;

@ccclass("CameraHelperInEditor")
export class CameraHelperInEditor extends Component {
	@property
	@property
	@property
	get updateNow() {
		return this._updateNow;
	}

	set updateNow(val: boolean) {
		if (CC_EDITOR && val) {
			this.updateCamera();
		}
		this._updateNow = false;
	}

	updateCamera() {
		if (!this.target) return;

		this.target.setWorldPosition(this.node.worldPosition);
		this.target.eulerAngles = this.node.eulerAngles;
		this.target.scale = this.node.scale;

		if (this.lookAtTarget) {
			const pos = this.lookAtTarget.worldPosition
				.clone()
				.add(this.offsetLookAtTargetTarget);

			this.target.lookAt(pos);
			this.node.lookAt(pos);
		}
	}

	@property(Node) target: Node = null;
	@property(Node) lookAtTarget: Node = null;
	@property(Vec3) offsetLookAtTargetTarget: Vec3 = v3(0, 0, 0);

	private _updateNow = false;
}
