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
M_WHITE = lambda: mat('hull_white', C(232,235,240), 0.1, 0.45)
M_PANEL = lambda: mat('hull_panel', C(205,210,218), 0.3, 0.4)
M_METAL = lambda: mat('metal', C(160,168,180), 0.8, 0.35)
M_DARK  = lambda: mat('dark', C(44,50,64), 0.4, 0.55)
M_GOLD  = lambda: mat('gold_foil', C(224,172,72), 0.9, 0.3)
M_ORANGE= lambda: mat('orange', C(240,120,50), 0.1, 0.5)
M_BLUE  = lambda: mat('fabric_blue', C(52,92,170), 0.0, 0.8)
M_CELL  = lambda: mat('solar_cell', C(22,44,110), 0.6, 0.18)
M_FLOOR = lambda: mat('floor', C(92,98,112), 0.2, 0.75)
M_SCREEN= lambda: mat('screen', C(20,60,90), 0.0, 0.3, emit=C(90,200,255), estr=2.0)
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
            bm = bmesh.new(); bm.from_mesh(r.data)
            rm = [v for v in bm.verts if v.co.x < -0.0 and False]
            bm.free()
            objs.append(r)
            for s in (-1,1): objs.append(cube((0.16,0.16,wall_h),(x, s*(width/2+0.1), wall_h/2), M_PANEL(), 'post'))
    if lights:
        objs.append(cube((length*0.96, 0.25, 0.05), (length/2, 0, height-0.05), M_LIGHT(), 'strip'))
    return join(objs, name)

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
    bm = bmesh.new(); bm.from_mesh(ring.data)
    inner = bmesh.ops.inset_region  # (keep simple solid ring; doors cut below)
    bm.free()
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
    objs.append(cyl(0.45, 7.6, (0,0,4.0), M_PANEL(), 'column', verts=20))
    objs.append(torus(1.4, 0.08, (0,0,6.8), M_LIGHT(), 'lamp', maj=32))
    objs.append(cyl(1.3, 0.15, (0,0,7.0), M_PANEL(), 'lampdisk', verts=32))
    # --- interior furniture (north half = Blender -Y = glTF +Z)
    # bunks: 4 bunk beds along north wall
    for k, a in enumerate([-2.35, -1.95, -1.55, -1.15]):
        cx, cy = math.cos(a)*8.0, math.sin(a)*8.0
        rot = a + math.pi/2
        for lvl in (0.6, 1.8):
            objs.append(cube((2.2, 0.95, 0.12), (cx, cy, lvl), M_PANEL(), 'bunkframe', rot=(0,0,rot), bevel=0.03))
            objs.append(cube((2.0, 0.85, 0.16), (cx, cy, lvl+0.13), M_BED(), 'mattress', rot=(0,0,rot), bevel=0.05))
        for s in (-1,1):
            px, py = cx + math.cos(rot)*1.1*s, cy + math.sin(rot)*1.1*s
            objs.append(cube((0.08, 0.95, 2.4), (px, py, 1.2), M_METAL(), 'bunkpost', rot=(0,0,rot)))
    # galley: counter + table + 4 stools (east-north)
    objs.append(cube((3.2, 0.8, 1.0), (5.2, -5.6, 0.5), M_PANEL(), 'counter', rot=(0,0,-0.7), bevel=0.04))
    objs.append(cube((0.9, 0.6, 0.6), (4.6, -6.3, 1.3), M_DARK(), 'oven', rot=(0,0,-0.7), bevel=0.03))
    objs.append(cyl(1.1, 0.08, (3.0, -1.8, 0.95), M_WOOD(), 'table', verts=32))
    objs.append(cyl(0.12, 0.8, (3.0, -1.8, 0.5), M_METAL(), 'tleg', verts=10))
    for k in range(4):
        a = k*math.pi/2 + 0.4
        objs.append(cyl(0.28, 0.08, (3.0+math.cos(a)*1.55, -1.8+math.sin(a)*1.55, 0.62), M_BLUE(), 'stool', verts=16))
        objs.append(cyl(0.05, 0.5, (3.0+math.cos(a)*1.55, -1.8+math.sin(a)*1.55, 0.35), M_METAL(), 'sleg', verts=8))
    # command / comms desk with screens (south-west, Blender +Y side, x<0)
    for k, a in enumerate([2.2, 2.5, 2.8]):
        cx, cy = math.cos(a)*8.6, math.sin(a)*8.6
        rot = a + math.pi/2
        objs.append(cube((1.6, 0.8, 0.9), (cx, cy, 0.45), M_PANEL(), 'desk', rot=(0,0,rot), bevel=0.04))
        objs.append(cube((1.3, 0.08, 0.8), (cx+math.cos(a)*0.35, cy+math.sin(a)*0.35, 1.5), M_SCREEN(), 'screen', rot=(0.25,0,rot)))
    # medical bay (south-east)
    objs.append(cube((2.2, 0.9, 0.7), (6.5, 5.5, 0.55), M_WHITE(), 'medbed', rot=(0,0,0.75), bevel=0.06))
    objs.append(cube((0.5, 0.5, 1.6), (7.6, 4.0, 0.8), M_PANEL(), 'medcab', rot=(0,0,0.75), bevel=0.04))
    objs.append(cube((0.4, 0.05, 0.3), (7.45, 3.85, 1.4), M_RED(), 'medlight', rot=(0,0,0.75)))
    # treadmill (exercise)
    objs.append(cube((1.8, 0.8, 0.25), (-3.2, -2.2, 0.42), M_DARK(), 'tread', rot=(0,0,0.4), bevel=0.04))
    objs.append(cube((0.1, 0.8, 1.1), (-4.0, -2.55, 0.95), M_METAL(), 'treadbar', rot=(0,0,0.4)))
    # lockers along west wall
    for k in range(5):
        a = math.pi + 0.45 + k*0.17
        objs.append(cube((0.7, 0.6, 2.2), (math.cos(a)*9.7, math.sin(a)*9.7, 1.1), M_PANEL() if k%2 else M_ORANGE(), 'locker', rot=(0,0,a), bevel=0.03))
    # plant shelf
    objs.append(cube((2.4, 0.5, 1.6), (-2.5, 4.5, 0.8), M_METAL(), 'shelf', rot=(0,0,0.2)))
    for k in range(4):
        objs.append(sphere(0.25, (-3.4+k*0.6, 4.3+k*0.12, 1.75), M_LEAF(), 'pot', seg=10, ring=6, scale=(1,1,0.7)))
    # partition walls: radial walls split the dome into rooms that open onto the central hall
    # (angles in game coordinates; Blender y = -game z, so Blender angle = -game angle)
    for ga in (20, 62, 145, -22, -62, -112, -165):
        a = -math.radians(ga); r0, r1 = 6.0, 10.5; rm = (r0+r1)/2
        objs.append(cube((r1-r0, 0.16, 2.7), (math.cos(a)*rm, math.sin(a)*rm, 1.35+0.3), M_PANEL(), 'partition', rot=(0,0,a), bevel=0.03))
        objs.append(cube((0.3, 0.3, 2.9), (math.cos(a)*r0, math.sin(a)*r0, 1.45+0.3), M_DARK(), 'pillar', rot=(0,0,a)))
        objs.append(cube((r1-r0, 0.2, 0.08), (math.cos(a)*rm, math.sin(a)*rm, 3.0+0.3), M_LIGHT(), 'walllight', rot=(0,0,a)))
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
            objs.append(cube((0.2, 3.4, 3.2), (L+0.1, 0, 1.6), M_PANEL(), 'outerframe'))
            objs.append(cube((0.25, 0.3, 0.3), (L+0.2, 1.3, 3.0), M_RED(), 'beacon'))
            # suit rack
            for k in range(3):
                objs.append(cube((0.6, 0.15, 1.6), (4+k*1.0, -1.45, 1.4), M_WHITE(), 'suit', bevel=0.08))
                objs.append(sphere(0.25, (4+k*1.0, -1.45, 2.4), M_WHITE(), 'helm', seg=12, ring=8))
            objs.append(cube((1.0, 0.5, 1.8), (9.5, 1.3, 0.9), M_ORANGE(), 'repairlocker', bevel=0.04))
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
        cap = sphere(r, (s*L/2,0,r), M_WHITE(), 'cap', seg=40, ring=20)
        bm = bmesh.new(); bm.from_mesh(cap.data)
        rm = [v for v in bm.verts if v.co.x*s < 0]
        bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(cap.data); bm.free(); objs.append(cap)
    for k in range(9):
        x = -L/2 + k*L/8
        if abs(x) < 2.0: continue   # no rib across the doorway
        objs.append(torus(r+0.1, 0.08, (x,0,r), M_PANEL(), 'rib', rot=(0,math.pi/2,0), maj=40, mnr=6))
    objs.append(cube((L, 4.6, 0.2), (0,0,0.55), M_FLOOR(), 'floor'))
    objs.append(cube((L*0.9, 0.3, 0.06), (0,0,2*r-0.15), M_LIGHT(), 'strip'))
    # benches along +Y wall (far side)
    for k in range(4):
        x = -6 + k*4
        objs.append(cube((3.2, 0.9, 0.9), (x, 1.6, 1.1), M_PANEL(), 'bench', bevel=0.04))
        objs.append(cube((1.1, 0.08, 0.7), (x-0.6, 2.05, 2.0), M_SCREEN(), 'labscreen', rot=(0.2,0,0)))
        objs.append(cube((0.8, 0.5, 0.6), (x+0.8, 1.6, 1.85), M_GLASS(), 'glovebox', bevel=0.05))
        objs.append(cyl(0.12, 0.4, (x+0.2, 1.4, 1.75), M_DARK(), 'scope', verts=10))
    # sample racks
    for k in range(6):
        objs.append(cyl(0.08, 0.35, (-7+k*0.35, -1.9, 1.3), M_GLASS(), 'tube', verts=10))
    objs.append(cube((2.5, 0.5, 1.2), (-6.0, -1.9, 0.9), M_METAL(), 'rack'))
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
    objs.append(cyl(R+0.2, 0.6, (0,0,0.3), M_PANEL(), 'ring', verts=60))
    objs.append(cyl(R-0.1, 0.25, (0,0,0.12), M_FLOOR(), 'floor', verts=60))
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
    # cell grid: 8 x 4 cells as slightly inset tiles on a frame
    objs.append(cube((W+0.12, H+0.12, 0.06), (0,0,0), M_METAL(), 'frame'))
    for i in range(8):
        for j in range(4):
            objs.append(cube((W/8-0.05, H/4-0.05, 0.03), (-W/2+W/16+i*W/8, -H/2+H/8+j*H/4, 0.035), M_CELL(), 'cell'))
    arr = join(objs, 'array')
    arr.location = (0,0,2.4)
    post = cyl(0.1, 2.3, (0,0,1.15), M_METAL(), 'post', verts=12)
    motor = cube((0.4,0.4,0.3), (0,0,2.25), M_DARK(), 'motor', bevel=0.03)
    base = cyl(0.45, 0.15, (0,0,0.075), M_DARK(), 'foot', verts=16)
    stand = join([post, motor, base], 'stand')
    export('solar')

def build_battery():
    reset(); objs = [cube((1.6,1.0,1.8), (0,0,0.9), M_DARK(), 'box', bevel=0.05)]
    for k in range(5): objs.append(cube((0.02,0.8,0.08), (0.81,0,0.5+k*0.2), M_METAL(), 'vent'))
    objs.append(cube((1.62,1.02,0.12), (0,0,1.86), M_METAL(), 'lid', bevel=0.02))
    objs.append(cube((0.5,0.02,0.3), (0,-0.51,1.3), M_SCREEN(), 'disp'))
    objs.append(cube((1.4,0.02,0.06), (0,-0.51,0.25), M_YELLOW(), 'stripe'))
    join(objs,'battery'); export('battery')

def build_reactor():
    reset(); objs = []
    objs.append(cyl(1.3, 5.0, (0,0,2.5), M_PANEL(), 'core', verts=32))
    objs.append(cyl(1.3, 1.2, (0,0,5.6), M_METAL(), 'top', verts=32, r2=0.6))
    objs.append(cyl(1.8, 0.6, (0,0,0.3), M_DARK(), 'base', verts=32))
    for k in range(4):
        a = k*math.pi/2 + math.pi/4
        panel = cube((5.5, 0.08, 3.6), (math.cos(a)*4.2, math.sin(a)*4.2, 3.2), M_DARK(), 'radiator', rot=(0,0,a))
        objs.append(panel)
        for q in range(6): objs.append(cube((5.5,0.1,0.05), (math.cos(a)*4.2, math.sin(a)*4.2, 1.6+q*0.6), M_METAL(), 'pipe', rot=(0,0,a)))
        objs.append(cube((1.5,0.2,0.2), (math.cos(a)*1.9, math.sin(a)*1.9, 3.2), M_METAL(), 'boom', rot=(0,0,a)))
    objs.append(sphere(0.2, (0,0,6.3), mat('green_light', C(90,255,140),0,0.3,emit=C(60,255,120),estr=4), 'light', seg=10, ring=6))
    objs.append(cube((2.6,0.06,0.5), (0,-1.35,1.2), M_YELLOW(), 'warn'))
    join(objs,'reactor'); export('reactor')

def build_dish():
    reset()
    # parabolic reflector: spin a profile
    bm = bmesh.new()
    prof = []
    for i in range(10):
        r = 2.4*i/9; prof.append(bm.verts.new((r, 0, 0.18*r*r)))
    for i in range(9): bm.edges.new((prof[i], prof[i+1]))
    bmesh.ops.spin(bm, geom=bm.verts[:]+bm.edges[:], cent=(0,0,0), axis=(0,0,1), steps=32, angle=math.pi*2)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    me = bpy.data.meshes.new('refl'); bm.to_mesh(me); bm.free()
    refl = bpy.data.objects.new('refl', me); bpy.context.collection.objects.link(refl)
    refl.modifiers.new('sol','SOLIDIFY').thickness = 0.05
    setmat(refl, M_WHITE()); smooth(refl)
    objs = [refl]
    for k in range(3):
        a = k*2*math.pi/3
        objs.append(cyl(0.025, 1.9, (math.cos(a)*0.9, math.sin(a)*0.9, 1.4), M_METAL(), 'strut', verts=6, rot=(math.sin(a)*0.45, -math.cos(a)*0.45, 0)))
    objs.append(cyl(0.12, 0.4, (0,0,2.2), M_DARK(), 'feed', verts=12))
    head = join(objs, 'head')
    head.location = (0,0,5.8); head.rotation_euler = (0.6, 0, 0)
    mast = cyl(0.18, 5.6, (0,0,2.8), M_METAL(), 'mast', verts=12)
    base = cube((1.6,1.6,0.4), (0,0,0.2), M_DARK(), 'base', bevel=0.05)
    box = cube((0.7,0.5,0.9), (0.6,0,0.85), M_PANEL(), 'electronics', bevel=0.04)
    join([mast, base, box], 'mount')
    export('dish')

def wheel(loc):
    w = cyl(0.45, 0.32, loc, M_RUBBER(), 'tyre', verts=24, rot=(math.pi/2,0,0))
    hub = cyl(0.22, 0.36, loc, M_METAL(), 'hub', verts=12, rot=(math.pi/2,0,0))
    objs = [w, hub]
    for k in range(6):
        a = k*math.pi/3
        objs.append(cube((0.08,0.34,0.6), (loc[0]+math.cos(a)*0.0, loc[1], loc[2]), M_METAL(), 'spoke', rot=(0,a,0)))
    return objs

def build_rover():
    reset(); objs = []
    objs.append(cube((3.6,2.0,0.4), (0,0,0.9), M_PANEL(), 'chassis', bevel=0.06))
    objs.append(cube((1.2,1.6,0.7), (-0.6,0,1.45), M_BLUE(), 'seat', bevel=0.1))
    objs.append(cube((0.1,1.6,0.9), (-1.15,0,1.75), M_BLUE(), 'seatback', bevel=0.04))
    objs.append(cube((0.6,1.0,0.5), (1.3,0,1.35), M_DARK(), 'console', bevel=0.05))
    objs.append(cube((0.4,0.02,0.25), (1.3,-0.51,1.45), M_SCREEN(), 'cscreen'))
    objs.append(cube((1.8,1.8,0.04), (0.2,0,2.4), M_CELL(), 'roofpanel'))
    for x in (-0.6,1.0):
        for y in (-0.85,0.85): objs.append(cyl(0.03, 1.3, (x,y,1.75), M_METAL(), 'rollbar', verts=6))
    objs.append(cyl(0.02, 1.4, (1.6,0.8,2.4), M_METAL(), 'ant', verts=6))
    objs.append(sphere(0.12, (1.6,0.8,3.1), M_WHITE(), 'antball', seg=8, ring=6))
    for x in (-1.3,0,1.3):
        for y in (-1.15,1.15): objs += wheel((x,y,0.45))
    for y in (-0.5,0.5): objs.append(cube((0.05,0.25,0.12), (1.82,y,0.95), M_LIGHT(), 'headlight'))
    join(objs,'rover'); export('rover')

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
    # drill rig
    reset(); objs = []
    for k in range(3):
        a = k*2*math.pi/3
        objs.append(cyl(0.07, 4.4, (math.cos(a)*0.9, math.sin(a)*0.9, 2.0), M_METAL(), 'tri', verts=8, rot=(-math.sin(a)*0.22, math.cos(a)*0.22, 0)))
    objs.append(cube((0.8,0.8,0.7), (0,0,4.1), M_ORANGE(), 'motor', bevel=0.05))
    objs.append(cyl(0.12, 3.6, (0,0,2.1), M_GOLD(), 'bit', verts=10))
    objs.append(cube((1.2,0.8,0.6), (1.4,0,0.3), M_DARK(), 'sampler', bevel=0.04))
    join(objs,'drill'); export('drill')
    # excavator
    reset(); objs = [cube((2.8,1.9,1.1), (0,0,1.1), M_YELLOW(), 'body', bevel=0.08)]
    for y in (-1.0,1.0): objs.append(cube((3.2,0.55,0.7), (0,y,0.35), M_RUBBER(), 'track', bevel=0.2))
    objs.append(cube((3.2,0.25,0.3), (2.2,0,1.9), M_YELLOW(), 'arm', rot=(0,0.45,0)))
    objs.append(cube((1.0,1.3,0.7), (3.6,0,1.0), M_METAL(), 'bucket', bevel=0.05))
    objs.append(cube((0.9,1.2,0.8), (-0.6,0,2.05), M_DARK(), 'cab', bevel=0.06))
    join(objs,'excavator'); export('excavator')
    # crate
    reset(); objs = [cube((1.0,1.0,0.9), (0,0,0.45), M_WHITE(), 'crate', bevel=0.04)]
    for z in (0.15,0.75): objs.append(cube((1.02,1.02,0.06), (0,0,z), M_BLUE(), 'band'))
    join(objs,'crate'); export('crate')
    # path light
    reset(); join([cyl(0.05,0.7,(0,0,0.35),M_METAL(),'p',verts=8), sphere(0.1,(0,0,0.75),M_LIGHT(),'l',seg=8,ring=6)],'pathlight'); export('pathlight')

def build_people():
    # Astronaut in an EVA suit and crew member in a blue flight suit. Each limb is its own node
    # with its origin at the joint so the game can swing arms and legs.
    def person(eva, name):
        reset()
        suit = M_WHITE() if eva else M_BLUE()
        parts = {}
        torso = sphere(0.36, (0,0,1.25), suit, 'torso', seg=16, ring=10, scale=(1,0.75,1.25))
        if eva:
            pack = cube((0.6,0.3,0.75), (0,0.35,1.3), M_PANEL(), 'pack', bevel=0.06)
            ring = cyl(0.2, 0.08, (0,0,1.72), M_METAL(), 'neck', verts=16)
            torso = join([torso, pack, ring], 'torso')
            badge = None
        else:
            belt = cyl(0.33, 0.08, (0,0,0.95), M_DARK(), 'belt', verts=16)
            torso = join([torso, belt], 'torso')
        parts['torso'] = torso
        if eva:
            helm = sphere(0.3, (0,0,1.95), M_WHITE(), 'helm', seg=20, ring=12)
            visor = sphere(0.255, (0,-0.08,1.95), M_VISOR(), 'visor', seg=20, ring=12, scale=(1,0.9,0.85))
            bm = bmesh.new(); bm.from_mesh(visor.data)
            rm = [v for v in bm.verts if v.co.y > -0.05 or v.co.z < -0.18]
            bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(visor.data); bm.free()
            head = join([helm, visor], 'head')
        else:
            face = sphere(0.18, (0,0,1.88), M_SKIN(), 'face', seg=16, ring=10, scale=(1,1,1.15))
            hair = sphere(0.19, (0,0.03,1.95), M_HAIR(), 'hair', seg=16, ring=10, scale=(1,1,0.9))
            bm = bmesh.new(); bm.from_mesh(hair.data)
            rm = [v for v in bm.verts if v.co.z < -0.02 and v.co.y < 0.05]
            bmesh.ops.delete(bm, geom=rm, context='VERTS'); bm.to_mesh(hair.data); bm.free()
            head = join([face, hair], 'head')
        head.name = 'head'; parts['head'] = head
        for side, sx in (('L',-1),('R',1)):
            arm = sphere(0.1, (sx*0.42, 0, 1.2), suit, 'arm'+side, seg=10, ring=8, scale=(1,1,3.3))
            glove = sphere(0.09, (sx*0.42, 0, 0.86), M_PANEL() if eva else M_SKIN(), 'glove', seg=10, ring=8)
            a = join([arm, glove], 'arm'+side)
            bpy.context.scene.cursor.location = (sx*0.42, 0, 1.52)
            bpy.ops.object.select_all(action='DESELECT'); a.select_set(True); bpy.context.view_layer.objects.active = a
            bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
            parts['arm'+side] = a
            leg = sphere(0.13, (sx*0.15, 0, 0.5), suit, 'leg'+side, seg=10, ring=8, scale=(1,1,3.6))
            boot = cube((0.24,0.36,0.16), (sx*0.15,-0.06,0.08), M_PANEL() if eva else M_DARK(), 'boot', bevel=0.05)
            l = join([leg, boot], 'leg'+side)
            bpy.context.scene.cursor.location = (sx*0.15, 0, 0.95)
            bpy.ops.object.select_all(action='DESELECT'); l.select_set(True); bpy.context.view_layer.objects.active = l
            bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
            parts['leg'+side] = l
        bpy.context.scene.cursor.location = (0,0,0)
        # face forward along glTF +Z  (Blender -Y): visor already on -Y
        root = empty_parent(name, list(parts.values()))
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
