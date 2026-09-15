import { projectEffectiveReceptionItem } from './receptionItemRealCorrectionProjection.js';
export function projectEffectiveReceptionItems({receptionItems=[],corrections=[]}={}){return receptionItems.map((item)=>projectEffectiveReceptionItem({receptionItem:item,corrections}));}
export const getEffectiveReceptionItemsForReception=({reception,corrections=[]}={})=>projectEffectiveReceptionItems({receptionItems:reception?.items||[],corrections});
export const getEffectiveReceptionItemByPurchaseItemId=({reception,corrections=[],purchaseItemId}={})=>getEffectiveReceptionItemsForReception({reception,corrections}).find((item)=>item.purchaseItemId===purchaseItemId)||null;
