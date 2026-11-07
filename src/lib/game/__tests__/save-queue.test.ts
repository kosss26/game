import { SaveQueue } from '../save-queue';

test('retains failed checkpoint and retries without losing newer state', async () => {
  let succeed = false;
  const write = jest.fn(async (_v: number) => succeed);
  const status = jest.fn();
  const q = new SaveQueue(write, status);
  q.push(1);
  await new Promise(r => setTimeout(r, 0));
  expect(status).toHaveBeenLastCalledWith(false);
  succeed = true;
  q.push(2);
  await new Promise(r => setTimeout(r, 0));
  expect(write.mock.calls.map(c => c[0])).toEqual([1, 2]);
  expect(status).toHaveBeenLastCalledWith(true);
});

test('serializes writes and drains the newest checkpoint after an in-flight request', async () => {
  let release!: (v: boolean) => void;
  const write = jest.fn((v: number) => v === 1 ? new Promise<boolean>(r => { release = r; }) : Promise.resolve(true));
  const q = new SaveQueue(write, jest.fn());
  q.push(1); q.push(2); q.push(3);
  expect(write).toHaveBeenCalledTimes(1);
  release(true);
  await new Promise(r => setTimeout(r, 0));
  expect(write.mock.calls.map(c => c[0])).toEqual([1, 3]);
});
