export type AccountIdentity = {
  clear(): void;
  identity: {
    senderKey(): string;
  };
  setUserId(userId: number | string): void;
};

export function createAccountIdentity(): AccountIdentity {
  let senderKey: string | undefined;

  return {
    clear() {
      senderKey = undefined;
    },
    identity: {
      senderKey() {
        if (senderKey === undefined) {
          throw new Error('Current account identity is not ready');
        }
        return senderKey;
      }
    },
    setUserId(userId: number | string) {
      senderKey = `user:${String(userId)}`;
    }
  };
}
