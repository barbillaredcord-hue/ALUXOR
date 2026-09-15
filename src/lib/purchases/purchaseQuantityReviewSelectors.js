import { getActiveReceptionItemCorrections, projectEffectiveReceptionItem } from '../receptions/receptionItemRealCorrectionProjection.js';

const active = new Set(['pending', 'approved', 'requires_reception_action', 'ready_for_final_approval', 'correction_authorized']);
const blocking = new Set(['pending', 'requires_reception_action']);
const physicalActionStatuses = new Set(['requires_reception_action', 'correction_authorized']);
const administrativePendingStatuses = new Set(['pending', 'approved', 'ready_for_final_approval']);
const cancelableStatuses = new Set(['pending', 'approved', 'requires_reception_action', 'ready_for_final_approval', 'correction_authorized']);
const number = (value) => Number(value) || 0;

export function isPurchaseQuantityReviewPhysicalActionPending(review, {
  workspaceId,
  receptions = [],
  corrections = [],
} = {}) {
  if (!review || !physicalActionStatuses.has(review.status)) return false;
  if (!review.receptionId || !review.purchaseId || !review.purchaseItemId) return false;
  if (workspaceId && review.workspaceId !== workspaceId) return false;
  const reception = receptions.find((candidate) => candidate.id === review.receptionId
    && candidate.workspaceId === review.workspaceId
    && candidate.purchaseId === review.purchaseId
    && !candidate.revertedAt);
  if (!reception) return false;
  const items = (reception.items || []).filter((item) => (
    item.workspaceId === review.workspaceId
    && item.receptionId === reception.id
    && item.purchaseId === review.purchaseId
    && item.purchaseItemId === review.purchaseItemId
    && (!review.receptionItemId || item.id === review.receptionItemId)
  ));
  if (items.length !== 1) return false;
  const effectiveItem = projectEffectiveReceptionItem({ receptionItem: items[0], corrections });
  return number(effectiveItem.acceptedQuantity) > number(review.requestedPurchasedQuantity);
}

export const getReceptionReviewVisualState = ({ reviewRequests = [], workspaceId, purchaseId, purchaseItemId, receptionId, receptions = [], corrections = [] } = {}) => {
  const activeReview = reviewRequests.find((review) => (
    review.purchaseId === purchaseId
      && (!receptionId || !review.receptionId || review.receptionId === receptionId)
      && (!purchaseItemId || review.purchaseItemId === purchaseItemId)
      && isPurchaseQuantityReviewPhysicalActionPending(review, { workspaceId, receptions, corrections })
  )) || null;
  return Object.freeze({ hasActiveReview: Boolean(activeReview), activeReview, requiresPhysicalAction: activeReview?.status === 'requires_reception_action', visualState: activeReview ? 'blocked' : 'normal' });
};

export const selectPendingPurchaseQuantityReviews = (requests = []) => requests.filter((review) => review.status === 'pending');
export function selectOperationalPhysicalPurchaseQuantityReviews(requests = [], context = {}) {
  const current = requests.filter((review) => isPurchaseQuantityReviewPhysicalActionPending(review, context));
  const groups = new Map();
  current.forEach((review) => {
    const key = [review.workspaceId, review.purchaseId, review.purchaseItemId, review.receptionId].join(':');
    const existing = groups.get(key);
    const rank = review.status === 'correction_authorized' ? 2 : 1;
    const existingRank = existing?.status === 'correction_authorized' ? 2 : 1;
    const updated = Date.parse(review.updatedAt || review.requestedAt || '') || 0;
    const existingUpdated = Date.parse(existing?.updatedAt || existing?.requestedAt || '') || 0;
    if (!existing || rank > existingRank || (rank === existingRank && (Number(review.version) > Number(existing.version) || (Number(review.version) === Number(existing.version) && updated > existingUpdated)))) groups.set(key, review);
  });
  return [...groups.values()];
}
export const selectOwnerPurchaseQuantityReviewInbox = (requests = [], role = '', context = null) => {
  if (!['owner', 'admin'].includes(role)) return [];
  if (!context) return requests.filter((review) => active.has(review.status));
  const administrative = requests.filter((review) => administrativePendingStatuses.has(review.status));
  return [...administrative, ...selectOperationalPhysicalPurchaseQuantityReviews(requests, context)];
};
export const selectReceptionPurchaseQuantityReviewInbox = (requests = [], context = null) => (
  context ? requests.filter((review) => isPurchaseQuantityReviewPhysicalActionPending(review, context)) : requests.filter((review) => physicalActionStatuses.has(review.status))
);
export const selectPurchaseItemReviewState = (requests = [], purchaseItemId) => requests.find((review) => review.purchaseItemId === purchaseItemId && blocking.has(review.status)) || null;
export const selectPurchaseQuantityReviewNotifications = (requests = [], role = '') => (['owner', 'admin'].includes(role) ? selectOwnerPurchaseQuantityReviewInbox(requests, role) : selectReceptionPurchaseQuantityReviewInbox(requests)).map((review) => ({ id: review.id, status: review.status, label: `Revisión de compra: ${review.status}` }));
export const selectPurchaseQuantityReviewHistory = (requests = [], purchaseItemId) => requests.filter((review) => review.purchaseItemId === purchaseItemId).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
export const selectCancelledPurchaseQuantityReviewHistory = (requests = []) => requests.filter((review) => review.status === 'cancelled').sort((left, right) => Date.parse(right.cancelledAt || right.updatedAt) - Date.parse(left.cancelledAt || left.updatedAt));
export const canCancelPurchaseQuantityReview = (review, corrections = []) => Boolean(review && cancelableStatuses.has(review.status) && !getActiveReceptionItemCorrections(corrections).some((correction) => correction.reviewRequestId === review.id));
export const getPurchaseQuantityReviewStage = (review, acceptedQuantity = review?.currentAcceptedQuantity) => {
  if (!review) return 'none';
  if (review.status === 'correction_authorized') return 'correction_authorized';
  if (review.status === 'requires_reception_action' && number(acceptedQuantity) <= number(review.requestedPurchasedQuantity)) return 'ready_for_final_approval';
  return review.status;
};
export const getAuthorizedPurchaseCorrection = ({ reviews = [], workspaceId, purchaseId, purchaseItemId, currentVersion, acceptedQuantity } = {}) => reviews.find((review) => review.status === 'correction_authorized' && review.workspaceId === workspaceId && review.purchaseId === purchaseId && review.purchaseItemId === purchaseItemId && number(review.authorizedPurchaseItemVersion) === number(currentVersion) && number(acceptedQuantity) <= number(review.requestedPurchasedQuantity)) || null;
export const getAuthorizedReceptionPhysicalCorrection = ({ reviews = [], workspaceId, purchaseId, purchaseItemId, receptionId, currentVersion } = {}) => reviews.find((review) => review.status === 'correction_authorized' && review.workspaceId === workspaceId && review.purchaseId === purchaseId && review.purchaseItemId === purchaseItemId && review.receptionId === receptionId && number(review.authorizedPurchaseItemVersion) === number(currentVersion)) || null;
export const canAuthorizePurchaseCorrection = (review, acceptedQuantity) => getPurchaseQuantityReviewStage(review, acceptedQuantity) === 'ready_for_final_approval';
export const canApplyAuthorizedPurchaseCorrection = ({ authorization, nextPurchasedQuantity, currentVersion, acceptedQuantity } = {}) => Boolean(authorization) && number(authorization.authorizedPurchaseItemVersion) === number(currentVersion) && number(acceptedQuantity) <= number(authorization.requestedPurchasedQuantity) && number(nextPurchasedQuantity) === number(authorization.requestedPurchasedQuantity);
