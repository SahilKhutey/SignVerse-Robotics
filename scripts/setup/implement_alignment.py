import os
import shutil
import json

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. TypeScript & Config Foundation
write_file("tsconfig.base.json", json.dumps({
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": True,
    "skipLibCheck": True,
    "resolveJsonModule": True,
    "allowSyntheticDefaultImports": True,
    "esModuleInterop": True,
    "baseUrl": ".",
    "paths": {
      "@signverse/ui/*": ["packages/ui/src/*"],
      "@signverse/types/*": ["packages/types/src/*"],
      "@signverse/state/*": ["packages/state/src/*"],
      "@signverse/api-contracts/*": ["packages/api-contracts/src/*"],
      "@signverse/config/*": ["packages/config/src/*"],
      "@signverse/sdk/*": ["sdk/core/src/*"]
    }
  }
}, indent=2))

write_file("packages/config/package.json", json.dumps({
  "name": "@signverse/config",
  "version": "0.0.0",
  "private": True
}, indent=2))

# 2. SDK & State Extraction
# Move ai-sdk to sdk/core
ai_sdk_src = os.path.join(base_dir, "packages/ai-sdk")
sdk_core_dest = os.path.join(base_dir, "sdk/core")
if os.path.exists(ai_sdk_src):
    shutil.copytree(ai_sdk_src, sdk_core_dest, dirs_exist_ok=True)
    shutil.rmtree(ai_sdk_src)
    
    # Update package.json name
    with open(os.path.join(sdk_core_dest, "package.json"), "r") as f:
        pkg = json.load(f)
    pkg["name"] = "@signverse/sdk"
    write_file("sdk/core/package.json", json.dumps(pkg, indent=2))

# Extract state out of UI
write_file("packages/state/package.json", json.dumps({
  "name": "@signverse/state",
  "version": "0.0.0",
  "main": "./index.ts",
  "types": "./index.ts",
  "dependencies": {
    "zustand": "^4.5.2"
  }
}, indent=2))

ui_store_src = os.path.join(base_dir, "packages/ui/store/layoutStore.ts")
if os.path.exists(ui_store_src):
    with open(ui_store_src, "r") as f:
        store_content = f.read()
    write_file("packages/state/index.ts", store_content)
    os.remove(ui_store_src)
    
    # Update UI Layout to point to state package
    layout_path = os.path.join(base_dir, "packages/ui/layout/DashboardLayout.tsx")
    with open(layout_path, "r") as f:
        layout_content = f.read()
    layout_content = layout_content.replace("'../store/layoutStore'", "'@signverse/state'")
    write_file("packages/ui/layout/DashboardLayout.tsx", layout_content)
    
    # Remove store export from UI index
    ui_index_path = os.path.join(base_dir, "packages/ui/index.tsx")
    with open(ui_index_path, "r") as f:
        ui_index_content = f.read()
    ui_index_content = ui_index_content.replace("export * from './store/layoutStore';\n", "")
    write_file("packages/ui/index.tsx", ui_index_content)
else:
    # Fallback if somehow not found
    write_file("packages/state/index.ts", "// Export zustand stores here")

# 3. API Contracts
write_file("packages/api-contracts/package.json", json.dumps({
  "name": "@signverse/api-contracts",
  "version": "0.0.0",
  "main": "./index.ts",
  "types": "./index.ts",
  "dependencies": {
    "zod": "^3.22.4"
  }
}, indent=2))

write_file("packages/api-contracts/index.ts", """import { z } from "zod";

export const TelemetrySchema = z.object({
  robotId: z.string(),
  batteryLevel: z.number(),
  cpuUsage: z.number(),
  gpuUsage: z.number(),
  temperature: z.number(),
  timestamp: z.number()
});

export type TelemetryPacket = z.infer<typeof TelemetrySchema>;
""")

# 4. Engine Realignment
os.makedirs(os.path.join(base_dir, "engines/sign-engine"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "engines/pose-engine"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "engines/scene-engine"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "engines/tracking-engine"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "engines/workflow-engine"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "engines/avatar-engine"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "engines/planning-engine"), exist_ok=True)

# Update App dependencies to reflect new SDK and State
dashboard_pkg_path = os.path.join(base_dir, "apps/dashboard-web/package.json")
if os.path.exists(dashboard_pkg_path):
    with open(dashboard_pkg_path, "r") as f:
        pkg = json.load(f)
    if "@signverse/ai-sdk" in pkg["dependencies"]:
        del pkg["dependencies"]["@signverse/ai-sdk"]
    pkg["dependencies"]["@signverse/sdk"] = "workspace:*"
    pkg["dependencies"]["@signverse/state"] = "workspace:*"
    pkg["dependencies"]["@signverse/api-contracts"] = "workspace:*"
    write_file("apps/dashboard-web/package.json", json.dumps(pkg, indent=2))
    
    app_tsx_path = os.path.join(base_dir, "apps/dashboard-web/src/App.tsx")
    with open(app_tsx_path, "r") as f:
        app_content = f.read()
    app_content = app_content.replace("'@signverse/ai-sdk'", "'@signverse/sdk'")
    write_file("apps/dashboard-web/src/App.tsx", app_content)

# Fix pnpm-workspace to include sdk
write_file("pnpm-workspace.yaml", """packages:
  - "apps/*"
  - "services/*"
  - "engines/*"
  - "packages/*"
  - "sdk/*"
""")

print("Phase 1 Alignment Architecture Modules implemented.")
