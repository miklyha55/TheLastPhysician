import { _decorator, AudioClip, AudioSource, Component } from "cc";
import GameEvent from "../../enums/GameEvent";
import { gameEventTarget } from "../../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

@ccclass("AudioPreset")
class AudioPreset {
	@property({})
	get id() {
		return this._id;
	}
	set id(value: string) {
		this._id = value;
	}

	@property({ type: AudioClip })
	get clip() {
		return this._clip;
	}
	set clip(value: AudioClip) {
		if (value) {
			this._id = value.name;
			this._clip = value;
		}
	}

	@property({
		visible() {
			return this.clip;
		},
	})
	isLoop: boolean = false;

	@property({
		visible() {
			return this.clip;
		},
	})
	volume: number = 1;

	@property private _id: string = "";
	@property private _clip: AudioClip = null;
}

@ccclass("AudioManager")
export class AudioManager extends Component {
	@property([AudioPreset]) audioPresets = [];

	static instance: AudioManager = null;
	private _volume: number = 0;
	private _audioSources: AudioSource[] = [];
	private _onSetAudioVolumeWindow: (event: Event) => void = null;

	protected onEnable() {
		this._handleSubscription(true);

		// Храним стабильную ссылку на обработчик, иначе removeEventListener не
		// сможет его снять (bind каждый раз создаёт новую функцию).
		this._onSetAudioVolumeWindow = (event: Event) =>
			this.onSetAudioVolume(event as CustomEvent);
		window.addEventListener("setAudioVolume", this._onSetAudioVolumeWindow);
	}

	protected onDisable() {
		this._handleSubscription(false);

		if (this._onSetAudioVolumeWindow) {
			window.removeEventListener(
				"setAudioVolume",
				this._onSetAudioVolumeWindow
			);
			this._onSetAudioVolumeWindow = null;
		}
	}

	protected onDestroy(): void {
		if (AudioManager.instance === this) {
			AudioManager.instance = null;
		}
	}

	protected onLoad(): void {
		AudioManager.instance = this;

		this._volume =
			typeof (window as any).isGlobalSound !== "undefined"
				? // @ts-ignore
				  Number(window.isGlobalSound)
				: 1;
	}

	play(id: string, callback: () => void = () => {}): void {
		this.audioPresets.map((audioPreset) => {
			if (audioPreset.id === id) {
				const audioSource: AudioSource = this._findAudioSourceById(id);

				audioSource.node = this.node;
				audioSource.clip = audioPreset.clip;
				audioSource.loop = audioPreset.isLoop;
				audioSource.volume = audioPreset.volume * this._volume;
				audioSource.play();

				audioSource.node.once(AudioSource.EventType.ENDED, () => {
					callback instanceof Function && callback();
				});

				return;
			}
		});
	}

	pause(id: string): void {
		this._audioSources[id] && this._audioSources[id].pause();
	}

	stop(id: string): void {
		this._audioSources[id] && this._audioSources[id].stop();
	}

	setVolume(id: string, volume: number): void {
		if (!this._audioSources[id]) return;

		const preset = this.audioPresets.find(
			(audioPreset) => audioPreset.id === id
		);
		if (!preset) return;

		this._audioSources[id].volume = preset.volume * volume * this._volume;
	}

	private onSetAudioVolume(event: CustomEvent): void {
		this._volume = this._normalizeVolume(event.detail.volume, 0, 100);

		for (const key in this._audioSources) {
			if (Object.hasOwnProperty.call(this._audioSources, key)) {
				const { volume } = this.audioPresets.find(
					(audioPreset) => audioPreset.id === key
				);

				this._audioSources[key].volume = volume * this._volume;
			}
		}
	}

	private _handleSubscription(active: boolean): void {
		const func: string = active ? "on" : "off";

		gameEventTarget[func](
			GameEvent.SET_AUDIO_VOLUME,
			this.onSetAudioVolume,
			this
		);
	}

	private _findAudioSourceById(id: string): AudioSource {
		if (this._audioSources[id]) {
			return this._audioSources[id];
		} else {
			const audioSource: AudioSource = new AudioSource();
			this._audioSources[id] = audioSource;

			return audioSource;
		}
	}

	private _normalizeVolume(x: number, min: number, max: number): number {
		return (x - min) / (max - min);
	}
}
