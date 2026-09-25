import {
	_decorator,
	math,
	screen,
	v3,
	Camera,
	Component,
	Node,
	Vec3,
	Quat,
	tween,
	CCInteger,
	TweenEasing,
	CCFloat,
} from "cc";
import Utils from "../../utils/Utils";

const { ccclass, property } = _decorator;

@ccclass("CameraManager")
export class CameraManager extends Component {
	@property(Camera) uiCamera: Camera = null;
	@property([Camera]) cameras: Camera[] = [];
	@property(Node) cameraBox: Node = null;
	@property(CCInteger) fovDefault: number = 45;
	@property(CCInteger) orthoHeightDefault: number = 300;
	@property(Node) lookAtTarget: Node | null = null;
	@property({
		visible(this: CameraManager) {
			return !!this.lookAtTarget;
		},
	})
	offsetLookAtTargetTarget: Vec3 = new Vec3();
	@property(Node) followTarget: Node | null = null;
	@property(CCFloat) lerpRatio: number = 0.1;

	static instance: CameraManager = null;

	private _cameraTransform: Node = null;
	private _cameraAnimation: Node = null;

	private _scale: number = 0;
	private _distance: Vec3 = v3();
	private _isStart: boolean = false;

	protected onDestroy(): void {
		if (CameraManager.instance === this) {
			CameraManager.instance = null;
		}
	}

	protected onLoad(): void {
		CameraManager.instance = this;

		this._init();
		this.setDistance();
	}

	private _init() {
		this._cameraTransform = Utils.getChildByName(this.cameraBox, "Transform");
		this._cameraAnimation = Utils.getChildByName(this.cameraBox, "Animation");
	}

	protected update() {
		if (!this.cameras.length || !this.cameraBox) {
			return;
		}

		this._updatePosition();
		this._updateZoom();
		this._updateEuler();

		if (!this._isStart) {
			this._isStart = true;
		}
	}

	setWorldPosition(
		worldPosition: Vec3,
		delay: number = 0,
		callback: () => void = () => {},
		easing: TweenEasing = "linear"
	): void {
		if (!delay) {
			this.cameraBox.setWorldPosition(worldPosition);
			return;
		}

		tween(this.cameraBox)
			.to(delay, { worldPosition }, { easing })
			.call(() => {
				callback instanceof Function && callback();
			})
			.start();
	}

	setRotation(
		eulerAngles: Vec3,
		delay: number = 0,
		callback: () => void = () => {},
		easing: TweenEasing = "linear"
	): void {
		if (!delay) {
			this.cameraBox.eulerAngles = eulerAngles;
			return;
		}

		tween(this.cameraBox)
			.to(delay, { eulerAngles }, { easing })
			.call(() => {
				callback instanceof Function && callback();
			})
			.start();
	}

	setZoom(
		zoom: number,
		delay: number = 0,
		callback: () => void = () => {},
		easing: TweenEasing = "linear"
	): void {
		if (!delay) {
			this.cameraBox.setScale(v3(zoom, zoom, zoom));
			return;
		}

		tween(this.cameraBox)
			.to(delay, { scale: v3(zoom, zoom, zoom) }, { easing })
			.call(() => {
				callback instanceof Function && callback();
			})
			.start();
	}

	setFollowTarget(followTarget: Node): void {
		this.followTarget = followTarget;
		this.setDistance();
	}

	setLookAtTarget(lookAtTarget: Node): void {
		this.lookAtTarget = lookAtTarget;
	}

	setFov(fov: number): void {
		this.cameras.forEach((camera) => {
			camera.fov = fov;
		});
	}

	setCameraBox(cameraBox: Node) {
		this.cameraBox = cameraBox;
		this._init();
	}

	setDistance(distance: Vec3 | null = null): void {
		if (this.followTarget) {
			this._distance = distance
				? distance
				: this.cameraBox.worldPosition
						.clone()
						.subtract(this.followTarget.worldPosition);
		}
	}

	private _direction = new Vec3();
	private _targetRotation = new Quat();
	private _currentRotation = new Quat();

	private _updateEuler(): void {
		this.cameras.forEach((camera) => {
			const offsetX =
				(this._cameraTransform?.eulerAngles.x || 0) +
				(this._cameraAnimation?.eulerAngles.x || 0);
			const offsetY =
				(this._cameraTransform?.eulerAngles.y || 0) +
				(this._cameraAnimation?.eulerAngles.y || 0);
			const offsetZ =
				(this._cameraTransform?.eulerAngles.z || 0) +
				(this._cameraAnimation?.eulerAngles.z || 0);

			const offsetQuat = new Quat();
			Quat.fromEuler(offsetQuat, offsetX, offsetY, offsetZ);

			if (this.lookAtTarget) {
				Vec3.subtract(
					this._direction,
					this.lookAtTarget.worldPosition
						.clone()
						.add(this.offsetLookAtTargetTarget),
					camera.node.worldPosition
				)
					.normalize()
					.negative();

				Quat.fromViewUp(this._targetRotation, this._direction, Vec3.UP);
				Quat.multiply(this._targetRotation, this._targetRotation, offsetQuat);

				camera.node.getWorldRotation(this._currentRotation);

				Quat.slerp(
					this._currentRotation,
					this._currentRotation,
					this._targetRotation,
					this.lerpRatio
				);
				camera.node.setWorldRotation(this._currentRotation);
			} else {
				Quat.fromEuler(
					this._currentRotation,
					this.cameraBox.eulerAngles.x,
					this.cameraBox.eulerAngles.y,
					this.cameraBox.eulerAngles.z
				);

				Quat.multiply(camera.node.rotation, this._currentRotation, offsetQuat);
			}
		});
	}

	private _updateZoom(): void {
		this.cameras.forEach((camera) => {
			const { width, height }: math.Size = screen.resolution;
			const transformScale: Vec3 = this._cameraTransform
				? this._cameraTransform.scale.clone()
				: v3(1, 1, 1);
			const animationScale: Vec3 = this._cameraAnimation
				? this._cameraAnimation.scale.clone()
				: v3(1, 1, 1);

			const tw: number =
				width / (this.cameraBox.scale.x * animationScale.x * transformScale.x);
			const th: number =
				height / (this.cameraBox.scale.y * animationScale.y * transformScale.y);
			const gw: number = width;
			const gh: number = height;
			const zX: number = gw / tw;
			const zY: number = gh / th;

			this._scale = zX < zY ? zX : zY;

			const value: number =
				camera.projection === 1 ? this.fovDefault : this.orthoHeightDefault;
			const func: string = camera.projection === 1 ? "fov" : "orthoHeight";

			camera[func] = this._scale * value;
		});
	}

	private _updatePosition(): void {
		this.cameras.forEach((camera) => {
			if (this.followTarget) {
				let followTargetWorldPosition: Vec3 = v3();
				this.followTarget.getWorldPosition(followTargetWorldPosition);

				this.cameraBox.setWorldPosition(
					followTargetWorldPosition.clone().add(this._distance)
				);
			}

			const transformPosition: Vec3 = this._cameraTransform
				? this._cameraTransform.worldPosition.clone()
				: v3();
			const animationPosition: Vec3 = this._cameraAnimation
				? this._cameraAnimation.worldPosition.clone()
				: v3();

			let cameraBoxWorldPosition: Vec3 = v3();
			this.cameraBox.getWorldPosition(cameraBoxWorldPosition);
			cameraBoxWorldPosition
				.subtract(cameraBoxWorldPosition.clone().subtract(animationPosition))
				.clone()
				.subtract(cameraBoxWorldPosition.clone().subtract(transformPosition));

			camera.node.setWorldPosition(
				this._isStart
					? camera.node.worldPosition
							.clone()
							.lerp(cameraBoxWorldPosition, this.lerpRatio)
					: cameraBoxWorldPosition
			);
		});
	}
}
