import {
  createPendingOperationsRepository,
} from '../optimization-sessions/pendingOperationsRepository.js';

export const ReceptionPendingOperationsRepository =
  createPendingOperationsRepository({
    storagePrefix: 'aluxor.receptionPendingOperations',
  });
