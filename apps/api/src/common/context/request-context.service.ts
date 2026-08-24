import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestStore {
  userId: string | null;
  system: boolean;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestStore>();

  run<T>(callback: () => T): T {
    return this.storage.run({ userId: null, system: false }, callback);
  }

  // Фонові задачі виконуються без користувача. Без явного контексту політики
  // повернули б їм порожні вибірки, тому вони мусять оголосити себе системними.
  runAsSystem<T>(callback: () => T): T {
    return this.storage.run({ userId: null, system: true }, callback);
  }

  setUserId(userId: string): void {
    const store = this.storage.getStore();
    if (store) {
      store.userId = userId;
    }
  }

  get userId(): string | null {
    return this.storage.getStore()?.userId ?? null;
  }

  get isSystem(): boolean {
    return this.storage.getStore()?.system ?? false;
  }
}
