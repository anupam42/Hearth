import { mount } from "./core/dom.js";
import { App } from "./pages/app.js";

const root = document.getElementById("app-root");
if (!root) throw new Error("missing #app-root element");
mount(root, App());
