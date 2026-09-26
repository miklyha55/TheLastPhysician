import { _decorator, AnimationClip, AnimationState, Component, SkeletalAnimation } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

const RUN = "run";
const IDLE = "idle";
const SHOOTING = "shooting";

// Runs while a finger that touched the screen is being dragged, idles once it lifts. On
// PlayerAttack's word it plays the shooting clip once, standing, and goes back to idling.
// Listens to the same input events the joystick does.
@ccclass("AnimationController")
export class AnimationController extends Component {
	@property(SkeletalAnimation) animation: SkeletalAnimation = null;
	@property(AnimationClip) runClip: AnimationClip = null;
	@property(AnimationClip) idleClip: AnimationClip = null;
	@property(AnimationClip) shootingClip: AnimationClip = null;
	@property({ tooltip: "Playback speed of the shooting clip; 2 — a shot takes half the clip's time" })
	shootingSpeed: number = 1;
	@property({ tooltip: "Blend between clips, seconds" })
	crossFade: number = 0.2;

	private _pressed: boolean = false;
	private _current: string = null;
	private _override: string = null;

	protected onLoad(): void {
		this.animation = this.animation || this.getComponent(SkeletalAnimation);
		// Both clips come from Mixamo under the same name, so each gets a state of its own.
		this._createState(this.runClip, RUN);
		this._createState(this.idleClip, IDLE);
		// GunSocket may have made the shooting state already; it watches it to arm the hand.
		if (this.animation && !this.animation.getState(SHOOTING)) {
			this._createState(this.shootingClip, SHOOTING);
		}
	}

	protected onEnable() {
		this._handleEvents(true);
	}

	protected onDisable() {
		this._handleEvents(false);
	}

	protected start(): void {
		const shooting = this.animation && this.animation.getState(SHOOTING);
		if (shooting) {
			shooting.wrapMode = AnimationClip.WrapMode.Normal;
			shooting.speed = this.shootingSpeed;
		}
		this._play(IDLE);
	}

	/**
	 * One shot, standing: the shooting clip from its start, then idle again. Returns how long
	 * the clip takes, or 0 when the player is running or there is no clip.
	 */
	shoot(): number {
		const state = this.animation && this.animation.getState(SHOOTING);
		if (this._pressed || !state) {
			return 0;
		}
		this.unschedule(this._backToIdle);
		if (this._current === SHOOTING) {
			this.animation.play(SHOOTING);
		} else {
			this._play(SHOOTING);
		}
		const duration = state.duration / (state.speed || 1);
		this.scheduleOnce(this._backToIdle, Math.max(0, duration - this.crossFade));
		return duration;
	}

	/**
	 * Plays a clip of its own over run and idle — a throw, a jump — at `speed`, from its start;
	 * the stick does not change it until `release`. Returns how long it takes, seconds.
	 */
	override(clip: AnimationClip, name: string, speed: number): number {
		if (!this.animation || !clip) {
			return 0;
		}
		let state = this.animation.getState(name);
		if (!state) {
			state = this.animation.createState(clip, name);
		}
		state.wrapMode = AnimationClip.WrapMode.Normal;
		state.speed = speed;
		this.unschedule(this._backToIdle);
		this._override = name;
		this._current = name;
		this.animation.crossFade(name, 0.08);
		return state.duration / (speed || 1);
	}

	/** Back to running or idling, whichever the stick says. */
	release(): void {
		this._override = null;
		this._current = null;
		this._play(this._pressed ? RUN : IDLE);
	}

	private _backToIdle(): void {
		if (!this._pressed) {
			this._play(IDLE);
		}
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		gameEventTarget[func](GameEvent.JOYSTICK_DOWN, this.onDown, this);
		gameEventTarget[func](GameEvent.JOYSTICK_MOVE, this.onMove, this);
		gameEventTarget[func](GameEvent.JOYSTICK_UP, this.onUp, this);
	}

	private onDown(): void {
		this._pressed = true;
	}

	private onMove(): void {
		if (this._pressed) {
			this.unschedule(this._backToIdle);
			this._play(RUN);
		}
	}

	private onUp(): void {
		this._pressed = false;
		this._play(IDLE);
	}

	private _createState(clip: AnimationClip, name: string): void {
		if (!this.animation || !clip) {
			return;
		}
		const state: AnimationState = this.animation.createState(clip, name);
		state.wrapMode = AnimationClip.WrapMode.Loop;
	}

	private _play(name: string): void {
		if (this._override || !this.animation || this._current === name || !this.animation.getState(name)) {
			return;
		}
		this._current = name;
		this.animation.crossFade(name, this.crossFade);
	}
}
