# MediaPipe runtime assets

These files are served locally so the camera mode does not fetch a moving CDN version at runtime.

- `pose_landmarker_lite.task`: Google MediaPipe Pose Landmarker Lite, float16, model version `1`, from `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`. SHA-256: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
- `wasm/vision_wasm_module_internal.js` and `.wasm`: copied from the installed `@mediapipe/tasks-vision` package version `1.0.1` (`node_modules/@mediapipe/tasks-vision/wasm/`). SHA-256: `da8934057f147b622e82cfb4c0dbd85461c598e268588b5a8ba9ca963a8ff82d` and `2dabd8e23c60984628beb7bb338764c81a08e6837145273f59578684b5d53c1b`.

The worker selects the module WASM loader. When upgrading the package, replace both WASM files together and update these hashes; check the model independently when changing it.

## Mobile / DOM fallback

The main-thread detector uses an explicit HTML canvas and classic WASM loader. Matching @mediapipe/tasks-vision 1.0.1 classic SIMD and non-SIMD files are shipped locally; the worker keeps its existing module pair. SHA-256:

- `vision_wasm_internal.js`: `e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73`
- `vision_wasm_internal.wasm`: `8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886`
- `vision_wasm_nosimd_internal.js`: `e81d715a3d42cc3373602eb2f7aff795d164934db680e32496b65dab537f9658`
- `vision_wasm_nosimd_internal.wasm`: `a28483cd42e74e855bf5ebdb6b40d9b66a5b49e35e95020bc97669e6822a3192`
