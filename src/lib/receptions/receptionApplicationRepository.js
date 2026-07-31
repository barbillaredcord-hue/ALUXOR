const METHODS = [
  'createReception',
  'updateReception',
  'deleteReception',
  'getReceptionById',
  'listByWorkspace',
  'listByPurchase',
  'listByPurchaseItem',
  'createReceptionItem',
  'updateReceptionItem',
  'listReceptionItems',
  'syncPendingOperations',
  'getPendingOperations',
  'subscribeToChanges',
];

export function createReceptionApplicationRepository({ syncEngine } = {}) {
  const valid = METHODS.every((method) => (
    typeof syncEngine?.[method] === 'function'
  ));
  const delegate = (method, ...args) => (
    valid
      ? syncEngine[method](...args)
      : {
        data: null,
        error: {
          code: 'RECEPTION_APPLICATION_REPOSITORY_INVALID',
          message: 'El Sync Engine de Recepción es inválido.',
        },
      }
  );
  return Object.freeze(Object.fromEntries(METHODS.map((method) => [
    method,
    (...args) => delegate(method, ...args),
  ])));
}
