import json, sys
from gen_level import generate

def wave(cells, step, cycle=5.0):
    # phase so that the gap in the fire runs along the cells at `step` seconds per cell
    return {c: round((cycle - (i * step) % cycle) % cycle, 2) for i, c in enumerate(cells)}

L = {}
L[1] = json.load(open('level1.spec.json'))

L[2] = {"name": "Level_2", "ammo": 3, "map": [
 "#################",
 "#.....#.........#",
 "#.P...#..Z...Z..#",
 "W..C..D.........#",
 "#.....#....Z....#",
 "#.....#.........#",
 "##############D##",
 "#.........#....C#",
 "#.L.......#.....#",
 "#......Z..r..R..#",
 "#...Z.....#.....#",
 "#.........#..Z..#",
 "###E#############"],
 "furniture": [["Crate",8,1,0],["Chair",11,1,0],["Crate",12,5,0],["Chair",15,3,0],["Table",10,3,0],["Bench",13,3,90],
   ["Chair",12,8,0],["Candelabra",15,11,0],
   ["Table",6,7,0],["Bench",6,8,90],["Bench",6,9,90],["Shelf",6,10,90],["Table",6,11,0],["Crate",8,8,0],["Chair",3,8,0],["Bed",1,11,0]]}

L[3] = {"name": "Level_3", "ammo": 3, "map": [
 "#################",
 "#...#...........#",
 "#.P.D..Z........#",
 "#.C.#.......Z..B#",
 "#...#...........#",
 "#####...Z.......#",
 "#...#.........Z.#",
 "#.L.b...........#",
 "#...#...Z.......#",
 "##E##############"],
 "barrels": True,
 "furniture": [["Crate",5,1,0],["Chair",11,1,0],["Candelabra",1,1,0]]}

L[4] = {"name": "Level_4", "ammo": 3, "map": [
 "###############",
 "#.....#.......#",
 "#.P...#...Z...#",
 "#.C...#.....L.#",
 "#.....#.......#",
 "#...O.#.......#",
 "####D######D###",
 "#.............#",
 "#..O....Z.....#",
 "#.............#",
 "#.......Z.....#",
 "#.............#",
 "#######E#######"],
 "buttons": [[[4,5],[[4,6]]], [[3,8],[[11,6]]]],
 "furniture": [["Crate",4,8,0],["Bed",1,1,0],["Candelabra",5,1,0],["Chair",12,7,0],["Crate",1,11,0],["Table",13,1,0],["Shelf",13,11,90]]}

L[5] = {"name": "Level_5", "ammo": 3, "map": [
 "#################",
 "#...#.....~....C#",
 "#.P.D.....~..Z..#",
 "#.C.#.....~.....#",
 "#...#..Z..~.....#",
 "#####.....~..R..#",
 "#...#~~~~~~~~~~~#",
 "#.L.rS....~.....#",
 "#...#..Z..~...Z.#",
 "#...#.....~.....#",
 "#...#.....~.....#",
 "#...#.....~.....#",
 "##E##############"],
 "furniture": [["Crate",7,2,0],["Chair",12,3,0],["Crate",8,9,0],["Chair",13,10,0],["Bench",7,1,0],["Table",14,9,0],["Candelabra",15,11,0]]}

corr = [(c, 7) for c in range(2, 15)]
fire6 = wave(corr, 0.5)
for c in (9, 10, 11): fire6[(10, c)] = 0
for c in (9, 10, 11): fire6[(4, c)] = 2.5
L[6] = {"name": "Level_6", "ammo": 3, "map": [
 "#################",
 "#.....#.........#",
 "#.P.C.#..Z...Z..#",
 "#.....D.........#",
 "#.....#....R....#",
 "#.....#.........#",
 "#r###############",
 "#.FFFFFFFFFFFFF.#",
 "###############.#",
 "#.L.F.....F.....#",
 "#...F.Z...F..Z..#",
 "#...F.....F.....#",
 "########E########"],
 "fire": {f"{c},{r}": p for (c, r), p in fire6.items()},
 "furniture": [["Crate",8,1,0],["Chair",14,5,0],["Table",11,2,0],["Crate",7,11,0],["Chair",12,11,0],["Bed",1,11,0]]}

L[7] = {"name": "Level_7", "ammo": 3, "map": [
 "###################",
 "#.....#.....#.....#",
 "#..B..#..Z..#..G..#",
 "#.....#..R..#.....#",
 "#.Z...#.....#...Z.#",
 "#....C#.....#.....#",
 "###r#####D#####b###",
 "#.................#",
 "#..Z....P.C....Z..#",
 "#.................#",
 "#.......S.S.......#",
 "#############g#####",
 "#.L..S...........Z#",
 "#....S............#",
 "#########E#########"],
 "spikes": {"5,12": 0, "5,13": 1.5, "8,10": 0, "10,10": 1.5},
 "furniture": [["Crate",4,7,0],["Chair",14,9,0],["Crate",8,4,0],["Chair",1,1,0],["Crate",17,1,0],["Table",11,12,0],["Bench",14,13,0],["Candelabra",17,7,0]]}

L[8] = {"name": "Level_8", "ammo": 3, "map": [
 "###################",
 "#...#.............#",
 "#.P.D..Z.....Z....#",
 "#.C.#.............#",
 "#...#.....Z....Z..#",
 "#####.............#",
 "#...#~~~~~~~~~~~~~#",
 "#...#.............#",
 "#.L.g...Z....Z....#",
 "#...#.............#",
 "#...#......Z....G.#",
 "#...#.............#",
 "##E################"],
 "barrels": True,
 "furniture": [["Barrel",7,3,0],["Barrel",8,3,0],["Barrel",13,3,0],["Barrel",14,3,0],["Barrel",11,4,0],["Barrel",16,4,0],
   ["Barrel",8,9,0],["Barrel",9,9,0],["Barrel",13,9,0],["Barrel",12,10,0],["Barrel",16,11,0],
   ["Crate",6,1,0],["Chair",17,1,0],["Crate",6,11,0],["Chair",1,1,0]]}

field9 = [(c, r) for r in (1, 2, 3, 4) for c in range(8, 16)]
rows9 = []
for r in range(5):
    row = ''
    for c in range(19):
        if r == 0 or c in (0, 18): row += '#'
        elif (c, r) in field9: row += 'S'
        elif c == 6: row += 'D' if r == 2 else '#'
        elif (c, r) == (17, 1): row += 'O'
        elif (c, r) == (2, 2): row += 'P'
        elif (c, r) == (2, 3): row += 'C'
        else: row += '.'
    rows9.append(row)
L[9] = {"name": "Level_9", "ammo": 3, "map": rows9 + [
 "###############D###",
 "#.........~.......#",
 "#..F.F.F..~..Z....#",
 "#.........~.......#",
 "#.L.......~....C..#",
 "#..F.F.F..~.......#",
 "#.........~...Z...#",
 "######E############"],
 "buttons": [[[17,1],[[15,5]]]],
 "spikes": {f"{c},{r}": round(((15 - c) * 0.375) % 3, 3) for c, r in field9},  # the wave runs from the door in (left) to the far side
 "fire": {"3,7": 0, "5,7": 1, "7,7": 2, "3,10": 2.5, "5,10": 3.5, "7,10": 4.5},
 "furniture": [["Crate",17,3,0],["Chair",16,4,0],["Crate",13,9,0],["Chair",17,11,0],["Bed",1,11,0],["Candelabra",1,1,0]]}

L[10] = {"name": "Level_10", "ammo": 3, "map": [
 "#####################",
 "#.....#.......#.....#",
 "#.P.C.D..Z....#..R..#",
 "#.....#....Z..#.....#",
 "#.....#..B....b..Z..#",
 "#.....#...Z...#.....#",
 "##########r##########",
 "#..~...#......#.....#",
 "#..~...#..O...#...L.#",
 "#..~.Z.#.....F#.....#",
 "#..~.G.D.....Fg..Z..#",
 "#..~...#..Z..F#.....#",
 "#..~C..#......#SSSSS#",
 "#..~...#......#SSSSS#",
 "#################E###"],
 "buttons": [[[10,8],[[7,10]]]],
 "fire": {"13,9": 0, "13,10": 0.8, "13,11": 1.6},
 "spikes": {**{f"{c},12": 0 for c in range(15, 20)}, **{f"{c},13": 1.5 for c in range(15, 20)}},
 "barrels": True,
 "furniture": [["Crate",11,8,0],["Chair",8,1,0],
   ["Crate",1,7,0],["Chair",6,13,0],["Crate",16,7,0],["Table",19,10,0],["Candelabra",1,1,0]]}

# ---- Act two: levels 11-20, bigger, everything learnt in new combinations.
def phases(cells, step, period=2.2):
    return {c: round((i * step) % period, 2) for i, c in enumerate(cells)}

L[11] = {"name": "Level_11", "ammo": 3, "map": [
 "#####################",
 "#.....#.............#",
 "#.P...D..Z......Z...#",
 "#..C..#.............#",
 "#.....#...Z....R....#",
 "#.....#.............#",
 "#################r###",
 "#...................#",
 "#...M..M..M..M..M...#",
 "#...................#",
 "#.###################",
 "#.......Z.......V..L#",
 "#...C.........Z.....#",
 "#......Z.......C....#",
 "##########E##########"],
 "pendulums": {c: (0, p) for c, p in phases([(16, 8), (13, 8), (10, 8), (7, 8), (4, 8)], 0.45).items()},
 "furniture": [["Table", 10, 2, 0], ["Candelabra", 12, 1, 0], ["Bed", 1, 1, 0]]}

L[12] = {"name": "Level_12", "ammo": 3, "map": [
 "#####################",
 "#...#...............#",
 "#.P.D...Z.....Z.....#",
 "#.C.#...........Z...#",
 "#...#....V..........#",
 "#####...Z...........#",
 "#....M.....M.....M..#",
 "#~~~~~~~~~~~~~~~~~~~#",
 "#...................#",
 "#..Z......C....Z..B.#",
 "#.......Z...........#",
 "#########b###########",
 "#.L.....Z.......C...#",
 "#......Z.....V......#",
 "##########E##########"],
 "pendulums": {(5, 6): (0, 0), (11, 6): (0, 0.7), (17, 6): (0, 1.4)},
 "furniture": [["Table", 14, 3, 0], ["Bench", 6, 9, 0]]}

L[13] = {"name": "Level_13", "ammo": 3, "map": [
 "#####################",
 "#.....#.............#",
 "#.P.C.D....V........#",
 "#.....#.........V...#",
 "#.....#.CZ..........#",
 "#.....#......Z....R.#",
 "##############r######",
 "#.........#.........#",
 "#..V...Z..#...Z..V.C#",
 "#.........g.........#",
 "#..Z......#....G....#",
 "#.........#.........#",
 "#.L.......#....Z....#",
 "#.........#.........#",
 "#####E###############"],
 "furniture": [["Table", 9, 2, 0], ["Bench", 13, 4, 90], ["Shelf", 12, 1, 0], ["Bed", 19, 1, 0], ["Table", 5, 11, 0], ["Shelf", 16, 13, 0]]}

L[14] = {"name": "Level_14", "ammo": 3, "map": [
 "#####################",
 "#.....#.............#",
 "#.....#..F..F..F....#",
 "#.P.C.D..........O..#",
 "#.....#..F..F..F....#",
 "#.....#.............#",
 "##########D##########",
 "#...................#",
 "#..Z....Z.....V.....#",
 "#.....FFF...........#",
 "#.....FLF....Z..C...#",
 "#.....FFF.......Z...#",
 "#...........Z.......#",
 "#...................#",
 "##########E##########"],
 "buttons": [[[17, 3], [[10, 6]]]],
 "fire": {**phases([(9, 2), (9, 4), (12, 2), (12, 4), (15, 2), (15, 4)], 0.8, 5.0),
          **{(c, r): 0 for c in (6, 7, 8) for r in (9, 10, 11) if (c, r) != (7, 10)}},
 "furniture": [["Crate", 18, 4, 0], ["Crate", 16, 1, 0], ["Table", 3, 12, 0]]}

L[15] = {"name": "Level_15", "ammo": 3, "barrels": True, "map": [
 "#######################",
 "#...#.................#",
 "#.P.D..Z....Z....Z....#",
 "#.C.#.....Z.....V.....#",
 "#...#..Z.........Z..B.#",
 "#####....V.....Z......#",
 "#...#..Z.....Z........#",
 "#.L.b.....Z.......V...#",
 "#...#..........Z......#",
 "#...#...Z.....C....Z..#",
 "#...#.................#",
 "#C..#.........Z.......#",
 "##E####################"],
 "furniture": [["Barrel", 11, 3, 0], ["Barrel", 12, 4, 0], ["Barrel", 16, 7, 0], ["Barrel", 17, 8, 0], ["Table", 7, 9, 0], ["Bench", 19, 5, 90]]}

L[16] = {"name": "Level_16", "ammo": 3, "map": [
 "#######################",
 "#.....#.......#.......#",
 "#..B..#...G...#...L...#",
 "#.Z...#..V....#.....Z.#",
 "#.....b.......g.......#",
 "#..C..#...S...#...Z...#",
 "###r###################",
 "#.....................#",
 "#..Z......P.......Z...#",
 "#.......C.............#",
 "#.....S.......S.......#",
 "##########D#######D####",
 "#............#........#",
 "#..Z....R....#...Z....#",
 "#......V.....#....M...#",
 "#.....C......#........#",
 "##################E####"],
 "pendulums": {(18, 14): (0, 0)},
 "furniture": [["Table", 16, 8, 0], ["Shelf", 5, 1, 0]]}

L[17] = {"name": "Level_17", "ammo": 3, "map": [
 "#######################",
 "#...#.F...F...F...F...#",
 "#.P.D.###############.#",
 "#.C.#.#.............#.#",
 "#...#.#..Z.....V....#.#",
 "#####.#.............#.#",
 "#.....#.....C.......#.#",
 "#.#########D#########F#",
 "#.#...................#",
 "#.#..SSS....MZ....SSS.#",
 "#.#..SLS..........S.S.#",
 "#.#..SSS.....Z....SSS.#",
 "#.D......M.......M....#",
 "#.#...................#",
 "#####E#################"],
 "pendulums": {(12, 9): (0, 0), (9, 12): (0, 0.7), (17, 12): (0, 1.4)},
 "fire": {**phases([(6, 1), (10, 1), (14, 1), (18, 1)], 0.6, 5.0), (21, 7): 2.5},
 "spikes": {**{(c, r): 0 for c in (5, 6, 7) for r in (9, 10, 11) if (c, r) != (6, 10)},
            **{(c, r): 1.5 for c in (18, 19, 20) for r in (9, 10, 11) if (c, r) != (19, 10)}},
 "furniture": [["Crate", 9, 6, 0], ["Bench", 16, 6, 0]]}

L[18] = {"name": "Level_18", "ammo": 3, "barrels": True, "map": [
 "#######################",
 "#...#.................#",
 "#.P.D...Z...Z...Z.....#",
 "#.C.#.................#",
 "#...#..Z.....V....Z...#",
 "#####.................#",
 "#.....Z.....Z......Z..#",
 "#.........C...........#",
 "#..Z....V.......Z.....#",
 "#.....................#",
 "#.....Z......Z.....V..#",
 "#..........C..........#",
 "#...Z.....Z.......Z...#",
 "#.....................#",
 "#..Z......Z........L..#",
 "#.........C...........#",
 "###########E###########"],
 "furniture": [["Table", 7, 7, 0], ["Table", 15, 9, 90], ["Bench", 5, 12, 0], ["Bench", 17, 5, 90], ["Shelf", 11, 13, 0], ["Bed", 20, 11, 0],
               ["Barrel", 12, 7, 0], ["Barrel", 13, 7, 0], ["Barrel", 7, 10, 0], ["Barrel", 16, 12, 0]]}

L[19] = {"name": "Level_19", "ammo": 3, "map": [
 "#######################",
 "#.....#...~...#.......#",
 "#.P.C.D...~...b...G...#",
 "#.....#...~...#..V....#",
 "#.....#.Z.~.Z.#.....Z.#",
 "#..O..#...~...#.......#",
 "###D#######.###########",
 "#.........~...........#",
 "#..Z......~.M...Z...C.#",
 "#.....B...~.......V...#",
 "#~~~~~~~~~~~~~~~~~~~~~#",
 "##########g############",
 "#.....................#",
 "#..F.F.F.L.F.F.F......#",
 "#.......Z.......Z.....#",
 "#............C........#",
 "###########E###########"],
 "buttons": [[[3, 5], [[3, 6]]]],
 "pendulums": {(12, 8): (0, 0)},
 "fire": phases([(3, 13), (5, 13), (7, 13), (11, 13), (13, 13), (15, 13)], 0.5, 5.0),
 "furniture": [["Crate", 18, 8, 0], ["Table", 4, 8, 0]]}

L[20] = {"name": "Level_20", "ammo": 3, "barrels": True, "map": [
 "#######################",
 "#.....#.......#.......#",
 "#.P.C.D...V...r...B...#",
 "#.....#.Z...Z.#.F.F.F.#",
 "#.....#...R...#.......#",
 "#.....#.Z...Z.#..Z.V..#",
 "##########.############",
 "#.....................#",
 "#..Z.....~~~~~~~~~....#",
 "#......C.~...M...~..Z.#",
 "#........~...V...~....#",
 "#####b#######g#####D###",
 "#.......#.......#.....#",
 "#...G...#.S.L.S.#..C..#",
 "#..Z..V.#.SSSSS.#.....#",
 "#.......#...Z...#.....#",
 "###################E###"],
 "pendulums": {(13, 9): (0, 0)},
 "fire": phases([(16, 3), (18, 3), (20, 3)], 0.7, 5.0),
 "spikes": {(10, 13): 0, (14, 13): 1.5, **{(c, 14): (0 if c % 2 else 1.5) for c in range(10, 15)}},
 "furniture": [["Table", 21, 13, 0], ["Shelf", 1, 12, 0]]}

out = {}

import random as _random
WALLS = '#WDrbgE'
def double(spec, seed):
    rnd = _random.Random(seed)
    m = [list(r) for r in spec['map']]
    H, W = len(m), len(m[0])
    furn = {(c, r) for _, c, r, _ in spec.get('furniture', [])}
    busy = set(furn)
    for b, ds in spec.get('buttons', []): pass
    N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    def floor(c, r): return 0 <= r < H and 0 <= c < W and m[r][c] not in WALLS
    # rooms: floor regions, doors split them
    room = {}
    for r in range(H):
        for c in range(W):
            if floor(c, r) and (c, r) not in room:
                k = len(set(room.values())); st = [(c, r)]
                while st:
                    p = st.pop()
                    if p in room or not floor(*p): continue
                    room[p] = k; st += [(p[0] + dc, p[1] + dr) for dc, dr in N4]
    player = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    def free(c, r, open_sides):
        if m[r][c] != '.' or (c, r) in busy: return False
        if any(0 <= r + dr < H and 0 <= c + dc < W and m[r + dr][c + dc] in 'DrbgE' for dc, dr in N4): return False
        # not next to a door diagonally either, and roomy enough not to bar a way
        if any(m[r + dr][c + dc] in 'DrbgE' for dc in (-1, 0, 1) for dr in (-1, 0, 1) if 0 <= r + dr < H and 0 <= c + dc < W): return False
        return sum(floor(c + dc, r + dr) for dc, dr in N4) >= open_sides
    zombies = [(c, r) for r in range(H) for c in range(W) if m[r][c] == 'Z']
    chests = [(c, r) for r in range(H) for c in range(W) if m[r][c] == 'C']
    added = []
    for z in zombies:
        cands = [(c, r) for (c, r), k in room.items() if k == room[z] and free(c, r, 2)
                 and 2 <= abs(c - z[0]) + abs(r - z[1]) <= 4 and abs(c - player[0]) + abs(r - player[1]) >= 4
                 and all(abs(c - a) + abs(r - b) >= 2 for a, b in zombies + added)]
        if not cands: print('  no room for a zombie near', z); continue
        p = rnd.choice(cands); m[p[1]][p[0]] = 'Z'; added.append(p)
    new_chests = []
    for ch in chests:
        cands = [(c, r) for (c, r) in room if free(c, r, 4)
                 and all(abs(c - a) + abs(r - b) >= 4 for a, b in chests + new_chests)]
        if not cands: print('  no room for a chest'); continue
        # far from the other chests, in a room with zombies if there is one
        zr = {room[z] for z in zombies}
        p = max(cands, key=lambda q: (room[q] in zr, min(abs(q[0] - a) + abs(q[1] - b) for a, b in chests + new_chests), rnd.random()))
        m[p[1]][p[0]] = 'C'; new_chests.append(p); busy.add(p)
    spec['map'] = [''.join(r) for r in m]
    print(spec['name'], 'zombies', len(zombies), '->', len(zombies) + len(added), 'chests', len(chests), '->', len(chests) + len(new_chests))


import math as _math
from collections import deque as _deque
def place_barrels(spec, per=3, near=3.0, far=4.5, apart=2.0):
    """Barrels are the player's weapon: taken and thrown at a crowd, shot in the air. One for
    every `per` zombies of a room, lying on the player's way in, out of a blast's reach of the
    zombies (`near`) but with them within a shot (`far`), apart so they do not chain."""
    m = spec['map']; H, W = len(m), len(m[0])
    furn = {(c, r) for _, c, r, _ in spec.get('furniture', [])}
    N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    fl = lambda c, r: 0 <= r < H and 0 <= c < W and m[r][c] not in WALLS
    room = {}
    for r in range(H):
        for c in range(W):
            if fl(c, r) and (c, r) not in room:
                k = len(set(room.values())); st = [(c, r)]
                while st:
                    p = st.pop()
                    if p in room or not fl(*p): continue
                    room[p] = k; st += [(p[0] + dc, p[1] + dr) for dc, dr in N4]
    player = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    # walking distance from the start, doors of any kind passable
    dist = {player: 0}; q = _deque([player])
    while q:
        c, r = q.popleft()
        for dc, dr in N4:
            n = (c + dc, r + dr)
            if n in dist or not (0 <= n[1] < H and 0 <= n[0] < W) or m[n[1]][n[0]] in '#W': continue
            dist[n] = dist[(c, r)] + 1; q.append(n)
    zombies = [(c, r) for r in range(H) for c in range(W) if m[r][c] == 'Z']
    placed = [(c, r) for n, c, r, _ in spec.get('furniture', []) if n == 'Barrel']
    added = []
    for k in sorted({room[z] for z in zombies}):
        crowd = [z for z in zombies if room[z] == k]
        if len(crowd) < 2: continue
        def ok(c, r, near=None, far=None):
            near, far = _nf[0], _nf[1]
            if m[r][c] != '.' or (c, r) in furn: return False
            if any(0 <= r + dr < H and 0 <= c + dc < W and m[r + dr][c + dc] in 'DrbgE' for dc in (-1, 0, 1) for dr in (-1, 0, 1)): return False
            if sum(fl(c + dc, r + dr) for dc, dr in N4) < 3: return False
            gap = min(_math.hypot(c - a, r - b) for a, b in zombies)
            if not (near <= gap and min(_math.hypot(c - a, r - b) for a, b in crowd) <= far): return False
            return all(_math.hypot(c - a, r - b) >= apart for a, b in placed + added)
        for _ in range(_math.ceil(len(crowd) / per)):
            cands = []
            # crowded rooms: step closer to the zombies, never into a blast's reach of them
            for _nf in ((3.0, 4.5), (2.5, 5.0), (2.1, 5.5)):
                cands = [p for p, kk in room.items() if kk == k and ok(*p)]
                if cands: break
            if not cands: print('  no spot for a barrel in room', k); break
            p = min(cands, key=lambda p: (dist.get(p, 999), p))
            added.append(p); furn.add(p)
    spec.setdefault('furniture', []).extend([['Barrel', c, r, 0] for c, r in added])
    print(spec['name'], 'barrels on the way in:', added)


GIRLS = {4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 1, 10: 3}
THROWABLE = ('Crate', 'Chair', 'Candelabra')

def _rooms(m):
    H, W = len(m), len(m[0]); N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    fl = lambda c, r: 0 <= r < H and 0 <= c < W and m[r][c] not in WALLS
    room = {}
    for r in range(H):
        for c in range(W):
            if fl(c, r) and (c, r) not in room:
                k = len(set(room.values())); st = [(c, r)]
                while st:
                    p = st.pop()
                    if p in room or not fl(*p): continue
                    room[p] = k; st += [(p[0] + dc, p[1] + dr) for dc, dr in N4]
    return room

def _walk(m, start):
    H, W = len(m), len(m[0]); dist = {start: 0}; q = _deque([start])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (c + dc, r + dr)
            if n in dist or not (0 <= n[1] < H and 0 <= n[0] < W) or m[n[1]][n[0]] in '#W': continue
            dist[n] = dist[(c, r)] + 1; q.append(n)
    return dist

def place_girls(spec, count):
    """Girls in the roomiest rooms with zombies, not the start one: each takes the place of the
    zombie deepest into the room from the way in — she wants room to run for things."""
    m = [list(r) for r in spec['map']]; H, W = len(m), len(m[0])
    room = _rooms(spec['map'])
    player = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    dist = _walk(spec['map'], player)
    size = {}
    for p, k in room.items(): size[k] = size.get(k, 0) + 1
    zombies = [(c, r) for r in range(H) for c in range(W) if m[r][c] == 'Z']
    rooms = sorted({room[z] for z in zombies if room[z] != room[player]}, key=lambda k: -size[k])
    placed = []
    for i in range(count):
        if not rooms: break
        k = rooms[i % len(rooms)]
        cands = [z for z in zombies if room[z] == k and z not in placed]
        if not cands: continue
        z = max(cands, key=lambda z: dist.get(z, 0))
        m[z[1]][z[0]] = 'V'; placed.append(z)
    spec['map'] = [''.join(r) for r in m]
    print(spec['name'], 'girls at', placed)

def place_throwables(spec, want=3, rnd_seed=0):
    """Enough to throw in every girl's room: small furniture, no barrels, apart from each other,
    not right by her, not by a door."""
    rnd = _random.Random(rnd_seed)
    m = spec['map']; H, W = len(m), len(m[0])
    room = _rooms(m)
    furn = spec.setdefault('furniture', [])
    taken = {(c, r) for _, c, r, _ in furn}
    N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    fl = lambda c, r: 0 <= r < H and 0 <= c < W and m[r][c] not in WALLS
    girls = [(c, r) for r in range(H) for c in range(W) if m[r][c] == 'V']
    added = []
    for k in sorted({room[g] for g in girls}):
        have = [(c, r) for n, c, r, _ in furn if n in THROWABLE and room.get((c, r)) == k]
        need = want * sum(1 for g in girls if room[g] == k) - len(have)
        mine = [g for g in girls if room[g] == k]
        for _ in range(max(0, need)):
            cands = [p for p, kk in room.items() if kk == k and m[p[1]][p[0]] == '.' and p not in taken
                     and not any(0 <= p[1] + dr < H and 0 <= p[0] + dc < W and m[p[1] + dr][p[0] + dc] in 'DrbgE' for dc in (-1, 0, 1) for dr in (-1, 0, 1))
                     and sum(fl(p[0] + dc, p[1] + dr) for dc, dr in N4) >= 3
                     and min(_math.hypot(p[0] - a, p[1] - b) for a, b in mine) >= 1.5
                     and all(_math.hypot(p[0] - a, p[1] - b) >= 1.5 for a, b in have)]
            if not cands: print('  no spot for a throwable in room', k); break
            # spread: far from what is already there
            p = max(cands, key=lambda q: (min([_math.hypot(q[0] - a, q[1] - b) for a, b in have] or [9]), rnd.random()))
            name = rnd.choice(THROWABLE)
            furn.append([name, p[0], p[1], rnd.choice([0, 90, 180, 270])]); taken.add(p); have.append(p); added.append((name, p))
    print(spec['name'], 'throwables added:', added)


# Wall spikes close the way round floor spikes: where one could slip past them sideways, along a
# wall — a door's jambs beside the spikes in front of it, the gap between two spikes at a wall.
WALL_SPIKES = {
    1: {(6, 8): 'E', (6, 10): 'E'},
    5: {(4, 6): 'E', (4, 8): 'E'},
    7: {(9, 11): 'N'},
    9: {(14, 5): 'N', (16, 5): 'N'},
}

def place_wall_spikes(spec, where):
    m = [list(r) for r in spec['map']]
    for (c, r), side in where.items():
        assert m[r][c] == '#', (spec['name'], 'not a plain wall at', c, r, m[r][c])
        m[r][c] = 'X'
    spec['map'] = [''.join(r) for r in m]
    spec['wall_spikes'] = dict(where)


# Pendulums in the first ten, where they add to what a level is about.
PENDULUMS = {
    # A pendulum swings along the way through it; its frame's posts stand at the sides.
    # Only on open floor, never in a doorway or a one-cell passage: it has to be possible to get past.
    4: {(10, 8): (90, 0), (10, 10): (90, 1.1)},  # in the lower hall, a pair out of step on the way from the far button to its door
    6: {(14, 9): (0, 0.6), (14, 11): (0, 1.7)},  # the room below, a pair out of step on the way to the gate
    7: {(12, 10): (0, 0), (14, 10): (0, 1.1)},  # either side of the way to the green door, swinging into it together
    10: {(4, 9): (90, 0)},    # the green key's room, on the way to it
}

def place_pendulums(spec, where):
    m = [list(r) for r in spec['map']]
    for (c, r) in where:
        assert m[r][c] == '.', (spec['name'], 'no free floor for a pendulum at', c, r, m[r][c])
        m[r][c] = 'M'
    spec['map'] = [''.join(r) for r in m]
    spec['pendulums'] = dict(where)

def scale_up(spec, factor, seed):
    """Every kind of enemy and the chests `factor` times as many: the extra ones in the rooms the
    others are in, near them — the same rules as doubling."""
    rnd = _random.Random(seed)
    m = [list(r) for r in spec['map']]
    H, W = len(m), len(m[0])
    busy = {(c, r) for _, c, r, _ in spec.get('furniture', [])}
    N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    fl = lambda c, r: 0 <= r < H and 0 <= c < W and m[r][c] not in WALLS
    room = _rooms(spec['map'])
    player = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    def free(c, r, sides):
        if m[r][c] != '.' or (c, r) in busy: return False
        if any(m[r + dr][c + dc] in 'DrbgE' for dc in (-1, 0, 1) for dr in (-1, 0, 1) if 0 <= r + dr < H and 0 <= c + dc < W): return False
        return sum(fl(c + dc, r + dr) for dc, dr in N4) >= sides
    report = []
    for kind, sides, near in (('Z', 2, 4), ('V', 2, 4), ('C', 4, 99)):
        have = [(c, r) for r in range(H) for c in range(W) if m[r][c] == kind]
        extra = int(len(have) * (factor - 1) + 0.5)
        added = []
        for i in range(extra):
            src = have[i % len(have)]
            mates = have + added
            zrooms = {room[p] for p in [(c, r) for r in range(H) for c in range(W) if m[r][c] in 'ZV']}
            ok_room = (lambda k: k in zrooms) if kind == 'C' else (lambda k: k == room[src])
            cands = [(c, r) for (c, r), k in room.items() if ok_room(k) and free(c, r, sides)
                     and abs(c - src[0]) + abs(r - src[1]) <= near
                     and abs(c - player[0]) + abs(r - player[1]) >= 4
                     and all(abs(c - a) + abs(r - b) >= (4 if kind == 'C' else 2) for a, b in mates)]
            if not cands:
                continue
            p = rnd.choice(cands); m[p[1]][p[0]] = kind; added.append(p)
        report.append(f"{kind} {len(have)}->{len(have) + len(added)}")
    spec['map'] = [''.join(r) for r in m]
    print(spec['name'], 'x' + str(factor), ', '.join(report))


def close_spike_lanes(spec):
    """Floor spikes hurt a square a little short of their cell's edges, and the player can slip
    between them and a wall they lie against. So a straight wall right beside floor spikes gets
    wall spikes, blades towards them and in step with them: the way along the wall is shut
    exactly while the spikes are up. Along a longer wall every other tile is enough — the lane
    is cut wherever it runs."""
    m = [list(r) for r in spec['map']]
    H, W = len(m), len(m[0])
    at = lambda c, r: m[r][c] if 0 <= r < H and 0 <= c < W else ' '
    wallch = '#WDrbgEXH'
    D4 = {'N': (0, -1), 'S': (0, 1), 'W': (-1, 0), 'E': (1, 0)}
    OPP = {'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}
    spikes = {tuple(map(int, k.split(','))) if isinstance(k, str) else k: v for k, v in spec.get('spikes', {}).items()}
    ws = {k: (v[0] if isinstance(v, tuple) else v) for k, v in spec.get('wall_spikes', {}).items()}
    lane = dict(ws)  # wall cell -> side it faces, the ones there already and the candidates
    for r in range(H):
        for c in range(W):
            if m[r][c] != 'S':
                continue
            for d, (dc, dr) in D4.items():
                wc, wr = c + dc, r + dr
                if at(wc, wr) != '#' or (wc, wr) in lane:
                    continue
                arms = {k for k, (ac, ar) in D4.items() if at(wc + ac, wr + ar) in wallch}
                if not (arms <= {'N', 'S'} or arms <= {'E', 'W'}):
                    continue  # a corner or a joint: no straight wall to put blades in
                lane[(wc, wr)] = OPP[d]
    # Runs along one wall, facing one way; every other tile of a run of three and more.
    added, seen = [], set()
    for cell in sorted(lane):
        if cell in seen:
            continue
        side = lane[cell]
        step = (1, 0) if side in 'NS' else (0, 1)
        run, p = [], cell
        while p in lane and lane[p] == side:
            run.append(p); seen.add(p); p = (p[0] + step[0], p[1] + step[1])
        for i, p in enumerate(run):
            if p in ws or len(run) < 3 or i % 2 == 0:
                if p not in ws:
                    m[p[1]][p[0]] = 'X'; added.append(p)
                ws[p] = side
    # In step with the floor spikes each one faces.
    out = {}
    for (c, r), side in ws.items():
        dc, dr = D4[side]
        out[(c, r)] = (side, spikes.get((c + dc, r + dr), 0))
    spec['map'] = [''.join(r) for r in m]
    spec['wall_spikes'] = out
    if added:
        print(spec['name'], 'spike lanes shut by wall spikes at', added)

def close_fire_lanes(spec):
    """A fire vent one floor tile off a wall leaves a lane between its flame and the wall to walk
    round it by. The wall in line with the vent gets wall spikes facing it, so going round the
    fire is a gamble too. Only a real lane counts: floor on both sides of the tile along the
    wall — a fire filling a corridor, or a dead end, has no way round. Neighbours take turns."""
    m = [list(r) for r in spec['map']]
    H, W = len(m), len(m[0])
    at = lambda c, r: m[r][c] if 0 <= r < H and 0 <= c < W else ' '
    wallch = '#WDrbgEXH'
    D4 = {'N': (0, -1), 'S': (0, 1), 'W': (-1, 0), 'E': (1, 0)}
    OPP = {'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}
    ws = dict(spec.get('wall_spikes', {}))
    added = []
    for r in range(H):
        for c in range(W):
            if m[r][c] != 'F':
                continue
            for d, (dc, dr) in D4.items():
                lc, lr = c + dc, r + dr
                wc, wr = c + 2 * dc, r + 2 * dr
                if at(lc, lr) in wallch + ' FSM' or at(wc, wr) != '#':
                    continue
                if at(lc + dr, lr + dc) in wallch + ' ' or at(lc - dr, lr - dc) in wallch + ' ':
                    continue  # no lane along the wall here
                arms = {a for a, (ac, ar) in D4.items() if at(wc + ac, wr + ar) in wallch}
                if not (arms <= {'N', 'S'} or arms <= {'E', 'W'}):
                    continue
                m[wr][wc] = 'X'
                ws[(wc, wr)] = (OPP[d], (len(added) % 2) * 1.5)
                added.append((wc, wr))
    spec['map'] = [''.join(r) for r in m]
    spec['wall_spikes'] = ws
    if added:
        print(spec['name'], 'fire lanes shut by wall spikes at', added)

def drop_hidden_wall_spikes(spec):
    """Blades facing north come out of a wall's back — the camera looks at walls from the south
    and never sees them coming. Any such wall spikes are plain walls again."""
    m = [list(r) for r in spec['map']]
    ws = dict(spec.get('wall_spikes', {}))
    dropped = []
    for (c, r), v in list(ws.items()):
        if (v[0] if isinstance(v, tuple) else v) == 'N':
            del ws[(c, r)]
            m[r][c] = '#'
            dropped.append((c, r))
    spec['map'] = [''.join(r) for r in m]
    spec['wall_spikes'] = ws
    if dropped:
        print(spec['name'], 'wall spikes on a wall back dropped at', dropped)

def gargoyle_count(n):
    return 0 if n < 5 else 1 if n <= 10 else 2 if n <= 15 else 3


def _must_cross(m, cut):
    """Does every way from the start to some key, the lever or the gate cross `cut`? Doors of
    any kind count as open: a head covers the way the player has to go, whatever the order."""
    H, W = len(m), len(m[0])
    at = lambda c, r: m[r][c] if 0 <= r < H and 0 <= c < W else ' '
    start = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    targets = [(c, r) for r in range(H) for c in range(W) if m[r][c] in 'RBGL']
    targets += [(c, r - 1) for r in range(H) for c in range(W) if m[r][c] == 'E']
    seen = {start}; q = _deque([start])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (c + dc, r + dr)
            if p in seen or p in cut or at(*p) in '#WXH ':
                continue
            seen.add(p); q.append(p)
    return any(t not in seen for t in targets)


def _route(m):
    """The tiles of the shortest ways from the start to every key, the lever and the gate."""
    H, W = len(m), len(m[0])
    at = lambda c, r: m[r][c] if 0 <= r < H and 0 <= c < W else ' '
    start = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    targets = [(c, r) for r in range(H) for c in range(W) if m[r][c] in 'RBGL']
    targets += [(c, r - 1) for r in range(H) for c in range(W) if m[r][c] == 'E']
    back = {start: None}; q = _deque([start])
    while q:
        c, r = q.popleft()
        for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p = (c + dc, r + dr)
            if p in back or at(*p) in '#WXH ':
                continue
            back[p] = (c, r); q.append(p)
    tiles = set()
    for t in targets:
        while t in back and t is not None:
            tiles.add(t); t = back[t]
    return tiles


# Heads placed by hand, where the level's author wants them: they replace the ones found by the rules.
GARGOYLES = {
    11: {(0, 7): 'E', (7, 7): 'E', (13, 7): 'E'},  # the corridor's west end and the snake's upper walls, each firing down its stretch
}


def place_gargoyles(spec, n):
    """Fire-spitting heads in the walls, each shooting across the player's way: the line it
    fires along cuts the level so that the player has to cross it to reach a key, the lever or
    the gate — there is no going round. The line runs over open floor from wall to wall, 4 to
    10 tiles, never down a passage one tile wide (beside every tile of it there is floor), so a
    ball is crossed in front of or behind, not outrun. A head looks south, east or west (a
    wall's back is out of sight), stands in a plain stretch of wall away from doors, clear of
    the player's start and of the other heads. Neighbouring heads fire out of step."""
    if n in GARGOYLES:
        m = [list(r) for r in spec['map']]
        chosen = {}
        for i, ((c, r), side) in enumerate(sorted(GARGOYLES[n].items())):
            assert m[r][c] == '#', (spec['name'], 'no plain wall for a head at', c, r, m[r][c])
            m[r][c] = 'H'
            # Out of step, spread over one cycle (2.6 s): a wave along them.
            chosen[(c, r)] = (side, round(i * 2.6 / len(GARGOYLES[n]), 2))
        spec['map'] = [''.join(r) for r in m]
        spec['gargoyles'] = chosen
        print(spec['name'], 'gargoyles by hand', chosen)
        return
    count = gargoyle_count(n)
    if not count:
        return
    import random
    rnd = random.Random(700 + n)
    m = [list(r) for r in spec['map']]
    H, W = len(m), len(m[0])
    at = lambda c, r: m[r][c] if 0 <= r < H and 0 <= c < W else ' '
    wallch = '#WDrbgEXH'
    D4 = {'N': (0, -1), 'S': (0, 1), 'W': (-1, 0), 'E': (1, 0)}
    player = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    free = '.ZVRBGCL~'
    cands = []
    route = _route(m)
    # A longer or shorter line only where no usual one cuts the way; where nothing cuts it (two
    # ways round, a hall too wide), a line across the shortest way to the goals.
    for lo, hi, cut in ((4, 10, True), (3, 14, True), (4, 16, False)):
      if cands: break
      for r in range(H):
          for c in range(W):
              if m[r][c] != '#':
                  continue
              arms = {k for k, (ac, ar) in D4.items() if at(c + ac, r + ar) in wallch}
              if not (arms == {'N', 'S'} or arms == {'E', 'W'}):
                  continue
              if any(at(c + ac, r + ar) in 'DrbgEXH' for ac, ar in D4.values()):
                  continue  # beside a door or other wall trap
              for side in 'SEW':
                  dc, dr = D4[side]
                  if (dc == 0) != ('N' not in arms):
                      continue  # facing along the wall
                  ray, k = [], 1
                  while at(c + dc * k, r + dr * k) not in wallch + ' ':
                      ray.append((c + dc * k, r + dr * k)); k += 1
                  end = at(c + dc * k, r + dr * k)
                  if not (lo <= len(ray) <= hi) or end not in '#X':
                      continue
                  if at(*ray[0]) not in free:
                      continue
                  if not all(any(at(x + sx, y + sy) not in wallch + ' ' for sx, sy in ((dr, dc), (-dr, -dc))) for x, y in ray):
                      continue
                  if min(abs(x - player[0]) + abs(y - player[1]) for x, y in ray) < 3:
                      continue
                  if cut and not _must_cross(m, set(ray)):
                      continue  # the player could go round it
                  if not cut and not (set(ray) & route):
                      continue  # off the way
                  cands.append(((c, r), side, len(ray)))
    rnd.shuffle(cands)
    cands.sort(key=lambda t: -min(t[2], 7))  # long enough to see it coming, first
    chosen = {}
    for cell, side, _ in cands:
        if len(chosen) >= count:
            break
        if any(abs(cell[0] - a) + abs(cell[1] - b) < 5 for a, b in chosen):
            continue
        chosen[cell] = (side, round(len(chosen) * 2.6 / max(count, 1) + rnd.random() * 0.4, 2))
        m[cell[1]][cell[0]] = 'H'
    spec['map'] = [''.join(r) for r in m]
    spec['gargoyles'] = chosen
    print(spec['name'], 'gargoyles on the way', chosen, 'of', len(cands), 'places')


# Walls placed by hand, where the level's author wants them — laid last, over whatever the rules
# made of those cells; a zombie standing there steps to the nearest free floor.
WALLS = {
    3: [(c, 5) for c in range(5, 11)],  # the middle wall run on to the east: the way between the rooms narrows
    5: [(c, 6) for c in range(5, 10)],  # the stream's west half walled over: the rooms meet only over the stream past the cross
}


def walls_by_hand(spec, n):
    if n not in WALLS:
        return
    m = [list(r) for r in spec['map']]
    H, W = len(m), len(m[0])
    furniture = {(f[1], f[2]) for f in spec.get('furniture', [])}
    moved = []
    for c, r in WALLS[n]:
        ch = m[r][c]
        m[r][c] = '#'
        if ch in 'ZV':
            # To the nearest free floor tile, not into the new wall.
            seen = {(c, r)}; q = _deque([(c, r)])
            while q:
                p = q.popleft()
                if m[p[1]][p[0]] == '.' and p not in furniture and p not in WALLS[n]:
                    m[p[1]][p[0]] = ch; moved.append(((c, r), p)); break
                for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    t = (p[0] + dc, p[1] + dr)
                    if t not in seen and 0 <= t[0] < W and 0 <= t[1] < H and m[t[1]][t[0]] not in '#WDrbgEXH':
                        seen.add(t); q.append(t)
        else:
            assert ch in '.#~', (spec['name'], 'a hand wall over', ch, 'at', c, r)
        assert (c, r) not in furniture, (spec['name'], 'furniture under a hand wall at', c, r)
    # A trap in a wall that now faces into the new wall has nothing to face: a plain wall.
    D4 = {'N': (0, -1), 'S': (0, 1), 'W': (-1, 0), 'E': (1, 0)}
    for key in ('wall_spikes', 'gargoyles'):
        traps = dict(spec.get(key, {}))
        for (tc, tr), v in list(traps.items()):
            side = v[0] if isinstance(v, tuple) else v
            dc, dr = D4[side]
            if (tc + dc, tr + dr) in WALLS[n]:
                del traps[(tc, tr)]
                m[tr][tc] = '#'
                moved.append(('trap made a plain wall', (tc, tr)))
        spec[key] = traps
    spec['map'] = [''.join(r) for r in m]
    print(spec['name'], 'walls by hand', WALLS[n], 'moved', moved)


# Spikes placed by hand: floor spikes {cell: phase}, wall spikes {cell: (side the blades face, phase)}.
FLOOR_SPIKES = {
    4: {(10, 7): 0, (10, 11): 1.5},  # before the first pendulum and after the second
    5: {(9, 2): 0, (9, 4): 1.5, (11, 8): 0, (11, 10): 1.5, (13, 7): 0, (15, 7): 1.5},  # three pairs, each taking turns
}
WALL_SPIKES_BY_HAND = {
    4: {(10, 6): ('S', 0)},  # the wall above the first spikes, in step with them
}


def spikes_by_hand(spec, n):
    if n not in FLOOR_SPIKES and n not in WALL_SPIKES_BY_HAND:
        return
    m = [list(r) for r in spec['map']]
    spikes = {tuple(map(int, k.split(','))) if isinstance(k, str) else k: v for k, v in spec.get('spikes', {}).items()}
    for (c, r), phase in FLOOR_SPIKES.get(n, {}).items():
        assert m[r][c] in '.S', (spec['name'], 'no free floor for spikes at', c, r, m[r][c])
        m[r][c] = 'S'
        spikes[(c, r)] = phase
    ws = dict(spec.get('wall_spikes', {}))
    for (c, r), (side, phase) in WALL_SPIKES_BY_HAND.get(n, {}).items():
        assert m[r][c] in '#X', (spec['name'], 'no plain wall for wall spikes at', c, r, m[r][c])
        m[r][c] = 'X'
        ws[(c, r)] = (side, phase)
    spec['map'] = [''.join(r) for r in m]
    spec['spikes'] = spikes
    spec['wall_spikes'] = ws
    print(spec['name'], 'spikes by hand', FLOOR_SPIKES.get(n), WALL_SPIKES_BY_HAND.get(n))


# Barrels placed by hand, where the level's author wants them: kept as they are, on top of the
# ones the crowd rule places.
BARRELS = {
    2: [(7, 3)],  # just inside the door of the first zombie room
    4: [(12, 4)],
    5: [(11, 5)],
    9: [(14, 6)],
}


def barrels_by_hand(spec, n):
    m = [list(row) for row in spec['map']]
    for c, r in BARRELS.get(n, []):
        # The author's scene is what counts: whatever the rules put on that cell makes way.
        if m[r][c] in 'CZVRBG':
            print(spec['name'], 'a hand barrel takes the place of', m[r][c], 'at', (c, r))
            m[r][c] = '.'
        assert m[r][c] == '.', (spec['name'], 'no free floor for a barrel at', c, r, m[r][c])
        spec['furniture'] = [f for f in spec.get('furniture', []) if (f[1], f[2]) != (c, r)]
        spec['furniture'].append(['Barrel', c, r, 0])
    spec['map'] = [''.join(row) for row in m]
    if n in BARRELS:
        print(spec['name'], 'barrels by hand', BARRELS[n])


def barrels_at_crowds(spec, blast=2.1, apart=2.0):
    """Barrels where the zombies crowd: each one on the tile whose blast (`blast`, the barrel's
    reach) catches the most zombies still uncaught — two at the least — so one shot at it
    clears a crowd. Next to them, not on them; on open floor away from doors, apart from the
    other barrels. As many as the level had, fewer when the crowds run out."""
    fur = spec.get('furniture', [])
    want = sum(1 for f in fur if f[0] == 'Barrel')
    if not want:
        return
    fur = [f for f in fur if f[0] != 'Barrel']
    m = spec['map']; H, W = len(m), len(m[0])
    at = lambda c, r: m[r][c] if 0 <= r < H and 0 <= c < W else ' '
    taken = {(c, r) for _, c, r, _ in fur}
    zombies = [(c, r) for r in range(H) for c in range(W) if m[r][c] in 'ZV']
    player = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
    def ok(c, r, placed):
        if m[r][c] != '.' or (c, r) in taken: return False
        if any(at(c + dc, r + dr) in 'DrbgE' for dc in (-1, 0, 1) for dr in (-1, 0, 1)): return False
        if sum(at(c + dc, r + dr) not in '#WDrbgEXH ' for dc, dr in N4) < 3: return False
        if _math.hypot(c - player[0], r - player[1]) < 3: return False
        return all(_math.hypot(c - a, r - b) >= apart for a, b in placed)
    uncaught = set(zombies); placed = []
    while len(placed) < want:
        best = None
        for r in range(H):
            for c in range(W):
                if not ok(c, r, placed): continue
                caught = [z for z in uncaught if _math.hypot(c - z[0], r - z[1]) <= blast]
                # the most zombies, then the closer they stand round it
                key = (len(caught), -sum(_math.hypot(c - z[0], r - z[1]) for z in caught))
                if len(caught) >= 2 and (best is None or key > best[0]):
                    best = (key, (c, r), caught)
        if not best: break
        placed.append(best[1]); taken.add(best[1]); uncaught -= set(best[2])
    spec['furniture'] = fur + [['Barrel', c, r, 0] for c, r in placed]
    print(spec['name'], 'barrels at the crowds:', len(placed), 'of', want, placed)

def scale_down(spec, factor):
    """Every kind of enemy `factor` times fewer, and the chests with them — as many chests to a
    zombie as before. Zombies go from where they stand thickest, so the level thins out evenly
    and a room that had zombies keeps one at least; a level with girls keeps a girl. Chests go
    from the rooms with the fewest zombies to a chest, the one by the start stays."""
    m = [list(r) for r in spec['map']]
    H, W = len(m), len(m[0])
    room = _rooms(spec['map'])
    player = next((c, r) for r in range(H) for c in range(W) if m[r][c] == 'P')
    cells = lambda ch: [(c, r) for r in range(H) for c in range(W) if m[r][c] == ch]
    before = {k: len(cells(k)) for k in 'ZVC'}
    for kind in 'ZV':
        have = cells(kind)
        keep = max(1, round(len(have) / factor)) if have else 0
        while len(have) > keep:
            everyone = cells('Z') + cells('V')
            def crowding(p):
                return min((_math.hypot(p[0] - q[0], p[1] - q[1]) for q in everyone if q != p), default=99)
            per_room = lambda k: sum(1 for q in everyone if room.get(q) == k)
            pick = [p for p in have if per_room(room.get(p)) > 1] or have
            p = min(pick, key=lambda p: (crowding(p), -abs(p[0] - player[0]) - abs(p[1] - player[1])))
            m[p[1]][p[0]] = '.'; have.remove(p)
    zombies = cells('Z') + cells('V')
    chests = cells('C')
    want = max(1, round(len(chests) * len(zombies) / max(1, before['Z'] + before['V']))) if chests else 0
    first = min(chests, key=lambda p: abs(p[0] - player[0]) + abs(p[1] - player[1])) if chests else None
    while len(chests) > want:
        def need(p):
            k = room.get(p)
            z = sum(1 for q in zombies if room.get(q) == k)
            ch = sum(1 for q in chests if room.get(q) == k)
            return (z / ch, -abs(p[0] - player[0]) - abs(p[1] - player[1]))
        p = min((p for p in chests if p != first), key=need)
        m[p[1]][p[0]] = '.'; chests.remove(p)
    spec['map'] = [''.join(r) for r in m]
    print(spec['name'], '/' + str(factor), 'Z %d->%d, V %d->%d, C %d->%d' % (
        before['Z'], len(cells('Z')), before['V'], len(cells('V')), before['C'], len(chests)))

def close_pendulum_lanes(spec):
    """A pendulum over a passage three tiles wide leaves a lane either side of its blade to walk
    past by. Floor spikes on those two tiles — beside the pendulum, across the passage — make
    going round it a gamble too: past the blade, or over the spikes while they are down.
    Pendulums one after another down the same passage make a snake instead: beside each, one
    side is walled off, the other side by turns — below the first, above the next — and there
    only spikes; the way winds from side to side, past every blade. Only where it is such a
    lane: floor on both sides of the pendulum, a wall right past each; furniture there — not."""
    m = [list(r) for r in spec['map']]
    H, W = len(m), len(m[0])
    at = lambda c, r: m[r][c] if 0 <= r < H and 0 <= c < W else ' '
    wallch = '#WDrbgEXH '
    spikes = {tuple(map(int, k.split(','))) if isinstance(k, str) else k: v for k, v in spec.get('spikes', {}).items()}
    furniture = {(fc, fr) for _, fc, fr, _ in spec.get('furniture', [])}
    found = []  # (pendulum, the axis of the passage, its two lane tiles)
    for r in range(H):
        for c in range(W):
            if m[r][c] != 'M':
                continue
            # The passage runs along the axis with floor on both sides; the lanes lie across it.
            for (ac, ar), (lc, lr) in (((1, 0), (0, 1)), ((0, 1), (1, 0))):
                if at(c + ac, r + ar) in wallch or at(c - ac, r - ar) in wallch:
                    continue  # not along this axis
                lanes = [(c + lc, r + lr), (c - lc, r - lr)]
                if not all(at(*p) == '.' and p not in furniture for p in lanes):
                    continue
                if not all(at(p[0] + (p[0] - c), p[1] + (p[1] - r)) in wallch for p in lanes):
                    continue  # the passage is wider: that is open floor, not a lane
                found.append(((c, r), (ac, ar), lanes))
                break
    # Pendulums in one passage: the same line along the same axis.
    runs = {}
    for p, axis, lanes in found:
        line = (axis, p[1] if axis == (1, 0) else p[0])
        runs.setdefault(line, []).append((p, lanes))
    added, walled = [], []
    for run in runs.values():
        run.sort()
        for k, (p, lanes) in enumerate(run):
            if len(run) >= 2:
                wall, spike = (lanes[0], lanes[1]) if k % 2 == 0 else (lanes[1], lanes[0])
                m[wall[1]][wall[0]] = '#'
                walled.append(wall)
                m[spike[1]][spike[0]] = 'S'
                spikes[spike] = (k % 2) * 1.5
                added.append(spike)
            else:
                for i, q in enumerate(lanes):
                    m[q[1]][q[0]] = 'S'
                    spikes[q] = i * 1.5
                added += lanes
    spec['map'] = [''.join(r) for r in m]
    spec['spikes'] = spikes
    if added:
        print(spec['name'], 'pendulum lanes: spikes at', added, 'walls at', walled)

# Floor spikes taken out by hand, after the level is laid out — so the rest of it keeps its tiles:
# {level: {cell as placed (x, z): the turn of the plain floor that takes its place}}.
SPIKES_TAKEN_OUT = {
    7: {(-1, 3): 90, (1, 3): 180},  # the pair on the way to the green door
}
PLAIN_FLOOR = '2d8b57fb-8ca7-4c17-b5e7-a06bce3d053f'
# Floor traps added by hand the same way, over the plain floor laid there:
# {level: {(x, z): (kind, phase[, turn])}}; a kind is its prefab and the list in the extras its timing
# goes to; a pendulum's turn says which way it swings.
TRAPS_ADDED = {
    7: {
        # down the middle of the hall below the red door: spikes and fire by turns
        (-3, 0): ('fire', 0), (-3, 1): ('spikes', 0), (-3, 2): ('fire', 2.5), (-3, 3): ('spikes', 1.5),
    },
    10: {
        # down the column by the stream, with the one at (-6, 2): every other one swinging the other way
        (-6, 0): ('pendulums', 1.1, 90), (-6, 4): ('pendulums', 1.1, 90), (-6, 6): ('pendulums', 0, 90),
    },
}
TRAP_KINDS = {
    'spikes': 'bed8095f-e751-4d9c-ae36-3c7a73a07e8e',  # Tile_Floor_Spikes
    'fire': '0c8d5b03-946a-4418-82ed-20b874efff3f',  # Tile_Floor_Firevent
    'pendulums': '8c1f9334-8659-4357-b2b8-3775c44aa719',  # Tile_Floor_Pendulum
}
PLAIN_FLOORS = (PLAIN_FLOOR, '6edfec28-b1b0-4b24-8307-991be428b044', 'd51eb5bf-5142-43ca-a96e-1ac543761e68')  # Tile_Floor_A, B, C


def traps_added(doc, extras, n):
    add = TRAPS_ADDED.get(n)
    if not add:
        return
    ids = {p['prefab']: p['id'] for p in doc['palette']}
    prefab = {p['id']: p['prefab'] for p in doc['palette']}
    for kind in {k for k, *_ in add.values()}:
        if TRAP_KINDS[kind] not in ids:
            ids[TRAP_KINDS[kind]] = max(p['id'] for p in doc['palette']) + 1
            doc['palette'].append({'id': ids[TRAP_KINDS[kind]], 'prefab': TRAP_KINDS[kind]})
    oc, orr = doc['width'] // 2, doc['height'] // 2
    done = []
    for layer in doc['layers']:
        if layer['name'] != 'Floor':
            continue
        for cell in layer['cells']:
            at = (cell[0] - oc, cell[1] - orr)
            if at in add:
                assert prefab[cell[2]] in PLAIN_FLOORS, (n, 'no plain floor for a trap at', at)
                kind, phase, *turn = add[at]
                cell[2], cell[3] = ids[TRAP_KINDS[kind]], (turn or [0])[0]
                extras.setdefault(kind, []).append({'at': list(at), 'phase': phase})
                done.append(at)
    assert sorted(done) == sorted(add), (n, 'cells for traps not found', add, done)
    print('Level_%d' % n, 'traps added by hand', sorted(done))


def spikes_taken_out(doc, extras, n):
    out = SPIKES_TAKEN_OUT.get(n)
    if not out:
        return
    ids = {p['prefab']: p['id'] for p in doc['palette']}
    if PLAIN_FLOOR not in ids:
        ids[PLAIN_FLOOR] = max(p['id'] for p in doc['palette']) + 1
        doc['palette'].append({'id': ids[PLAIN_FLOOR], 'prefab': PLAIN_FLOOR})
    oc, orr = doc['width'] // 2, doc['height'] // 2
    done = []
    for layer in doc['layers']:
        if layer['name'] != 'Floor':
            continue
        for cell in layer['cells']:
            at = (cell[0] - oc, cell[1] - orr)
            if at in out:
                cell[2], cell[3] = ids[PLAIN_FLOOR], out[at]
                done.append(at)
    assert sorted(done) == sorted(out), (n, 'spikes to take out not found', out, done)
    extras['spikes'] = [s for s in extras['spikes'] if tuple(s['at']) not in out]
    print('Level_%d' % n, 'spikes taken out by hand', done)


# The game is the first ten levels; the specs past them are kept, not built.
LEVEL_COUNT = 10

for n in sorted(k for k in L if k <= LEVEL_COUNT):
    if n in PENDULUMS: place_pendulums(L[n], PENDULUMS[n])
    if n <= 10: double(L[n], n)
    if n in WALL_SPIKES: place_wall_spikes(L[n], WALL_SPIKES[n])
    if n in GIRLS: place_girls(L[n], GIRLS[n])
    if n <= 10: scale_up(L[n], 1.4, 100 + n)
    scale_down(L[n], 1.4)
    if L[n].get('barrels'): place_barrels(L[n])
    barrels_at_crowds(L[n])
    barrels_by_hand(L[n], n)
    if n in GIRLS or n > 10: place_throwables(L[n], rnd_seed=n)
    close_pendulum_lanes(L[n])
    close_spike_lanes(L[n])
    close_fire_lanes(L[n])
    drop_hidden_wall_spikes(L[n])
    place_gargoyles(L[n], n)
    walls_by_hand(L[n], n)
    spikes_by_hand(L[n], n)
    spec = L[n]
    spec['buttons'] = [(tuple(b), [tuple(d) for d in ds]) for b, ds in spec.get('buttons', [])]
    spec['fire'] = {tuple(map(int, k.split(','))) if isinstance(k, str) else k: v for k, v in spec.get('fire', {}).items()}
    spec['spikes'] = {tuple(map(int, k.split(','))) if isinstance(k, str) else k: v for k, v in spec.get('spikes', {}).items()}
    try:
        doc, extras = generate(spec)
        spikes_taken_out(doc, extras, n)
        traps_added(doc, extras, n)
        json.dump({'doc': doc, 'extras': extras}, open(f'level{n}.out.json', 'w'), indent=1)
    except AssertionError as e:
        print('!!', spec['name'], e)
