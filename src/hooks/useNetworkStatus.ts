import { useState } from "react";
import { NETWORK_STATUS_ITEMS } from "@/constants/networkStatus";

export function useNetworkStatus() {
  const [statuses] = useState(NETWORK_STATUS_ITEMS);

  return { statuses };
}
