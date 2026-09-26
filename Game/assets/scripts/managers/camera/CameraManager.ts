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
	director,
} from "cc";
import Utils from "../../utils/Utils";

const { ccclass, property } = _decorator;

/** Smooth noise in -1..1: the same whole number always gives the same value, so the track never tears. */
function wobble(t: number): number {
	const step = Math.floor(t);
	const part = t - step;
	const at = (n: number) => {
		const s = Math.sin(n * 127.1) * 43758.5453;
		return (s - Math.floor(s)) * 2 - 1;
	};
	const k = part * part * (3 - 2 * part);
	return at(step) + (at(step + 1) - at(step)) * k;
}

@ccclass("CameraManager")
export class CameraManager extends Component {
	@property(Camera) uiCamera: Camera = null;
	@property([Camera]) cameras: Camera[] = [];
	@property(Node) cameraBox: Node = null;
	@property(CCInteger) fovDefault: number = 45;
	@property(CCFloat) orthoHeightDefault: number = 300;
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
	private _orbitSpeed: number = 0;
	// Shake: seconds left, over how long it dies away, the strength it started at, and a
	// time of its own for the noise, never reset so the track never jumps.
	private _shake: number = 0;
	private _shakeFor: number = 1;
	private _shakePower: number = 0;
	private _shakeTime: number = Math.random() * 100;
	private _cameraBase = new Vec3();
	private _baseSet = false;
	@property({ type: CCFloat, tooltip: "Shakes per second: lower is heavier, higher is finer" })
	shakeRate: number = 11;
	@property({ type: CCFloat, tooltip: "How much weaker the shake is up and down than across" })
	shakeLift: number = 0.6;

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

	protected update(dt: number) {
		if (!this.cameras.length || !this.cameraBox) {
			return;
		}

		if (this._orbitSpeed && this.followTarget) {
			Vec3.rotateY(this._distance, this._distance, Vec3.ZERO, math.toRadian(this._orbitSpeed * dt));
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

	/**
	 * Shakes the camera by up to `power` world units, dying away over `seconds`. A stronger
	 * jolt replaces a weaker one rather than adding to it; an equal one keeps it going.
	 */
	shake(power: number, seconds: number): void {
		if (power < this._shakePower && this._shake > 0) {
			return;
		}
		this._shake = seconds;
		this._shakeFor = seconds;
		this._shakePower = power;
	}

	/** Circles round the target at the current distance, looking at it; 0 degrees per second stops. */
	orbit(target: Node, degreesPerSecond: number, lookAtOffset: Vec3 = new Vec3()): void {
		if (this.followTarget !== target) {
			this.setFollowTarget(target);
		}
		this.lookAtTarget = target;
		this.offsetLookAtTargetTarget.set(lookAtOffset);
		this._orbitSpeed = degreesPerSecond;
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
	// Scratch values reused every frame, so following the player makes no garbage.
	private _offsetQuat = new Quat();
	private _lookAt = new Vec3();
	private _boxAt = new Vec3();
	private _cameraAt = new Vec3();
	private static readonly ONE = v3(1, 1, 1);

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

			const offsetQuat = this._offsetQuat;
			Quat.fromEuler(offsetQuat, offsetX, offsetY, offsetZ);

			if (this.lookAtTarget) {
				Vec3.subtract(
					this._direction,
					Vec3.add(this._lookAt, this.lookAtTarget.worldPosition, this.offsetLookAtTargetTarget),
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
			const transformScale: Readonly<Vec3> = this._cameraTransform
				? this._cameraTransform.scale
				: CameraManager.ONE;
			const animationScale: Readonly<Vec3> = this._cameraAnimation
				? this._cameraAnimation.scale
				: CameraManager.ONE;

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
				Vec3.add(this._boxAt, this.followTarget.worldPosition, this._distance);
				this.cameraBox.setWorldPosition(this._boxAt);
			}

			// Where the camera goes is the Animation child of the camera box, or the origin
			// without one — the same place the chain of box and child offsets came to before.
			const target = this._cameraAnimation
				? this._boxAt.set(this._cameraAnimation.worldPosition)
				: this._boxAt.set(0, 0, 0);

			// The follow runs on the unshaken place, and the shake goes on top of it, so the
			// frame jerks but stays looking where it did and settles exactly back.
			if (!this._baseSet) {
				this._cameraBase.set(camera.node.worldPosition);
				this._baseSet = true;
			}
			if (this._isStart) {
				Vec3.lerp(this._cameraBase, this._cameraBase, target, this.lerpRatio);
			} else {
				this._cameraBase.set(target);
			}
			this._cameraAt.set(this._cameraBase);
			this._shakeStep(this._cameraAt);
			camera.node.setWorldPosition(this._cameraAt);
		});
	}

	private _shakeStep(at: Vec3): void {
		if (this._shake <= 0) {
			return;
		}
		const dt = director.getDeltaTime();
		this._shake = Math.max(0, this._shake - dt);
		this._shakeTime += dt * this.shakeRate;
		const left = this._shake / this._shakeFor;
		const amount = this._shakePower * left * left; // dies away softly
		// A track per axis, far apart on the noise, so the frame rocks instead of sliding.
		at.x += wobble(this._shakeTime) * amount;
		at.y += wobble(this._shakeTime + 31.7) * amount * this.shakeLift;
		at.z += wobble(this._shakeTime + 74.3) * amount;
		if (this._shake === 0) {
			this._shakePower = 0;
		}
	}
}
