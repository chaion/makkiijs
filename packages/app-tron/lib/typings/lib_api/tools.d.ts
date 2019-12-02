declare const formatAddress1Line: (address: any) => string;
declare function validateBalanceSufficiency(account: any, amount: any): Promise<unknown>;
declare function sameAddress(address1: any, address2: any): boolean;
export { formatAddress1Line, validateBalanceSufficiency, sameAddress };