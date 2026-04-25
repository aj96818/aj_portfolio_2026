import { appConfig } from "../config/appConfig";
import { staticStockDataClient } from "./staticStockDataClient";
import type { StockDataClient } from "./stockDataClient";

export function getStockDataClient(): StockDataClient {
  switch (appConfig.dataSource) {
    case "static_json":
      return staticStockDataClient;
    default:
      throw new Error(`Data source "${appConfig.dataSource}" is not implemented in this build.`);
  }
}

export const stockDataClient = getStockDataClient();
