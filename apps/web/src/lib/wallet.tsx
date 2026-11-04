import { useQueryClient } from "@tanstack/react-query";
import { useNearWallet } from "near-connect-hooks";
import { useCallback, useState } from "react";

import { useToast } from "../components/Toast";
import type { ContractCall } from "@nolossmeme/sdk";

export interface TxState {
  pending: boolean;
  error: string | null;
}

/** Sign a `ContractCall` from the SDK, toast the outcome and refresh queries. */
export function useTx() {
  const { signAndSendTransaction, signedAccountId, signIn } = useNearWallet();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [state, setState] = useState<TxState>({ pending: false, error: null });

  const send = useCallback(
    async (call: ContractCall, label: string): Promise<boolean> => {
      if (!signedAccountId) {
        await signIn();
        return false;
      }
      setState({ pending: true, error: null });
      try {
        await signAndSendTransaction({ receiverId: call.receiverId, actions: call.actions });
        toast.show({ kind: "success", text: `${label} confirmed` });
        setState({ pending: false, error: null });
        await queryClient.invalidateQueries();
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.show({ kind: "error", text: `${label} failed: ${message.slice(0, 140)}` });
        setState({ pending: false, error: message });
        return false;
      }
    },
    [signAndSendTransaction, signedAccountId, signIn, queryClient, toast],
  );

  return { send, ...state, signedAccountId };
}
