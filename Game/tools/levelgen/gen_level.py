"""Level generator: an ASCII map + a spec -> a grid_placer layout (layers) plus the wiring extras.

Map symbols
  #  wall            W  window          D  plain door       r b g  locked doors
  E  exit gate (bottom wall)
  .  floor           P  player start    Z  zombie           R B G  keys
  C  chest           L  lever           O  floor button     S  spikes
  F  fire vent       ~  slime stream (tiles picked and turned by the neighbours)
  V  zombie girl — throws things at the player
  X  wall with spikes shooting out of it into the room
  M  pendulum over the floor
"""
import json, random, sys
from collections import deque, Counter

U = {
    'FA': '2d8b57fb-8ca7-4c17-b5e7-a06bce3d053f', 'FB': '6edfec28-b1b0-4b24-8307-991be428b044', 'FC': 'd51eb5bf-5142-43ca-a96e-1ac543761e68',
    'Spikes': 'bed8095f-e751-4d9c-ae36-3c7a73a07e8e',
    'WA': '8279bd2e-6f94-4533-85ea-b295b8d40989', 'WB': '1e2f87ac-5058-4b54-a40a-012f3a2d2503', 'WC': '18c535cd-6d9e-474f-ae6a-40367bae2253',
    'Corner': '3c2330c1-5af5-40ff-a833-784f093141ba', 'Cross': 'd0d38f71-bc77-4c78-bf0c-895db53df691', 'T': '71a3c3db-f8fc-4007-b861-5e383eb38871',
    'Door': 'da39a363-a91a-4e52-ad68-0c21bf6fcee5', 'Window': '2f912d12-3ccc-4bc1-9dd0-b9a630f55f33', 'Gate': '0c8b38ea-817d-46c3-89af-40734311ba5a',
    'DoorR': 'e540a56f-feae-4b02-86fa-2b7e0c72ebbb', 'DoorB': '17b31bad-0844-4b54-969c-9bf0017d1dbe', 'DoorG': 'f98e2384-8682-490b-92bf-7ac8d7f351b0',
    'KeyR': 'c92b53a8-a707-4497-a7bd-8cae91ca8020', 'KeyB': 'eb7eaf11-0f5a-479f-a5b8-b42db44c6347', 'KeyG': '02490fb8-2a9d-4f38-bab5-18acac98ae55',
    'Zombie': '6b60ec55-a1cd-4eaa-8de9-0171a4ccdcea', 'Chest': '475847b0-dc37-47a5-a7fc-83d8fb3e8259',
    'Barrel': 'f2af8503-e930-4967-bbf9-9faf99822aa6', 'Bed': '0c8a5430-8429-45fb-975c-db3270fb9544', 'Bench': 'b8179066-150e-4ab7-8aa8-66ba78593714',
    'Candelabra': '4725d302-4f78-438b-8b14-8580ca903753', 'Chair': '4d115c98-68c0-44e8-a3f3-b75cdc475099', 'Crate': 'b45fa9b4-4da2-4561-a964-79beca0d20d9',
    'Shelf': '42695824-c488-4c91-ab4f-9844d066eee3', 'Table': 'd57f9b65-46d2-48ed-8538-505084cb0017',
    'Lever': 'c1f597bc-fcbc-43f3-9dc5-6e0f7b05912a',
    'StreamLine': 'b0d6eca3-1aa5-453f-8309-3ecb184bfee9', 'StreamCorner': '1cbab2e6-8a94-4c6e-a511-f3122eba5d3b', 'StreamCross': '1430f94d-5989-4dac-bcf4-ce804a13f3fa',
    'Button': '9e3b4c3d-fecb-4960-8dcd-cd2067bf3fc5', 'Fire': '0c8d5b03-946a-4418-82ed-20b874efff3f',
    'Girl': 'aaf8c8c6-319b-4149-9d50-c135834c0fa9',
    'WallSpikes': '07d1446a-4f09-4172-9d2c-39b9323bf7cb',
    'Pendulum': '8c1f9334-8659-4357-b2b8-3775c44aa719',
    'Gargoyle': '557fcf36-a6e7-4d62-ba5f-19e2c94d11b2',
}
# A chest's front (its local +Z) turned to where the camera looks from: the same in every level.
CHEST_YAW = 34
FURNITURE = {'Barrel', 'Bed', 'Bench', 'Candelabra', 'Chair', 'Crate', 'Shelf', 'Table'}
SMALL = {'Barrel', 'Candelabra', 'Chair', 'Crate'}

DIRS = {'N': (0, -1), 'S': (0, 1), 'W': (-1, 0), 'E': (1, 0)}
OPP = {'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}
WALLCH = '#WDrbgEXH'
PASS = '.PZSRBGCLOF~VM'
CORNER = {frozenset('WN'): 0, frozenset('SW'): 90, frozenset('ES'): 180, frozenset('NE'): 270}
TROT = {'N': 0, 'W': 90, 'S': 180, 'E': 270}          # T joint turned so its missing arm points that way
STREAM_CORNER = {frozenset('NW'): 0, frozenset('WS'): 90, frozenset('SE'): 180, frozenset('EN'): 270}
DOORS = {'D': 'Door', 'r': 'DoorR', 'b': 'DoorB', 'g': 'DoorG'}


# A shelf's open front is its local +Z: turned 0 it faces south (+row), 90 east, 180 north, 270 west.
FACING = {'S': 0, 'E': 90, 'N': 180, 'W': 270}


def shelf_rotation(at, c, r, W, H):
    """Shelves always face into the room: back to the wall it stands against, or, standing free,
    away from the nearest wall."""
    walls = [d for d, (dc, dr) in DIRS.items() if at(c + dc, r + dr) in WALLCH]
    if walls:
        back = walls[0] if len(walls) == 1 else sorted(walls, key=lambda d: 'NSWE'.index(d))[0]
        return FACING[OPP[back]]
    # free-standing: nearest wall straight out in each direction
    reach = {}
    for d, (dc, dr) in DIRS.items():
        k = 1
        while at(c + dc * k, r + dr * k) not in WALLCH and at(c + dc * k, r + dr * k) != ' ':
            k += 1
        reach[d] = k
    back = min(reach, key=lambda d: (reach[d], 'NSWE'.index(d)))
    return FACING[OPP[back]]


def generate(spec):
    MAP = spec['map']
    H = len(MAP); W = len(MAP[0])
    assert all(len(r) == W for r in MAP), [len(r) for r in MAP]
    at = lambda c, r: MAP[r][c] if 0 <= r < H and 0 <= c < W else ' '
    rnd = random.Random(spec.get('seed', 1))
    palette = []; slot = {}
    def sid(k):
        if k not in slot:
            slot[k] = len(palette) + 1; palette.append({'id': slot[k], 'prefab': U[k]})
        return slot[k]
    floor, walls, zombies, keys, chests, levers, furniture = [], [], [], [], [], [], []
    player = None
    for r in range(H):
        for c in range(W):
            ch = MAP[r][c]
            if ch in WALLCH:
                arms = {d for d, (dc, dr) in DIRS.items() if at(c + dc, r + dr) in WALLCH}
                ns = 'N' in arms or 'S' in arms; ew = 'E' in arms or 'W' in arms
                if len(arms) == 4: walls.append([c, r, sid('Cross'), 0]); continue
                if len(arms) == 3:
                    walls.append([c, r, sid('T'), TROT[({'N', 'S', 'E', 'W'} - arms).pop()]]); continue
                if len(arms) == 2 and ns and ew: walls.append([c, r, sid('Corner'), CORNER[frozenset(arms)]]); continue
                vertical = ns and not ew
                if ch in DOORS:
                    assert len(arms) == 2, ('door not in a straight wall', c, r, arms)
                    walls.append([c, r, sid(DOORS[ch]), 90 if vertical else 0]); continue
                if ch == 'E':
                    assert len(arms) == 2 and not vertical and r == H - 1, 'the gate sits in the bottom wall'
                    walls.append([c, r, sid('Gate'), 180]); continue
                if vertical: rot = 90 if c > W // 2 else 270
                else: rot = 0 if r > H // 2 else 180
                if ch == 'W': walls.append([c, r, sid('Window'), rot]); continue
                if ch == 'X':
                    # Blades out of the local +Z face, towards the side the spec names, else the floor side.
                    given = spec.get('wall_spikes', {}).get((c, r))
                    given = given[0] if isinstance(given, tuple) else given
                    side = given or next((d for d, (dc, dr) in DIRS.items() if at(c + dc, r + dr) in PASS), 'S')
                    assert at(c + DIRS[side][0], r + DIRS[side][1]) in PASS, ('wall spikes facing a wall', c, r, side)
                    walls.append([c, r, sid('WallSpikes'), FACING[side]]); continue
                if ch == 'H':
                    # A fire-spitting head, its mouth (local +Z) towards the side the spec names.
                    side = spec['gargoyles'][(c, r)][0]
                    assert at(c + DIRS[side][0], r + DIRS[side][1]) in PASS, ('gargoyle facing a wall', c, r, side)
                    walls.append([c, r, sid('Gargoyle'), FACING[side]]); continue
                walls.append([c, r, sid(rnd.choices(['WA', 'WB', 'WC'], [6, 2, 2])[0]), rot])
                continue
            assert ch in PASS, ('unknown symbol', ch, c, r)
            if ch == 'S': floor.append([c, r, sid('Spikes'), 0])
            elif ch == 'O': floor.append([c, r, sid('Button'), 0])
            elif ch == 'F': floor.append([c, r, sid('Fire'), 0])
            elif ch == 'M':
                # swings across the tile along its local X: turned 90 it swings north-south
                turn, _ = spec.get('pendulums', {}).get((c, r), (0, 0))
                # Never a door: open floor both ways it swings, so it can be got past under the
                # blade; across it a wall may stand on one side (a snake round the pendulums),
                # never on both.
                along = ('E', 'W') if turn % 180 == 0 else ('N', 'S')
                across = ('N', 'S') if turn % 180 == 0 else ('E', 'W')
                way = [at(c + DIRS[d][0], r + DIRS[d][1]) for d in along]
                side = [at(c + DIRS[d][0], r + DIRS[d][1]) for d in across]
                assert all(a in PASS and a != 'M' for a in way), ('pendulum blocked where it swings', spec['name'], c, r, way)
                assert any(a in PASS and a != 'M' for a in side), ('pendulum walled in on both sides', spec['name'], c, r, side)
                floor.append([c, r, sid('Pendulum'), turn])
            # The lever's tile has its own floor: nothing under it.
            elif ch == 'L': levers.append([c, r, sid('Lever'), 0])
            elif ch == '~':
                arms = {d for d, (dc, dr) in DIRS.items() if at(c + dc, r + dr) == '~'}
                # A stream end at a wall flows out from under it.
                for d, (dc, dr) in DIRS.items():
                    if len(arms) == 1 and d == OPP[next(iter(arms))] and at(c + dc, r + dr) in WALLCH:
                        arms.add(d)
                if len(arms) >= 3: floor.append([c, r, sid('StreamCross'), 0])
                elif len(arms) == 2 and arms in ({'N', 'S'}, {'E', 'W'}):
                    floor.append([c, r, sid('StreamLine'), 90 if 'N' in arms else 0])
                elif len(arms) == 2: floor.append([c, r, sid('StreamCorner'), STREAM_CORNER[frozenset(arms)]])
                else:
                    d = next(iter(arms)) if arms else 'E'
                    floor.append([c, r, sid('StreamLine'), 90 if d in 'NS' else 0])
            else: floor.append([c, r, sid(rnd.choice(['FA', 'FA', 'FB', 'FC'])), rnd.choice([0, 90, 180, 270])])
            if ch == 'Z': zombies.append([c, r, sid('Zombie'), rnd.choice([0, 90, 180, 270])])
            if ch == 'V': zombies.append([c, r, sid('Girl'), rnd.choice([0, 90, 180, 270])])
            if ch in 'RBG': keys.append([c, r, sid('Key' + ch), 0])
            if ch == 'C':
                # Face to the camera, whatever wall is near: the open lid and the potions in it in sight.
                chests.append([c, r, sid('Chest'), CHEST_YAW])
            if ch == 'P': player = (c, r)
    for name, c, r, rot in spec.get('furniture', []):
        assert name in FURNITURE, name
        assert at(c, r) == '.', ('furniture on', at(c, r), name, c, r)
        if name == 'Shelf':
            rot = shelf_rotation(at, c, r, W, H)
        furniture.append([c, r, sid(name), rot])

    # Playable: keys picked up on the way, doors of the colours held opened, the gate reached.
    lock = {(c, r) for r in range(H) for c in range(W) if MAP[r][c] in 'rbg'}
    keyat = {MAP[r][c]: (c, r) for r in range(H) for c in range(W) if MAP[r][c] in 'RBG'}
    gate = [(c, r) for r in range(H) for c in range(W) if MAP[r][c] == 'E'][0]
    held = set(); order = []
    while True:
        seen = {player}; q = deque([player])
        while q:
            c, r = q.popleft()
            for dc, dr in DIRS.values():
                n = (c + dc, r + dr); ch = at(*n)
                if n in seen: continue
                if ch in PASS or ch == 'D' or (ch in 'rbg' and ch.upper() in held):
                    seen.add(n); q.append(n)
        got = {k for k, pos in keyat.items() if pos in seen} - held
        if not got: break
        held |= got; order.append(sorted(got))
    near_gate = any((gate[0] + dc, gate[1] + dr) in seen for dc, dr in DIRS.values())
    cells = {(c, r) for c, r, _, _ in floor}
    assert near_gate and cells <= seen, ('unreachable', sorted(cells - seen), 'gate', near_gate)
    assert len(levers) == 1, 'one lever opens the gate'

    oc, orr = W // 2, H // 2
    # One tile to a cell: a tile with a floor of its own takes the place of the floor, never lies on it.
    tiles = Counter((cell[0], cell[1]) for cell in floor + walls + levers)
    doubled = [cell for cell, count in tiles.items() if count > 1]
    assert not doubled, (spec['name'], 'more than one tile in a cell', doubled)
    layers = [('Floor', floor), ('Walls', walls), ('Zombies', zombies), ('Keys', keys), ('Chests', chests), ('Furniture', furniture), ('Levers', levers)]
    doc = {'version': 1, 'name': spec['name'], 'width': W, 'height': H, 'parent': None, 'palette': palette,
           'layers': [{'name': n, 'y': 0, 'visible': True, 'cells': cl} for n, cl in layers if cl], 'built': []}
    extras = {
        'player': [player[0] - oc, player[1] - orr],
        'ammo': spec.get('ammo', 5),
        'buttons': [{'button': [b[0] - oc, b[1] - orr], 'doors': [[d[0] - oc, d[1] - orr] for d in ds]} for b, ds in spec.get('buttons', [])],
        'fire': [{'at': [c - oc, r - orr], 'phase': p} for (c, r), p in spec.get('fire', {}).items()],
        'spikes': [{'at': [c - oc, r - orr], 'phase': p} for (c, r), p in spec.get('spikes', {}).items()],
        'pendulums': [{'at': [c - oc, r - orr], 'phase': ph} for (c, r), (_, ph) in spec.get('pendulums', {}).items()],
        'gargoyles': [{'at': [c - oc, r - orr], 'phase': ph} for (c, r), (_, ph) in sorted(spec.get('gargoyles', {}).items())],
        'wallSpikes': [{'at': [c - oc, r - orr], 'phase': (v[1] if isinstance(v, tuple) else (i % 2) * 1.5)}
                       for i, ((c, r), v) in enumerate(sorted(spec.get('wall_spikes', {}).items()))],
    }
    for b in spec.get('buttons', []):
        assert at(*b[0]) == 'O', ('no button at', b[0])
        for d in b[1]: assert at(*d) == 'D', ('no plain door at', d)
    inv = {v: k for k, v in slot.items()}
    print(spec['name'], 'size', W, H, 'player', player, 'keys in order', order)
    for n, cl in layers:
        if cl: print(' ', n, dict(Counter(inv[x[2]] for x in cl)))
    return doc, extras


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1]))
    spec['buttons'] = [(tuple(b), [tuple(d) for d in ds]) for b, ds in spec.get('buttons', [])]
    spec['fire'] = {tuple(map(int, k.split(','))): v for k, v in spec.get('fire', {}).items()}
    spec['spikes'] = {tuple(map(int, k.split(','))): v for k, v in spec.get('spikes', {}).items()}
    doc, extras = generate(spec)
    json.dump({'doc': doc, 'extras': extras}, open(sys.argv[2], 'w'), indent=1)
