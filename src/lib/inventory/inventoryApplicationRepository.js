const METHODS = [
  'listMovements', 'getMovement', 'create', 'updateAllowedMetadata',
  'reverseMovement', 'createTransfer', 'syncPendingOperations',
  'getPendingOperations', 'subscribeToChanges', 'remove',
];

export function createInventoryApplicationRepository({ syncEngine } = {}) {
  const valid = METHODS.every((method) => typeof syncEngine?.[method] === 'function');
  const call = (method, ...args) => valid
    ? syncEngine[method](...args)
    : { data: null, error: { code: 'INVENTORY_APPLICATION_INVALID', message: 'Composición de Inventario inválida.' } };
  return Object.freeze({
    listMovements: (...args) => call('listMovements', ...args),
    getMovement: (...args) => call('getMovement', ...args),
    create: (...args) => call('create', ...args),
    update: (...args) => call('updateAllowedMetadata', ...args),
    updateAllowedMetadata: (...args) => call('updateAllowedMetadata', ...args),
    reverseMovement: (...args) => call('reverseMovement', ...args),
    createTransfer: (...args) => call('createTransfer', ...args),
    remove: (...args) => call('remove', ...args),
    syncPendingOperations: (...args) => call('syncPendingOperations', ...args),
    getPendingOperations: (...args) => call('getPendingOperations', ...args),
    subscribeToChanges: (...args) => call('subscribeToChanges', ...args),
  });
}
