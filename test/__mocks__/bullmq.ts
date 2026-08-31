/** Stub ESM de bullmq para Jest e2e (sin Redis). */
export class Queue {
  add = jest.fn().mockResolvedValue({ id: 'mock-job-id' });
}

export class Worker {
  close = jest.fn().mockResolvedValue(undefined);
}

export class Job<T = unknown> {
  data: T;
  id?: string;

  constructor(data: T, id = 'mock-job-id') {
    this.data = data;
    this.id = id;
  }
}
