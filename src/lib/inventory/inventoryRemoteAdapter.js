import {
  inventoryMovementFromRemoteRow,
  inventoryMovementToRemoteRow,
  validateInventoryRemoteRow,
} from './inventoryAdapter.js';

export const inventoryMovementToRemote = inventoryMovementToRemoteRow;
export const inventoryMovementFromRemote = inventoryMovementFromRemoteRow;
export const validateRemoteInventoryMovement = validateInventoryRemoteRow;
