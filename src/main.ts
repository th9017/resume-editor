import { createApp } from "vue";
import App from "./App.vue";
import { resolveTheme } from "./core/theme";
import "./style.css";
import "./core/render/styles/screen.css";

// 首帧前先按系统偏好定外壳配色，避免深色用户看到白闪
document.documentElement.dataset.theme = resolveTheme(
  "system",
  matchMedia("(prefers-color-scheme: dark)").matches
);

createApp(App).mount("#app");