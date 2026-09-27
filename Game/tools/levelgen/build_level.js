// Runs in the scene process (body of an async function; `args` = { out, layout }).
const fs = require('fs');
const req = (...a) => Editor.Message.request('scene', ...a);
const wait = (t) => new Promise((r) => setTimeout(r, t));
const { doc, extras } = JSON.parse(fs.readFileSync(args.out, 'utf8'));
const scene = cc.director.getScene();
const world = scene.getChildByName('World');
const level = world.getChildByName('Level');
if (!level) return 'no Level';

// --- lay the level
const names = {};
for (const p of doc.palette) {
	const info = await Editor.Message.request('asset-db', 'query-asset-info', p.prefab);
	if (!info) return 'missing prefab ' + p.prefab;
	names[p.id] = { uuid: p.prefab, name: info.name.replace(/\.prefab$/, '') };
}
const oc = Math.floor(doc.width / 2), orr = Math.floor(doc.height / 2);
const layers = doc.layers.filter((l) => l.visible).map((l) => ({
	name: l.name, y: l.y,
	items: l.cells.map(([c, r, id, rot]) => ({ prefab: names[id].uuid, name: names[id].name, x: c - oc, z: r - orr, r: rot, row: r, col: c }))
		.sort((a, b) => a.row - b.row || a.col - b.col),
}));
const res = await req('execute-scene-script', { name: 'grid_placer', method: 'build', args: [level.uuid, layers] });
await wait(300);

const comp = async (node, type) => {
	const d = await req('query-node', node.uuid);
	return d.__comps__.findIndex((c) => c.type === type);
};
const set = async (node, type, path, dump) => {
	const k = await comp(node, type);
	return req('set-property', { uuid: node.uuid, path: `__comps__.${k}.${path}`, dump });
};
const setPos = (n, p) => req('set-property', { uuid: n.uuid, path: 'position', dump: { type: 'cc.Vec3', value: { x: p.x, y: p.y, z: p.z } } });
const near = (node, x, z) => Math.abs(node.position.x - x) < 0.01 && Math.abs(node.position.z - z) < 0.01;
const group = (name) => level.getChildByName(name);

// --- plain doors: open, unless a button drives them
const buttonDoors = new Set();
for (const b of extras.buttons) for (const d of b.doors) buttonDoors.add(d.join(','));
let opened = 0, shut = 0;
for (const door of level.getComponentsInChildren('Door')) {
	if (door.getComponent('LockedDoor')) continue;
	const key = [Math.round(door.node.position.x), Math.round(door.node.position.z)].join(',');
	const open = !buttonDoors.has(key);
	await set(door.node, 'Door', 'startOpen', { type: 'Boolean', value: open });
	open ? opened++ : shut++;
}
// --- buttons and their doors
const walls = group('Walls');
for (const b of extras.buttons) {
	const node = group('Floor').children.find((n) => near(n, b.button[0], b.button[1]) && n.getComponent('FloorButton'));
	if (!node) return 'no button at ' + b.button;
	for (let i = 0; i < b.doors.length; i++) {
		const doorNode = walls.children.find((n) => near(n, b.doors[i][0], b.doors[i][1]));
		await set(node, 'FloorButton', `doors.${i}`, { type: 'Door', value: { uuid: doorNode.getComponent('Door').uuid } });
	}
}
// --- the gate opens with the level's lever
const gateNode = walls.children.find((n) => n.getComponent('Gate'));
const lever = level.getComponentsInChildren('Lever')[0];
await set(gateNode, 'Gate', 'lever', { type: 'Lever', value: { uuid: lever.uuid } });
// --- timings of fire vents and spikes, so neighbours can take turns
for (const f of extras.fire) {
	const node = group('Floor').children.find((n) => near(n, f.at[0], f.at[1]) && n.getComponent('FireVent'));
	node && (await set(node, 'FireVent', 'phase', { type: 'Number', value: f.phase }));
}
for (const p of extras.pendulums || []) {
	const node = group('Floor').children.find((n) => near(n, p.at[0], p.at[1]) && n.getComponent('Pendulum'));
	node && (await set(node, 'Pendulum', 'phase', { type: 'Number', value: p.phase }));
}
for (const s of extras.wallSpikes || []) {
	const node = group('Walls').children.find((n) => near(n, s.at[0], s.at[1]) && n.getComponent('SpikeTrap'));
	node && (await set(node, 'SpikeTrap', 'phase', { type: 'Number', value: s.phase }));
}
for (const g of extras.gargoyles || []) {
	const node = group('Walls').children.find((n) => near(n, g.at[0], g.at[1]) && n.getComponent('Gargoyle'));
	node && (await set(node, 'Gargoyle', 'phase', { type: 'Number', value: g.phase }));
	// Across a whole hall, wall to wall: the ball goes out at the far wall, not in mid-air.
	node && (await set(node, 'Gargoyle', 'maxRange', { type: 'Number', value: 20 }));
}
for (const s of extras.spikes) {
	const node = group('Floor').children.find((n) => near(n, s.at[0], s.at[1]) && n.getComponent('SpikeTrap'));
	node && (await set(node, 'SpikeTrap', 'phase', { type: 'Number', value: s.phase }));
}
// --- the player's walls: every wall-like tile in the list, so its standing parts block
{
	const P = world.getChildByName('Player');
	const wc = P.getComponent('WallCollision');
	for (const u of ['07d1446a-4f09-4172-9d2c-39b9323bf7cb', '8c1f9334-8659-4357-b2b8-3775c44aa719', '557fcf36-a6e7-4d62-ba5f-19e2c94d11b2']) {
		if (!wc.wallPrefabs.some((p) => p && p._uuid === u)) {
			await set(P, 'WallCollision', `wallPrefabs.${wc.wallPrefabs.length}`, { type: 'cc.Prefab', value: { uuid: u } });
			await wait(150);
		}
	}
}
// --- the player: to the start, the camera rig by the same step; potions to start with; keys for the stack
const player = world.getChildByName('Player');
const from = player.worldPosition.clone();
const to = new cc.Vec3(extras.player[0], 0, extras.player[1]);
const delta = new cc.Vec3(); cc.Vec3.subtract(delta, to, from); delta.y = 0;
await setPos(player, { x: to.x, y: player.position.y, z: to.z });
const cm = scene.getComponentsInChildren('CameraManager')[0];
for (const n of [cm.cameraBox, ...cm.cameras.map((c) => c.node)]) if (n) await setPos(n, n.position.clone().add(delta));
await set(player, 'PlayerAttack', 'ammo', { type: 'Number', value: extras.ammo });
const KEYS = ['c92b53a8-a707-4497-a7bd-8cae91ca8020', 'eb7eaf11-0f5a-479f-a5b8-b42db44c6347', '02490fb8-2a9d-4f38-bab5-18acac98ae55'];
const stack = player.getComponentInChildren('PotionStack') || scene.getComponentsInChildren('PotionStack')[0];
for (let i = 0; i < KEYS.length; i++) await set(stack.node, 'PotionStack', `keyPrefabs.${i}`, { type: 'cc.Prefab', value: { uuid: KEYS[i] } });

// --- the layout file, for the grid placer
doc.parent = { uuid: level.uuid, path: 'World/Level' };
doc.built = res.groups;
const url = `db://assets/grid_levels/${args.layout}.json`;
let info = await Editor.Message.request('asset-db', 'query-asset-info', url);
if (info) fs.writeFileSync(info.file, JSON.stringify(doc, null, 1));
else await Editor.Message.request('asset-db', 'create-asset', url, JSON.stringify(doc, null, 1));
await Editor.Message.request('asset-db', 'refresh-asset', url);

await wait(500);
const stray = scene.children.filter((c) => /^Tile_|^Key_|^Chest|^Furn_|^Zombie/.test(c.name)).length;
if (!stray) await req('save-scene');
await wait(600);
return {
	scene: scene.name, walls: world.getChildByName('Player').getComponent('WallCollision').wallPrefabs.length, created: res.created, removed: res.removed, kept: res.kept, turned: res.turned, errors: res.errors,
	groups: level.children.map((c) => c.name + ':' + c.children.length),
	doors: { opened, shut }, gate: !!gateNode.getComponent('Gate').lever,
	buttons: level.getComponentsInChildren('FloorButton').map((b) => b.doors.length),
	fire: level.getComponentsInChildren('FireVent').map((f) => f.phase),
	player: player.worldPosition.toString(), ammo: player.getComponent('PlayerAttack').ammo,
	keyPrefabs: stack.keyPrefabs.map((p) => p && p.name), stray,
	dirty: await req('query-dirty'),
};
