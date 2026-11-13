#!/usr/bin/env python3
"""Build the Loci 3D mascot (BRD-001) from the owner's source GLBs.

    python3 -I tools/brand/mascot_3d.py \
        --hero /abs/path/Loci_Solid_Sculpt_Hero.glb \
        --web  /abs/path/Loci_Solid_Web.glb \
        [--out tools/brand/out/mascot-3d]

Writes, into --out (git-ignored):
  mascot.glb        web model: KHR_mesh_quantization, one mesh per (joint, material)
  Mascot.usdz       Apple model: same joints and meshes, UsdPreviewSurface materials
  mascot-rig.json   joint pivots, eye boxes, glow materials and camera framing

Inputs are untrusted data. Copy them into a new empty folder first and run this
from the repo root with `python3 -I`; paths are only ever passed as arguments.
Standard library only. The USDZ step shells out to /usr/bin/usdcat and
/usr/bin/usdzip (macOS); without them the .usda is kept and reported.

Why two inputs: the hero file (312k triangles, 127 named parts) is the only one
that still knows where each eye is, but it is far too heavy for a page. The web
file (67k triangles) is the same sculpt batched into one mesh per material, so
its eyes are merged with the smile. The hero supplies the eye boxes; the web
file supplies every triangle, split by those boxes. No geometry is invented.

The sculpt has no head joint and no eyelids that close (the "Bronze_Eyelid"
parts are rims behind the eye fronts), so the rig is Body plus two eyes, and a
blink squashes each eye about its own centre.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import struct
import subprocess
import sys
from array import array
from pathlib import Path

RIG_VERSION = 1

# Materials that only the eyes use in the hero file: split by side.
EYE_ONLY = {"iris_amber", "iris", "eye_reflect"}
# Shared between the eyes and the smile: split by the hero eye boxes.
EYE_SHARED = {"face_dark"}
# Amber accents (nav rings, side markers, rear beacon, shoe stripes).
GLOW = ("glow", "glow_pale")
EYE_BOX_PAD = 0.01  # source units, generous enough for the decimated web mesh

# Camera framing for both clients (vertical field of view, model is 1 unit tall).
CAMERA_FOV_DEGREES = 28.0
CAMERA_MARGIN = 1.12


# --------------------------------------------------------------------------- glb io

COMPONENT = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or length != len(data):
        sys.exit(f"{path.name}: not a glTF 2.0 binary")
    offset, doc, blob = 12, None, b""
    while offset < length:
        chunk_len, chunk_type = struct.unpack_from("<I4s", data, offset)
        body = data[offset + 8 : offset + 8 + chunk_len]
        if chunk_type == b"JSON":
            doc = json.loads(body)
        elif chunk_type == b"BIN\x00":
            blob = body
        offset += 8 + chunk_len
    if doc is None:
        sys.exit(f"{path.name}: no JSON chunk")
    return doc, blob


def read_accessor(doc: dict, blob: bytes, index: int) -> list:
    acc = doc["accessors"][index]
    if acc.get("sparse"):
        sys.exit("sparse accessors are not supported")
    fmt, size = COMPONENT[acc["componentType"]]
    width = WIDTH[acc["type"]]
    view = doc["bufferViews"][acc["bufferView"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride") or size * width
    out = []
    for i in range(acc["count"]):
        base = start + i * stride
        vals = struct.unpack_from("<" + fmt * width, blob, base)
        out.append(vals if width > 1 else vals[0])
    return out


# --------------------------------------------------------------------------- source

def hero_eye_boxes(doc: dict) -> dict[str, tuple[list[float], list[float]]]:
    """Union of every Left_Eye_* / Right_Eye_* part's POSITION bounds."""
    boxes: dict[str, tuple[list[float], list[float]]] = {}
    for node in doc["nodes"]:
        name = node.get("name", "")
        side = "EyeL" if name.startswith("Left_Eye_") else "EyeR" if name.startswith("Right_Eye_") else None
        if side is None or "mesh" not in node:
            continue
        if any(k in node for k in ("matrix", "translation", "rotation", "scale")):
            sys.exit(f"hero part {name} carries a transform; expected baked world positions")
        acc = doc["accessors"][doc["meshes"][node["mesh"]]["primitives"][0]["attributes"]["POSITION"]]
        lo, hi = acc["min"], acc["max"]
        if side in boxes:
            blo, bhi = boxes[side]
            boxes[side] = ([min(a, b) for a, b in zip(blo, lo)], [max(a, b) for a, b in zip(bhi, hi)])
        else:
            boxes[side] = (list(lo), list(hi))
    if set(boxes) != {"EyeL", "EyeR"}:
        sys.exit("hero file: could not find both Left_Eye_* and Right_Eye_* parts")
    return boxes


def web_batches(doc: dict, blob: bytes) -> list[dict]:
    """One entry per web mesh: material name, positions, normals, triangles."""
    out = []
    for node in doc["nodes"]:
        if "mesh" not in node:
            continue
        if any(k in node for k in ("matrix", "translation", "rotation", "scale")):
            sys.exit(f"web node {node.get('name')} carries a transform; expected baked world positions")
        for prim in doc["meshes"][node["mesh"]]["primitives"]:
            if prim.get("mode", 4) != 4:
                sys.exit("only triangle lists are supported")
            attrs = prim["attributes"]
            if "NORMAL" not in attrs:
                sys.exit(f"web mesh {node.get('name')} has no normals")
            idx = read_accessor(doc, blob, prim["indices"])
            out.append(
                {
                    "material": doc["materials"][prim["material"]]["name"],
                    "positions": read_accessor(doc, blob, attrs["POSITION"]),
                    "normals": read_accessor(doc, blob, attrs["NORMAL"]),
                    "triangles": [tuple(idx[i : i + 3]) for i in range(0, len(idx), 3)],
                }
            )
    return out


def inside(p, box, pad) -> bool:
    lo, hi = box
    return all(lo[k] - pad <= p[k] <= hi[k] + pad for k in range(3))


def joint_for(material: str, centroid, boxes) -> str:
    if material in EYE_ONLY:
        return "EyeL" if centroid[0] < 0 else "EyeR"
    if material in EYE_SHARED:
        for side in ("EyeL", "EyeR"):
            if inside(centroid, boxes[side], EYE_BOX_PAD):
                return side
    return "Body"


# --------------------------------------------------------------------------- build

def build(hero: Path, web: Path) -> tuple[list[dict], dict, list[dict]]:
    hero_doc, _ = read_glb(hero)
    boxes = hero_eye_boxes(hero_doc)
    web_doc, web_blob = read_glb(web)
    batches = web_batches(web_doc, web_blob)

    ys = [p[1] for b in batches for p in b["positions"]]
    floor, top = min(ys), max(ys)
    scale = 1.0 / (top - floor)

    def norm(p):
        return (p[0] * scale, (p[1] - floor) * scale, p[2] * scale)

    eyes = {}
    for side, (lo, hi) in boxes.items():
        centre = norm([(a + b) / 2 for a, b in zip(lo, hi)])
        size = [(b - a) * scale for a, b in zip(lo, hi)]
        eyes[side] = {"centre": [round(c, 6) for c in centre], "size": [round(s, 6) for s in size]}

    pivots = {"Body": (0.0, 0.0, 0.0), "EyeL": tuple(eyes["EyeL"]["centre"]), "EyeR": tuple(eyes["EyeR"]["centre"])}

    # Split each batch into (joint, material) parts, re-indexed compactly,
    # with positions relative to the joint pivot.
    parts: dict[tuple[str, str], dict] = {}
    for b in batches:
        pos, nrm = b["positions"], b["normals"]
        for tri in b["triangles"]:
            c = [sum(pos[i][k] for i in tri) / 3 for k in range(3)]
            joint = joint_for(b["material"], c, boxes)
            part = parts.setdefault((joint, b["material"]), {"joint": joint, "material": b["material"], "map": {}, "positions": [], "normals": [], "indices": []})
            pivot = pivots[joint]
            for i in tri:
                j = part["map"].get(i)
                if j is None:
                    j = len(part["positions"])
                    part["map"][i] = j
                    q = norm(pos[i])
                    part["positions"].append(tuple(q[k] - pivot[k] for k in range(3)))
                    n = nrm[i]
                    ln = math.sqrt(sum(v * v for v in n)) or 1.0
                    part["normals"].append(tuple(v / ln for v in n))
                part["indices"].append(j)

    order = {"Body": 0, "EyeL": 1, "EyeR": 2}
    meshes = sorted(parts.values(), key=lambda p: (order[p["joint"]], p["material"]))
    for m in meshes:
        del m["map"]
        if len(m["positions"]) > 65535:
            sys.exit(f"{m['joint']}_{m['material']}: more than 65535 vertices")

    materials = {m["name"]: m for m in web_doc["materials"]}
    used = sorted({m["material"] for m in meshes}, key=lambda n: list(materials).index(n))
    mats = []
    for name in used:
        mat = json.loads(json.dumps(materials[name]))
        if name in GLOW:
            # Amber is carried by hue, not strength: a hot emissive clips to
            # pale yellow in both renderers (Aaru BRD-011). Emissive = base colour.
            mat["emissiveFactor"] = [round(v, 6) for v in mat["pbrMetallicRoughness"]["baseColorFactor"][:3]]
        mats.append(mat)

    distance = (0.5 * CAMERA_MARGIN) / math.tan(math.radians(CAMERA_FOV_DEGREES) / 2)
    rig = {
        "version": RIG_VERSION,
        "about": "Generated by tools/brand/mascot_3d.py. Do not edit; rerun the script.",
        "space": {"up": "+Y", "forward": "+Z", "unit": "mascot height", "origin": "between the soles", "sourceHeight": round(top - floor, 6)},
        "joints": {
            "Root": {"parent": None, "translation": [0, 0, 0]},
            "Mascot": {"parent": "Root", "translation": [0, 0, 0]},
            "Body": {"parent": "Mascot", "translation": [0, 0, 0]},
            "EyeL": {"parent": "Body", "translation": eyes["EyeL"]["centre"]},
            "EyeR": {"parent": "Body", "translation": eyes["EyeR"]["centre"]},
        },
        "eyes": eyes,
        "glowMaterials": [g for g in GLOW if g in used],
        "camera": {"fovDegrees": CAMERA_FOV_DEGREES, "target": [0, 0.5, 0], "distance": round(distance, 6)},
        "meshes": [f"{m['joint']}_{m['material']}" for m in meshes],
    }
    return meshes, rig, mats


# --------------------------------------------------------------------------- glb out

def pad4(b: bytearray, fill: int = 0) -> None:
    while len(b) % 4:
        b.append(fill)


def write_glb(path: Path, meshes: list[dict], rig: dict, mats: list[dict]) -> None:
    blob = bytearray()
    views, accessors, gl_meshes, nodes = [], [], [], []
    mat_index = {m["name"]: i for i, m in enumerate(mats)}

    def add_view(data: bytes, target: int, stride: int | None = None) -> int:
        pad4(blob)
        view = {"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target}
        if stride:
            view["byteStride"] = stride
        blob.extend(data)
        views.append(view)
        return len(views) - 1

    joint_nodes: dict[str, int] = {}
    for name in ("Root", "Mascot", "Body", "EyeL", "EyeR"):
        node = {"name": name, "children": []}
        t = rig["joints"][name]["translation"]
        if any(t):
            node["translation"] = t
        nodes.append(node)
        joint_nodes[name] = len(nodes) - 1
    for name, j in rig["joints"].items():
        if j["parent"]:
            nodes[joint_nodes[j["parent"]]]["children"].append(joint_nodes[name])

    for m in meshes:
        pos = m["positions"]
        lo = [min(p[k] for p in pos) for k in range(3)]
        hi = [max(p[k] for p in pos) for k in range(3)]
        centre = [(a + b) / 2 for a, b in zip(lo, hi)]
        half = max((b - a) / 2 for a, b in zip(lo, hi)) or 1.0
        q = array("h")
        for p in pos:
            for k in range(3):
                q.append(max(-32767, min(32767, round((p[k] - centre[k]) / half * 32767))))
            q.append(0)
        n = array("b")
        for v in m["normals"]:
            for k in range(3):
                n.append(max(-127, min(127, round(v[k] * 127))))
            n.append(0)
        idx = array("H", m["indices"])
        qmin = [min(q[i * 4 + k] for i in range(len(pos))) for k in range(3)]
        qmax = [max(q[i * 4 + k] for i in range(len(pos))) for k in range(3)]
        accessors.append({"bufferView": add_view(q.tobytes(), 34962, 8), "componentType": 5122, "normalized": True, "count": len(pos), "type": "VEC3", "min": qmin, "max": qmax})
        a_pos = len(accessors) - 1
        accessors.append({"bufferView": add_view(n.tobytes(), 34962, 4), "componentType": 5120, "normalized": True, "count": len(pos), "type": "VEC3"})
        a_nrm = len(accessors) - 1
        accessors.append({"bufferView": add_view(idx.tobytes(), 34963), "componentType": 5123, "count": len(idx), "type": "SCALAR"})
        a_idx = len(accessors) - 1
        name = f"{m['joint']}_{m['material']}"
        gl_meshes.append({"name": name, "primitives": [{"attributes": {"POSITION": a_pos, "NORMAL": a_nrm}, "indices": a_idx, "material": mat_index[m["material"]]}]})
        nodes.append({"name": name, "mesh": len(gl_meshes) - 1, "translation": [round(c, 7) for c in centre], "scale": [round(half / 32767, 10)] * 3})
        nodes[joint_nodes[m["joint"]]]["children"].append(len(nodes) - 1)

    for node in nodes:
        if not node.get("children"):
            node.pop("children", None)
    pad4(blob)
    doc = {
        "asset": {"version": "2.0", "generator": "loci tools/brand/mascot_3d.py"},
        "extensionsUsed": ["KHR_mesh_quantization"],
        "extensionsRequired": ["KHR_mesh_quantization"],
        "scene": 0,
        "scenes": [{"name": "Mascot", "nodes": [joint_nodes["Root"]]}],
        "nodes": nodes,
        "meshes": gl_meshes,
        "materials": mats,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(blob)}],
    }
    js = bytearray(json.dumps(doc, separators=(",", ":"), sort_keys=True).encode())
    pad4(js, 0x20)
    total = 12 + 8 + len(js) + 8 + len(blob)
    out = bytearray(struct.pack("<4sII", b"glTF", 2, total))
    out += struct.pack("<I4s", len(js), b"JSON") + js
    out += struct.pack("<I4s", len(blob), b"BIN\x00") + blob
    path.write_bytes(out)


# --------------------------------------------------------------------------- usd out

def usd_name(s: str) -> str:
    return "".join(c if c.isalnum() or c == "_" else "_" for c in s)


def fmt(v: float) -> str:
    s = f"{v:.6g}"
    return "0" if s == "-0" else s


def write_usda(path: Path, meshes: list[dict], rig: dict, mats: list[dict]) -> None:
    lines = ['#usda 1.0', '(', '    defaultPrim = "Root"', '    metersPerUnit = 1', '    upAxis = "Y"', ')', '']
    by_joint: dict[str, list[dict]] = {}
    for m in meshes:
        by_joint.setdefault(m["joint"], []).append(m)
    children = {name: [c for c, j in rig["joints"].items() if j["parent"] == name] for name in rig["joints"]}

    def material_block(ind: str) -> None:
        lines.append(f'{ind}def Scope "Materials"')
        lines.append(f"{ind}{{")
        for mat in mats:
            pbr = mat["pbrMetallicRoughness"]
            c = pbr["baseColorFactor"]
            e = mat.get("emissiveFactor", [0, 0, 0])
            n = usd_name(mat["name"])
            i2, i3 = ind + "    ", ind + "        "
            lines.extend([
                f'{i2}def Material "{n}"',
                f"{i2}{{",
                f"{i3}token outputs:surface.connect = </Root/Materials/{n}/Surface.outputs:surface>",
                f'{i3}def Shader "Surface"',
                f"{i3}{{",
                f'{i3}    uniform token info:id = "UsdPreviewSurface"',
                f"{i3}    color3f inputs:diffuseColor = ({fmt(c[0])}, {fmt(c[1])}, {fmt(c[2])})",
                f"{i3}    color3f inputs:emissiveColor = ({fmt(e[0])}, {fmt(e[1])}, {fmt(e[2])})",
                f"{i3}    float inputs:metallic = {fmt(pbr.get('metallicFactor', 1))}",
                f"{i3}    float inputs:roughness = {fmt(pbr.get('roughnessFactor', 1))}",
                f"{i3}    float inputs:opacity = {fmt(c[3])}",
                f"{i3}    token outputs:surface",
                f"{i3}}}",
                f"{i2}}}",
            ])
        lines.append(f"{ind}}}")

    def mesh_block(m: dict, ind: str) -> None:
        name = f"{m['joint']}_{m['material']}"
        pts = ", ".join(f"({fmt(p[0])}, {fmt(p[1])}, {fmt(p[2])})" for p in m["positions"])
        nrm = ", ".join(f"({fmt(n[0])}, {fmt(n[1])}, {fmt(n[2])})" for n in m["normals"])
        idx = ", ".join(str(i) for i in m["indices"])
        cnt = ", ".join("3" for _ in range(len(m["indices"]) // 3))
        i2 = ind + "    "
        lines.extend([
            f'{ind}def Mesh "{name}" (prepend apiSchemas = ["MaterialBindingAPI"])',
            f"{ind}{{",
            f"{i2}int[] faceVertexCounts = [{cnt}]",
            f"{i2}int[] faceVertexIndices = [{idx}]",
            f"{i2}point3f[] points = [{pts}]",
            f'{i2}normal3f[] normals = [{nrm}] (interpolation = "vertex")',
            f'{i2}uniform token subdivisionScheme = "none"',
            f"{i2}rel material:binding = </Root/Materials/{usd_name(m['material'])}>",
            f"{ind}}}",
        ])

    def xform(name: str, ind: str) -> None:
        t = rig["joints"][name]["translation"]
        lines.append(f'{ind}def Xform "{name}"')
        lines.append(f"{ind}{{")
        i2 = ind + "    "
        if any(t):
            lines.append(f"{i2}double3 xformOp:translate = ({fmt(t[0])}, {fmt(t[1])}, {fmt(t[2])})")
            lines.append(f'{i2}uniform token[] xformOpOrder = ["xformOp:translate"]')
        if name == "Root":
            material_block(i2)
        for m in by_joint.get(name, []):
            mesh_block(m, i2)
        for c in children[name]:
            xform(c, i2)
        lines.append(f"{ind}}}")

    xform("Root", "")
    path.write_text("\n".join(lines) + "\n")


def write_usdz(out: Path, meshes, rig, mats) -> str:
    usda = out / "Mascot.usda"
    write_usda(usda, meshes, rig, mats)
    usdcat, usdzip = shutil.which("usdcat", path="/usr/bin"), shutil.which("usdzip", path="/usr/bin")
    if not (usdcat and usdzip):
        return f"kept {usda.name} (no /usr/bin/usdcat or usdzip)"
    usdc = out / "Mascot.usdc"
    usdz = out / "Mascot.usdz"
    usdz.unlink(missing_ok=True)
    subprocess.run([usdcat, str(usda), "-o", str(usdc)], check=True)
    subprocess.run([usdzip, usdz.name, usdc.name], check=True, cwd=out, capture_output=True)
    usdc.unlink()
    return f"{usdz.name} {usdz.stat().st_size / 1024:.0f} KB"


# --------------------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hero", required=True, type=Path, help="Loci_Solid_Sculpt_Hero.glb (named parts)")
    ap.add_argument("--web", required=True, type=Path, help="Loci_Solid_Web.glb (decimated, batched by material)")
    ap.add_argument("--out", type=Path, default=Path("tools/brand/out/mascot-3d"))
    args = ap.parse_args()

    meshes, rig, mats = build(args.hero.resolve(), args.web.resolve())
    args.out.mkdir(parents=True, exist_ok=True)
    glb = args.out / "mascot.glb"
    write_glb(glb, meshes, rig, mats)
    (args.out / "mascot-rig.json").write_text(json.dumps(rig, indent=2, sort_keys=False) + "\n")
    usdz = write_usdz(args.out, meshes, rig, mats)

    tris = sum(len(m["indices"]) // 3 for m in meshes)
    verts = sum(len(m["positions"]) for m in meshes)
    print(f"mascot.glb       {glb.stat().st_size / 1024:.0f} KB  draw calls {len(meshes)}  triangles {tris}  vertices {verts}")
    print(f"Mascot.usdz      {usdz}")
    for joint in ("Body", "EyeL", "EyeR"):
        js = [m for m in meshes if m["joint"] == joint]
        print(f"  {joint:<5} meshes {len(js):>2}  triangles {sum(len(m['indices']) // 3 for m in js):>6}  " + ", ".join(m["material"] for m in js))
    print(f"eyes             L {rig['eyes']['EyeL']['centre']}  R {rig['eyes']['EyeR']['centre']}")


if __name__ == "__main__":
    main()
