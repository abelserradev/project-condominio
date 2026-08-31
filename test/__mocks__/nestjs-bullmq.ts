import { DynamicModule, Inject } from '@nestjs/common';

/** Mock de cola para e2e: no requiere Redis ni worker BullMQ real. */
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
};

export class WorkerHost {}

export function Processor(): ClassDecorator {
  return () => {};
}

export function getQueueToken(name: string): string {
  return `BullQueue_${name}`;
}

export function InjectQueue(name?: string): ParameterDecorator {
  return Inject(getQueueToken(name ?? 'default'));
}

export const BullModule = {
  registerQueue(config?: { name?: string }): DynamicModule {
    const queueName = config?.name ?? 'default';
    const token = getQueueToken(queueName);
    return {
      module: class BullModuleMock {},
      providers: [{ provide: token, useValue: mockQueue }],
      exports: [token],
    };
  },
};

export { mockQueue };
