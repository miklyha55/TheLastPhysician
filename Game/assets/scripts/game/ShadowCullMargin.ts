import { _decorator, CCFloat, Component, MeshRenderer, Vec3, v3 } from "cc";

const { ccclass, property } = _decorator;

const MIN_SCALE: number = 0.0001;

/**
 * Расширяет габариты моделей, чтобы планарная тень не пропадала в кадре.
 *
 * Тень кулится отдельно от самой модели (`planar-shadow-queue.ts`, gatherShadowPasses):
 *
 *     geometry.AABB.transform(_ab, model.worldBounds, shadows.matLight);
 *     if (!geometry.intersect.aabbFrustum(_ab, frustum)) { continue; }
 *
 * То есть габариты модели проецируются матрицей света и проверяются на пересечение с фрустумом
 * камеры. Габариты берутся из меша (`minPosition`/`maxPosition`) и облегают геометрию плотно,
 * поэтому у объекта на краю экрана спроецированный бокс выходит из фрустума раньше, чем тень
 * уезжает за границу кадра — и она гаснет на видном месте.
 *
 * Раздутый бокс отодвигает этот момент за пределы экрана. На то, что рисуется, он не влияет —
 * только на кулинг, поэтому цена правки это лишь чуть больше моделей в очереди.
 */
@ccclass("ShadowCullMargin")
export class ShadowCullMargin extends Component {
	@property({
		type: CCFloat,
		tooltip:
			"На сколько единиц МИРА раздуть габариты каждой модели. Больше — позже гаснет тень",
	})
	public margin: number = 5;

	protected start(): void {
		this.apply();
	}

	/** Отдельным методом, чтобы можно было вызвать после смены освещения или пересборки уровня. */
	public apply(): number {
		let expanded: number = 0;

		for (const renderer of this.node.getComponentsInChildren(MeshRenderer)) {
			if (this._expand(renderer)) {
				expanded++;
			}
		}

		return expanded;
	}

	private _expand(renderer: MeshRenderer): boolean {
		const mesh = renderer.mesh;
		const model = renderer.model;

		if (!mesh || !model || !mesh.struct.minPosition || !mesh.struct.maxPosition) {
			return false;
		}

		// Запас задаётся в мировых единицах, а границы модели локальные, и движок домножает их
		// на мировой масштаб ноды. Поэтому делим на масштаб по каждой оси — иначе у пропа с
		// масштабом 1.8 запас вырос бы почти вдвое против заданного.
		const scale: Vec3 = renderer.node.worldScale;
		const local: Vec3 = v3(
			this.margin / Math.max(Math.abs(scale.x), MIN_SCALE),
			this.margin / Math.max(Math.abs(scale.y), MIN_SCALE),
			this.margin / Math.max(Math.abs(scale.z), MIN_SCALE)
		);

		const min: Vec3 = v3(
			mesh.struct.minPosition.x - local.x,
			mesh.struct.minPosition.y - local.y,
			mesh.struct.minPosition.z - local.z
		);
		const max: Vec3 = v3(
			mesh.struct.maxPosition.x + local.x,
			mesh.struct.maxPosition.y + local.y,
			mesh.struct.maxPosition.z + local.z
		);

		model.createBoundingShape(min, max);
		model.updateWorldBound();

		return true;
	}
}
