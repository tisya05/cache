import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  incomeTotal(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  spendTotal(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  currentSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  periodId(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  previousBalance(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  previousBalanceSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  newSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  register(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  updateTotals(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  proveSavings(context: __compactRuntime.CircuitContext<PS>, tier_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
  build(context: __compactRuntime.CircuitContext<PS>, kind_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type ProvableCircuits<PS> = {
  register(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  updateTotals(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  proveSavings(context: __compactRuntime.CircuitContext<PS>, tier_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
  build(context: __compactRuntime.CircuitContext<PS>, kind_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type PureCircuits = {
  maxTier(): bigint;
  maxBuildingKind(): bigint;
}

export type Circuits<PS> = {
  maxTier(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
  maxBuildingKind(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
  register(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  updateTotals(context: __compactRuntime.CircuitContext<PS>,
               commitment_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  proveSavings(context: __compactRuntime.CircuitContext<PS>, tier_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
  build(context: __compactRuntime.CircuitContext<PS>, kind_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type Ledger = {
  commitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  tiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  blocks: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  savingsBalance: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
