# Blender (bpy 5.x) script: builds every 3D asset for "Junior Astronaut: Outpost" and exports one GLB per asset.
# Coordinates: Blender Z-up. glTF export converts to Y-up: glTF(x,y,z) = Blender(x, z, -y).
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix

OUT = os.environ.get('OUT', '/tmp/claude-0/blender/out')
os.makedirs(OUT, exist_ok=True)
random.seed(7)

def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
    for c in (bpy.data.meshes, bpy.data.curves):
        for b in list(c):
            if b.users == 0: c.remove(b)

MATS = {}
def mat(name, color, metal=0.0, rough=0.6, emit=None, estr=1.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = estr
    if alpha < 1:
        p.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except Exception: m.blend_method = 'BLEND'
    MATS[name] = m
    return m

def C(r,g,b): return (r/255.0, g/255.0, b/255.0)
M_WHITE = lambda: mat('hull_white', C(214,219,227), 0.1, 0.5)
M_PANEL = lambda: mat('hull_panel', C(205,210,218), 0.3, 0.4)
M_METAL = lambda: mat('metal', C(160,168,180), 0.8, 0.35)
M_DARK  = lambda: mat('dark', C(44,50,64), 0.4, 0.55)
M_GOLD  = lambda: mat('gold_foil', C(224,172,72), 0.9, 0.3)
M_ORANGE= lambda: mat('orange', C(240,120,50), 0.1, 0.5)
M_BLUE  = lambda: mat('fabric_blue', C(52,92,170), 0.0, 0.8)
M_CELL  = lambda: mat('solar_cell', C(22,44,110), 0.6, 0.18)
M_FLOOR = lambda: mat('floor', C(92,98,112), 0.2, 0.75)
M_SCREEN= lambda: mat('screen', C(14,40,70), 0.0, 0.25, emit=C(40,130,220), estr=0.55)
M_LIGHT = lambda: mat('led', C(255,240,210), 0.0, 0.3, emit=C(255,236,200), estr=4.0)
M_GROW  = lambda: mat('grow_led', C(255,120,220), 0.0, 0.3, emit=C(255,90,210), estr=5.0)
M_RED   = lambda: mat('red_light', C(255,70,70), 0.0, 0.3, emit=C(255,40,40), estr=4.0)
M_GLASS = lambda: mat('glass', C(200,225,255), 0.0, 0.05, alpha=0.22)
M_VISOR = lambda: mat('visor', C(230,170,60), 1.0, 0.12)
M_SOIL  = lambda: mat('soil', C(70,48,34), 0.0, 1.0)
M_LEAF  = lambda: mat('leaf', C(70,170,70), 0.0, 0.7)
M_LEAF2 = lambda: mat('leaf_dark', C(40,120,50), 0.0, 0.7)
M_TOMATO= lambda: mat('tomato', C(220,40,30), 0.0, 0.35)
M_WHEAT = lambda: mat('wheat', C(214,180,90), 0.0, 0.7)
M_SKIN  = lambda: mat('skin', C(224,178,140), 0.0, 0.6)
M_HAIR  = lambda: mat('hair', C(40,30,24), 0.0, 0.8)
M_RUBBER= lambda: mat('rubber', C(30,30,32), 0.0, 0.9)
M_YELLOW= lambda: mat('yellow_paint', C(242,178,51), 0.2, 0.5)
M_BED   = lambda: mat('bedding', C(90,130,200), 0.0, 0.9)
M_WOOD  = lambda: mat('composite', C(180,170,150), 0.0, 0.6)

def setmat(o, m):
    o.data.materials.clear(); o.data.materials.append(m); return o

def active(): return bpy.context.view_layer.objects.active

def cube(size, loc, m, name='cube', bevel=0.0, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = active(); o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        md = o.modifiers.new('bv','BEVEL'); md.width = bevel; md.segments = 2
    return setmat(o, m)

def cyl(r, depth, loc, m, name='cyl', verts=24, rot=(0,0,0), r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = active(); o.name = name; return setmat(o, m)

def sphere(r, loc, m, name='sph', seg=24, ring=12, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=r, location=loc)
    o = active(); o.name = name; o.scale = scale; bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    return setmat(o, m)

def torus(R, r, loc, m, name='tor', rot=(0,0,0), maj=32, mnr=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=maj, minor_segments=mnr)
    o = active(); o.name = name; return setmat(o, m)

def smooth(o):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.shade_smooth()
    return o

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        for md in list(o.modifiers):
            try: bpy.ops.object.modifier_apply(modifier=md.name)
            except Exception: pass
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = active(); o.name = name
    return o

def empty_parent(name, children, loc=(0,0,0)):
    bpy.ops.object.empty_add(location=loc); e = active(); e.name = name
    for c in children:
        mw = c.matrix_world.copy(); c.parent = e; c.matrix_world = mw
    return e

def export(name):
    bpy.ops.object.select_all(action='SELECT')
    for o in bpy.context.selected_objects:
        for md in list(o.modifiers):
            bpy.context.view_layer.objects.active = o
            try: bpy.ops.object.modifier_apply(modifier=md.name)
            except Exception: pass
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False, export_apply=True,
                              export_yup=True, export_texcoords=False, export_materials='EXPORT', export_animations=False)
    print('exported', name, os.path.getsize(path))

def dome_with_doors(R, doors, wall_m, name, seg=48, rings=16, door_w=3.2, door_h=3.0):
    """Hemisphere shell (Blender Z up) with rectangular door openings at given azimuths (radians, 0=+X)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings*2, radius=R)
    for v in list(bm.verts):
        if v.co.z < -0.01: bm.verts.remove(v)
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        az = math.atan2(c.y, c.x)
        for d in doors:
            da = (az - d + math.pi) % (2*math.pi) - math.pi
            if abs(da) * R < door_w/2 + 0.2 and c.z < door_h: kill.append(f); break
    bmesh.ops.delete(bm, geom=list(set(kill)), context='FACES')
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    md = o.modifiers.new('sol','SOLIDIFY'); md.thickness = 0.25
    setmat(o, wall_m); smooth(o)
    return o

def tunnel(length, width=3.2, height=3.0, ribs=True, name='tunnel', floor=True, lights=True):
    """Arched pressurised corridor along +X from x=0 to x=length, open at both ends."""
    objs = []
    # arch shell: half cylinder on top of short walls
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=width/2, depth=length, location=(length/2,0,height-width/2), rotation=(0,math.pi/2,0), end_fill_type='NOTHING')
    sh = active(); sh.name='shell'
    bm = bmesh.new(); bm.from_mesh(sh.data)
    for v in list(bm.verts):
        if v.co.x < -0.05 and False: pass
    # keep upper half only (local cylinder axis is Z before rotation: after rotation the "up" is world Z)
    me = sh.data
    bm.free()
    bm = bmesh.new(); bm.from_mesh(me)
    mw = sh.matrix_world
    rm = [v for v in bm.verts if (mw @ v.co).z < height - width/2 - 0.01]
    bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(me); bm.free()
    md = sh.modifiers.new('sol','SOLIDIFY'); md.thickness = 0.18
    setmat(sh, M_WHITE()); smooth(sh); objs.append(sh)
    wall_h = height - width/2
    for s in (-1,1):
        objs.append(cube((length, 0.18, wall_h), (length/2, s*width/2, wall_h/2), M_WHITE(), 'wall'))
    if floor: objs.append(cube((length, width, 0.2), (length/2, 0, 0.1), M_FLOOR(), 'floor'))
    if ribs:
        n = max(2, int(length/1.6))
        for k in range(n+1):
            x = k*length/n
            r = torus(width/2+0.12, 0.08, (x,0,wall_h), M_PANEL(), 'rib', rot=(0,math.pi/2,0), maj=24, mnr=6)
            # keep only the upper arch: the lower half used to poke through the walls and floor
            bpy.context.view_layer.update(); mw = r.matrix_world
            bm = bmesh.new(); bm.from_mesh(r.data)
            rm = [v for v in bm.verts if (mw @ v.co).z < wall_h - 0.02]
            bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(r.data); bm.free()
            objs.append(r)
            for s in (-1,1): objs.append(cube((0.16,0.16,wall_h),(x, s*(width/2+0.1), wall_h/2), M_PANEL(), 'post'))
    if lights:
        objs.append(cube((length*0.96, 0.25, 0.05), (length/2, 0, height-0.05), M_LIGHT(), 'strip'))
    return join(objs, name)

def tube(p0, p1, r, m, name='tube', verts=10, r2=None):
    a, b = Vector(p0), Vector(p1); d = b - a
    o = cyl(r, d.length, tuple((a+b)/2), m, name, verts=verts, r2=r2)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0,0,1)).rotation_difference(d.normalized())
    bpy.ops.object.transform_apply(rotation=True)
    return o

def cut_sphere(o, keep):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co)], context='VERTS'); bm.to_mesh(o.data); bm.free()
    return o

def rack_suit(x, wall_y, front, stripe=False):
    """EMU-style spacesuit hanging on a wall rack. front = +1/-1 (direction from the wall into the room)."""
    o = []; f = front
    y = lambda d: wall_y + f*d
    o.append(cube((0.72, 0.05, 1.5), (x, y(0.03), 1.05), M_DARK(), 'rackplate', bevel=0.01))
    for z in (0.5, 1.6): o.append(cube((0.8, 0.08, 0.06), (x, y(0.07), z), M_METAL(), 'rackbar'))
    o.append(cube((0.5, 0.2, 0.62), (x, y(0.18), 1.4), M_PANEL(), 'plss', bevel=0.05))
    o.append(cube((0.36, 0.04, 0.12), (x, y(0.29), 1.68), M_DARK(), 'plsstop', bevel=0.01))
    o.append(sphere(0.26, (x, y(0.42), 1.42), M_WHITE(), 'hut', seg=20, ring=12, scale=(1.05,0.72,1.08)))
    o.append(cube((0.3, 0.08, 0.15), (x, y(0.62), 1.33), M_PANEL(), 'dcm', bevel=0.02))
    o.append(cube((0.24, 0.02, 0.06), (x, y(0.665), 1.36), M_DARK(), 'dcmface'))
    for k,mm in enumerate((M_RED(), M_LIGHT(), M_GROW())): o.append(cube((0.03,0.02,0.03), (x-0.07+k*0.07, y(0.675), 1.3), mm, 'dcmled'))
    o.append(cyl(0.15, 0.06, (x, y(0.42), 1.72), M_METAL(), 'neckring', verts=20))
    helm = sphere(0.205, (x, y(0.42), 1.9), M_WHITE(), 'helm', seg=20, ring=12)
    o.append(helm)
    vis = sphere(0.21, (x, y(0.44), 1.9), M_VISOR(), 'visor', seg=20, ring=12)
    cut_sphere(vis, lambda c: c.y*f > 0.05 and -0.12 < c.z < 0.13); o.append(vis)
    for sx in (-1,1):
        o.append(cube((0.05,0.07,0.06), (x+sx*0.2, y(0.46), 1.98), M_LIGHT() if sx>0 else M_DARK(), 'helmlamp', bevel=0.01))
        sh = (x+sx*0.3, y(0.42), 1.53); el = (x+sx*0.34, y(0.47), 1.2); wr = (x+sx*0.32, y(0.52), 0.94)
        o.append(cyl(0.085, 0.05, sh, M_METAL(), 'shbearing', verts=16, rot=(0, math.pi/2, 0)))
        o.append(smooth(tube(sh, el, 0.08, M_WHITE(), 'upperarm', verts=14, r2=0.07)))
        o.append(sphere(0.07, el, M_WHITE(), 'elbow', seg=10, ring=8))
        o.append(smooth(tube(el, wr, 0.068, M_WHITE(), 'forearm', verts=14, r2=0.058)))
        o.append(cyl(0.065, 0.04, (wr[0], wr[1], wr[2]-0.01), M_METAL(), 'wristring', verts=14))
        o.append(sphere(0.06, (wr[0], wr[1], wr[2]-0.09), M_PANEL(), 'glove', seg=10, ring=8, scale=(0.8,0.7,1.35)))
        hx = x+sx*0.11; hip=(hx, y(0.42), 1.02); kn=(hx+sx*0.01, y(0.45), 0.6); an=(hx, y(0.44), 0.32)
        o.append(smooth(tube(hip, kn, 0.1, M_WHITE(), 'thigh', verts=14, r2=0.085)))
        o.append(sphere(0.085, kn, M_WHITE(), 'knee', seg=10, ring=8))
        o.append(smooth(tube(kn, an, 0.08, M_WHITE(), 'shin', verts=14, r2=0.072)))
        o.append(cyl(0.085, 0.04, an, M_METAL(), 'bootring', verts=14))
        o.append(cube((0.15, 0.3, 0.12), (hx, y(0.5), 0.25), M_PANEL(), 'boot', bevel=0.04))
        if stripe:
            o.append(cyl(0.102, 0.06, (hx, y(0.43), 0.82), M_ORANGE(), 'cdrstripe', verts=14))
            o.append(cyl(0.083, 0.05, (sh[0]+sx*0.0, y(0.45), 1.36), M_ORANGE(), 'armstripe', verts=12))
    o.append(cyl(0.22, 0.2, (x, y(0.42), 1.1), M_WHITE(), 'brief', verts=20, r2=0.24))
    o.append(torus(0.215, 0.025, (x, y(0.42), 1.19), M_METAL(), 'waistring', maj=24, mnr=6))
    o.append(cube((0.16, 0.02, 0.08), (x+0.12, y(0.66), 1.52), M_BLUE(), 'flag'))
    return o

# ------------------------------------------------------------------ HABITAT
def build_hab():
    reset()
    R = 11.0
    objs = []
    # doors: east (+X, airlock), west (-X, greenhouse), south (glTF -Z = Blender +Y, lab)
    shell = dome_with_doors(R, [0.0, math.pi, math.pi/2], M_WHITE(), 'dome', seg=64, rings=18)
    objs.append(shell)
    # ribs
    for k in range(12):
        a = k/12*math.pi*2
        t = torus(R+0.18, 0.09, (0,0,0), M_PANEL(), 'rib', rot=(math.pi/2,0,a), maj=64, mnr=6)
        bm = bmesh.new(); bm.from_mesh(t.data)
        rm = [v for v in bm.verts if v.co.y < -0.05]  # torus local: rotated into vertical plane; drop lower half
        bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(t.data); bm.free()
        # remove rib segments crossing door openings
        bm = bmesh.new(); bm.from_mesh(t.data); mw = t.matrix_world
        rm = []
        for v in bm.verts:
            w = mw @ v.co
            az = math.atan2(w.y, w.x)
            for d in (0.0, math.pi, math.pi/2):
                da = (az - d + math.pi) % (2*math.pi) - math.pi
                if abs(da)*R < 2.0 and w.z < 3.4: rm.append(v); break
        bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(t.data); bm.free()
        objs.append(t)
    # base ring
    ring = cyl(R+0.35, 0.9, (0,0,0.45), M_PANEL(), 'ring', verts=64)
    # hollow it out: the old solid disc covered the whole floor 0.6 m above where people walk
    hole = cyl(R-0.02, 2.0, (0,0,0.45), M_PANEL(), 'ringhole', verts=64)
    md = ring.modifiers.new('hole','BOOLEAN'); md.object = hole; md.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = ring; bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.data.objects.remove(hole)
    objs.append(ring)
    # windows ring (emissive squares) avoiding doors
    for k in range(18):
        a = k/18*math.pi*2 + 0.17
        if any(abs((a-d+math.pi)%(2*math.pi)-math.pi) < 0.3 for d in (0.0, math.pi, math.pi/2)): continue
        z = 4.6; rr = math.sqrt(max(0.1, R*R - z*z)) + 0.05
        w = cube((0.12, 1.0, 0.7), (math.cos(a)*rr, math.sin(a)*rr, z), M_LIGHT(), 'win', rot=(0, -math.atan2(z, rr), a))
        objs.append(w)
    # door frames
    for d in (0.0, math.pi, math.pi/2):
        x, y = math.cos(d)*(R-0.05), math.sin(d)*(R-0.05)
        objs.append(cube((0.5, 3.8, 0.4), (x, y, 3.2), M_PANEL(), 'lintel', rot=(0,0,d)))
        for s in (-1,1):
            px, py = x + math.cos(d+math.pi/2)*1.8*s, y + math.sin(d+math.pi/2)*1.8*s
            objs.append(cube((0.5, 0.4, 3.2), (px, py, 1.6), M_PANEL(), 'jamb', rot=(0,0,d)))
    # cut the base ring at doors with simple boolean boxes
    for d in (0.0, math.pi, math.pi/2):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(d)*R, math.sin(d)*R, 0.6), rotation=(0,0,d))
        cutter = active(); cutter.scale = (3, 3.0, 1.6); bpy.ops.object.transform_apply(scale=True)
        md = ring.modifiers.new('cut','BOOLEAN'); md.object = cutter; md.operation = 'DIFFERENCE'
        bpy.context.view_layer.objects.active = ring; bpy.ops.object.modifier_apply(modifier=md.name)
        bpy.data.objects.remove(cutter)
    # floor with plating
    fl = cyl(R-0.1, 0.3, (0,0,0.15), M_FLOOR(), 'floor', verts=64); objs.append(fl)
    for k in range(-4,5):
        objs.append(cube((2*math.sqrt(max(0,(R-0.4)**2-(k*2.2)**2)), 0.04, 0.02), (0, k*2.2, 0.31), M_DARK(), 'seam'))
    # central column with light ring
    # (the central column was removed: it read as a chimney through the middle of the hall)
    # --- interior furniture (north half = Blender -Y = glTF +Z)
    # bunks: 4 bunk beds along north wall
    for k, a in enumerate([math.radians(-d) for d in (76, 94, 112, 130)]):
        cx, cy = math.cos(a)*8.1, math.sin(a)*8.1
        rot = a + math.pi/2
        tx, ty = math.cos(rot), math.sin(rot)
        for lvl in (0.6, 1.75):
            objs.append(cube((2.1, 0.95, 0.1), (cx, cy, lvl), M_PANEL(), 'bunkframe', rot=(0,0,rot), bevel=0.03))
            objs.append(cube((1.95, 0.85, 0.16), (cx, cy, lvl+0.13), M_BED(), 'mattress', rot=(0,0,rot), bevel=0.05))
            objs.append(cube((1.2, 0.88, 0.05), (cx-tx*0.35, cy-ty*0.35, lvl+0.23), mat('blanket%d' % k, C(*[(230,120,90),(110,180,120),(240,200,90),(160,120,210)][k]), 0.0, 0.9), 'blanket', rot=(0,0,rot), bevel=0.02))
            objs.append(cube((0.35, 0.6, 0.12), (cx+tx*0.75, cy+ty*0.75, lvl+0.26), M_WHITE(), 'pillow', rot=(0,0,rot), bevel=0.05))
        for sgn in (-1,1):
            px, py = cx + tx*1.07*sgn, cy + ty*1.07*sgn
            objs.append(cube((0.06, 0.95, 2.3), (px, py, 1.15+0.3), M_DARK(), 'bunkend', rot=(0,0,rot), bevel=0.02))
        rx, ry = -math.cos(a), -math.sin(a)          # towards the hall
        for q in (0.55, 0.9):
            px, py = cx + rx*0.5 + tx*q, cy + ry*0.5 + ty*q
            objs.append(cyl(0.022, 1.65, (px, py, 1.12), M_METAL(), 'ladderrail', verts=8))
        for h in (0.75, 1.1, 1.45):
            px, py = cx + rx*0.5 + tx*0.725, cy + ry*0.5 + ty*0.725
            objs.append(cube((0.35, 0.035, 0.035), (px, py, h), M_METAL(), 'rung', rot=(0,0,rot)))
    # galley (east-north): base cabinets with doors and handles, stone worktop, backsplash, upper cabinets,
    # a deep steel sink with a gooseneck tap, a glass induction hob with knobs, an oven and an extractor hood
    M_STONE = mat('worktop_stone', C(236,236,232), 0.0, 0.3)
    M_STEEL = mat('steel_brushed', C(196,200,206), 0.9, 0.22)
    M_HOBG  = mat('hob_glass', C(16,16,20), 0.2, 0.08)
    M_RING  = mat('hob_ring', C(120,40,30), 0.0, 0.4, emit=C(255,70,30), estr=1.6)
    M_RINGO = mat('hob_ring_off', C(70,70,78), 0.0, 0.5)
    M_SPLASH= mat('backsplash', C(150,190,215), 0.1, 0.25)
    M_CAB   = mat('cabinet', C(70,92,120), 0.1, 0.55)
    def gp(a, r, t, z): return (math.cos(a)*r - math.sin(a)*t, math.sin(a)*r + math.cos(a)*t, z)
    for k, gd in enumerate((27, 38, 49)):
        a = math.radians(-gd); rr = a + math.pi/2; R = 9.35
        objs.append(cube((1.92, 0.66, 0.84), gp(a, R+0.02, 0, 0.74), M_CAB, 'counter', rot=(0,0,rr), bevel=0.02))
        objs.append(cube((1.8, 0.05, 0.1), gp(a, R-0.27, 0, 0.36), M_DARK(), 'plinth', rot=(0,0,rr)))
        # the stove unit has the oven in the middle and two narrow doors beside it; the others have two wide doors
        doors = ((-0.68, 0.5), (0.68, 0.5)) if k == 1 else ((-0.45, 0.86), (0.45, 0.86))
        for q, wd in doors:
            objs.append(cube((wd, 0.02, 0.66), gp(a, R-0.32, q, 0.8), M_PANEL(), 'cabdoor', rot=(0,0,rr), bevel=0.01))
            objs.append(cube((min(0.3, wd-0.16), 0.03, 0.025), gp(a, R-0.345, q, 1.05), M_STEEL, 'cabhandle', rot=(0,0,rr)))
        objs.append(cube((1.98, 0.74, 0.05), gp(a, R, 0, 1.2), M_STONE, 'worktop', rot=(0,0,rr), bevel=0.01))
        objs.append(cube((2.0, 0.03, 0.62), gp(a, R+0.36, 0, 1.54), M_SPLASH, 'backsplash', rot=(0,0,rr)))
        objs.append(cube((1.98, 0.4, 0.6), gp(a, R+0.4, 0, 2.15), M_WHITE(), 'upper', rot=(0,0,rr), bevel=0.03))
        for q in (-0.43, 0.43):
            objs.append(cube((0.25, 0.03, 0.025), gp(a, R+0.185, q, 1.9), M_STEEL, 'uphandle', rot=(0,0,rr)))
        objs.append(cube((1.9, 0.04, 0.02), gp(a, R+0.24, 0, 1.84), M_LIGHT(), 'undercab', rot=(0,0,rr)))
        if k == 0:
            # sink: steel rim, a dark recessed bowl, drainer grooves, gooseneck tap with a lever
            objs.append(cube((0.78, 0.52, 0.02), gp(a, R-0.02, -0.25, 1.235), M_STEEL, 'sinkrim', rot=(0,0,rr)))
            objs.append(cube((0.5, 0.38, 0.2), gp(a, R-0.02, -0.33, 1.15), mat('sink_bowl', C(70,74,82), 0.9, 0.3), 'sinkbowl', rot=(0,0,rr)))
            for j in range(4):
                objs.append(cube((0.015, 0.34, 0.006), gp(a, R-0.02, 0.0+j*0.035, 1.247), M_DARK(), 'drainer', rot=(0,0,rr)))
            objs.append(cyl(0.022, 0.36, gp(a, R+0.22, -0.33, 1.42), M_STEEL, 'tap', verts=12))
            objs.append(cyl(0.02, 0.28, gp(a, R+0.09, -0.33, 1.6), M_STEEL, 'tapneck', verts=12, rot=(0,math.pi/2,a)))   # horizontal, pointing from the wall over the sink
            objs.append(cyl(0.022, 0.08, gp(a, R-0.04, -0.33, 1.56), M_STEEL, 'spout', verts=12))
            objs.append(cube((0.1, 0.028, 0.022), gp(a, R+0.22, -0.33+0.068, 1.5), M_STEEL, 'taplever', rot=(0,0,rr)))   # touches the tap body
            objs.append(cyl(0.05, 0.16, gp(a, R+0.18, 0.55, 1.31), mat('soap', C(110,200,170), 0.0, 0.3), 'soap', verts=12))
        if k == 1:
            # induction hob: black glass, four rings (one switched on), knobs on the front
            objs.append(cube((0.78, 0.56, 0.015), gp(a, R, 0, 1.232), M_HOBG, 'hob', rot=(0,0,rr)))
            for j, (q, rd) in enumerate(((-0.2, -0.13), (0.2, -0.13), (-0.2, 0.13), (0.2, 0.13))):
                x0, y0, _ = gp(a, R+rd, q, 0)
                objs.append(torus(0.1 if j%2 else 0.08, 0.008, (x0, y0, 1.242), M_RING if j == 0 else M_RINGO, 'hobring', maj=24, mnr=4))
            for j in range(4):
                objs.append(cyl(0.03, 0.03, gp(a, R-0.355, -0.27+j*0.18, 1.14), M_DARK(), 'knob', verts=12, rot=(math.pi/2,0,rr)))
            # oven under the hob: steel door with a window and a bar handle
            objs.append(cube((0.78, 0.02, 0.62), gp(a, R-0.33, 0, 0.78), M_STEEL, 'ovendoor', rot=(0,0,rr), bevel=0.01))
            objs.append(cube((0.46, 0.012, 0.24), gp(a, R-0.348, 0, 0.7), mat('oven_glass', C(20,20,26), 0.3, 0.1, emit=C(255,140,60), estr=0.25), 'ovenwin', rot=(0,0,rr)))
            objs.append(cyl(0.015, 0.56, gp(a, R-0.37, 0, 1.02), M_STEEL, 'ovenbar', verts=8, rot=(0,math.pi/2,rr)))
            objs.append(cyl(0.12, 0.08, gp(a, R+0.12, 0.25, 1.29), M_DARK(), 'pot', verts=18))
        if k == 2:
            # food prep: rehydration station, cutting board, kettle and a food warmer
            objs.append(cube((0.55, 0.4, 0.35), gp(a, R+0.12, 0.45, 1.4), M_DARK(), 'oven', rot=(0,0,rr), bevel=0.03))
            objs.append(cube((0.3, 0.02, 0.2), gp(a, R-0.09, 0.45, 1.42), M_SCREEN(), 'ovenwin2', rot=(0,0,rr)))
            objs.append(cube((0.4, 0.28, 0.02), gp(a, R-0.05, -0.35, 1.235), M_WOOD(), 'board', rot=(0,0,rr), bevel=0.01))
            objs.append(cyl(0.08, 0.2, gp(a, R+0.15, -0.05, 1.33), M_STEEL, 'kettle', verts=16))
            objs.append(cube((0.25, 0.25, 0.32), gp(a, R+0.15, -0.65, 1.39), M_WHITE(), 'rehydrator', rot=(0,0,rr), bevel=0.02))
    a = math.radians(-41); tx, ty = math.cos(a)*7.2, math.sin(a)*7.2
    objs.append(cyl(0.75, 0.06, (tx, ty, 1.05), M_WOOD(), 'table', verts=32))
    objs.append(cyl(0.08, 0.75, (tx, ty, 0.67), M_METAL(), 'tleg', verts=10))
    for k in range(3):
        b = a + math.pi + (k-1)*1.1
        sx, sy = tx + math.cos(b)*1.05, ty + math.sin(b)*1.05
        objs.append(cyl(0.24, 0.07, (sx, sy, 0.78), M_BLUE(), 'stool', verts=16))
        objs.append(cyl(0.04, 0.45, (sx, sy, 0.53), M_METAL(), 'sleg', verts=8))
    # comms post (game angles -125..-151): three desks with monitors on stands, keyboards, swivel chairs,
    # a big wall display with the Earth link and a radio rack with status lights
    def rad(r, gdeg): a = math.radians(-gdeg); return math.cos(a)*r, math.sin(a)*r, a
    M_GREEN = mat('led_green', C(90,230,120), 0.0, 0.3, emit=C(80,255,120), estr=3.0)
    for gdeg in (-125, -138, -151):
        x, y, a = rad(8.75, gdeg); rot = a + math.pi/2; ux, uy = math.cos(a), math.sin(a)
        objs.append(cube((1.75, 0.8, 0.06), (x, y, 1.05), M_WOOD(), 'desktop', rot=(0,0,rot), bevel=0.02))
        objs.append(cube((1.7, 0.06, 0.7), (x+ux*0.36, y+uy*0.36, 0.67), M_PANEL(), 'deskback', rot=(0,0,rot)))
        for q in (-0.82, 0.82):
            objs.append(cube((0.05, 0.75, 0.72), (x - uy*q, y + ux*q, 0.67), M_PANEL(), 'deskside', rot=(0,0,rot)))
        mx, my = x+ux*0.2, y+uy*0.2
        objs.append(cube((0.3, 0.2, 0.03), (mx, my, 1.095), M_DARK(), 'monbase', rot=(0,0,rot)))
        objs.append(cube((0.06, 0.04, 0.4), (mx+ux*0.03, my+uy*0.03, 1.3), M_DARK(), 'monneck', rot=(0,0,rot)))
        objs.append(cube((1.0, 0.05, 0.6), (mx, my, 1.68), M_DARK(), 'bezel', rot=(0,0,rot), bevel=0.015))
        objs.append(cube((0.92, 0.02, 0.52), (mx-ux*0.03, my-uy*0.03, 1.68), M_SCREEN(), 'monitor', rot=(0,0,rot)))
        objs.append(cube((0.55, 0.18, 0.025), (x-ux*0.12, y-uy*0.12, 1.09), M_DARK(), 'keyboard', rot=(0,0,rot)))
        objs.append(cube((0.08, 0.12, 0.03), (x-ux*0.1-uy*0.45, y-uy*0.1+ux*0.45, 1.09), M_DARK(), 'mouse', rot=(0,0,rot)))
        # swivel chair facing the desk
        cx2, cy2 = x - ux*1.05, y - uy*1.05
        objs.append(cyl(0.27, 0.09, (cx2, cy2, 0.78), M_BLUE(), 'chairseat', verts=18))
        objs.append(cube((0.48, 0.07, 0.5), (cx2-ux*0.27, cy2-uy*0.27, 1.12), M_BLUE(), 'chairback', rot=(0,0,rot), bevel=0.03))
        objs.append(cyl(0.035, 0.42, (cx2, cy2, 0.53), M_METAL(), 'chairpost', verts=8))
        for k in range(5):
            b = k*2*math.pi/5
            objs.append(cube((0.32, 0.05, 0.04), (cx2+math.cos(b)*0.16, cy2+math.sin(b)*0.16, 0.33), M_DARK(), 'chairfoot', rot=(0,0,b)))
    x, y, a = rad(10.05, -138); rot = a + math.pi/2
    objs.append(cube((0.1, 3.0, 1.5), (x, y, 2.55), M_DARK(), 'wallframe', rot=(0,0,a), bevel=0.03))
    objs.append(cube((0.04, 2.8, 1.3), (x-math.cos(a)*0.06, y-math.sin(a)*0.06, 2.55), M_SCREEN(), 'wallscreen', rot=(0,0,a)))
    x, y, a = rad(9.65, -117)
    objs.append(cube((0.6, 0.7, 2.1), (x, y, 1.35), M_DARK(), 'radiorack', rot=(0,0,a), bevel=0.03))
    for k in range(6):
        for j in range(3):
            m = (M_GREEN, M_LIGHT(), M_RED())[(k+j) % 3] if (k*3+j) % 4 else M_GREEN
            objs.append(cube((0.03, 0.05, 0.03), (x-math.cos(a)*0.31 - math.sin(a)*(-0.2+j*0.2), y-math.sin(a)*0.31 + math.cos(a)*(-0.2+j*0.2), 1.0+k*0.22), m, 'rackled', rot=(0,0,a)))
        objs.append(cube((0.02, 0.6, 0.02), (x-math.cos(a)*0.31, y-math.sin(a)*0.31, 0.92+k*0.22), M_METAL(), 'rackslot', rot=(0,0,a)))
    # medical bay (game angles -22..-62): radial exam bed, wall monitor on an arm, IV stand, ultrasound cart,
    # tall medicine cabinet with a red cross, counter with sink and drawers, stool, first-aid kit
    def radm(r, gdeg): a = math.radians(-gdeg); return math.cos(a)*r, math.sin(a)*r, a
    x, y, a = radm(8.3, -42); ux, uy = math.cos(a), math.sin(a)
    objs.append(cube((2.0, 0.85, 0.12), (x, y, 0.85), M_PANEL(), 'bedframe', rot=(0,0,a), bevel=0.03))
    for q in (-0.85, 0.85):
        for w2 in (-0.35, 0.35):
            objs.append(cyl(0.035, 0.5, (x+ux*q-uy*w2, y+uy*q+ux*w2, 0.55), M_METAL(), 'bedleg', verts=8))
            objs.append(sphere(0.05, (x+ux*q-uy*w2, y+uy*q+ux*w2, 0.33), M_DARK(), 'caster', seg=8, ring=6))
    objs.append(cube((1.95, 0.8, 0.14), (x, y, 0.98), M_WHITE(), 'medmat', rot=(0,0,a), bevel=0.05))
    objs.append(cube((0.42, 0.62, 0.12), (x+ux*0.72, y+uy*0.72, 1.1), M_WHITE(), 'pillow', rot=(0,0,a), bevel=0.05))
    objs.append(cube((0.9, 0.82, 0.04), (x-ux*0.4, y-uy*0.4, 1.06), mat('blanket_med', C(120,190,200), 0.0, 0.9), 'medblanket', rot=(0,0,a), bevel=0.01))
    objs.append(cube((0.06, 0.85, 0.35), (x+ux*1.0, y+uy*1.0, 1.15), M_PANEL(), 'headboard', rot=(0,0,a), bevel=0.02))
    # wall monitor on an arm
    # vitals monitor: hangs straight (vertical) on a bracket that reaches back to the curved wall
    zc = 1.75; rw = math.sqrt(10.48**2 - (zc+0.3)**2) - 0.08
    _, _, a = radm(rw, -34); ca, sa = math.cos(a), math.sin(a)
    objs.append(cube((0.3, 0.3, 0.2), (ca*(rw+0.16), sa*(rw+0.16), zc), M_METAL(), 'monarm', rot=(0,0,a)))
    objs.append(cube((0.06, 0.8, 0.52), (ca*(rw-0.04), sa*(rw-0.04), zc), M_DARK(), 'medbezel', rot=(0,0,a), bevel=0.015))
    objs.append(cube((0.02, 0.72, 0.44), (ca*(rw-0.075), sa*(rw-0.075), zc), mat('vitals', C(10,30,20), 0.0, 0.3, emit=C(60,230,140), estr=0.7), 'medscreen', rot=(0,0,a)))
    # IV stand
    x, y, a = radm(9.0, -51)
    objs.append(cyl(0.025, 1.9, (x, y, 1.27), M_METAL(), 'ivpole', verts=8))
    objs.append(cyl(0.25, 0.04, (x, y, 0.33), M_DARK(), 'ivbase', verts=16))
    objs.append(cube((0.35, 0.025, 0.025), (x, y, 2.2), M_METAL(), 'ivhook'))
    objs.append(cube((0.16, 0.06, 0.26), (x+0.14, y, 2.03), M_GLASS(), 'ivbag', bevel=0.03))
    objs.append(cyl(0.006, 0.9, (x+0.14, y, 1.45), M_GLASS(), 'ivline', verts=4))
    # ultrasound cart
    x, y, a = radm(7.7, -32)
    objs.append(cube((0.5, 0.5, 0.75), (x, y, 0.72), M_WHITE(), 'cart', rot=(0,0,a), bevel=0.04))
    for q in (-0.2, 0.2):
        for w2 in (-0.2, 0.2): objs.append(sphere(0.05, (x+math.cos(a)*q-math.sin(a)*w2, y+math.sin(a)*q+math.cos(a)*w2, 0.33), M_DARK(), 'caster', seg=8, ring=6))
    # screen sits on a short post that rises from the cart top (it used to float above it)
    objs.append(cube((0.06, 0.06, 0.3), (x+math.cos(a)*0.14, y+math.sin(a)*0.14, 1.24), M_DARK(), 'uspost', rot=(0,0,a)))
    objs.append(cube((0.06, 0.52, 0.38), (x+math.cos(a)*0.12, y+math.sin(a)*0.12, 1.5), M_DARK(), 'usbezel', rot=(0.0,0.3,a), bevel=0.01))
    objs.append(cube((0.02, 0.46, 0.32), (x+math.cos(a)*0.085, y+math.sin(a)*0.085, 1.5), M_SCREEN(), 'usscreen', rot=(0.0,0.3,a)))
    objs.append(cyl(0.03, 0.18, (x-math.cos(a)*0.2, y-math.sin(a)*0.2, 1.17), M_PANEL(), 'probe', verts=8))
    # tall medicine cabinet with a red cross on its front
    x, y, a = radm(10.0, -27)
    objs.append(cube((0.5, 1.0, 2.3), (x, y, 1.45), M_WHITE(), 'medcab', rot=(0,0,a), bevel=0.04))
    objs.append(cube((0.02, 0.02, 2.1), (x-math.cos(a)*0.26, y-math.sin(a)*0.26, 1.45), M_DARK(), 'cabseam', rot=(0,0,a)))
    fx, fy = x-math.cos(a)*0.265, y-math.sin(a)*0.265
    objs.append(cube((0.02, 0.12, 0.42), (fx, fy, 2.05), M_RED(), 'cross1', rot=(0,0,a)))
    objs.append(cube((0.02, 0.42, 0.12), (fx, fy, 2.05), M_RED(), 'cross2', rot=(0,0,a)))
    for q in (-0.08, 0.08): objs.append(cube((0.04, 0.03, 0.25), (fx - math.sin(a)*q, fy + math.cos(a)*q, 1.4), M_METAL(), 'cabhandle', rot=(0,0,a)))
    # counter with sink, drawers and a first-aid kit
    x, y, a = radm(9.6, -56)
    objs.append(cube((0.65, 1.5, 0.9), (x, y, 0.75), M_PANEL(), 'medcounter', rot=(0,0,a), bevel=0.03))
    objs.append(cube((0.7, 1.55, 0.05), (x, y, 1.225), M_WHITE(), 'medtop', rot=(0,0,a)))
    objs.append(cube((0.4, 0.45, 0.06), (x, y+0.0, 1.23), M_METAL(), 'medsink', rot=(0,0,a)))
    for k in range(3): objs.append(cube((0.03, 0.4, 0.03), (x-math.cos(a)*0.335 - math.sin(a)*0.45, y-math.sin(a)*0.335 + math.cos(a)*0.45, 0.55+k*0.25), M_METAL(), 'drawer', rot=(0,0,a)))
    objs.append(cube((0.35, 0.25, 0.2), (x - math.sin(a)*(-0.5), y + math.cos(a)*(-0.5), 1.35), M_RED(), 'firstaid', rot=(0,0,a), bevel=0.03))
    objs.append(cube((0.36, 0.06, 0.05), (x - math.sin(a)*(-0.5), y + math.cos(a)*(-0.5), 1.47), M_WHITE(), 'firstaidband', rot=(0,0,a)))
    x, y, a = radm(7.4, -50)
    objs.append(cyl(0.2, 0.06, (x, y, 0.82), M_BLUE(), 'medstool', verts=14))
    objs.append(cyl(0.03, 0.5, (x, y, 0.55), M_METAL(), 'medstoolleg', verts=8))
    # gym (game angle ~170 deg = Blender -170 deg): treadmill, bike, weights rack
    def tang(r, deg): a = math.radians(deg); return math.cos(a)*r, math.sin(a)*r, a + math.pi/2
    def rad(r, gdeg): a = math.radians(-gdeg); return math.cos(a)*r, math.sin(a)*r, a
    x, y, a = rad(8.5, 151)
    objs.append(cube((1.9, 0.85, 0.22), (x, y, 0.42), M_DARK(), 'treadbase', rot=(0,0,a), bevel=0.04))
    objs.append(cube((1.7, 0.6, 0.03), (x, y, 0.545), M_RUBBER(), 'belt', rot=(0,0,a)))
    ix, iy = math.cos(a)*7.55, math.sin(a)*7.55
    for q in (-0.4, 0.4):
        px, py = ix - math.sin(a)*q, iy + math.cos(a)*q
        objs.append(cyl(0.035, 1.0, (px, py, 0.95), M_METAL(), 'upright', verts=8))
        objs.append(cube((0.9, 0.05, 0.05), (px+math.cos(a)*0.45, py+math.sin(a)*0.45, 1.35), M_METAL(), 'rail', rot=(0,0,a)))
    objs.append(cube((0.25, 0.75, 0.35), (ix, iy, 1.5), M_DARK(), 'console', rot=(0,0,a), bevel=0.03))
    objs.append(cube((0.02, 0.5, 0.22), (ix-math.cos(a)*0.13, iy-math.sin(a)*0.13, 1.52), M_SCREEN(), 'tscreen', rot=(0,0,a)))
    # local helper: point at (along, across) from (x, y) facing angle a
    def off(x, y, a, f, s): return x + math.cos(a)*f - math.sin(a)*s, y + math.sin(a)*f + math.cos(a)*s
    M_MAT = mat('gym_floor', C(46,50,58), 0.0, 0.95)
    # dark rubber floor for the whole gym corner (no more green mat)
    x, y, a = rad(8.3, 160)
    objs.append(cube((3.4, 3.6, 0.02), (x, y, 0.31), M_MAT, 'gymfloor', rot=(0,0,a)))
    # exercise bike (like CEVIS on the ISS): frame, shrouded flywheel, cranks, seat, bars, small screen
    x, y, a = rad(8.4, 160)
    objs.append(cube((1.1, 0.5, 0.08), (x, y, 0.36), M_DARK(), 'bikefoot', rot=(0,0,a), bevel=0.02))
    fx, fy = off(x, y, a, -0.32, 0)
    objs.append(cyl(0.24, 0.16, (fx, fy, 0.62), M_DARK(), 'flyshroud', verts=24, rot=(math.pi/2,0,a)))
    objs.append(cyl(0.12, 0.17, (fx, fy, 0.62), M_METAL(), 'flyhub', verts=16, rot=(math.pi/2,0,a)))
    for side in (-1, 1):
        cx, cy = off(x, y, a, -0.05, side*0.14)
        objs.append(cube((0.05, 0.03, 0.34), (cx, cy, 0.62), M_METAL(), 'crank', rot=(0,0.6*side,a)))
        px, py = off(x, y, a, -0.05 + 0.09*side, side*0.2)
        objs.append(cube((0.16, 0.1, 0.03), (px, py, 0.62 + 0.15*side), M_RUBBER(), 'pedal', rot=(0,0,a)))
    sx, sy = off(x, y, a, 0.28, 0)
    objs.append(cyl(0.035, 0.6, (sx, sy, 0.68), M_METAL(), 'seatpost', verts=8, rot=(0,-0.25,a)))
    objs.append(cube((0.3, 0.22, 0.07), (sx+math.cos(a)*0.06, sy+math.sin(a)*0.06, 1.0), M_RUBBER(), 'bikeseat', rot=(0,0,a), bevel=0.03))
    hx, hy = off(x, y, a, -0.42, 0)
    objs.append(cyl(0.035, 0.7, (hx, hy, 0.8), M_METAL(), 'stem', verts=8, rot=(0,0.2,a)))
    objs.append(cube((0.05, 0.55, 0.04), (hx-math.cos(a)*0.06, hy-math.sin(a)*0.06, 1.15), M_RUBBER(), 'bars', rot=(0,0,a)))
    objs.append(cube((0.03, 0.22, 0.15), (hx-math.cos(a)*0.02, hy-math.sin(a)*0.02, 1.25), M_SCREEN(), 'bikescreen', rot=(0,0.35,a)))
    # resistance machine (like ARED on the ISS): platform, two vacuum cylinders, lifting bar on arms
    x, y, a = rad(9.15, 168)
    objs.append(cube((0.8, 1.05, 0.1), (x, y, 0.36), M_DARK(), 'aredbase', rot=(0,0,a), bevel=0.02))
    for side in (-1, 1):
        cx, cy = off(x, y, a, 0.32, side*0.42)
        objs.append(cyl(0.11, 1.2, (cx, cy, 0.95), M_WHITE(), 'canister', verts=16))
        objs.append(cyl(0.12, 0.06, (cx, cy, 1.56), M_METAL(), 'canistercap', verts=16))
        # cable from the canister top down to the bar, so the bar hangs on something real
        objs.append(cyl(0.012, 0.3, (cx, cy, 1.4), M_DARK(), 'aredcable', verts=6))
    # lifting bar runs straight through both canisters (it is held by them, not floating)
    bx, by = off(x, y, a, 0.32, 0)
    objs.append(cyl(0.025, 1.1, (bx, by, 1.25), M_METAL(), 'aredbar', verts=8, rot=(math.pi/2,0,a)))
    for side in (-1, 1):
        gx, gy = off(x, y, a, 0.32, side*0.2)
        objs.append(cyl(0.035, 0.16, (gx, gy, 1.25), M_RUBBER(), 'aredgrip', verts=10, rot=(math.pi/2,0,a)))
    # dumbbell rack: two shelves with dumbbells that have heads
    x, y, a = rad(10.0, 156)
    objs.append(cube((0.4, 1.1, 0.06), (x, y, 0.75), M_DARK(), 'rackshelf', rot=(0,0,a)))
    objs.append(cube((0.4, 1.1, 0.06), (x, y, 1.15), M_DARK(), 'rackshelf', rot=(0,0,a)))
    for q in (-0.52, 0.52):
        lx, ly = off(x, y, a, 0, q)
        objs.append(cube((0.4, 0.05, 1.0), (lx, ly, 0.82), M_METAL(), 'rackside', rot=(0,0,a)))
    for h in (0.86, 1.26):
        for k in range(3):
            q = -0.32 + k*0.32; dx, dy = off(x, y, a, -0.02, q)
            objs.append(cyl(0.02, 0.24, (dx, dy, h), M_METAL(), 'dbhandle', verts=8, rot=(0,math.pi/2,a)))
            for e in (-0.12, 0.12):
                ex, ey = off(dx, dy, a, e, 0)
                objs.append(cyl(0.055 + 0.01*k, 0.05, (ex, ey, h), M_RUBBER(), 'dbhead', verts=12, rot=(0,math.pi/2,a)))
    # wall screen with the workout plan: hangs straight (vertical), bracket reaches back to the curved wall
    zc = 1.8; rw = math.sqrt(10.48**2 - (zc+0.4)**2) - 0.08
    x, y, a = rad(rw - 0.03, 160); ca, sa = math.cos(a), math.sin(a)
    objs.append(cube((0.3, 0.5, 0.3), (ca*(rw+0.2), sa*(rw+0.2), zc), M_METAL(), 'gymscreenmount', rot=(0,0,a)))
    objs.append(cube((0.05, 1.3, 0.72), (x, y, zc), M_DARK(), 'gymscreenframe', rot=(0,0,a), bevel=0.02))
    objs.append(cube((0.02, 1.2, 0.62), (x-ca*0.03, y-sa*0.03, zc), M_SCREEN(), 'gymscreen', rot=(0,0,a)))
    # galley extras: fridge and wall shelf
    x, y, rr = tang(9.3, -57); objs.append(cube((0.9, 0.75, 2.0), (x, y, 1.3), M_WHITE(), 'fridge', rot=(0,0,rr), bevel=0.05))
    objs.append(cube((0.05, 0.05, 0.9), (x+math.cos(rr)*0.3-math.cos(rr-math.pi/2)*0.4, y+math.sin(rr)*0.3-math.sin(rr-math.pi/2)*0.4, 1.4), M_METAL(), 'handle', rot=(0,0,rr)))
    # coloured accent panel on the back wall of every room (Blender angle = -game angle)
    for gdeg, col in ((41,(255,211,90)),(103,(143,184,255)),(-42,(255,143,163)),(-138,(127,211,255))):  # no green strip in the gym
        a = -math.radians(gdeg); r = 10.25
        pass   # flat accent panels removed: on the curved dome wall they stood off it like floating boards
    # wardrobes: a row of tall cabinets on the wall behind the bunks, one pair per bunk, door colour = blanket colour
    for k, gd in enumerate((76, 94, 112, 130)):
        col = [(230,120,90),(110,180,120),(240,200,90),(160,120,210)][k]
        for q in (-0.5, 0.5):
            a = math.radians(-(gd + q*7.0)); rr = a + math.pi/2; r = 9.55
            x, y = math.cos(a)*r, math.sin(a)*r
            objs.append(cube((0.95, 0.6, 2.75), (x, y, 0.3+1.375), M_WHITE(), 'wardrobe', rot=(0,0,rr), bevel=0.03))
            fx, fy = math.cos(a)*(r-0.31), math.sin(a)*(r-0.31)
            objs.append(cube((0.86, 0.03, 0.9), (fx, fy, 2.45), mat('wdoor%d' % k, C(*col), 0.1, 0.5), 'wdoor', rot=(0,0,rr), bevel=0.01))
            objs.append(cube((0.04, 0.04, 0.5), (fx+math.cos(rr)*0.32, fy+math.sin(rr)*0.32, 1.5), M_METAL(), 'whandle', rot=(0,0,rr)))
            objs.append(cube((0.88, 0.02, 0.02), (fx, fy, 1.9), M_DARK(), 'wseam', rot=(0,0,rr)))
    # (the radial partition walls by the doorways were removed: they read as stray lines beside every passage)
    # hall ring marked on the floor and a ring of ceiling lights
    objs.append(torus(6.0, 0.05, (0,0,0.31), M_YELLOW(), 'floorring', maj=96, mnr=4))
    for k in range(16):
        a = k/16*math.pi*2
        objs.append(cube((0.8, 0.25, 0.06), (math.cos(a)*7.6, math.sin(a)*7.6, math.sqrt(121-7.6**2)-0.4), M_LIGHT(), 'ceilinglight', rot=(0,0,a)))
    hab = join(objs, 'hab')
    export('hab')

def build_corridors():
    for name, L in (('corr_air', 13.0), ('corr_gh', 14.0), ('corr_lab', 10.0)):
        reset()
        t = tunnel(L, name=name)
        if name == 'corr_air':
            # airlock doors at both ends + warning stripes + light
            objs = [t]
            for x in (0.6, L-0.2):
                objs.append(cube((0.25, 3.6, 0.4), (x, 0, 3.0), M_YELLOW(), 'doorhead'))
            objs.append(cube((0.25, 0.3, 0.3), (L+0.2, 1.3, 3.0), M_RED(), 'beacon'))
            # suit rack: three EMU-style suits hanging on wall mounts
            for k in range(3):
                objs += rack_suit(4+k*1.0, -1.52, 1, stripe=(k==0))
            objs.append(cube((3.2, 0.1, 0.06), (5, -1.44, 1.62), M_YELLOW(), 'rackrail'))
            # tool locker: grey body, two orange doors with vents, handles, label and a plinth
            lx, ly = 9.5, 1.42
            objs.append(cube((1.24, 0.32, 0.1), (lx, ly, 0.25), M_DARK(), 'plinth'))
            objs.append(cube((1.2, 0.3, 1.5), (lx, ly, 1.05), M_PANEL(), 'lockerbody', bevel=0.03))
            for q in (-1, 1):
                dx = lx + q*0.295
                objs.append(cube((0.56, 0.03, 1.38), (dx, ly-0.16, 1.05), M_ORANGE(), 'lockerdoor', bevel=0.012))
                for v in range(5): objs.append(cube((0.36, 0.012, 0.025), (dx, ly-0.178, 1.55+v*0.05), M_DARK(), 'vent'))
                objs.append(cube((0.03, 0.03, 0.34), (lx + q*0.06, ly-0.19, 1.05), M_METAL(), 'lockerhandle', bevel=0.008))
                for z in (0.55, 1.55): objs.append(cube((0.04, 0.02, 0.1), (lx + q*0.58, ly-0.17, z), M_DARK(), 'hinge'))
            objs.append(cube((0.3, 0.012, 0.12), (lx-0.3, ly-0.18, 1.3), M_WHITE(), 'label'))
            objs.append(cube((0.16, 0.012, 0.03), (lx-0.3, ly-0.19, 1.3), M_DARK(), 'labeltext'))
            objs.append(cube((1.18, 0.012, 0.06), (lx, ly-0.18, 0.42), M_YELLOW(), 'kickstripe'))
            objs.append(cube((0.07, 0.02, 0.07), (lx+0.45, ly-0.18, 1.62), mat('green_led', C(90,255,140),0,0.3,emit=C(60,255,120),estr=3), 'lockled'))
            t = join(objs, name)
        export(name)

def build_lab():
    reset()
    L, r = 16.0, 3.4
    objs = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=r, depth=L, location=(0,0,r), rotation=(0,math.pi/2,0), end_fill_type='NOTHING')
    sh = active(); sh.name = 'labshell'
    # cut doorway on +Y side (glTF -Z faces the hab ... hab is at Blender -Y of lab? lab sits at glTF z=-26 => Blender y=+26; door toward hab => Blender -Y)
    bm = bmesh.new(); bm.from_mesh(sh.data); mw = sh.matrix_world
    kill = [f for f in bm.faces if abs((mw @ f.calc_center_median()).x) < 1.7 and (mw @ f.calc_center_median()).y < -1.0 and (mw @ f.calc_center_median()).z < 3.2]
    bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(sh.data); bm.free()
    sh.modifiers.new('sol','SOLIDIFY').thickness = 0.2
    setmat(sh, M_WHITE()); smooth(sh); objs.append(sh)
    for s in (-1,1):
        # flat bulkhead closes each end (a dome here read as a giant ball from inside)
        objs.append(cyl(r+0.06, 0.25, (s*L/2,0,r), M_PANEL(), 'bulkhead', verts=40, rot=(0,math.pi/2,0)))
        objs.append(torus(r-0.15, 0.09, (s*(L/2-0.14),0,r), M_DARK(), 'bulkring', rot=(0,math.pi/2,0), maj=40, mnr=6))
        objs.append(cyl(0.55, 0.06, (s*(L/2-0.14),0,4.6), M_DARK(), 'porthole_rim', verts=24, rot=(0,math.pi/2,0)))
        objs.append(cyl(0.45, 0.07, (s*(L/2-0.15),0,4.6), M_SCREEN(), 'porthole', verts=24, rot=(0,math.pi/2,0)))
        objs.append(cube((0.1, 2.4, 1.3), (s*(L/2-0.17), 0, 2.35), M_DARK(), 'endpanel', bevel=0.03))
        objs.append(cube((0.06, 2.0, 1.0), (s*(L/2-0.22), 0, 2.35), M_SCREEN(), 'endscreen'))
        for y in (-1.9, 1.9): objs.append(cube((0.12, 0.5, 2.2), (s*(L/2-0.2), y, 1.75), M_WHITE(), 'endcab', bevel=0.03))
        for z in (1.0, 5.6): objs.append(cyl(0.06, 4.0, (s*(L/2-0.22), 0, z), M_METAL(), 'pipe', verts=8, rot=(math.pi/2,0,0)))
        # outside: tapered end cone, berthing ring, hatch with handwheel, handrails, lights and a stripe
        ex = s*(L/2+0.125)
        objs.append(cyl(r+0.06, 0.7, (ex + s*0.35, 0, r), M_WHITE(), 'endcone', verts=40, r2=r*0.6, rot=(0, s*math.pi/2, 0)))
        objs.append(torus(r+0.02, 0.1, (ex + s*0.02, 0, r), M_METAL(), 'endring', rot=(0,math.pi/2,0), maj=40, mnr=8))
        objs.append(cyl(r*0.6, 0.12, (ex + s*0.76, 0, r), M_PANEL(), 'berthplate', verts=32, rot=(0,math.pi/2,0)))
        objs.append(torus(r*0.58, 0.08, (ex + s*0.8, 0, r), M_DARK(), 'berthring', rot=(0,math.pi/2,0), maj=32, mnr=8))
        objs.append(cyl(0.85, 0.08, (ex + s*0.84, 0, r-0.2), M_WHITE(), 'hatch', verts=28, rot=(0,math.pi/2,0)))
        objs.append(torus(0.85, 0.05, (ex + s*0.87, 0, r-0.2), M_METAL(), 'hatchrim', rot=(0,math.pi/2,0), maj=28, mnr=6))
        objs.append(torus(0.25, 0.03, (ex + s*0.92, 0, r-0.2), M_YELLOW(), 'handwheel', rot=(0,math.pi/2,0), maj=20, mnr=6))
        for k in range(3): objs.append(cube((0.03, 0.5, 0.03), (ex + s*0.92, 0, r-0.2), M_YELLOW(), 'spokeh', rot=(k*math.pi/3, 0, 0)))
        objs.append(cyl(0.18, 0.04, (ex + s*0.89, 0, r+0.5), M_GLASS(), 'hatchwindow', verts=16, rot=(0,math.pi/2,0)))
        for q in (-1, 1):
            objs.append(cube((0.06, 0.06, 1.2), (ex + s*0.88, q*1.15, r-0.2), M_YELLOW(), 'handrail'))
            objs.append(cube((0.08, 0.3, 0.3), (ex + s*0.86, q*1.45, r+1.2), M_DARK(), 'lamphead', bevel=0.02))
            objs.append(cube((0.02, 0.24, 0.2), (ex + s*0.91, q*1.45, r+1.2), M_LIGHT(), 'lamp'))
        objs.append(cube((0.04, 2.0, 0.12), (ex + s*0.86, 0, r+1.15), M_ORANGE(), 'endstripe'))
    for k in range(9):
        x = -L/2 + k*L/8
        if abs(x) < 2.0: continue   # no rib across the doorway
        objs.append(torus(r+0.1, 0.08, (x,0,r), M_PANEL(), 'rib', rot=(0,math.pi/2,0), maj=40, mnr=6))
    objs.append(cube((L, 4.6, 0.2), (0,0,0.55), M_FLOOR(), 'floor'))
    objs.append(cube((L*0.9, 0.3, 0.06), (0,0,2*r-0.15), M_LIGHT(), 'strip'))
    # benches along +Y wall (far side): worktop, monitor on a stand, glovebox, microscope, rock samples,
    # upper cabinets and a shelf of sample jars
    M_GREEN = mat('led_green', C(90,230,120), 0.0, 0.3, emit=C(80,255,120), estr=3.0)
    for k in range(4):
        x = -6 + k*4
        objs.append(cube((3.2, 0.9, 0.9), (x, 1.6, 1.1), M_PANEL(), 'bench', bevel=0.04))
        objs.append(cube((3.25, 0.95, 0.05), (x, 1.58, 1.575), M_DARK(), 'benchtop'))
        for q in (-1.05, 0.0, 1.05): objs.append(cube((0.5, 0.02, 0.03), (x+q, 1.14, 1.3), M_METAL(), 'drawerhandle'))
        objs.append(cube((0.25, 0.18, 0.03), (x-0.6, 1.85, 1.615), M_DARK(), 'monbase'))
        objs.append(cube((0.05, 0.05, 0.35), (x-0.6, 1.88, 1.79), M_DARK(), 'monneck'))
        objs.append(cube((1.0, 0.05, 0.6), (x-0.6, 1.84, 2.2), M_DARK(), 'labbezel', bevel=0.015))
        objs.append(cube((0.92, 0.02, 0.52), (x-0.6, 1.81, 2.2), M_SCREEN(), 'labscreen'))
        # glovebox: solid frame and back, glass front with two glove ports and gloves reaching inside
        gx = x+0.8
        objs.append(cube((0.84, 0.52, 0.06), (gx, 1.6, 1.63), M_DARK(), 'gbbase'))
        objs.append(cube((0.84, 0.52, 0.06), (gx, 1.6, 2.2), M_DARK(), 'gbroof'))
        objs.append(cube((0.84, 0.06, 0.6), (gx, 1.84, 1.92), M_PANEL(), 'gbback'))
        for q in (-0.4, 0.4): objs.append(cube((0.05, 0.52, 0.6), (gx+q, 1.6, 1.92), M_DARK(), 'gbside'))
        objs.append(cube((0.76, 0.02, 0.5), (gx, 1.36, 1.92), M_GLASS(), 'glovebox'))
        for q in (-0.18, 0.18):
            objs.append(cyl(0.085, 0.04, (gx+q, 1.35, 1.88), M_DARK(), 'gloveport', verts=16, rot=(math.pi/2,0,0)))
            objs.append(cyl(0.06, 0.3, (gx+q, 1.5, 1.86), M_RUBBER(), 'glove', verts=10, rot=(math.pi/2,0,0), r2=0.045))
        objs.append(sphere(0.11, (x+0.8, 1.65, 1.7), M_DARK() if k%2 else M_PANEL(), 'rock', seg=7, ring=5, scale=(1.2,1,0.8)))
        objs.append(cube((0.6, 0.4, 0.04), (x, 1.85, 2.85), M_WHITE(), 'shelf'))
        for j in range(5): objs.append(cyl(0.06, 0.16, (x-0.24+j*0.12, 1.85, 2.95), M_GLASS() if j%2 else M_ORANGE(), 'jar', verts=10))
        objs.append(cube((1.4, 0.4, 0.6), (x+0.95, 1.9, 3.15), M_WHITE(), 'uppercab', bevel=0.03))
        objs.append(cube((0.02, 0.02, 0.4), (x+0.95, 1.69, 3.15), M_METAL(), 'cabhandle'))
        objs.append(cube((0.03, 0.03, 0.03), (x+1.55, 1.13, 1.45), M_GREEN, 'benchled'))
    # pipes and cable trays along the ceiling
    for y in (-1.3, 1.3):
        objs.append(cyl(0.05, L-0.6, (0, y, 6.15), M_METAL(), 'ceilpipe', verts=10, rot=(0,math.pi/2,0)))
    objs.append(cube((L-0.6, 0.35, 0.05), (0, 0, 6.5), M_DARK(), 'cabletray'))
    # plant growth chamber (like the Advanced Plant Habitat on the ISS) on the near wall, east end
    objs.append(cube((0.8, 0.7, 1.4), (7.3, -1.75, 1.4), M_WHITE(), 'apha', bevel=0.04))
    objs.append(cube((0.65, 0.02, 1.0), (7.3, -1.39, 1.45), M_GLASS(), 'aphadoor'))
    objs.append(cube((0.65, 0.5, 0.04), (7.3, -1.75, 1.95), M_GROW(), 'aphalight'))
    for j in range(4): objs.append(sphere(0.08, (7.05+j*0.17, -1.7, 1.15), M_LEAF(), 'aphaplant', seg=8, ring=5, scale=(1,1,0.8)))
    # moon rock under a glass dome on the island
    objs.append(cyl(0.22, 0.05, (4.75, -0.5, 1.62), M_DARK(), 'rockbase', verts=20))
    objs.append(sphere(0.12, (4.75, -0.5, 1.72), M_PANEL(), 'moonrock', seg=7, ring=5, scale=(1.3,1,0.8)))
    dome = sphere(0.2, (4.75, -0.5, 1.64), M_GLASS(), 'rockdome', seg=16, ring=8)
    bm = bmesh.new(); bm.from_mesh(dome.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context='VERTS'); bm.to_mesh(dome.data); bm.free()
    objs.append(dome)
    # sample racks
    for k in range(6):
        objs.append(cyl(0.08, 0.35, (-7+k*0.35, -1.9, 1.3), M_GLASS(), 'tube', verts=10))
    objs.append(cube((2.5, 0.5, 1.2), (-6.0, -1.9, 0.9), M_METAL(), 'rack'))
    # central island with microscope, sample trays and stools
    objs.append(cube((2.2, 0.9, 0.9), (4.0, -0.5, 1.1), M_PANEL(), 'island', bevel=0.04))
    objs.append(cube((2.3, 1.0, 0.05), (4.0, -0.5, 1.57), M_DARK(), 'islandtop'))
    # microscope: heavy base, upright pillar, arm, stage with a slide, objective and an angled eyepiece
    objs.append(cube((0.3, 0.36, 0.05), (3.3, -0.45, 1.62), M_WHITE(), 'mscbase', bevel=0.02))
    objs.append(cube((0.08, 0.08, 0.42), (3.3, -0.3, 1.85), M_WHITE(), 'mscpillar', bevel=0.02))
    objs.append(cube((0.1, 0.24, 0.08), (3.3, -0.39, 2.06), M_WHITE(), 'mscarm', bevel=0.02))
    objs.append(cube((0.2, 0.18, 0.02), (3.3, -0.5, 1.8), M_DARK(), 'mscstage'))
    objs.append(cube((0.08, 0.03, 0.005), (3.3, -0.52, 1.813), M_GLASS(), 'slide'))
    objs.append(cyl(0.03, 0.12, (3.3, -0.5, 1.96), M_DARK(), 'objective', verts=12))
    objs.append(cyl(0.025, 0.16, (3.3, -0.36, 2.15), M_DARK(), 'eyepiece', verts=12, rot=(-0.5,0,0)))
    for k in range(3): objs.append(cube((0.22, 0.32, 0.05), (3.75+k*0.26, -0.6, 1.62), M_WHITE(), 'tray', bevel=0.01))
    for k in range(3): objs.append(sphere(0.045, (3.75+k*0.26, -0.6, 1.67), M_DARK() if k%2 else M_PANEL(), 'sample', seg=7, ring=5, scale=(1.3,1,0.7)))
    # laptop at the other end of the island
    objs.append(cube((0.36, 0.26, 0.02), (4.75, -0.75, 1.605), M_DARK(), 'laptopbase'))
    objs.append(cube((0.36, 0.02, 0.24), (4.75, -0.62, 1.73), M_DARK(), 'laptoplid', rot=(-0.25,0,0)))
    objs.append(cube((0.32, 0.005, 0.2), (4.75, -0.635, 1.73), M_SCREEN(), 'laptopscreen', rot=(-0.25,0,0)))
    for x in (3.4, 4.6):
        objs.append(cyl(0.22, 0.08, (x, -1.35, 1.0), M_BLUE(), 'labstool', verts=14))
        objs.append(cyl(0.04, 0.4, (x, -1.35, 0.78), M_METAL(), 'labstoolleg', verts=8))
    # sample freezer and core-sample rack (west end)
    objs.append(cube((1.0, 0.8, 1.6), (-3.2, -1.8, 1.45), M_WHITE(), 'freezer', bevel=0.04))
    objs.append(cube((0.6, 0.04, 0.25), (-3.2, -2.22, 1.9), M_SCREEN(), 'freezerscreen'))
    # drill cores lie in a proper core box on a low cabinet instead of floating
    objs.append(cube((1.5, 0.6, 0.8), (5.75, -1.85, 1.0), M_PANEL(), 'corecab', bevel=0.03))
    objs.append(cube((1.4, 0.55, 0.12), (5.75, -1.85, 1.46), M_DARK(), 'corebox'))
    for k in range(4): objs.append(cyl(0.05, 1.25, (5.75, -2.06+k*0.14, 1.52), M_ORANGE() if k%2 else M_PANEL(), 'core', verts=10, rot=(0,math.pi/2,0)))
    lab = join(objs, 'lab')
    export('lab')

def build_greenhouse():
    reset()
    R = 9.0
    # geodesic frame from an icosphere
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=R)
    ic = active(); ic.name = 'geo'
    bm = bmesh.new(); bm.from_mesh(ic.data)
    rm = [v for v in bm.verts if v.co.z < -0.3]
    bmesh.ops.delete(bm, geom=rm, context='VERTS')
    # door opening at +X (towards hab: hab is at glTF x=0, greenhouse at x=-34 => door at +X)
    kill = [f for f in bm.faces if f.calc_center_median().x > R*0.8 and abs(f.calc_center_median().y) < 2.0 and f.calc_center_median().z < 3.6]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(ic.data); bm.free()
    glass = ic.copy(); glass.data = ic.data.copy(); bpy.context.collection.objects.link(glass); glass.name='glass'
    setmat(glass, M_GLASS())
    wf = ic.modifiers.new('wf','WIREFRAME'); wf.thickness = 0.12; setmat(ic, M_PANEL())
    objs = [ic, glass]
    gring = cyl(R+0.2, 0.6, (0,0,0.3), M_PANEL(), 'ring', verts=60)
    ghole = cyl(R-0.15, 2.0, (0,0,0.3), M_PANEL(), 'ringhole', verts=60)
    md = gring.modifiers.new('hole','BOOLEAN'); md.object = ghole; md.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = gring; bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.data.objects.remove(ghole)
    # open the base ring at the door so nothing blocks the passage
    bpy.ops.mesh.primitive_cube_add(size=1, location=(R, 0, 0.3)); cutter = active(); cutter.scale = (2.0, 3.4, 2.0); bpy.ops.object.transform_apply(scale=True)
    md = gring.modifiers.new('cut','BOOLEAN'); md.object = cutter; md.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = gring; bpy.ops.object.modifier_apply(modifier=md.name); bpy.data.objects.remove(cutter)
    objs.append(gring)
    objs.append(cyl(R-0.1, 0.25, (0,0,0.12), M_FLOOR(), 'floor', verts=60))
    objs.append(cube((1.4, 3.2, 0.25), (R-0.2, 0, 0.12), M_FLOOR(), 'doorfloor'))
    # walkway
    objs.append(cube((R*2-1, 1.6, 0.05), (0,0,0.27), M_DARK(), 'walk'))
    gh = join(objs, 'greenhouse')
    export('greenhouse')
    # one raised bed with LED bar (instanced 8x in game)
    reset()
    objs = [cube((5.0, 1.4, 0.7), (0,0,0.35), M_PANEL(), 'bed', bevel=0.05),
            cube((4.8, 1.2, 0.1), (0,0,0.68), M_SOIL(), 'soil')]
    for s in (-2.3, 2.3): objs.append(cube((0.1, 0.1, 2.0), (s,0,1.6), M_METAL(), 'post'))
    objs.append(cube((4.8, 0.3, 0.08), (0,0,2.55), M_GROW(), 'ledbar'))
    join(objs, 'bed'); export('bed')

def leaf(len_, wid, loc, ang, tilt, m):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0,0,0))
    o = active(); o.scale = (len_, wid, 1); bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts:
        v.co.x += len_/2; v.co.z = 0.25*(v.co.x/len_)**2*len_ - 0.05*abs(v.co.y)
        v.co.y *= (1 - (v.co.x/len_)**2)
    bm.to_mesh(o.data); bm.free()
    o.rotation_euler = (0, -tilt, ang); o.location = loc
    return setmat(o, m)

def build_plants():
    # lettuce
    reset(); objs = []
    for k in range(14):
        a = k*2.4; t = 0.5 + 0.5*(k%3)/2
        objs.append(leaf(0.28+0.05*(k%3), 0.2, (0,0,0.02+k*0.004), a, t, M_LEAF() if k%2 else M_LEAF2()))
    join(objs,'lettuce'); export('lettuce')
    # tomato
    reset(); objs = [cyl(0.03, 1.1, (0,0,0.55), M_LEAF2(), 'stem', verts=6)]
    for k in range(10):
        z = 0.2 + k*0.09; a = k*1.9
        objs.append(leaf(0.22, 0.12, (0,0,z), a, 0.3, M_LEAF()))
    for k in range(6):
        a = k*1.3; z = 0.35+0.11*k
        objs.append(sphere(0.06, (math.cos(a)*0.12, math.sin(a)*0.12, z), M_TOMATO(), 'fruit', seg=10, ring=6))
    join(objs,'tomato'); export('tomato')
    # wheat clump
    reset(); objs = []
    for k in range(12):
        a = k*2.1; rr = 0.05+0.04*(k%3); x, y = math.cos(a)*rr, math.sin(a)*rr
        objs.append(cyl(0.008, 0.8, (x,y,0.4), M_WHEAT(), 'stalk', verts=4, rot=(random.uniform(-0.12,0.12), random.uniform(-0.12,0.12),0)))
        objs.append(cyl(0.025, 0.14, (x,y,0.85), M_WHEAT(), 'head', verts=6))
    join(objs,'wheat'); export('wheat')

def build_solar():
    reset(); objs = []
    W, H = 4.2, 2.4
    M_FR = mat('solar_frame', C(190,196,206), 0.8, 0.3)
    # aluminium frame with a raised lip, 10 x 5 cells with silver busbars, a white backsheet and a rear truss
    objs.append(cube((W+0.14, H+0.14, 0.05), (0,0,0), M_FR, 'frame', bevel=0.01))
    for sx in (-1,1): objs.append(cube((0.06, H+0.14, 0.09), (sx*(W/2+0.04),0,0.02), M_FR, 'lip'))
    for sy in (-1,1): objs.append(cube((W+0.14, 0.06, 0.09), (0,sy*(H/2+0.04),0.02), M_FR, 'lip'))
    objs.append(cube((W, H, 0.01), (0,0,0.028), M_WHITE(), 'backsheet'))
    nx, ny = 10, 5
    for i in range(nx):
        for j in range(ny):
            objs.append(cube((W/nx-0.035, H/ny-0.035, 0.02), (-W/2+W/nx/2+i*W/nx, -H/2+H/ny/2+j*H/ny, 0.04), M_CELL(), 'cell'))
    for j in range(ny):
        for q in (-0.12, 0.12):
            objs.append(cube((W-0.04, 0.008, 0.004), (0, -H/2+H/ny/2+j*H/ny+q*H/ny*1.6, 0.052), M_METAL(), 'busbar'))
    objs.append(cube((W*0.9, 0.08, 0.08), (0,-H*0.3,-0.07), M_FR, 'purlin'))
    objs.append(cube((W*0.9, 0.08, 0.08), (0,H*0.3,-0.07), M_FR, 'purlin'))
    for x in (-1.6, -0.55, 0.55, 1.6): objs.append(cube((0.06, H*0.85, 0.06), (x,0,-0.05), M_FR, 'rib'))
    objs.append(tube((-W*0.42,0,-0.14), (W*0.42,0,-0.14), 0.06, M_METAL(), 'torque'))
    objs.append(cube((0.3, 0.18, 0.1), (0.9,-H*0.38,-0.1), M_DARK(), 'jbox', bevel=0.015))
    arr = join(objs, 'array')
    arr.location = (0,0,2.4)
    st = []
    st.append(cyl(0.11, 2.15, (0,0,1.1), M_METAL(), 'post', verts=14))
    st.append(cyl(0.2, 0.22, (0,0,2.12), M_DARK(), 'slew', verts=20))
    for sx in (-1,1):
        st.append(cube((0.08, 0.2, 0.35), (sx*0.28,0,2.3), M_FR, 'yoke'))
        st.append(cyl(0.08, 0.06, (sx*0.33,0,2.26), M_DARK(), 'bearing', verts=12, rot=(0,math.pi/2,0)))
    st.append(cube((0.7, 0.24, 0.06), (0,0,2.2), M_FR, 'yokebase'))
    st.append(cube((0.25,0.15,0.2), (0.22,0,1.95), M_DARK(), 'motor', bevel=0.02))
    st.append(cube((1.1, 1.1, 0.12), (0,0,0.06), M_DARK(), 'foot', bevel=0.02))
    for sx in (-1,1):
        for sy in (-1,1): st.append(cyl(0.035, 0.05, (sx*0.42, sy*0.42, 0.14), M_METAL(), 'bolt', verts=8))
    for k in range(4):
        a2 = k*math.pi/2
        st.append(tube((math.cos(a2)*0.48, math.sin(a2)*0.48, 0.12), (math.cos(a2)*0.1, math.sin(a2)*0.1, 0.9), 0.03, M_FR, 'gusset'))
    st.append(tube((0.12,0.05,1.9), (0.12,0.05,0.2), 0.02, M_RUBBER(), 'cable', verts=6))
    st.append(tube((0.12,0.05,0.2), (0.6,0.05,0.02), 0.02, M_RUBBER(), 'cable', verts=6))
    st.append(cube((0.3,0.04,0.2), (0,-0.13,1.2), M_YELLOW(), 'tag'))
    join(st, 'stand')
    export('solar')

def build_battery():
    reset(); objs = [cube((1.6,1.0,1.8), (0,0,0.9), M_DARK(), 'box', bevel=0.05)]
    for k in range(5): objs.append(cube((0.02,0.8,0.08), (0.81,0,0.5+k*0.2), M_METAL(), 'vent'))
    objs.append(cube((1.62,1.02,0.12), (0,0,1.86), M_METAL(), 'lid', bevel=0.02))
    objs.append(cube((0.5,0.02,0.3), (0,-0.51,1.3), M_SCREEN(), 'disp'))
    objs.append(cube((1.4,0.02,0.06), (0,-0.51,0.25), M_YELLOW(), 'stripe'))
    join(objs,'battery'); export('battery')

def build_reactor():
    # Fission-surface-power style reactor: core vessel and shield cone on a plinth, four radiator wings
    # with coolant pipes and headers, a top hat, a power conversion ring, warning signs and a cable trench.
    reset(); objs = []
    M_RAD = mat('radiator_panel', C(206,210,216), 0.45, 0.4)
    M_RADP = mat('radiator_pipe', C(168,120,72), 0.8, 0.35)
    objs.append(cube((5.0, 5.0, 0.35), (0,0,0.175), mat('concrete', C(150,146,140), 0.0, 0.9), 'plinth', bevel=0.04))
    for k in range(4):
        a = k*math.pi/2
        objs.append(cube((1.2, 0.08, 0.35), (math.cos(a)*2.5, math.sin(a)*2.5, 0.175), M_YELLOW(), 'edge', rot=(0,0,a+math.pi/2)))
    objs.append(cyl(1.9, 0.5, (0,0,0.6), M_DARK(), 'base', verts=40))
    objs.append(cyl(1.5, 1.6, (0,0,1.65), mat('shield', C(120,126,136), 0.6, 0.45), 'shieldcone', verts=40, r2=1.25))
    objs.append(torus(1.52, 0.06, (0,0,1.0), M_YELLOW(), 'shieldband', maj=40, mnr=6))
    objs.append(cyl(1.15, 3.2, (0,0,4.05), M_PANEL(), 'core', verts=40))
    for z in (2.7, 3.6, 4.5, 5.4): objs.append(torus(1.17, 0.045, (0,0,z), M_METAL(), 'hoop', maj=40, mnr=6))
    objs.append(cyl(1.35, 0.5, (0,0,3.1), M_DARK(), 'pcu', verts=24))
    for k in range(8):
        a = k*math.pi/4
        objs.append(cube((0.25, 0.12, 0.3), (math.cos(a)*1.4, math.sin(a)*1.4, 3.1), M_METAL(), 'stirling', rot=(0,0,a)))
    objs.append(cyl(1.15, 0.9, (0,0,6.1), M_METAL(), 'top', verts=40, r2=0.55))
    objs.append(cyl(0.55, 0.25, (0,0,6.67), M_DARK(), 'cap', verts=24))
    objs.append(sphere(0.18, (0,0,6.9), mat('green_light', C(90,255,140),0,0.3,emit=C(60,255,120),estr=4), 'light', seg=10, ring=6))
    for k in range(4):
        a = k*math.pi/2 + math.pi/4
        ca, sa = math.cos(a), math.sin(a)
        cx, cy = ca*4.3, sa*4.3
        objs.append(cube((5.2, 0.06, 3.4), (cx, cy, 3.8), M_RAD, 'radiator', rot=(0,0,a)))
        objs.append(cube((5.3, 0.12, 0.12), (cx, cy, 5.5), M_METAL(), 'radframe', rot=(0,0,a)))
        objs.append(cube((5.3, 0.12, 0.12), (cx, cy, 2.1), M_METAL(), 'radframe', rot=(0,0,a)))
        for side in (-1, 1):
            for q in range(9):
                objs.append(cube((0.05, 0.1, 3.3), (cx + ca*(-2.35+q*0.6), cy + sa*(-2.35+q*0.6), 3.8), M_RADP, 'riser', rot=(0,0,a)))
        objs.append(cube((0.16, 0.16, 3.5), (ca*1.65, sa*1.65, 3.8), M_RADP, 'header', rot=(0,0,a)))
        objs.append(cube((1.1, 0.3, 0.3), (ca*1.5, sa*1.5, 5.2), M_METAL(), 'boom', rot=(0,0,a)))
        objs.append(cube((1.1, 0.3, 0.3), (ca*1.5, sa*1.5, 2.4), M_METAL(), 'boom', rot=(0,0,a)))
        objs.append(tube((ca*6.6, sa*6.6, 2.1), (ca*6.6, sa*6.6, 0.0), 0.06, M_METAL(), 'radleg'))
        objs.append(cyl(0.25, 0.08, (ca*6.6, sa*6.6, 0.04), M_DARK(), 'radfoot', verts=12))
    # warning signs on the shield (yellow triangle with a black dot) and a cable trench to the base
    for k in range(4):
        a = k*math.pi/2
        ca, sa = math.cos(a), math.sin(a)
        objs.append(cube((0.6, 0.04, 0.5), (ca*1.42, sa*1.42, 1.75), M_YELLOW(), 'sign', rot=(0.0, 0, a+math.pi/2)))
        objs.append(cyl(0.09, 0.05, (ca*1.45, sa*1.45, 1.75), M_DARK(), 'trefoil', verts=12, rot=(math.pi/2, 0, a+math.pi/2)))
    objs.append(tube((0, -1.9, 0.6), (0, -2.6, 0.36), 0.07, M_RUBBER(), 'powercable'))
    objs.append(cube((0.8, 0.6, 1.0), (1.2, -3.3, 0.5), M_PANEL(), 'switchbox', bevel=0.04))
    objs.append(cube((0.5, 0.02, 0.3), (1.2, -3.61, 0.65), M_SCREEN(), 'switchscreen'))
    join(objs,'reactor'); export('reactor')

def build_dish():
    # A small deep-space style antenna: pad, tapered pedestal with ladder, azimuth bearing and yoke,
    # a ribbed parabolic reflector with a quadripod, subreflector and feed horn, a counterweight and an equipment shelter.
    reset()
    bm = bmesh.new(); prof = []
    for i in range(14):
        r = 2.9*i/13; prof.append(bm.verts.new((r, 0, 0.13*r*r)))
    for i in range(13): bm.edges.new((prof[i], prof[i+1]))
    bmesh.ops.spin(bm, geom=bm.verts[:]+bm.edges[:], cent=(0,0,0), axis=(0,0,1), steps=48, angle=math.pi*2)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    me = bpy.data.meshes.new('refl'); bm.to_mesh(me); bm.free()
    refl = bpy.data.objects.new('refl', me); bpy.context.collection.objects.link(refl)
    refl.modifiers.new('sol','SOLIDIFY').thickness = 0.05
    setmat(refl, M_WHITE()); smooth(refl)
    objs = [refl]
    zr = 0.13*2.9*2.9
    objs.append(torus(2.9, 0.05, (0,0,zr), M_METAL(), 'rim', maj=48, mnr=6))
    # back structure: radial ribs and a hub
    for k in range(12):
        a = k/12*math.pi*2
        objs.append(cube((2.7, 0.05, 0.16), (math.cos(a)*1.45, math.sin(a)*1.45, 0.13*1.45*1.45-0.12), M_METAL(), 'rib', rot=(0, -math.atan(0.26*1.45), a)))
    objs.append(cyl(0.55, 0.5, (0,0,-0.2), M_PANEL(), 'hub', verts=16))
    # quadripod to the subreflector, feed horn in the middle
    fz = 2.6
    for k in range(4):
        a = k*math.pi/2 + math.pi/4; bx, by = math.cos(a)*2.3, math.sin(a)*2.3; bz = 0.13*2.3*2.3
        L = math.sqrt(bx*bx + by*by + (fz-bz)**2)
        mx, my, mz = bx/2, by/2, (bz+fz)/2
        tilt = math.acos((fz-bz)/L)
        objs.append(cyl(0.035, L, (mx, my, mz), M_METAL(), 'strut', verts=6, rot=(0, -tilt, a)))
    objs.append(cyl(0.38, 0.12, (0,0,fz), M_WHITE(), 'subrefl', verts=24, r2=0.15))
    objs.append(cyl(0.18, 0.7, (0,0,0.45), M_PANEL(), 'feedhorn', verts=16, r2=0.32))
    objs.append(sphere(0.07, (0,0,fz+0.12), M_RED(), 'beacon', seg=10, ring=6))
    # counterweight behind the dish
    objs.append(cube((1.1, 0.7, 0.6), (0, 0, -0.9), M_DARK(), 'counterweight', bevel=0.04))
    head = join(objs, 'head')
    head.location = (0,0,5.6); head.rotation_euler = (0.6, 0, 0)
    # static mount
    m = []
    m.append(cube((3.0,3.0,0.3), (0,0,0.15), M_DARK(), 'pad', bevel=0.05))
    for sx in (-1,1):
        for sy in (-1,1): m.append(cyl(0.07, 0.12, (sx*1.25, sy*1.25, 0.36), M_METAL(), 'bolt', verts=6))
    m.append(cyl(0.6, 4.4, (0,0,2.5), M_PANEL(), 'pedestal', verts=8, r2=0.38))
    m.append(cube((0.5, 0.05, 0.05), (0, 0, 0.9), M_YELLOW(), 'stripe'))
    for q in (-0.2, 0.2): m.append(cyl(0.02, 4.0, (q, -0.62, 2.3), M_METAL(), 'ladder', verts=6))
    for h in range(10): m.append(cyl(0.015, 0.42, (0, -0.62, 0.6+h*0.4), M_METAL(), 'rung', verts=6, rot=(0, math.pi/2, 0)))
    m.append(cyl(0.08, 4.2, (0.5, 0.25, 2.3), M_DARK(), 'conduit', verts=8))
    m.append(cyl(0.7, 0.3, (0,0,4.8), M_METAL(), 'azbearing', verts=24))
    for sx in (-1,1): m.append(cube((0.2, 0.5, 1.0), (sx*0.9, 0, 5.3), M_PANEL(), 'yoke', bevel=0.03))
    m.append(cube((2.0, 0.6, 0.2), (0, 0, 4.95), M_PANEL(), 'yokebase', bevel=0.03))
    m.append(cyl(0.12, 2.0, (0,0,5.6), M_METAL(), 'elaxle', verts=12, rot=(0, math.pi/2, 0)))
    # equipment shelter
    m.append(cube((1.6, 1.1, 1.3), (2.3, 0.4, 0.95), M_WHITE(), 'shelter', bevel=0.05))
    m.append(cube((0.6, 0.03, 1.0), (2.1, -0.16, 0.85), M_PANEL(), 'shdoor'))
    m.append(cube((0.3, 0.03, 0.15), (2.7, -0.16, 1.3), M_SCREEN(), 'shscreen'))
    for k in range(3): m.append(sphere(0.04, (2.6+k*0.1, -0.17, 1.1), M_RED() if k==0 else mat('green_light', C(90,255,140),0,0.3,emit=C(60,255,120),estr=4), 'shled', seg=8, ring=4))
    m.append(cube((0.04, 1.0, 0.9), (3.12, 0.4, 0.95), M_DARK(), 'radiator'))
    join(m, 'mount')
    export('dish')

def build_rover():
    # Two-seat open rover in the spirit of the Apollo LRV: tubular chassis, wishbone suspension, mesh wheels
    # with chevron treads and curved fenders, two seats with belts, a T-handle controller and display,
    # an umbrella high-gain antenna, a camera, a low-gain antenna and a rear tool pallet.
    # Wheels are separate nodes (wFL, wFR, wRL, wRR) with the origin at the hub so the game can spin and steer them.
    reset(); objs = []
    M_FRAME = mat('rover_frame', C(178,184,194), 0.75, 0.3)
    M_FENDER = mat('rover_fender', C(70,108,170), 0.2, 0.45)
    M_FOIL = mat('rover_foil', C(214,206,190), 0.6, 0.35)
    # chassis: two side rails, cross members, floor pan
    for y in (-0.62, 0.62): objs.append(tube((-1.5,y,0.68), (1.5,y,0.68), 0.045, M_FRAME, 'rail'))
    for x in (-1.45, -0.75, 0.0, 0.75, 1.45): objs.append(tube((x,-0.62,0.68), (x,0.62,0.68), 0.035, M_FRAME, 'cross'))
    objs.append(cube((2.9, 1.2, 0.03), (0,0,0.7), M_METAL(), 'floorpan'))
    objs.append(cube((1.0, 1.1, 0.03), (0.15,0,0.73), mat('mat_dark', C(60,66,78), 0.1, 0.9), 'floormat'))
    # suspension: upper and lower wishbones and a damper per wheel
    for x in (-1.05, 1.05):
        for y in (-1, 1):
            hub = (x, y*0.74, 0.41)
            for dx in (-0.22, 0.22):
                objs.append(tube((x+dx, y*0.6, 0.66), (x, y*0.72, 0.5), 0.022, M_FRAME, 'armU'))
                objs.append(tube((x+dx, y*0.6, 0.6), (x, y*0.72, 0.33), 0.022, M_FRAME, 'armL'))
            objs.append(tube((x-0.05*(1 if x>0 else -1), y*0.6, 0.85), (x, y*0.7, 0.45), 0.03, M_DARK(), 'damper'))
            # curved fender over the wheel (top arc only)
            bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.5, depth=0.34, location=(x, y*0.88, 0.41), rotation=(math.pi/2,0,0), end_fill_type='NOTHING')
            fd = active(); bpy.context.view_layer.update(); mw = fd.matrix_world
            cut_sphere(fd, lambda c, mw=mw: (mw @ c).z > 0.62)
            fd.modifiers.new('sol','SOLIDIFY').thickness = 0.025
            setmat(fd, M_FENDER); smooth(fd); objs.append(fd)
            objs.append(cube((0.5, 0.36, 0.02), (x + (0.42 if x>0 else -0.42), y*0.88, 0.72), M_FENDER, 'fenderext', bevel=0.005))
    # front avionics bay: foil-wrapped box, dust-cover lids, radiator mirror on top
    objs.append(cube((0.65, 1.2, 0.36), (1.25,0,0.9), M_FOIL, 'avionics', bevel=0.03))
    objs.append(cube((0.5, 0.5, 0.02), (1.25,-0.3,1.09), mat('mirror', C(220,230,240), 1.0, 0.05), 'radiator'))
    objs.append(cube((0.5, 0.5, 0.02), (1.25,0.3,1.09), M_WHITE(), 'dustcover', bevel=0.005))
    for y in (-0.45, 0.45):
        objs.append(cyl(0.06, 0.05, (1.58,y,0.92), M_LIGHT(), 'headlight', verts=14, rot=(0,math.pi/2,0)))
        objs.append(cyl(0.075, 0.04, (1.565,y,0.92), M_DARK(), 'headlightrim', verts=14, rot=(0,math.pi/2,0)))
    objs.append(cube((0.02, 0.9, 0.05), (1.585,0,0.78), M_YELLOW(), 'bumperstripe'))
    # batteries under the seats
    for y in (-0.38, 0.38): objs.append(cube((0.5, 0.36, 0.18), (0.05,y,0.82), M_DARK(), 'battery', bevel=0.02))
    # seats: tube frame, fabric pan and back, belts, armrests, footrest
    for y in (-0.36, 0.36):
        objs.append(cube((0.52, 0.5, 0.06), (-0.05,y,1.0), M_BLUE(), 'seat', bevel=0.025))
        objs.append(cube((0.07, 0.5, 0.58), (-0.33,y,1.3), M_BLUE(), 'seatback', bevel=0.025, rot=(0,-0.18,0)))
        for yy in (y-0.26, y+0.26):
            objs.append(tube((0.22,yy,0.98), (-0.3,yy,0.98), 0.018, M_FRAME, 'seatframe'))
            objs.append(tube((-0.3,yy,0.98), (-0.4,yy,1.6), 0.018, M_FRAME, 'seatframe'))
            objs.append(tube((-0.15,yy,1.2), (0.18,yy,1.2), 0.016, M_FRAME, 'armrest'))
            objs.append(tube((0.18,yy,1.2), (0.18,yy,0.98), 0.016, M_FRAME, 'armpost'))
        objs.append(tube((-0.4,y-0.26,1.6), (-0.4,y+0.26,1.6), 0.018, M_FRAME, 'seattop'))
        for sy in (-0.12, 0.12): objs.append(cube((0.02, 0.05, 0.5), (-0.28,y+sy,1.28), M_DARK(), 'belt', rot=(0,-0.18,0)))
        objs.append(cube((0.3, 0.06, 0.02), (-0.03,y,1.04), M_DARK(), 'lapbelt'))
        objs.append(cube((0.25, 0.45, 0.03), (0.55,y,0.8), M_METAL(), 'footrest', rot=(0,0.5,0)))
    # control console: post, angled display with gauges, T-handle hand controller
    objs.append(tube((0.45,0,0.72), (0.45,0,1.25), 0.04, M_FRAME, 'consolepost'))
    objs.append(cube((0.12, 0.42, 0.3), (0.5,0,1.36), M_DARK(), 'console', bevel=0.02, rot=(0,-0.35,0)))
    objs.append(cube((0.01, 0.36, 0.2), (0.44,0,1.38), M_SCREEN(), 'cscreen', rot=(0,-0.35,0)))
    for k, mm in enumerate((M_RED(), M_LIGHT(), mat('green_led', C(90,255,140),0,0.3,emit=C(60,255,120),estr=3))):
        objs.append(cube((0.02, 0.03, 0.03), (0.43,-0.12+k*0.12,1.24), mm, 'clight'))
    objs.append(cube((0.16, 0.12, 0.08), (0.18,0,1.06), M_DARK(), 'tbase', bevel=0.01))
    objs.append(tube((0.18,0,1.08), (0.18,0,1.28), 0.018, M_METAL(), 'tstick'))
    objs.append(tube((0.18,-0.07,1.29), (0.18,0.07,1.29), 0.022, M_RUBBER(), 'thandle'))
    # umbrella high-gain antenna on a mast at the front left
    objs.append(tube((1.0,-0.55,0.95), (1.0,-0.55,2.0), 0.025, M_FRAME, 'hgamast'))
    objs.append(cyl(0.5, 0.18, (1.0,-0.55,2.12), mat('hga_mesh', C(232,232,226), 0.3, 0.5), 'hga', verts=16, r2=0.06, rot=(0,-0.35,0)))
    for k in range(8):
        a2 = k*math.pi/4
        objs.append(tube((1.0,-0.55,2.04), (1.0+math.cos(a2)*0.47*0.94, -0.55+math.sin(a2)*0.47, 2.04+0.1+math.cos(a2)*0.16), 0.008, M_FRAME, 'hgarib', verts=5))
    objs.append(tube((1.0,-0.55,2.12), (1.08,-0.55,2.4), 0.012, M_METAL(), 'feed', verts=6))
    # low-gain helical antenna and TV camera
    objs.append(tube((1.0,0.55,0.95), (1.0,0.55,1.7), 0.02, M_FRAME, 'lgamast'))
    objs.append(cyl(0.05, 0.45, (1.0,0.55,1.92), M_WHITE(), 'lga', verts=10, r2=0.02))
    objs.append(tube((1.45,-0.2,1.1), (1.45,-0.2,1.55), 0.025, M_FRAME, 'cammast'))
    objs.append(cube((0.22, 0.14, 0.14), (1.47,-0.2,1.63), M_WHITE(), 'camera', bevel=0.02))
    objs.append(cyl(0.05, 0.12, (1.62,-0.2,1.63), M_DARK(), 'lens', verts=14, rot=(0,math.pi/2,0)))
    objs.append(cyl(0.035, 0.01, (1.685,-0.2,1.63), M_GLASS(), 'lensglass', verts=14, rot=(0,math.pi/2,0)))
    # rear pallet: toolbox, sample bags, a rake and a scoop, a whip antenna and tail lights
    objs.append(cube((0.8, 1.2, 0.05), (-1.25,0,0.75), M_METAL(), 'pallet'))
    for x in (-1.6, -0.9):
        for y in (-0.6, 0.6): objs.append(tube((x,y,0.75), (x,y,1.25), 0.018, M_FRAME, 'palletpost'))
    for x in (-1.6, -0.9): objs.append(tube((x,-0.6,1.25), (x,0.6,1.25), 0.018, M_FRAME, 'palletrail'))
    objs.append(cube((0.55, 0.5, 0.3), (-1.25,-0.3,0.93), M_WHITE(), 'toolbox', bevel=0.03))
    objs.append(cube((0.56, 0.02, 0.05), (-1.25,-0.56,0.98), M_ORANGE(), 'toolstripe'))
    for k in range(3): objs.append(cube((0.16, 0.14, 0.2), (-1.45+k*0.2, 0.32, 0.88), mat('bag', C(230,225,210), 0.0, 0.9), 'samplebag', bevel=0.03))
    objs.append(tube((-1.62,0.45,0.85), (-0.95,0.45,1.45), 0.015, M_METAL(), 'rakehandle'))
    objs.append(cube((0.04, 0.3, 0.1), (-0.93,0.45,1.47), M_METAL(), 'rakehead'))
    objs.append(tube((-1.62,0.15,0.85), (-0.95,0.15,1.4), 0.015, M_METAL(), 'scoophandle'))
    objs.append(cyl(0.012, 1.0, (-1.55,-0.55,1.75), M_METAL(), 'whip', verts=4))
    for y in (-0.5, 0.5): objs.append(cube((0.03, 0.12, 0.06), (-1.66,y,0.82), M_RED(), 'taillight'))
    objs.append(cube((0.02, 0.9, 0.05), (-1.66,0,0.72), M_YELLOW(), 'rearstripe'))
    join(objs,'body')
    for nm, x, y in (('wFL',1.05,0.88),('wFR',1.05,-0.88),('wRL',-1.05,0.88),('wRR',-1.05,-0.88)):
        t = cyl(0.4, 0.23, (x,y,0.41), mat('wire_mesh', C(120,124,130), 0.8, 0.5), nm, verts=32, rot=(math.pi/2,0,0))
        parts = [t]
        for sy in (-0.115, 0.115): parts.append(torus(0.385, 0.025, (x,y+sy,0.41), M_METAL(), 'bead', rot=(math.pi/2,0,0), maj=32, mnr=6))
        parts.append(cyl(0.3, 0.25, (x,y,0.41), M_DARK(), 'innerrim', verts=24, rot=(math.pi/2,0,0)))
        parts.append(cyl(0.12, 0.29, (x,y,0.41), M_METAL(), 'hub', verts=16, rot=(math.pi/2,0,0)))
        parts.append(cyl(0.06, 0.31, (x,y,0.41), M_GOLD(), 'hubcap', verts=12, rot=(math.pi/2,0,0)))
        for k in range(8):
            a = k*math.pi/4
            parts.append(cube((0.035,0.26,0.2), (x+math.cos(a)*0.2, y, 0.41+math.sin(a)*0.2), M_METAL(), 'spoke', rot=(0,-a,0)))
        for k in range(18):
            a = k*2*math.pi/18
            for sy in (-0.06, 0.06):
                parts.append(cube((0.05,0.1,0.03), (x+math.cos(a)*0.405, y+sy, 0.41+math.sin(a)*0.405), M_GOLD(), 'chevron', rot=(0,-a+math.pi/2,0)))
        w = join(parts, nm); w.name = nm
        bpy.ops.object.select_all(action='DESELECT'); w.select_set(True); bpy.context.view_layer.objects.active = w
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    export('rover')

def build_lander():
    reset(); objs = []
    objs.append(cyl(1.8, 2.6, (0,0,3.2), M_GOLD(), 'body', verts=8))
    objs.append(cyl(1.6, 1.8, (0,0,5.4), M_WHITE(), 'cabin', verts=16, r2=1.0))
    objs.append(cyl(0.7, 1.0, (0,0,1.6), M_DARK(), 'bell', verts=16, r2=0.35))
    for k in range(4):
        a = k*math.pi/2 + math.pi/4
        objs.append(cyl(0.08, 3.4, (math.cos(a)*2.3, math.sin(a)*2.3, 1.5), M_METAL(), 'leg', verts=8, rot=(-math.sin(a)*0.5, math.cos(a)*0.5, 0)))
        objs.append(cyl(0.45, 0.12, (math.cos(a)*3.1, math.sin(a)*3.1, 0.06), M_METAL(), 'pad', verts=12))
        objs.append(sphere(0.55, (math.cos(a)*1.6, math.sin(a)*1.6, 2.2), M_WHITE(), 'tank', seg=12, ring=8))
    for k in range(8): objs.append(cube((0.5,0.06,0.04), (1.95, 0, 0.5+k*0.35), M_METAL(), 'ladder'))
    join(objs,'lander'); export('lander')

def build_small():
    # drill rig: skid, four-leg derrick with braces, top drive on a mast, drill string into the ground
    reset(); objs = []
    def strut(p0, p1, r, m, name='strut'):
        a, b = Vector(p0), Vector(p1); d = b - a
        o = cyl(r, d.length, tuple((a+b)/2), m, name, verts=8)
        o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0,0,1)).rotation_difference(d.normalized()); return o
    objs.append(cube((2.6,2.6,0.25), (0,0,0.125), M_DARK(), 'skid', bevel=0.03))
    for k in range(8): objs.append(cube((0.32,0.06,0.02), (-1.1+k*0.32, -1.31, 0.2), M_YELLOW() if k%2 else M_DARK(), 'stripe', rot=(0,0,0.6)))
    top = 4.4
    for sx in (-1,1):
        for sy in (-1,1):
            objs.append(strut((sx*1.0, sy*1.0, 0.25), (sx*0.3, sy*0.3, top), 0.06, M_METAL(), 'leg'))
    for h in (1.3, 2.4, 3.4):
        f = 1.0 - (h-0.25)/(top-0.25)*0.7
        for (x0,y0,x1,y1) in ((-f,-f,f,-f),(f,-f,f,f),(f,f,-f,f),(-f,f,-f,-f)): objs.append(strut((x0,y0,h),(x1,y1,h),0.035,M_YELLOW(),'brace'))
    for (x0,y0,x1,y1) in ((-1,-1,0.62,-0.62),(1,-1,-0.62,-0.62)): objs.append(strut((x0,y0,0.25),(x1,y1,2.4),0.03,M_METAL(),'diag'))
    objs.append(cube((0.9,0.9,0.25), (0,0,top+0.12), M_YELLOW(), 'crown', bevel=0.03))
    objs.append(cyl(0.18, 0.5, (0,0,top+0.45), M_DARK(), 'sheave', verts=16, rot=(math.pi/2,0,0)))
    objs.append(cube((0.55,0.55,0.6), (0,0,3.0), M_ORANGE(), 'topdrive', bevel=0.05))
    objs.append(strut((0,0,3.3),(0,0,top),0.05,M_METAL(),'cable'))
    objs.append(cube((1.0,0.7,0.9), (1.75,0,0.7), M_PANEL(), 'control', bevel=0.04))
    objs.append(cube((0.5,0.02,0.3), (1.75,-0.36,0.95), M_SCREEN(), 'ctlscreen'))
    objs.append(cube((0.8,0.6,0.5), (-1.7,0.4,0.5), M_WHITE(), 'samplebox', bevel=0.04))
    objs.append(strut((1.3,0,0.9),(0.3,0,2.8),0.03,M_DARK(),'hose'))
    join(objs,'drill')
    bit = cyl(0.08, 3.6, (0,0,1.0), M_GOLD(), 'bit', verts=10)
    export('drill')
    # excavator
    reset(); objs = []
    def beam(p0, p1, w, h, m, name):
        dx, dz = p1[0]-p0[0], p1[2]-p0[2]; Lb = math.hypot(dx, dz)
        return cube((Lb+w*0.5, w, h), ((p0[0]+p1[0])/2, p0[1], (p0[2]+p1[2])/2), m, name, rot=(0, -math.atan2(dz, dx), 0))
    for y in (-1.05,1.05):
        objs.append(cube((3.4,0.62,0.72), (0,y,0.36), M_RUBBER(), 'track', bevel=0.2))
        for x in (-1.2,-0.4,0.4,1.2): objs.append(cyl(0.24, 0.66, (x,y,0.36), M_METAL(), 'wheel', verts=14, rot=(math.pi/2,0,0)))
    objs.append(cube((2.6,1.5,0.32), (0,0,0.86), M_DARK(), 'frame'))
    objs.append(cyl(0.95, 0.18, (0,0,1.11), M_METAL(), 'turntable', verts=28))
    objs.append(cube((2.6,2.0,0.9), (-0.35,0,1.65), M_YELLOW(), 'body', bevel=0.08))
    objs.append(cube((0.6,1.9,0.5), (-1.55,0,1.45), M_DARK(), 'counterweight', bevel=0.05))
    objs.append(cube((1.1,1.0,1.0), (0.45,0.5,2.6), M_YELLOW(), 'cab', bevel=0.06))
    objs.append(cube((0.06,0.86,0.6), (1.01,0.5,2.7), M_GLASS(), 'window'))
    objs.append(cube((0.9,0.06,0.5), (0.4,1.01,2.7), M_GLASS(), 'window2'))
    pb, pe, pk = (0.75,-0.35,1.9), (3.0,-0.35,3.2), (3.9,-0.35,1.0)
    objs.append(beam(pb, pe, 0.34, 0.42, M_YELLOW(), 'boom'))
    objs.append(beam(pe, pk, 0.28, 0.32, M_YELLOW(), 'stick'))
    objs.append(beam((0.9,-0.35,1.55), (2.3,-0.35,2.85), 0.12, 0.12, M_METAL(), 'ram'))
    for p in (pb, pe): objs.append(cyl(0.16, 0.5, p, M_DARK(), 'pin', verts=12, rot=(math.pi/2,0,0)))
    objs.append(cube((0.85,1.1,0.7), (4.05,-0.35,0.42), M_METAL(), 'bucket', bevel=0.06))
    for k in range(4): objs.append(cube((0.14,0.14,0.18), (4.42,-0.75+k*0.27,0.05), M_DARK(), 'tooth'))
    join(objs,'excavator'); export('excavator')
    # crate
    reset(); objs = [cube((1.0,1.0,0.9), (0,0,0.45), M_WHITE(), 'crate', bevel=0.04)]
    for z in (0.15,0.75): objs.append(cube((1.02,1.02,0.06), (0,0,z), M_BLUE(), 'band'))
    join(objs,'crate'); export('crate')
    # path light
    reset(); join([cyl(0.05,0.7,(0,0,0.35),M_METAL(),'p',verts=8), sphere(0.1,(0,0,0.75),M_LIGHT(),'l',seg=8,ring=6)],'pathlight'); export('pathlight')

def build_people():
    # Astronaut in an EVA suit and crew member in a flight suit, with human proportions (about 1.8 m).
    # Each limb is its own node with its origin at the joint (shoulders, hips) so the game can swing it.
    def sc(o): return smooth(o)
    def seg(p0, p1, r, m, name, r2=None):
        a, b = Vector(p0), Vector(p1); d = b - a
        o = cyl(r, d.length, tuple((a+b)/2), m, name, verts=14, r2=r2)
        o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0,0,1)).rotation_difference(d.normalized())
        bpy.ops.object.transform_apply(rotation=True); return sc(o)
    def pivot(o, loc):
        bpy.context.scene.cursor.location = loc
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    def person(eva, name):
        reset()
        k = 1.3 if eva else 1.0
        suit = M_WHITE() if eva else M_BLUE()
        trim = M_PANEL() if eva else M_DARK()
        parts = {}
        SH, HIP = 0.27*(1.12 if eva else 1.0), 0.105
        # torso: hips, tapered chest, shoulders, neck
        t = [seg((0,0,0.98), (0,0,1.5), 0.17*k, suit, 'chest', r2=0.205*k)]
        t[0].scale = (1, 0.68, 1); bpy.ops.object.transform_apply(scale=True)
        t.append(sc(sphere(0.18*k, (0,0,0.98), suit, 'hips', seg=16, ring=10, scale=(1,0.7,0.55))))
        t.append(sc(sphere(0.2*k, (0,0,1.5), suit, 'shoulders', seg=16, ring=10, scale=(1.25,0.62,0.4))))
        for sx in (-1,1): t.append(sc(sphere(0.08*k, (sx*SH,0,1.48), suit, 'deltoid', seg=12, ring=8)))
        if eva:
            t.append(cube((0.5,0.26,0.62), (0,0.27,1.28), M_PANEL(), 'pack', bevel=0.06))
            t.append(cube((0.3,0.06,0.18), (0,-0.17,1.3), M_DARK(), 'dcm', bevel=0.02))
            t.append(cyl(0.16, 0.07, (0,0,1.62), M_METAL(), 'neckring', verts=20))
            for sx in (-1,1): t.append(cube((0.08,0.02,0.05), (sx*0.1,-0.205,1.31), M_RED() if sx<0 else M_LIGHT(), 'led'))
        else:
            t.append(sc(cyl(0.05, 0.12, (0,0,1.6), M_SKIN(), 'neck', verts=12)))
            t.append(torus(0.075, 0.022, (0,0,1.58), suit, 'collar', maj=16, mnr=6))
            t.append(cyl(0.165, 0.06, (0,0,1.02), M_DARK(), 'belt', verts=20))
            t.append(cube((0.07,0.02,0.05), (0,-0.12,1.02), M_METAL(), 'buckle'))
            t[-2].scale = (1,0.72,1); 
            t.append(cube((0.012,0.01,0.42), (0,-0.142,1.28), M_DARK(), 'zip'))
            t.append(cube((0.09,0.012,0.09), (-0.09,-0.152,1.4), M_ORANGE(), 'patch', bevel=0.01))
            t.append(cube((0.1,0.012,0.03), (0.09,-0.152,1.42), M_WHITE(), 'nametag'))
            for sx in (-1,1): t.append(cube((0.09,0.02,0.11), (sx*0.17,-0.06,0.86), suit, 'pocket', rot=(0,0,sx*0.4)))
        parts['torso'] = join(t, 'torso')
        # head
        if eva:
            h = [sc(sphere(0.21, (0,0,1.83), M_WHITE(), 'helm', seg=24, ring=14, scale=(1,1,1.05)))]
            visor = sc(sphere(0.19, (0,-0.035,1.83), M_VISOR(), 'visor', seg=24, ring=14, scale=(1,1,0.95)))
            bm = bmesh.new(); bm.from_mesh(visor.data)
            rm = [v for v in bm.verts if v.co.y > -0.06 or v.co.z < -0.15 or v.co.z > 0.14]
            bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(visor.data); bm.free()
            h.append(visor)
            h.append(cube((0.06,0.06,0.05), (0.19,-0.05,1.95), M_LIGHT(), 'helmlamp', bevel=0.01))
            head = join(h, 'head')
        else:
            h = [sc(sphere(0.115, (0,0,1.76), M_SKIN(), 'face', seg=20, ring=14, scale=(0.92,1.0,1.18)))]
            h.append(sc(sphere(0.05, (0,-0.035,1.665), M_SKIN(), 'chin', seg=12, ring=8, scale=(1.2,1,0.8))))
            for sx in (-1,1):
                h.append(sphere(0.017, (sx*0.042,-0.1,1.785), M_RUBBER(), 'eye', seg=10, ring=6))
                h.append(cube((0.04,0.012,0.009), (sx*0.044,-0.104,1.815), M_HAIR(), 'brow', rot=(0,sx*0.12,0)))
                h.append(sc(sphere(0.026, (sx*0.108,0.0,1.765), M_SKIN(), 'ear', seg=10, ring=6, scale=(0.5,1,1.3))))
            h.append(sc(sphere(0.02, (0,-0.118,1.75), M_SKIN(), 'nose', seg=10, ring=6, scale=(0.8,1,1.3))))
            h.append(cube((0.04,0.01,0.008), (0,-0.106,1.705), mat('lips', C(170,90,80), 0.0, 0.6), 'mouth'))
            hair = sc(sphere(0.124, (0,0.012,1.79), M_HAIR(), 'hair', seg=20, ring=14, scale=(0.97,1.02,1.12)))
            bm = bmesh.new(); bm.from_mesh(hair.data)
            rm = [v for v in bm.verts if (v.co.y < -0.02 and v.co.z < 0.07) or (v.co.z < -0.04 and v.co.y < 0.06)]
            bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(hair.data); bm.free()
            h.append(hair)
            head = join(h, 'head')
        pivot(head, (0,0,1.62)); head.name = 'head'; parts['head'] = head
        for side, sx in (('L',-1),('R',1)):
            x = sx*(SH+0.03)
            a = [seg((x,0,1.48), (x+sx*0.02,0,1.17), 0.06*k, suit, 'upper', r2=0.055*k),
                 sc(sphere(0.055*k, (x+sx*0.02,0,1.17), suit, 'elbow', seg=10, ring=8)),
                 seg((x+sx*0.02,0,1.17), (x+sx*0.02,-0.02,0.9), 0.052*k, suit, 'fore', r2=0.045*k),
                 cyl(0.05*k, 0.04, (x+sx*0.02,-0.02,0.89), trim, 'cuff', verts=14),
                 sc(sphere(0.05*k, (x+sx*0.02,-0.025,0.83), M_PANEL() if eva else M_SKIN(), 'hand', seg=10, ring=8, scale=(0.8,0.7,1.3)))]
            arm = join(a, 'arm'+side); pivot(arm, (x,0,1.48)); arm.name = 'arm'+side; parts['arm'+side] = arm
            lx = sx*HIP*(1.15 if eva else 1.0)
            l = [seg((lx,0,0.97), (lx,0,0.53), 0.085*k, suit, 'thigh', r2=0.07*k),
                 sc(sphere(0.07*k, (lx,0,0.53), suit, 'knee', seg=10, ring=8)),
                 seg((lx,0,0.53), (lx,0.01,0.12), 0.066*k, suit, 'shin', r2=0.055*k),
                 cube((0.12*k,0.27,0.11*k), (lx,-0.045,0.055*k), trim, 'shoe', bevel=0.035)]
            if eva: l.append(cyl(0.08*k, 0.05, (lx,0,0.2), M_METAL(), 'bootring', verts=14))
            leg = join(l, 'leg'+side); pivot(leg, (lx,0,0.97)); leg.name = 'leg'+side; parts['leg'+side] = leg
        bpy.context.scene.cursor.location = (0,0,0)
        empty_parent(name, list(parts.values()))
        export(name)
    person(True, 'astronaut')
    person(False, 'crew')

if __name__ == '__main__':
    import sys
    which = os.environ.get('ONLY')
    steps = [build_hab, build_corridors, build_lab, build_greenhouse, build_plants, build_solar, build_battery, build_reactor, build_dish, build_rover, build_lander, build_small, build_people]
    for f in steps:
        if which and f.__name__ != which: continue
        f()
