import { Node, ParticleSystem, ParticleSystem2D, Prefab, Vec3, v3 } from "cc";
import PoolManager, { CustomNode } from "./PoolManager";
import Utils from "../../utils/Utils";

type FxCache = {
	ps3D: ParticleSystem[];
	ps2D: ParticleSystem2D[];
};

class FxManager {
	static create(prefab: Prefab, parent: Node, offset: Vec3 = v3(), returnDelay: number = 5): Node | null {
		if (!parent) {
			console.warn("FxManager: parent is required");

			return null;
		}

		const node = PoolManager.pop(prefab);

		if (!node?.isValid) {
			console.warn("FxManager: pool returned invalid node");

			return null;
		}

		// Токен текущего использования — чтобы отложенный возврат сработал
		// только для этого pop, а не для последующего переиспользования ноды.
		const poolToken = (node as CustomNode).poolToken;

		node.parent = parent;
		node.worldPosition = parent.worldPosition.clone().add(offset);

		const cache = this._getOrCreateCache(node);

		if (!cache.ps2D.length && !cache.ps3D.length) {
			console.warn("FxManager: no particle systems found");
			
			node.removeFromParent();
			node.destroy();

			return null;
		}

		if (cache.ps3D.length) {
			for (let i = 0; i < cache.ps3D.length; i++) {
				cache.ps3D[i].play();
			}
		}

		if (cache.ps2D.length) {
			for (let i = 0; i < cache.ps2D.length; i++) {
				cache.ps2D[i].resetSystem();
			}
		}

		Utils.globalScheduleOnce(() => {
			if (
				node.isValid &&
				(node as CustomNode).poolToken === poolToken &&
				PoolManager.findByNode(node)
			) {
				PoolManager.push(node);
			}
		}, returnDelay);

		return node;
	}

	private static _getOrCreateCache(node: Node): FxCache {
		let cache = node["_fxCache"] as FxCache;

		if (cache) return cache;

		const ps3D = ParticleSystem ? node.getComponentsInChildren(ParticleSystem) : [];
		const ps2D = ParticleSystem2D ? node.getComponentsInChildren(ParticleSystem2D) : [];

		cache = {
			ps3D,
			ps2D,
		};

		node["_fxCache"] = cache;
		return cache;
	}
}

export default FxManager;