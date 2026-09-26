import { _decorator, AnimationClip, Component, Node, SkeletalAnimation, v3, Vec3 } from "cc";

const { ccclass, property } = _decorator;

const SHOOTING = "shooting";

// Keeps the gun in the right hand while the shooting animation plays and slung on the back
// for every other one. Both places are sockets of the player's SkeletalAnimation, so the gun
// follows the bones even with baked animation; the gun is moved between them and takes the
// pose it has in each. The shooting clip is registered as the "shooting" state — play it with
// crossFade("shooting") and the gun goes to hand by itself.
@ccclass("GunSocket")
export class GunSocket extends Component {
	@property(SkeletalAnimation) animation: SkeletalAnimation = null;
	@property(AnimationClip) shootingClip: AnimationClip = null;
	@property({ type: Node, tooltip: "Socket on the right hand" }) handSocket: Node = null;
	@property({ type: Node, tooltip: "Socket on the back (Spine2)" }) backSocket: Node = null;
	@property handPosition: Vec3 = v3();
	@property handEuler: Vec3 = v3();
	@property backPosition: Vec3 = v3();
	@property backEuler: Vec3 = v3();

	private _inHand: boolean = null;

	protected onLoad(): void {
		if (this.animation && this.shootingClip && !this.animation.getState(SHOOTING)) {
			this.animation.createState(this.shootingClip, SHOOTING);
		}
	}

	protected start(): void {
		this._place(false);
	}

	protected lateUpdate(): void {
		const state = this.animation && this.animation.getState(SHOOTING);
		// While blending in and out, the gun changes hands at the half-way point.
		const shooting = !!state && state.isPlaying && state.weight >= 0.5;
		if (shooting !== this._inHand) {
			this._place(shooting);
		}
	}

	private _place(inHand: boolean): void {
		const socket = inHand ? this.handSocket : this.backSocket;
		if (!socket) {
			return;
		}
		this._inHand = inHand;
		this.node.setParent(socket, false);
		const position = inHand ? this.handPosition : this.backPosition;
		const euler = inHand ? this.handEuler : this.backEuler;
		this.node.setPosition(position);
		this.node.setRotationFromEuler(euler.x, euler.y, euler.z);
	}
}
