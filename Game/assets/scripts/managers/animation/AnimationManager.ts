import { _decorator, Animation, AnimationClip, Component } from "cc";

const { ccclass, property } = _decorator;

@ccclass("AnimationPreset")
class AnimationPreset {
	@property({})
	get id() {
		return this._id;
	}
	set id(value: string) {
		this._id = value;
	}

	@property(Animation) animation: Animation = null;

	@property({ type: AnimationClip })
	get clip() {
		return this._clip;
	}
	set clip(value: AnimationClip) {
		if (value) {
			this._id = value.name;
			this._clip = value;
		}
	}

	@property private _id: string = "";
	@property private _clip: AnimationClip = null;
}

@ccclass("AnimationManager")
export class AnimationManager extends Component {
	@property([AnimationPreset]) animationPresets: AnimationPreset[] = [];
	@property defaultTransitionDuration: number = 0.3;

	play(
		id: string,
		callback: () => void = null,
		transitionDuration: number = null
	) {
		const animationPreset: AnimationPreset | void =
			this._findAnimationPresetById(id);

		const duration =
			transitionDuration !== null
				? transitionDuration
				: this.defaultTransitionDuration;

		if (animationPreset) {
			if (duration > 0) {
				animationPreset.animation.crossFade(
					animationPreset.clip.name,
					duration
				);
			} else {
				animationPreset.animation.play(animationPreset.clip.name);
			}

			animationPreset.animation.once(Animation.EventType.FINISHED, () => {
				callback instanceof Function && callback();
			});
		} else {
			this._catchWarn();
		}
	}

	stop(id: string) {
		const animationPreset: AnimationPreset | void =
			this._findAnimationPresetById(id);

		if (animationPreset) {
			animationPreset.animation.stop();
		} else {
			this._catchWarn();
		}
	}

	stopAll() {
		this.animationPresets.forEach((animationPreset) => {
			try {
				animationPreset.animation.stop();
			} catch (error) {
				this._catchWarn();
			}
		});
	}

	private _catchWarn() {
		console.warn("Please, add Animation component to animation preset");
	}

	private _findAnimationPresetById(id: string): AnimationPreset | void {
		return this.animationPresets.find(
			(animationPreset) => animationPreset.id === id
		);
	}
}
