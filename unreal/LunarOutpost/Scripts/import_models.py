"""Run once inside the Unreal Editor (Tools > Execute Python Script, or in the Output Log: py "Scripts/import_models.py").
Imports the Blender models (Models/*.fbx) and sign textures (Textures/*.png) into /Game/Outpost and builds the
few materials the C++ code uses. Safe to run again: existing assets are kept."""
import os, glob, unreal

PROJECT = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
MESHES, MATS, TEX = '/Game/Outpost/Meshes', '/Game/Outpost/Materials', '/Game/Outpost/Textures'
EAL, MEL = unreal.EditorAssetLibrary, unreal.MaterialEditingLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()

def log(msg): unreal.log('[Outpost] ' + msg)

# ---------- 1. meshes (legacy FBX importer: one static mesh per file, pivot kept, no auto collision) ----------
unreal.SystemLibrary.execute_console_command(None, 'Interchange.FeatureFlags.Import.FBX false')
tasks = []
for f in sorted(glob.glob(os.path.join(PROJECT, 'Models', '*.fbx'))):
    name = os.path.splitext(os.path.basename(f))[0]
    if EAL.does_asset_exist(f'{MESHES}/{name}'): continue
    t = unreal.AssetImportTask(); t.filename = f; t.destination_path = MESHES; t.destination_name = name
    t.automated = True; t.save = True; t.replace_existing = True
    ui = unreal.FbxImportUI(); ui.import_mesh = True; ui.import_as_skeletal = False; ui.import_animations = False
    ui.import_materials = True; ui.import_textures = False
    ui.set_editor_property('mesh_type_to_import', unreal.FBXImportType.FBXIT_STATIC_MESH)
    sd = ui.static_mesh_import_data
    sd.set_editor_property('combine_meshes', True); sd.set_editor_property('auto_generate_collision', False)
    sd.set_editor_property('generate_lightmap_u_vs', True)
    t.options = ui; tasks.append(t)
if tasks:
    log(f'importing {len(tasks)} meshes...'); tools.import_asset_tasks(tasks)

# ---------- 2. sign textures ----------
tasks = []
for f in sorted(glob.glob(os.path.join(PROJECT, 'Textures', '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    if EAL.does_asset_exist(f'{TEX}/{name}'): continue
    t = unreal.AssetImportTask(); t.filename = f; t.destination_path = TEX; t.destination_name = name
    t.automated = True; t.save = True; t.replace_existing = True; tasks.append(t)
if tasks: tools.import_asset_tasks(tasks)

# ---------- 3. materials ----------
def new_mat(name):
    path = f'{MATS}/{name}'
    if EAL.does_asset_exist(path): return None
    return tools.create_asset(name, MATS, unreal.Material, unreal.MaterialFactoryNew())

def const3(m, rgb, x=-400, y=0):
    c = MEL.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, x, y)
    c.set_editor_property('constant', unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1.0)); return c

def scalar(m, v, x=-400, y=200):
    c = MEL.create_material_expression(m, unreal.MaterialExpressionConstant, x, y); c.set_editor_property('r', v); return c

def finish(m):
    MEL.recompile_material(m); EAL.save_loaded_asset(m)

m = new_mat('M_Regolith')          # terrain: colour comes from the terrain's vertex colours
if m:
    vc = MEL.create_material_expression(m, unreal.MaterialExpressionVertexColor, -400, 0)
    MEL.connect_material_property(vc, '', unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(scalar(m, 1.0), '', unreal.MaterialProperty.MP_ROUGHNESS)
    m.set_editor_property('two_sided', True); finish(m)

m = new_mat('M_Paint')             # plain painted surface, colour set from C++
if m:
    p = MEL.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -400, 0)
    p.set_editor_property('parameter_name', 'Color'); p.set_editor_property('default_value', unreal.LinearColor(0.5, 0.5, 0.5, 1))
    MEL.connect_material_property(p, '', unreal.MaterialProperty.MP_BASE_COLOR)
    r = MEL.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -400, 200)
    r.set_editor_property('parameter_name', 'Roughness'); r.set_editor_property('default_value', 0.7)
    MEL.connect_material_property(r, '', unreal.MaterialProperty.MP_ROUGHNESS); finish(m)

m = new_mat('M_Glow')              # station rings and markers: unlit, see-through, colour from C++
if m:
    m.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    m.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT); m.set_editor_property('two_sided', True)
    p = MEL.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -600, 0)
    p.set_editor_property('parameter_name', 'Color'); p.set_editor_property('default_value', unreal.LinearColor(0.5, 0.8, 1, 1))
    mul = MEL.create_material_expression(m, unreal.MaterialExpressionMultiply, -300, 0)
    MEL.connect_material_expressions(p, '', mul, 'A'); MEL.connect_material_expressions(scalar(m, 4.0, -600, 150), '', mul, 'B')
    MEL.connect_material_property(mul, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    o = MEL.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -400, 300)
    o.set_editor_property('parameter_name', 'Opacity'); o.set_editor_property('default_value', 0.45)
    MEL.connect_material_property(o, '', unreal.MaterialProperty.MP_OPACITY); finish(m)

m = new_mat('M_Glass')
if m:
    m.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT); m.set_editor_property('two_sided', True)
    MEL.connect_material_property(const3(m, (0.75, 0.85, 1.0)), '', unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(scalar(m, 0.22), '', unreal.MaterialProperty.MP_OPACITY)
    MEL.connect_material_property(scalar(m, 0.05, -400, 400), '', unreal.MaterialProperty.MP_ROUGHNESS); finish(m)

EMISSIVE = {  # Blender material name -> glowing colour (linear) for screens and lights
    'screen': (0.03, 0.25, 0.7), 'led': (6.0, 5.4, 4.5), 'grow_led': (6.0, 1.2, 5.0), 'red_light': (6.0, 0.3, 0.3),
    'vitals': (0.2, 1.6, 0.6), 'led_green': (0.6, 5.0, 1.0), 'star': (8.0, 8.0, 9.0), 'sun': (40.0, 36.0, 30.0)}
for key, rgb in EMISSIVE.items():
    m = new_mat('M_E_' + key)
    if m:
        m.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
        MEL.connect_material_property(const3(m, rgb), '', unreal.MaterialProperty.MP_EMISSIVE_COLOR); finish(m)

m = new_mat('M_Earth')
if m:
    MEL.connect_material_property(const3(m, (0.08, 0.25, 0.65)), '', unreal.MaterialProperty.MP_BASE_COLOR)
    MEL.connect_material_property(const3(m, (0.02, 0.06, 0.16), -400, 300), '', unreal.MaterialProperty.MP_EMISSIVE_COLOR); finish(m)

for f in sorted(glob.glob(os.path.join(PROJECT, 'Textures', 'T_Sign_*.png'))):
    key = os.path.splitext(os.path.basename(f))[0][len('T_Sign_'):]
    m = new_mat('M_Sign_' + key)
    if not m: continue
    m.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    ts = MEL.create_material_expression(m, unreal.MaterialExpressionTextureSample, -500, 0)
    ts.set_editor_property('texture', EAL.load_asset(f'{TEX}/T_Sign_{key}'))
    MEL.connect_material_property(ts, 'RGB', unreal.MaterialProperty.MP_EMISSIVE_COLOR); finish(m)

# ---------- 4. per-mesh fixes: real-triangle collision, glass and glowing materials ----------
glass = EAL.load_asset(f'{MATS}/M_Glass')
fixed = 0
for path in EAL.list_assets(MESHES, recursive=False):
    a = EAL.load_asset(path)
    if not isinstance(a, unreal.StaticMesh): continue
    bs = a.get_editor_property('body_setup')
    if bs: bs.set_editor_property('collision_trace_flag', unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    mats = a.get_editor_property('static_materials')
    for i, sm in enumerate(mats):
        mi = sm.get_editor_property('material_interface')
        n = mi.get_name().lower() if mi else ''
        new = None
        if n.startswith('glass'): new = glass
        else:
            for key in EMISSIVE:
                if n == key or n.startswith(key + '_') or n.startswith(key + '.'): new = EAL.load_asset(f'{MATS}/M_E_{key}')
        if new:
            try: a.set_material(i, new)
            except Exception:
                sm.set_editor_property('material_interface', new); mats[i] = sm; a.set_editor_property('static_materials', mats)
            fixed += 1
    EAL.save_loaded_asset(a)
log(f'done: meshes in {MESHES}, {fixed} glass/glow material slots replaced. Now press Play.')
