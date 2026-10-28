import urllib.request
import json
import base64
import os
import shutil

img_dir = r"e:\my tech\optifilter\docs\images"
os.makedirs(img_dir, exist_ok=True)

def save_b64(b64_str, filename):
    if not b64_str:
        return
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    filepath = os.path.join(img_dir, filename)
    with open(filepath, "wb") as f:
        f.write(base64.b64decode(b64_str))
    print(f"Saved: {filename} ({os.path.getsize(filepath)} bytes)")

boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

def make_multipart(fields):
    lines = []
    for k, v in fields.items():
        lines.append(f"--{boundary}".encode())
        lines.append(f'Content-Disposition: form-data; name="{k}"\r\n'.encode())
        lines.append(f"{v}".encode())
    lines.append(f"--{boundary}--\r\n".encode())
    return b"\r\n".join(lines)

# 1. Fetch Track A
print("Fetching Track A...")
body_a = make_multipart({"dataset_name": "DRIVE", "item_id": "drive_training_23"})
req_a = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/analysis/vessels",
    data=body_a,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)
try:
    with urllib.request.urlopen(req_a) as resp:
        data_a = json.loads(resp.read().decode("utf-8"))
        inter_a = data_a.get("intermediate_images", {})
        for k, v in inter_a.items():
            save_b64(v, f"track_a_{k}.png")
        save_b64(data_a.get("overlay_image"), "track_a_overlay.png")
        save_b64(data_a.get("mask_image"), "track_a_mask.png")
except Exception as e:
    print("Track A error:", e)

# 2. Fetch Track B
print("Fetching Track B...")
body_b = make_multipart({"dataset_name": "Drishti-GS", "item_id": "drishti_test_drishtiGS_006"})
req_b = urllib.request.Request(
    "http://127.0.0.1:8000/api/v1/analysis/disc-cup",
    data=body_b,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
)
try:
    with urllib.request.urlopen(req_b) as resp:
        data_b = json.loads(resp.read().decode("utf-8"))
        inter_b = data_b.get("intermediate_images", {})
        for k, v in inter_b.items():
            save_b64(v, f"track_b_{k}.png")
        save_b64(data_b.get("overlay_image"), "track_b_overlay.png")
        save_b64(data_b.get("disc_mask_image"), "track_b_disc_mask.png")
        save_b64(data_b.get("cup_mask_image"), "track_b_cup_mask.png")
except Exception as e:
    print("Track B error:", e)

# 3. Copy direct visual overlays from backend research outputs
src_failure = r"e:\my tech\optifilter\backend\research_outputs\failure_analysis"
if os.path.exists(src_failure):
    for f in os.listdir(src_failure):
        if f.startswith("vessel_overlay_") or f.startswith("disc_cup_overlay_") or f.startswith("diagnostic_overlay_"):
            shutil.copy2(os.path.join(src_failure, f), os.path.join(img_dir, f))
    print("Copied diagnostic failure and validation overlays into docs/images!")

print("All pipeline images successfully generated and organized in docs/images!")
