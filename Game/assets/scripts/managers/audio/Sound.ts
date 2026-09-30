import { AssetManager, assetManager, AudioClip, AudioSource, Director, director, Node, v3, Vec3 } from "cc";
import { CameraManager } from "../camera/CameraManager";
import GameEvent from "../../enums/GameEvent";
import { gameEventTarget } from "../../plugins/GameEventTarget";

/** How a sound plays. */
export interface SoundOptions {
	/** Its own volume, 0..1, under the game's volume. */
	volume?: number;
	/** Round and round until stopped. */
	loop?: boolean;
	/** What it is called for pause/stop/setVolume; the path, or the clip's name, by default. */
	id?: string;
	/** Called once it has played to its end (never for a loop). */
	onEnded?: () => void;
	/** Where it sounds from: quieter the farther it is from where the camera looks — followed while it plays. */
	at?: Vec3 | Node;
	/** Full volume within this of where the camera looks, units on the floor. */
	near?: number;
	/** Silent past this. */
	far?: number;
}

/** A sound: a path in the sound bundle ("walk/walk1"), or the clip itself. */
export type SoundRef = string | AudioClip;

const _focus = v3();
const _forward = v3();

interface Channel {
	source: AudioSource;
	/** Its own volume, before the game's. */
	volume: number;
	/** Where it sounds from, for the fall-off with distance; null — everywhere alike. */
	at: Vec3 | Node;
	near: number;
	far: number;
	/** Bumped on every play and stop, so a clip still loading for an old request is not played. */
	request: number;
	/** The music's channel: under the music's switch, not the sounds'. */
	music: boolean;
}

// Sound for the whole game, from anywhere, with nothing to set up in a scene: the clips are
// taken straight from the assets — a path in the sound bundle (`bundle`, the assets/audio
// folder: "shoot", "walk/walk1") or an AudioClip in hand — loaded the first time they are asked for and kept. The way AudioManager
// plays its presets, only static: a sound with an id plays on a channel of its own that can be
// paused, stopped and turned down (music, loops); short effects go out as one-shots and overlap.
// It lives on a node of its own kept across scenes, so a level change does not cut it off. The
// game's volume is the one the ad network sets (window.isGlobalSound, the setAudioVolume event,
// GameEvent.SET_AUDIO_VOLUME), as for AudioManager.
// A sound may come from a place in the world (`at`, or playOneShotAt): the farther it is from
// where the camera looks — the point on the floor at the middle of the picture, about where the
// player is — the quieter, full within `near`, silent past `far`. A channel's is kept up with
// the camera every frame; a one-shot's is fixed when it starts.
export class Sound {
	/** The bundle the paths are in: the assets/audio folder. */
	static bundle = "audio";
	/** Full volume within this of where the camera looks, units on the floor. */
	static near = 3;
	/** Silent past this. */
	static far = 12;

	private static _node: Node = null;
	private static _oneShot: AudioSource = null;
	private static _channels = new Map<string, Channel>();
	private static _clips = new Map<string, AudioClip>();
	private static _loading = new Map<string, Promise<AudioClip>>();
	private static _volume = -1;
	/** The window has lost the focus — another window, another app, the portal's page around the game: silent till it is back. */
	private static _unfocused = false;
	private static _listening = false;
	private static _following = false;
	private static _soundOn = true;
	private static _musicOn = true;

	/** The channel the music plays on: the music's switch is for it, the sounds' for the rest. */
	static musicId = "music";

	/** The player's switch for every sound but the music. */
	static get soundOn(): boolean {
		return Sound._soundOn;
	}

	static set soundOn(on: boolean) {
		Sound._soundOn = on;
		Sound._channels.forEach((channel) => Sound._apply(channel));
	}

	/** The player's switch for the music. */
	static get musicOn(): boolean {
		return Sound._musicOn;
	}

	static set musicOn(on: boolean) {
		Sound._musicOn = on;
		Sound._channels.forEach((channel) => Sound._apply(channel));
	}

	/** The game's volume, 0..1: what every sound is multiplied by. */
	static get volume(): number {
		Sound._listen();
		return Sound._volume;
	}

	static set volume(value: number) {
		Sound._listen();
		Sound._volume = Math.max(0, Math.min(1, value));
		Sound._channels.forEach((channel) => Sound._apply(channel));
	}

	/**
	 * How loud a sound at `at` comes through, 0..1: 1 within `near` of where the camera looks,
	 * 0 past `far`, smoothly between.
	 */
	static attenuation(at: Vec3 | Node, near = Sound.near, far = Sound.far): number {
		const point = at instanceof Node ? (at.isValid ? at.worldPosition : null) : at;
		const focus = point && Sound._focus(_focus);
		if (!point || !focus) {
			return 1;
		}
		const distance = Math.hypot(point.x - focus.x, point.z - focus.z);
		if (distance <= near) {
			return 1;
		}
		if (distance >= far) {
			return 0;
		}
		const k = 1 - (distance - near) / Math.max(far - near, 1e-4);
		return k * k * (3 - 2 * k); // smoothstep
	}

	/** Loads the clips ahead, so their first play starts at once. */
	static preload(paths: string[]): Promise<void> {
		return Promise.all(paths.map((path) => Sound._load(path).catch(() => null))).then(() => undefined);
	}

	/**
	 * Plays a sound on its own channel (its id — the path by default): a second play of the
	 * same id starts it over. For music, loops, anything to be paused or stopped.
	 */
	static play(sound: SoundRef, options: SoundOptions = {}): void {
		const id = options.id || Sound._name(sound);
		const channel = Sound._channel(id);
		const request = ++channel.request;
		channel.volume = options.volume === undefined ? 1 : options.volume;
		channel.at = options.at || null;
		channel.near = options.near === undefined ? Sound.near : options.near;
		channel.far = options.far === undefined ? Sound.far : options.far;
		Sound._clip(sound, (clip) => {
			if (channel.request !== request || !clip) {
				return; // stopped, or played again, while it loaded
			}
			const source = channel.source;
			source.stop();
			source.clip = clip;
			source.loop = !!options.loop;
			Sound._apply(channel);
			source.play();
			if (options.onEnded && !options.loop) {
				source.node.off(AudioSource.EventType.ENDED);
				source.node.once(AudioSource.EventType.ENDED, () => channel.request === request && options.onEnded());
			}
		});
	}

	/** A short sound that overlaps with the others and cannot be stopped: a shot, a hit, a blast. */
	static playOneShot(sound: SoundRef, volume = 1): void {
		Sound._clip(sound, (clip) => {
			const source = Sound._oneShotSource();
			clip && source && !Sound._unfocused && Sound._soundOn && source.playOneShot(clip, Math.max(0, volume) * Sound.volume);
		});
	}

	/**
	 * A one-shot from a place in the world: quieter the farther it is from where the camera
	 * looks, as it stands when the sound starts; not played at all when too far to be heard.
	 */
	static playOneShotAt(sound: SoundRef, at: Vec3 | Node, volume = 1, near = Sound.near, far = Sound.far): void {
		const heard = Sound.attenuation(at, near, far);
		if (heard <= 0.001) {
			return;
		}
		Sound.playOneShot(sound, volume * heard);
	}

	static pause(id: string): void {
		const channel = Sound._channels.get(id);
		channel && channel.source.pause();
	}

	static resume(id: string): void {
		const channel = Sound._channels.get(id);
		channel && channel.source.clip && !channel.source.playing && channel.source.play();
	}

	static stop(id: string): void {
		const channel = Sound._channels.get(id);
		if (channel) {
			channel.request++;
			channel.source.stop();
		}
	}

	/** Every channel quiet; one-shots already going play out. */
	static stopAll(): void {
		Sound._channels.forEach((channel, id) => Sound.stop(id));
	}

	/** A channel's own volume, 0..1. */
	static setVolume(id: string, volume: number): void {
		const channel = Sound._channels.get(id);
		if (channel) {
			channel.volume = Math.max(0, Math.min(1, volume));
			Sound._apply(channel);
		}
	}

	static isPlaying(id: string): boolean {
		const channel = Sound._channels.get(id);
		return !!channel && channel.source.playing;
	}

	/**
	 * Where a channel's clip is: seconds played and its whole length; null while there is no clip
	 * on it yet (still loading). What follows the sound itself — the intro's text — reads this.
	 */
	static progress(id: string): { time: number; duration: number } | null {
		const channel = Sound._channels.get(id);
		const source = channel && channel.source;
		if (!source || !source.isValid || !source.clip) {
			return null;
		}
		return { time: source.currentTime, duration: source.duration };
	}

	// --- inside

	/** A channel's volume as it comes through now: its own, the distance, the game's. */
	private static _apply(channel: Channel): void {
		if (!channel.source || !channel.source.isValid) {
			return;
		}
		const heard = channel.at ? Sound.attenuation(channel.at, channel.near, channel.far) : 1;
		const on = channel.music ? Sound._musicOn : Sound._soundOn;
		channel.source.volume = Sound._unfocused || !on ? 0 : channel.volume * heard * Sound.volume;
	}

	/** Channels sounding from a place: kept up with the camera and the thing, every frame. */
	private static _follow(): void {
		Sound._channels.forEach((channel) => {
			if (channel.at && channel.source && channel.source.isValid && channel.source.playing) {
				Sound._apply(channel);
			}
		});
	}

	/** Where the camera looks: its line of sight down to the floor (y = 0); null — no camera. */
	private static _focus(out: Vec3): Vec3 {
		const manager = CameraManager.instance;
		const camera = manager && manager.cameras[0];
		if (!camera || !camera.node || !camera.node.isValid) {
			return null;
		}
		const eye = camera.node.worldPosition;
		Vec3.transformQuat(_forward, Vec3.FORWARD, camera.node.worldRotation);
		if (_forward.y < -1e-3) {
			const t = -eye.y / _forward.y;
			return out.set(eye.x + _forward.x * t, 0, eye.z + _forward.z * t);
		}
		return out.set(eye.x, 0, eye.z);
	}

	/** The node the sources live on, kept across scenes; made the first time a sound is asked for. */
	private static _holder(): Node {
		if (Sound._node && Sound._node.isValid) {
			return Sound._node;
		}
		const scene = director.getScene();
		if (!scene) {
			return null;
		}
		const node = new Node("Sound");
		scene.addChild(node);
		director.addPersistRootNode(node);
		if (!Sound._following) {
			Sound._following = true;
			director.on(Director.EVENT_AFTER_UPDATE, Sound._follow);
		}
		Sound._node = node;
		Sound._oneShot = null;
		Sound._channels.forEach((channel) => {
			// The old node went with its scene: the channels move to the new one.
			const child = new Node(channel.source.node ? channel.source.node.name : "Channel");
			node.addChild(child);
			channel.source = child.addComponent(AudioSource);
		});
		return node;
	}

	private static _channel(id: string): Channel {
		let channel = Sound._channels.get(id);
		const holder = Sound._holder();
		if (!channel || !channel.source.isValid) {
			const child = new Node(`Sound:${id}`);
			holder && holder.addChild(child);
			channel = { source: child.addComponent(AudioSource), volume: 1, at: null, near: Sound.near, far: Sound.far, request: channel ? channel.request : 0, music: id === Sound.musicId };
			channel.source.playOnAwake = false;
			Sound._channels.set(id, channel);
		}
		return channel;
	}

	private static _oneShotSource(): AudioSource {
		if (Sound._oneShot && Sound._oneShot.isValid) {
			return Sound._oneShot;
		}
		const holder = Sound._holder();
		if (!holder) {
			return null;
		}
		const child = new Node("Sound:oneShot");
		holder.addChild(child);
		Sound._oneShot = child.addComponent(AudioSource);
		Sound._oneShot.playOnAwake = false;
		return Sound._oneShot;
	}

	private static _name(sound: SoundRef): string {
		return typeof sound === "string" ? sound : sound ? sound.name : "";
	}

	/** The clip, at once when it is in hand or already loaded, else once it has loaded. */
	private static _clip(sound: SoundRef, then: (clip: AudioClip) => void): void {
		if (!sound) {
			return;
		}
		if (typeof sound !== "string") {
			then(sound);
			return;
		}
		const known = Sound._clips.get(sound);
		if (known) {
			then(known);
			return;
		}
		Sound._load(sound).then(then, () => then(null));
	}

	private static _load(path: string): Promise<AudioClip> {
		const known = Sound._clips.get(path);
		if (known) {
			return Promise.resolve(known);
		}
		let loading = Sound._loading.get(path);
		if (!loading) {
			loading = new Promise<AudioClip>((resolve, reject) => {
				Sound._bundle().then(
					(bundle) =>
						bundle.load(path, AudioClip, (error, clip) => {
							Sound._loading.delete(path);
							if (error || !clip) {
								console.warn(`Sound: no clip "${path}" in the "${Sound.bundle}" bundle`, error || "");
								reject(error);
								return;
							}
							Sound._clips.set(path, clip);
							resolve(clip);
						}),
					(error) => {
						Sound._loading.delete(path);
						reject(error);
					},
				);
			});
			Sound._loading.set(path, loading);
		}
		return loading;
	}

	private static _bundlePromise: Promise<AssetManager.Bundle> = null;

	/** The sound bundle, loaded once. */
	private static _bundle(): Promise<AssetManager.Bundle> {
		const known = assetManager.getBundle(Sound.bundle);
		if (known) {
			return Promise.resolve(known);
		}
		if (!Sound._bundlePromise) {
			Sound._bundlePromise = new Promise((resolve, reject) =>
				assetManager.loadBundle(Sound.bundle, (error, bundle) => {
					if (error || !bundle) {
						console.warn(`Sound: no "${Sound.bundle}" bundle`, error || "");
						Sound._bundlePromise = null;
						reject(error);
						return;
					}
					resolve(bundle);
				}),
			);
		}
		return Sound._bundlePromise;
	}

	/** The game's volume from the ad network, once: its global flag, and its volume events. */
	private static _listen(): void {
		if (Sound._listening) {
			return;
		}
		Sound._listening = true;
		const flag = typeof window !== "undefined" ? (window as any).isGlobalSound : undefined;
		Sound._volume = typeof flag !== "undefined" ? Math.max(0, Math.min(1, Number(flag))) : 1;
		// 0..100, as AudioManager takes it.
		const fromEvent = (detail: { volume: number }) => {
			if (detail && typeof detail.volume === "number") {
				Sound.volume = detail.volume / 100;
			}
		};
		gameEventTarget.on(GameEvent.SET_AUDIO_VOLUME, (event: CustomEvent) => fromEvent(event && event.detail));
		typeof window !== "undefined" && window.addEventListener("setAudioVolume", (event: Event) => fromEvent((event as CustomEvent).detail));
		// The platform's rule: the browser's focus lost, the game's sound stops. A hidden tab the engine
		// pauses itself; a window still in sight but not in focus it does not — that is heard here.
		// A touch or a key on the game is the focus back even where the browser says nothing of it.
		if (typeof window !== "undefined") {
			const focus = (on: boolean) => {
				if (Sound._unfocused === !on) {
					return;
				}
				Sound._unfocused = !on;
				Sound._channels.forEach((channel) => Sound._apply(channel));
			};
			window.addEventListener("blur", () => focus(false));
			window.addEventListener("focus", () => focus(true));
			for (const event of ["pointerdown", "keydown"]) window.addEventListener(event, () => focus(true), { capture: true });
		}
	}
}
