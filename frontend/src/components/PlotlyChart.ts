import Plotly from "plotly.js-dist-min";
import factoryModule from "react-plotly.js/factory.js";

const createPlotlyComponent =
  typeof factoryModule === "function" ? factoryModule : factoryModule.default;
export const Plot = createPlotlyComponent(Plotly);
