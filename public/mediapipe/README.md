# MediaPipe runtime assets

These files are served locally so the camera mode does not fetch a moving CDN version at runtime.

- `pose_landmarker_lite.task`: Google MediaPipe Pose Landmarker Lite, float16, model version `1`, from `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`. SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- `wasm/vision_wasm_module_internal.js` and `.wasm`: copied from the installed `@mediapipe/tasks-vision` package version `1.0.1` (`node_modules/@mediapipe/tasks-vision/wasm/`). SHA-256: `da8934057f147b622e82cfb4c0dbd85461c598e268588b5a8ba9ca963a8ff82d` and `2dabd8e23c60984628beb7bb338764c81a08e6837145273f59578684b5d53c1b`.

The worker selects the module WASM loader. When upgrading the package, replace both WASM files together and update these hashes; check the model independently when changing it.
