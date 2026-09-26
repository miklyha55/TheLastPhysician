import { _decorator, Camera, Component, geometry, Material, MeshRenderer, Node, v3, Vec3 } from "cc";

const { ccclass, property } = _decorator;

const DITHER = "ditherAmount";
const GRID_X = 3;
const GRID_Y = 5;

// Fades out whatever model hides the player: a few times a second rays are cast from the
// camera to a grid of points over the player, and when at least `threshold` of them are
// blocked, every model that blocks any of them is screen-door faded (the standard-dither
// effect's ditherAmount) — still opaque, so its inside never shows. When the player is in
// view again the models get their own materials back.
@ccclass("OcclusionFade")
export class OcclusionFade extends Component {
	@property(Camera) camera: Camera = null;
	@property({ type: Node, tooltip: "Where the models that may hide the player are; empty — the whole scene" })
	root: Node = null;
	@property({ tooltip: "Share of the player that has to be hidden before models fade", slide: true, range: [0, 1, 0.05] })
	threshold: number = 0.7;
	@property({ tooltip: "Faded models come back only once the hidden share drops this far below the threshold, so they do not flicker at the edge", slide: true, range: [0, 1, 0.05] })
	hysteresis: number = 0.2;
	@property({ tooltip: "How much of a hiding model is thrown away when faded, 0..1", slide: true, range: [0, 1, 0.05] })
	fadeAmount: number = 0.6;
	@property({ tooltip: "Fade per second" })
	fadeSpeed: number = 4;
	@property({ tooltip: "Seconds between visibility checks" })
	checkInterval: number = 0.1;

	private _playerRenderers: MeshRenderer[] = [];
	private _candidateList: MeshRenderer[] = [];
	private _faded = new Map<MeshRenderer, { amount: number; shared: Material[] }>();
	private _hiding = new Set<MeshRenderer>();
	private _timer = 0;
	private _fading = false;
	private _center = v3();
	private _ray = new geometry.Ray();
	private _points: Vec3[] = [];
	private _right = v3();
	private _up = v3();

	protected start(): void {
		this._playerRenderers = this.node.getComponentsInChildren(MeshRenderer);
		this._points.length = 0;
		for (let i = 0; i < GRID_X * GRID_Y; i++) {
			this._points.push(v3());
		}
		// The level does not change while playing: gather what can fade once, not every check.
		const own = new Set(this._playerRenderers);
		const root = this.root || this.node.scene;
		this._candidateList = root.getComponentsInChildren(MeshRenderer).filter((renderer) =>
			!own.has(renderer) && this._canFade(renderer));
	}

	protected update(dt: number): void {
		this._timer -= dt;
		if (this._timer <= 0) {
			this._timer = this.checkInterval;
			this._check();
		}
		this._animate(dt);
	}

	/** Which models hide the player now, if together they hide enough of it. */
	private _check(): void {
		if (!this.camera || !this._playerRenderers.length) {
			this._hiding.clear();
			return;
		}
		this._samplePoints();
		const eye = this.camera.node.worldPosition;
		// Only what stands between the camera and the player counts: a point at the player's
		// edge can sink into a wall right behind them, and that wall hides nothing.
		const front = Vec3.distance(eye, this._center) - 0.05;
		const candidates = this._candidates();
		const blockers = new Set<MeshRenderer>();
		let hidden = 0;
		for (const point of this._points) {
			const distance = Vec3.distance(eye, point);
			geometry.Ray.fromPoints(this._ray, eye, point);
			let blocked = false;
			for (const renderer of candidates) {
				const model = renderer.model;
				const near = geometry.intersect.rayAABB(this._ray, model.worldBounds);
				if (!near || near >= distance) {
					continue;
				}
				const hit = geometry.intersect.rayModel(this._ray, model);
				if (hit > 0 && hit < distance - 0.01 && hit < front) {
					blockers.add(renderer);
					blocked = true;
				}
			}
			if (blocked) {
				hidden++;
			}
		}
		// Fade from the threshold up, come back only well below it.
		const share = hidden / this._points.length;
		this._fading = this._fading ? share >= this.threshold - this.hysteresis : share >= this.threshold;
		if (!this._fading) {
			this._hiding.clear();
			return;
		}
		// While faded, a model stays faded as long as it still covers the player at all.
		blockers.forEach((renderer) => this._hiding.add(renderer));
		this._hiding.forEach((renderer) => {
			if (!blockers.has(renderer)) {
				this._hiding.delete(renderer);
			}
		});
	}

	/** A grid over the player's bounds, on the plane that faces the camera. */
	private _samplePoints(): void {
		const min = v3(Infinity, Infinity, Infinity);
		const max = v3(-Infinity, -Infinity, -Infinity);
		for (const renderer of this._playerRenderers) {
			const bounds = renderer.model && renderer.model.worldBounds;
			if (!bounds) {
				continue;
			}
			Vec3.min(min, min, v3(bounds.center.x - bounds.halfExtents.x, bounds.center.y - bounds.halfExtents.y, bounds.center.z - bounds.halfExtents.z));
			Vec3.max(max, max, v3(bounds.center.x + bounds.halfExtents.x, bounds.center.y + bounds.halfExtents.y, bounds.center.z + bounds.halfExtents.z));
		}
		const center = Vec3.lerp(this._center, min, max, 0.5);
		const half = Vec3.subtract(v3(), max, center);
		Vec3.transformQuat(this._right, Vec3.RIGHT, this.camera.node.worldRotation);
		Vec3.transformQuat(this._up, Vec3.UP, this.camera.node.worldRotation);
		const width = Math.max(half.x, half.z) * 0.8;
		const height = half.y * 0.8;
		let at = 0;
		for (let y = 0; y < GRID_Y; y++) {
			const v = (y / (GRID_Y - 1)) * 2 - 1;
			for (let x = 0; x < GRID_X; x++) {
				const u = (x / (GRID_X - 1)) * 2 - 1;
				const point = this._points[at++];
				Vec3.scaleAndAdd(point, center, this._right, u * width);
				Vec3.scaleAndAdd(point, point, this._up, v * height);
			}
		}
	}

	/** Models that can fade right now: the ones gathered at start that are still shown. */
	private _candidates(): MeshRenderer[] {
		return this._candidateList.filter((renderer) => renderer.isValid && renderer.enabledInHierarchy && renderer.model);
	}

	private _canFade(renderer: MeshRenderer): boolean {
		return renderer.sharedMaterials.some((material) => material && material.passes[0].getHandle(DITHER));
	}

	private _animate(dt: number): void {
		this._hiding.forEach((renderer) => {
			if (!this._faded.has(renderer)) {
				this._faded.set(renderer, { amount: 0, shared: renderer.sharedMaterials.slice() });
			}
		});
		this._faded.forEach((state, renderer) => {
			const target = this._hiding.has(renderer) ? this.fadeAmount : 0;
			const step = this.fadeSpeed * dt;
			state.amount = Math.abs(target - state.amount) <= step ? target : state.amount + Math.sign(target - state.amount) * step;
			if (state.amount <= 0 && target === 0) {
				// Back to the shared materials, so the model batches with its neighbours again.
				// forceUpdate: the shared material is the same one, and without it the
				// renderer keeps the faded instance.
				state.shared.forEach((material, index) => renderer.setSharedMaterial(material, index, true));
				this._faded.delete(renderer);
				return;
			}
			for (let i = 0; i < renderer.sharedMaterials.length; i++) {
				const material = renderer.getMaterialInstance(i);
				if (material && material.passes[0].getHandle(DITHER)) {
					material.setProperty(DITHER, state.amount);
				}
			}
		});
	}
}
