import { Contract, xdr } from "@stellar/stellar-sdk";

function toOperation(op: ReturnType<Contract['call']>): xdr.Operation {
  return op as unknown as xdr.Operation;
}
