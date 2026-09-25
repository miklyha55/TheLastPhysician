import { instantiate, Node, NodePool, Prefab } from "cc";

export interface CustomNode extends Node {
	poolPrefab: Prefab;
	// Инкрементится при каждом pop. Позволяет отложенному возврату в пул
	// убедиться, что ноду не выкатили заново (защита от двойного put).
	poolToken?: number;
}

interface PoolObjectProps {
	prefab: Prefab;
	size: number;
	pool: NodePool;
}

class PoolManager {
	private static _pools: PoolObjectProps[] = [];

	static findByPrefab(prefab: Prefab): NodePool | void {
		return PoolManager._pools.find(
			(poolObjectProp) => poolObjectProp.prefab === prefab
		)?.pool;
	}

	static findByNode(node: Node): NodePool | void {
		return PoolManager._pools.find(
			(poolObjectProp) =>
				(node as CustomNode).poolPrefab === poolObjectProp.prefab
		)?.pool;
	}

	static create(prefab: Prefab, size: number = 10): NodePool {
		const findedPool: NodePool | void = this.findByPrefab(prefab);
		const pool: NodePool = findedPool ? findedPool : new NodePool();

		for (let i = 0; i < size; ++i) {
			const node: Node = instantiate(prefab);

			pool.put(node);
		}

		// Только если пула ещё не было: иначе при доливке опустевшего пула
		// (pop → create) в _pools копились бы дубликаты одного префаба.
		if (!findedPool) {
			PoolManager._pools.push({
				prefab,
				size,
				pool,
			});
		}

		return pool;
	}

	static remove(prefab: Prefab): void {
		const index: number = PoolManager._pools.findIndex(
			(poolObjectProp) => poolObjectProp.prefab === prefab
		);

		PoolManager._pools[index]?.pool?.clear();

		index >= 0 && PoolManager._pools.splice(index, 1);
	}

	static push(node: Node): void {
		const pool: NodePool | void = PoolManager.findByNode(node);

		if (pool) {
			pool.put(node);
		} else {
			console.warn("Unable to find pool for given prefab");
		}
	}

	static pop(prefab: Prefab): Node {
		let node: Node = null;
		const pool: NodePool | void = PoolManager.findByPrefab(prefab);

		if (pool && pool.size() > 0) {
			node = pool.get();
		} else {
			node = PoolManager.create(prefab).get();
		}

		(node as CustomNode).poolPrefab = prefab;
		(node as CustomNode).poolToken =
			((node as CustomNode).poolToken ?? 0) + 1;
		return node;
	}
	
	static clear(): void {
		this._pools.forEach(poolObjectProps => {
			poolObjectProps.pool.size() && poolObjectProps.pool.clear();
		});

		this._pools.length = 0;
	}
}

export default PoolManager;
