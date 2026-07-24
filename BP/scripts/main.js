import "./DoriosCore/index.js";
import * as DoriosLib from "./DoriosLib/index.js";
import "./machinery/main.js";
import "./config/main.js";

DoriosLib.registry.install();
DoriosLib.container.initialize();
