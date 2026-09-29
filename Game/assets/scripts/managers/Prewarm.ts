import { _decorator, Camera, Component, director, instantiate, MeshRenderer, Node, SkinnedMeshRenderer, v3, Vec3 } from "cc";
import { CameraManager } from "./camera/CameraManager";
import { LoadingScreen } from "./LoadingScreen";

const { ccclass } = _decorator;

// A level's warm-up, behind the loading screen, before it is played. What the game draws the
// first time costs a hitch — the shader and pipeline built for it, the model's first frame: a
// zombie girl coming into view, the first blast, blood, the flash of a shot, a wall fading, a
// flame, a potion on the floor. So everything is drawn once before the player sees anything:
// a camera over the whole level for a few frames, each effect set off once in its sight, every
// wall that can fade faded a moment; then the loading screen goes.
export class Prewarm {
	private static _active = false;

	/** Warming up now — the loading screen stays until it is done. */
	static get active(): boolean {
		return Prewarm._active;
	}

	/** Warms up the level just started; `title` is what the loading screen says meanwhile. */
	static run(title: string): void {
		const scene = director.getScene();
		if (!scene || Prewarm._active) {
			return;
		}
		Prewarm._active = true;
		LoadingScreen.cover(title);
		const node = new Node("Prewarm");
		scene.addChild(node);
		node.addComponent(PrewarmRunner);
	}

	static done(): void {
		Prewarm._active = false;
		LoadingScreen.hide();
	}
}

/** Anything with these methods is an effect it sets off once — by name, not by import. */
type Effect = Component & { burst?: (at: Vec3) => void; splash?: (at: Vec3, from: Vec3, scale?: number) => void; fire?: (from: Vec3, to: Vec3) => void };

@ccclass("PrewarmRunner")
class PrewarmRunner extends Component {
	/** Frames every step gets drawn in. */
	private static readonly FRAMES = 4;
	/** Seconds the effects are given to play out before the level is uncovered. */
	private static readonly SETTLE = 0.6;

	private _frame = 0;
	private _time = 0;
	private _camera: Camera = null;
	private _spawned: Node[] = [];
	private _vents: { vent: Component & { phase: number; offTime: number; onTime: number }; time: number }[] = [];
	private _centre = v3();
	/** Zombies wearing their red for the warm-up, to take it off at its end. */
	private _flashed: (Component & { prewarmFlash?: (on: boolean) => void })[] = [];

	protected start(): void {
		this._overview();
		this._effects();
		this._flames(true);
	}

	protected update(dt: number): void {
		this._frame++;
		this._time += dt;
		if (this._frame === 2) {
			// The walls' faded look: its shader is only built once a wall fades.
			this._fadeWalls();
		}
		if (this._frame < PrewarmRunner.FRAMES * 2 || this._time < PrewarmRunner.SETTLE) {
			return;
		}
		this._finish();
	}

	/** A camera straight over the level, wide enough to see all of it: everything gets drawn. */
	private _overview(): void {
		const scene = this.node.scene;
		const main = CameraManager.instance && CameraManager.instance.cameras[0];
		let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
		for (const renderer of scene.getComponentsInChildren(MeshRenderer)) {
			const p = renderer.node.worldPosition;
			minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
			minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
		}
		if (!isFinite(minX)) {
			minX = minZ = -5; maxX = maxZ = 5;
		}
		this._centre.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
		const span = Math.max(maxX - minX, maxZ - minZ, 4);
		const node = new Node("PrewarmCamera");
		scene.addChild(node);
		node.setWorldPosition(this._centre.x, span * 0.6 + 2, this._centre.z + 0.01);
		node.setRotationFromEuler(-90, 0, 0);
		const camera = node.addComponent(Camera);
		camera.projection = Camera.ProjectionType.PERSPECTIVE;
		camera.fov = 100;
		camera.near = 0.1;
		camera.far = span * 2 + 20;
		if (main) {
			camera.visibility = main.visibility;
			camera.priority = main.priority + 1;
		}
		// Over what the main camera draws: the screen is covered anyway, only the drawing counts.
		camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
		this._camera = camera;
		this._spawned.push(node);
	}

	/** Each effect once, in the middle of the level where the camera sees it. */
	private _effects(): void {
		const scene = this.node.scene;
		const at = v3(this._centre.x, 0.4, this._centre.z);
		const from = v3(this._centre.x - 1, 0.4, this._centre.z);
		for (const name of ["Explosions", "Blood", "GunEffects"]) {
			for (const effect of scene.getComponentsInChildren(name) as Effect[]) {
				effect.burst && effect.burst(at);
				effect.splash && effect.splash(at, from, 1);
				effect.fire && effect.fire(from, at);
			}
		}
		// The zombies' red of a blow: a skinned model copies a material's passes on the first blow.
		for (const zombie of scene.getComponentsInChildren("Zombie") as (Component & { prewarmFlash?: (on: boolean) => void })[]) {
			zombie.prewarmFlash && zombie.prewarmFlash(true);
			this._flashed.push(zombie);
		}
		// The heads' fire: their first shot would otherwise build its shaders mid-game.
		for (const head of scene.getComponentsInChildren("Gargoyle") as (Component & { prewarm?: () => void })[]) {
			head.prewarm && head.prewarm();
		}
		// What only appears in play: a potion in flight or on the floor, a key on the stack.
		const attack = scene.getComponentsInChildren("PlayerAttack")[0] as Component & { projectile: any; stack: { item: any; keyPrefabs: any[] } };
		const prefabs = attack ? [attack.projectile, attack.stack && attack.stack.item, ...((attack.stack && attack.stack.keyPrefabs) || [])] : [];
		let offset = 0;
		for (const prefab of prefabs) {
			if (!prefab) {
				continue;
			}
			const node = instantiate(prefab) as Node;
			// Only its looks: whatever it does in play stays off, from before it wakes.
			for (const component of node.getComponentsInChildren(Component)) {
				if (!(component instanceof MeshRenderer) && !(component instanceof SkinnedMeshRenderer)) {
					component.enabled = false;
				}
			}
			scene.addChild(node);
			node.setWorldPosition(this._centre.x + offset, 0.2, this._centre.z);
			offset += 0.3;
			this._spawned.push(node);
		}
	}

	/** Flames up in every fire pipe for the warm-up; `on` false puts them back in their cycle. */
	private _flames(on: boolean): void {
		if (on) {
			for (const vent of this.node.scene.getComponentsInChildren("FireVent") as (Component & { phase: number; offTime: number; onTime: number; _time: number })[]) {
				this._vents.push({ vent, time: vent._time });
				vent._time = vent.offTime + vent.onTime / 2;
			}
			return;
		}
		for (const { vent } of this._vents) {
			if (vent.isValid) {
				(vent as unknown as { _time: number })._time = vent.phase;
			}
		}
	}

	private _fadeWalls(): void {
		const fade = this.node.scene.getComponentsInChildren("OcclusionFade")[0] as Component & { _items: { amount: number }[]; _apply: (item: unknown) => void };
		if (!fade || !fade._items) {
			return;
		}
		// Faded a moment; its own update brings them back to solid.
		for (const item of fade._items) {
			item.amount = 0.3;
			fade._apply(item);
		}
	}

	private _finish(): void {
		this._flames(false);
		for (const zombie of this._flashed) {
			zombie.isValid && zombie.prewarmFlash && zombie.prewarmFlash(false);
		}
		this._flashed.length = 0;
		for (const node of this._spawned) {
			node.isValid && node.destroy();
		}
		this._spawned.length = 0;
		this.node.destroy();
		Prewarm.done();
	}
}
